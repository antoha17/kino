-- Шаг 3в. Примерный баланс OpenAI в «Статистике».
-- Владелец вписывает сумму после пополнения; приложение вычитает траты, записанные после этого.
-- Выполнить один раз: Supabase → SQL Editor → New query → вставить весь текст → Run. Повторный запуск безопасен.

alter table public.app_settings add column if not exists balance_usd    numeric(10,2);
alter table public.app_settings add column if not exists balance_set_at timestamptz;
alter table public.app_settings add column if not exists balance_warn   numeric(10,2) not null default 1.00;

create or replace function public.admin_set_balance(amount numeric, warn numeric) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then raise exception 'forbidden'; end if;
  update public.app_settings
     set balance_usd = case when amount is null then null else greatest(0, least(amount, 100000)) end,
         balance_set_at = case when amount is null then null else now() end,
         balance_warn = greatest(0, least(coalesce(warn, 1), 1000)),
         updated_at = now()
   where id = 1;
end $$;

-- Обзор для «Статистики» + баланс.
create or replace function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s public.app_settings%rowtype; spent numeric;
begin
  if not public.is_owner() then raise exception 'forbidden'; end if;
  select * into s from public.app_settings where id = 1;
  select coalesce(sum(cost_usd), 0) into spent from public.usage
   where s.balance_set_at is not null and created_at >= s.balance_set_at;
  return jsonb_build_object(
    'seats',  s.seats,
    'invite', s.invite_code,
    'thanks_url',  s.thanks_url,
    'contact_url', s.contact_url,
    'ai_model', s.ai_model,
    'daily_limit', s.daily_limit,
    'monthly_usd', s.monthly_usd,
    'global_monthly_usd', s.global_monthly_usd,
    'balance_usd', s.balance_usd,
    'balance_set_at', s.balance_set_at,
    'balance_warn', s.balance_warn,
    'balance_left', case when s.balance_usd is null then null else s.balance_usd - spent end,
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

revoke execute on function public.admin_set_balance(numeric, numeric), public.admin_overview() from public, anon;
grant execute on function public.admin_set_balance(numeric, numeric), public.admin_overview() to authenticated;
