create or replace function public.confirm_special_schedule_group(
  p_shul_id uuid,
  p_dates jsonb
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  item jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_shul_admin(p_shul_id) then
    raise exception 'Admin access required';
  end if;

  if jsonb_typeof(coalesce(p_dates,'[]'::jsonb)) <> 'array' then
    raise exception 'p_dates must be a JSON array';
  end if;

  for item in select * from jsonb_array_elements(coalesce(p_dates,'[]'::jsonb))
  loop
    perform public.confirm_special_schedule(
      p_shul_id,
      (item->>'event_date')::date,
      item->>'title',
      coalesce(item->'rows','[]'::jsonb),
      coalesce((item->>'replace_normal_schedule')::boolean,true)
    );
  end loop;
end;
$$;

revoke all on function public.confirm_special_schedule_group(uuid,jsonb) from public;
revoke all on function public.confirm_special_schedule_group(uuid,jsonb) from anon;
grant execute on function public.confirm_special_schedule_group(uuid,jsonb) to authenticated;
