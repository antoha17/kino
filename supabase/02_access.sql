-- Шаг 2б. Доступ: число мест, ссылка-приглашение, страница «Статистика» для владельца.
-- Выполнить один раз: Supabase → SQL Editor → New query → вставить весь текст → Run.
-- Повторный запуск безопасен. Владельцем становится самый первый зарегистрированный аккаунт.
-- После выполнения включить хук: Authentication → Hooks → Before User Created →
--   Postgres → схема public → функция hook_before_user_created.

-- Настройки (одна строка): владелец, число мест, текущий код приглашения.
create table if not exists public.app_settings (
  id          int primary key default 1 check (id = 1),
  owner_id    uuid references auth.users(id) on delete set null,
  seats       int  not null default 8 check (seats >= 0 and seats <= 1000),
  invite_code text not null default substr(md5(random()::text || clock_timestamp()::text), 1, 10),
  updated_at  timestamptz not null default now()
);
insert into public.app_settings (id) values (1) on conflict (id) do nothing;
update public.app_settings
   set owner_id = (select id from auth.users order by created_at limit 1)
 where id = 1 and owner_id is null;

-- Служебные сведения о людях: последний заход и «отключён ли доступ». Без списков.
create table if not exists public.profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text,
  created_at timestamptz not null default now(),
  last_seen  timestamptz,
  disabled   boolean not null default false
);
insert into public.profiles (user_id, email, created_at)
select id, email, created_at from auth.users
on conflict (user_id) do nothing;

-- Напрямую через API эти таблицы недоступны никому: только через функции ниже.
alter table public.app_settings enable row level security;
alter table public.profiles     enable row level security;
revoke all on public.app_settings, public.profiles from anon, authenticated;

-- Новому аккаунту сразу создаётся запись в profiles.
create or replace function public.on_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, email) values (new.id, new.email)
  on conflict (user_id) do nothing;
  return new;
end $$;
drop trigger if exists on_new_user on auth.users;
create trigger on_new_user after insert on auth.users
  for each row execute function public.on_new_user();

-- Проверка при регистрации: нужен верный код приглашения и свободное место.
create or replace function public.hook_before_user_created(event jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s    public.app_settings%rowtype;
  used int;
  inv  text := event->'user'->'user_metadata'->>'invite';
begin
  select * into s from public.app_settings where id = 1;
  if inv is null or s.invite_code is null or inv <> s.invite_code then
    return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'invite_required'));
  end if;
  select count(*) into used from auth.users u where s.owner_id is null or u.id <> s.owner_id;
  if used >= s.seats then
    return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'no_seats'));
  end if;
  return '{}'::jsonb;
end $$;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_before_user_created(jsonb) from authenticated, anon, public;

-- Вспомогательные проверки.
create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_settings where id = 1 and owner_id = auth.uid());
$$;
create or replace function public.is_disabled() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select disabled from public.profiles where user_id = auth.uid()), false);
$$;

-- Отключённый человек не может читать и менять свой список.
drop policy if exists "own items" on public.items;
create policy "own items" on public.items
  for all to authenticated
  using (user_id = (select auth.uid()) and not public.is_disabled())
  with check (user_id = (select auth.uid()) and not public.is_disabled());
drop policy if exists "own tastes" on public.tastes;
create policy "own tastes" on public.tastes
  for all to authenticated
  using (user_id = (select auth.uid()) and not public.is_disabled())
  with check (user_id = (select auth.uid()) and not public.is_disabled());

-- Отметка «заходил»: вызывается приложением при открытии. Возвращает, отключён ли доступ.
create or replace function public.touch() returns boolean
language plpgsql security definer set search_path = public as $$
declare d boolean;
begin
  if auth.uid() is null then return false; end if;
  insert into public.profiles (user_id, email, last_seen) values (auth.uid(), auth.email(), now())
  on conflict (user_id) do update set last_seen = now(), email = excluded.email
  returning disabled into d;
  return d;
end $$;

-- ===== Функции страницы «Статистика» (работают только у владельца) =====
create or replace function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s public.app_settings%rowtype;
begin
  if not public.is_owner() then raise exception 'forbidden'; end if;
  select * into s from public.app_settings where id = 1;
  return jsonb_build_object(
    'seats',  s.seats,
    'invite', s.invite_code,
    'used',   (select count(*) from auth.users where id <> s.owner_id),
    'people', coalesce((select jsonb_agg(x order by x.is_owner desc, x.created_at) from (
        select u.id, u.email, u.created_at, p.last_seen,
               coalesce(p.disabled, false) as disabled,
               (u.id = s.owner_id) as is_owner,
               (select count(*) from public.items i where i.user_id = u.id and i.app = 'kino')  as kino,
               (select count(*) from public.items i where i.user_id = u.id and i.app = 'knigi') as knigi
          from auth.users u left join public.profiles p on p.user_id = u.id) x), '[]'::jsonb)
  );
end $$;

create or replace function public.admin_set_seats(n int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then raise exception 'forbidden'; end if;
  update public.app_settings set seats = greatest(0, least(n, 1000)), updated_at = now() where id = 1;
end $$;

create or replace function public.admin_new_invite() returns text
language plpgsql security definer set search_path = public as $$
declare c text := substr(md5(random()::text || clock_timestamp()::text), 1, 10);
begin
  if not public.is_owner() then raise exception 'forbidden'; end if;
  update public.app_settings set invite_code = c, updated_at = now() where id = 1;
  return c;
end $$;

create or replace function public.admin_set_disabled(uid uuid, val boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then raise exception 'forbidden'; end if;
  if uid = auth.uid() then raise exception 'self'; end if;
  insert into public.profiles (user_id, disabled) values (uid, val)
  on conflict (user_id) do update set disabled = val;
end $$;

create or replace function public.admin_delete_user(uid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then raise exception 'forbidden'; end if;
  if uid = auth.uid() then raise exception 'self'; end if;
  delete from auth.users where id = uid;   -- списки и профиль удалятся вместе с аккаунтом
end $$;

revoke execute on function public.on_new_user(), public.is_owner(), public.is_disabled(), public.touch(),
  public.admin_overview(), public.admin_set_seats(int), public.admin_new_invite(),
  public.admin_set_disabled(uuid, boolean), public.admin_delete_user(uuid) from public, anon;
grant execute on function public.is_owner(), public.is_disabled(), public.touch(),
  public.admin_overview(), public.admin_set_seats(int), public.admin_new_invite(),
  public.admin_set_disabled(uuid, boolean), public.admin_delete_user(uuid) to authenticated;
