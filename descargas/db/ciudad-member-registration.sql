-- Ejecutar después de db/omega-roles.sql en el SQL Editor de Supabase.
-- Altas públicas siempre member; nunca se confía en raw_user_meta_data.
-- No modifica los administradores existentes.
begin;
create or replace function public.ciudad_register_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.omega_user_roles(user_id, role)
  values (new.id, 'member')
  on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.ciudad_register_member() from public, anon, authenticated;
drop trigger if exists ciudad_member_after_signup on auth.users;
create trigger ciudad_member_after_signup
  after insert on auth.users
  for each row execute function public.ciudad_register_member();
insert into public.omega_user_roles(user_id, role)
select id, 'member' from auth.users
on conflict (user_id) do nothing;
commit;
