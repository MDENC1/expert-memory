revoke execute on function public.create_shul_onboarding(text,text,text,integer,jsonb) from public, anon;
grant execute on function public.create_shul_onboarding(text,text,text,integer,jsonb) to authenticated;

revoke execute on function public.is_shul_member(uuid) from public, anon;
grant execute on function public.is_shul_member(uuid) to authenticated;

revoke execute on function public.is_shul_admin(uuid) from public, anon;
grant execute on function public.is_shul_admin(uuid) to authenticated;
