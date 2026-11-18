-- Шаг 3а. ИИ: учёт запросов и затрат, лимиты на людей, выбор модели.
-- Выполнить один раз: Supabase → SQL Editor → New query → вставить весь текст → Run. Повторный запуск безопасен.
-- Сами запросы к ИИ делает серверная функция `ai` (supabase/functions/ai), она же записывает затраты.

-- Общие настройки ИИ.
alter table public.app_settings add column if not exists ai_model           text          not null default 'gpt-6.2-sol';
alter table public.app_settings add column if not exists daily_limit        int           not null default 20;
alter table public.app_settings add column if not exists monthly_usd        numeric(10,2) not null default 1.00;
alter table public.app_settings add column if not exists global_monthly_usd numeric(10,2) not null default 10.00;

-- Личные лимиты (пусто = общий лимит). У владельца лимитов нет.
alter table public.profiles add column if not exists daily_limit int;
alter table public.profiles add column if not exists monthly_usd numeric(10,2);
alter table public.profiles add column if not exists unlimited   boolean not null default false;
update public.profiles set unlimited = true
 where user_id = (select owner_id from public.app_settings where id = 1);

-- Журнал запросов к ИИ: кто, что, какая модель, сколько стоило. Без текста запросов.
create table if not exists public.usage (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users(id) on delete set null,
  app        text,
  kind       text,            -- pick (подбор), quick (быстро добавить), taste (мой вкус), test (проверка модели)
  model      text,
  in_tokens  int  not null default 0,
  out_tokens int  not null default 0,
  cost_usd   numeric(12,6) not null default 0,
  estimated  boolean not null default false,   -- true: запрос прервали раньше, стоимость оценена
  created_at timestamptz not null default now()
);
create index if not exists usage_user_time on public.usage (user_id, created_at);
alter table public.usage enable row level security;
revoke all on public.usage from anon, authenticated;
grant select, insert on public.usage to service_role;
grant usage, select on sequence public.usage_id_seq to service_role;

-- Начало сегодняшнего дня и месяца по Москве.
create or replace function public.day_start() returns timestamptz language sql stable as $$
  select date_trunc('day', now() at time zone 'Europe/Moscow') at time zone 'Europe/Moscow';
$$;
create or replace function public.month_start() returns timestamptz language sql stable as $$
  select date_trunc('month', now() at time zone 'Europe/Moscow') at time zone 'Europe/Moscow';
$$;

