-- Шаг 2. Списки и «Мой вкус» для обоих приложений (kino и knigi).
-- Выполнить один раз: Supabase → SQL Editor → New query → вставить весь текст → Run.
-- Повторный запуск безопасен.

-- Записи списка: одна строка = один фильм/сериал/книга одного человека.
create table if not exists public.items (
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  app        text        not null check (app in ('kino', 'knigi')),
  norm       text        not null,              -- нормализованное название (для поиска повторов)
  data       jsonb       not null,              -- вся запись: название, год, отметка, заметка, сезон/серия, прогресс…
  updated_at timestamptz not null default now(),
  primary key (user_id, app, norm)
);

-- «Мой вкус»: свой текст для каждого приложения.
create table if not exists public.tastes (
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  app        text        not null check (app in ('kino', 'knigi')),
  profile    text        not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, app)
);

-- Защита: каждый видит и меняет только свои строки.
alter table public.items  enable row level security;
alter table public.tastes enable row level security;

drop policy if exists "own items" on public.items;
create policy "own items" on public.items
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "own tastes" on public.tastes;
create policy "own tastes" on public.tastes
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Доступ через API только вошедшим пользователям (анонимам — ничего).
revoke all on public.items, public.tastes from anon;
grant select, insert, update, delete on public.items, public.tastes to authenticated;
