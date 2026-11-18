-- Шаг 6. «Новинки недели» (каждую пятницу) и резервная копия (каждое воскресенье).
-- Выполнить один раз: Supabase → SQL Editor → New query → вставить весь текст → Run. Повторный запуск безопасен.
-- Расписание работает внутри Supabase (pg_cron), отдельный «будильник» не нужен.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Секрет, которым расписание подписывает вызов функции news. Хранится только в базе.
alter table public.app_settings add column if not exists cron_secret text;
update public.app_settings set cron_secret = md5(random()::text || clock_timestamp()::text) || md5(random()::text) where id = 1 and cron_secret is null;

-- ===== Новинки недели =====
create table if not exists public.news (
  id         bigint generated always as identity primary key,
  app        text not null default 'kino',
  week       text,
  items      jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.news enable row level security;
revoke all on public.news from anon, authenticated;
grant select, insert, delete on public.news to service_role;
grant usage, select on sequence public.news_id_seq to service_role;

-- Последние новинки — для всех вошедших.
create or replace function public.public_news(a text default 'kino') returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('week', week, 'items', items, 'created_at', created_at)
    from public.news where app = a order by created_at desc, id desc limit 1;
$$;
revoke execute on function public.public_news(text) from public, anon;
grant execute on function public.public_news(text) to authenticated;

-- ===== Резервная копия =====
create table if not exists public.backups (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  data       jsonb not null
);
alter table public.backups enable row level security;
revoke all on public.backups from anon, authenticated;

create or replace function public.snapshot() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'made_at', now(),
    'items',   coalesce((select jsonb_agg(to_jsonb(i)) from public.items i), '[]'::jsonb),
    'tastes',  coalesce((select jsonb_agg(to_jsonb(t)) from public.tastes t), '[]'::jsonb),
    'people',  coalesce((select jsonb_agg(jsonb_build_object('user_id', p.user_id, 'email', p.email, 'created_at', p.created_at,
                 'disabled', p.disabled, 'daily_limit', p.daily_limit, 'monthly_usd', p.monthly_usd, 'unlimited', p.unlimited)) from public.profiles p), '[]'::jsonb),
    'settings', (select to_jsonb(s) - 'cron_secret' - 'invite_code' from public.app_settings s where id = 1)
  );
$$;
revoke execute on function public.snapshot() from public, anon, authenticated;

-- Копия раз в неделю; храним последние 8 (два месяца).
create or replace function public.make_backup() returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.backups (data) values (public.snapshot());
  delete from public.backups where id not in (select id from public.backups order by created_at desc limit 8);
end $$;
revoke execute on function public.make_backup() from public, anon, authenticated;

-- Скачать копию прямо сейчас (кнопка в «Статистике», только владелец).
create or replace function public.admin_export() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then raise exception 'forbidden'; end if;
  return public.snapshot();
end $$;
create or replace function public.admin_backups() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'count', (select count(*) from public.backups),
    'last',  (select max(created_at) from public.backups),
    'news_last', (select max(created_at) from public.news));
end $$;
revoke execute on function public.admin_export(), public.admin_backups() from public, anon;
grant execute on function public.admin_export(), public.admin_backups() to authenticated;

-- ===== Расписание =====
do $$ begin
  perform cron.unschedule(jobname) from cron.job where jobname in ('kk-news', 'kk-backup');
end $$;
-- Новинки: каждую пятницу в 06:07 UTC (09:07 по Москве).
select cron.schedule('kk-news', '7 6 * * 5', $cron$
  select net.http_post(
    url := 'https://ipqcqexoymvfoxejypyr.supabase.co/functions/v1/news',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-cron-secret', (select cron_secret from public.app_settings where id = 1)),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000);
$cron$);
-- Резервная копия: каждое воскресенье в 03:17 UTC.
select cron.schedule('kk-backup', '17 3 * * 0', $cron$ select public.make_backup(); $cron$);

-- Первая копия сразу.
select public.make_backup();