-- Проверка перед запросом к ИИ (вызывает только серверная функция).
create or replace function public.ai_gate(uid uuid, kind text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  s public.app_settings%rowtype;
  p public.profiles%rowtype;
  is_own boolean;
  today int; month_cost numeric; total numeric; lim int; mlim numeric;
begin
  select * into s from public.app_settings where id = 1;
  select * into p from public.profiles where user_id = uid;
  is_own := (uid = s.owner_id);
  if coalesce(p.disabled, false) then return jsonb_build_object('ok', false, 'code', 'disabled'); end if;
  if kind = 'test' and not is_own then return jsonb_build_object('ok', false, 'code', 'forbidden'); end if;
  select coalesce(sum(cost_usd), 0) into total from public.usage where created_at >= public.month_start();
  if total >= s.global_monthly_usd and not is_own then
    return jsonb_build_object('ok', false, 'code', 'global_limit');
  end if;
  if is_own or coalesce(p.unlimited, false) then
    return jsonb_build_object('ok', true, 'model', s.ai_model, 'left_today', null);
  end if;
  select coalesce(sum(g.cost_usd), 0) into month_cost from public.usage g
   where g.user_id = uid and g.created_at >= public.month_start();
  mlim := coalesce(p.monthly_usd, s.monthly_usd);
  if month_cost >= mlim then return jsonb_build_object('ok', false, 'code', 'month_limit'); end if;
  lim := coalesce(p.daily_limit, s.daily_limit);
  select count(*) into today from public.usage g
   where g.user_id = uid and g.kind = 'pick' and g.created_at >= public.day_start();
  if ai_gate.kind = 'pick' and today >= lim then return jsonb_build_object('ok', false, 'code', 'limit'); end if;
  return jsonb_build_object('ok', true, 'model', s.ai_model,
    'left_today', case when ai_gate.kind = 'pick' then greatest(lim - today - 1, 0) else greatest(lim - today, 0) end);
end $$;
revoke execute on function public.ai_gate(uuid, text) from public, anon, authenticated;
grant execute on function public.ai_gate(uuid, text) to service_role;

-- ===== «Статистика» (только владелец) =====
create or replace function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s public.app_settings%rowtype;
begin
  if not public.is_owner() then raise exception 'forbidden'; end if;
  select * into s from public.app_settings where id = 1;
  return jsonb_build_object(
    'seats',  s.seats,
    'invite', s.invite_code,
    'thanks_url',  s.thanks_url,
    'contact_url', s.contact_url,
    'ai_model', s.ai_model,
    'daily_limit', s.daily_limit,
    'monthly_usd', s.monthly_usd,
    'global_monthly_usd', s.global_monthly_usd,
    'month_total', (select coalesce(sum(cost_usd), 0) from public.usage where created_at >= public.month_start()),
    'used',   (select count(*) from auth.users where id <> s.owner_id),
    'people', coalesce((select jsonb_agg(x order by x.is_owner desc, x.created_at) from (
        select u.id, u.email, u.created_at, p.last_seen,
               coalesce(p.disabled, false) as disabled,
               (u.id = s.owner_id) as is_owner,
               coalesce(p.unlimited, false) or u.id = s.owner_id as unlimited,
               p.daily_limit, p.monthly_usd,
               (select count(*) from public.items i where i.user_id = u.id and i.app = 'kino')  as kino,
               (select count(*) from public.items i where i.user_id = u.id and i.app = 'knigi') as knigi,
               (select count(*) from public.usage g where g.user_id = u.id and g.kind = 'pick' and g.created_at >= public.day_start()) as picks_today,
               (select count(*) from public.usage g where g.user_id = u.id and g.kind = 'pick' and g.created_at >= public.month_start()) as picks_month,
               (select coalesce(sum(cost_usd), 0) from public.usage g where g.user_id = u.id and g.created_at >= public.month_start()) as cost_month
          from auth.users u left join public.profiles p on p.user_id = u.id) x), '[]'::jsonb)
  );
end $$;

create or replace function public.admin_set_ai(model text, daily int, monthly numeric, global numeric) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then raise exception 'forbidden'; end if;
  if model not in ('gpt-6.2-sol', 'gpt-6.1-terra') then raise exception 'bad_model'; end if;
  update public.app_settings
     set ai_model = model,
         daily_limit = greatest(0, least(daily, 1000)),
         monthly_usd = greatest(0, least(monthly, 1000)),
         global_monthly_usd = greatest(0, least(global, 10000)),
         updated_at = now()
   where id = 1;
end $$;

-- Личные лимиты: daily / monthly = null — общий лимит.
create or replace function public.admin_set_person_limits(uid uuid, daily int, monthly numeric, unlim boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then raise exception 'forbidden'; end if;
  insert into public.profiles (user_id, daily_limit, monthly_usd, unlimited)
  values (uid, daily, monthly, coalesce(unlim, false))
  on conflict (user_id) do update
     set daily_limit = excluded.daily_limit, monthly_usd = excluded.monthly_usd, unlimited = excluded.unlimited;
end $$;

revoke execute on function public.admin_overview(), public.admin_set_ai(text, int, numeric, numeric),
  public.admin_set_person_limits(uuid, int, numeric, boolean) from public, anon;
grant execute on function public.admin_overview(), public.admin_set_ai(text, int, numeric, numeric),
  public.admin_set_person_limits(uuid, int, numeric, boolean) to authenticated;
