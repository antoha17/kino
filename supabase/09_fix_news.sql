-- Исправление: функции «Новинки недели» не хватало прав читать настройки.
-- Выполнить один раз: Supabase → SQL Editor → New query → вставить → Run.
grant select on public.app_settings to service_role;
grant select, insert on public.usage to service_role;
grant select, insert, delete on public.news to service_role;
