create or replace function public.confirm_special_schedule(
  p_shul_id uuid,
  p_event_date date,
  p_title text,
  p_rows jsonb,
  p_replace_normal_schedule boolean default true
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  row_data jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_shul_admin(p_shul_id) then
    raise exception 'Admin access required';
  end if;

  if p_event_date is null then
    raise exception 'Event date is required';
  end if;

  if nullif(trim(coalesce(p_title,'')),'') is null then
    raise exception 'Special schedule title is required';
  end if;

  delete from public.schedule_overrides
  where shul_id=p_shul_id
    and event_date=p_event_date;

  delete from public.special_schedule_entries
  where shul_id=p_shul_id
    and event_date=p_event_date;

  insert into public.special_schedule_days(
    shul_id,event_date,title,replace_normal_schedule,confirmed_at,confirmed_by
  )
  values(
    p_shul_id,p_event_date,trim(p_title),p_replace_normal_schedule,now(),auth.uid()
  )
  on conflict (shul_id,event_date) do update set
    title=excluded.title,
    replace_normal_schedule=excluded.replace_normal_schedule,
    confirmed_at=excluded.confirmed_at,
    confirmed_by=excluded.confirmed_by;

  if p_replace_normal_schedule then
    for row_data in
      select * from jsonb_array_elements(coalesce(p_rows,'[]'::jsonb))
    loop
      if nullif(trim(coalesce(row_data->>'title','')),'') is null then
        continue;
      end if;

      insert into public.special_schedule_entries(
        shul_id,event_date,title,event_time,approximate,note,sort_order,active
      )
      values(
        p_shul_id,
        p_event_date,
        trim(row_data->>'title'),
        case
          when nullif(row_data->>'event_time','') is null then null
          else (row_data->>'event_time')::time
        end,
        coalesce((row_data->>'approximate')::boolean,false),
        nullif(trim(coalesce(row_data->>'note','')),''),
        coalesce((row_data->>'sort_order')::integer,100),
        true
      );
    end loop;

    if not exists(
      select 1 from public.special_schedule_entries
      where shul_id=p_shul_id and event_date=p_event_date and active=true
    ) then
      raise exception 'At least one special schedule item is required';
    end if;
  end if;
end;
$$;

revoke all on function public.confirm_special_schedule(uuid,date,text,jsonb,boolean) from public;
revoke all on function public.confirm_special_schedule(uuid,date,text,jsonb,boolean) from anon;
grant execute on function public.confirm_special_schedule(uuid,date,text,jsonb,boolean) to authenticated;
