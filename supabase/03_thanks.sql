-- Шаг 2в. «Поблагодарить автора»: ссылка на страницу оплаты (CloudTips, ЮMoney…).
-- Ссылка хранится в базе, а не в открытом коде; владелец меняет её в «Статистике».
-- Выполнить один раз: Supabase → SQL Editor → New query → вставить весь текст → Run. Повторный запуск безопасен.

alter table public.app_settings add column if not exists thanks_url text;

-- Общие настройки, которые нужны всем вошедшим (пока только ссылка «Поблагодарить»).
create or replace function public.public_settings() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('thanks_url', thanks_url) from public.app_settings where id = 1;
$$;

create or replace function public.admin_set_thanks(url text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then raise exception 'forbidden'; end if;
  url := nullif(trim(coalesce(url, '')), '');
  if url is not null and url !~* '^https://[^\s<>"]+$' then raise exception 'bad_url'; end if;
  update public.app_settings set thanks_url = url, updated_at = now() where id = 1;
end $$;

-- Обзор для «Статистики» теперь включает ссылку.
create or replace function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s public.app_settings%rowtype;
begin
  if not public.is_owner() then raise exception 'forbidden'; end if;
  select * into s from public.app_settings where id = 1;
  return jsonb_build_object(
    'seats',  s.seats,
    'invite', s.invite_code,
    'thanks_url', s.thanks_url,
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

revoke execute on function public.public_settings(), public.admin_set_thanks(text), public.admin_overview() from public, anon;
grant execute on function public.public_settings(), public.admin_set_thanks(text), public.admin_overview() to authenticated;
