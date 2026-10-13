create or replace function public.save_monthly_custom_events(
  p_shul_id uuid,
  p_start_date date,
  p_end_date date,
  p_rows jsonb
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  row_data jsonb;
  row_date date;
  pilot_shul constant uuid := 'e102b001-e0d4-4cd1-9a9f-2705b315f74a'::uuid;
begin
  if p_shul_id is null or p_start_date is null or p_end_date is null then
    raise exception 'Shul and date range are required';
  end if;

  if p_end_date < p_start_date or p_end_date - p_start_date > 62 then
    raise exception 'Invalid monthly custom-event date range';
  end if;

  if auth.uid() is null then
    if p_shul_id <> pilot_shul then
      raise exception 'Authentication required';
    end if;
  elsif not public.is_shul_admin(p_shul_id) then
    raise exception 'Admin access required';
  end if;

  if jsonb_typeof(coalesce(p_rows,'[]'::jsonb)) <> 'array' then
    raise exception 'p_rows must be a JSON array';
  end if;

  delete from public.special_schedule_entries
  where shul_id=p_shul_id
    and event_date between p_start_date and p_end_date
    and note='monthly_custom_event';

  for row_data in
    select * from jsonb_array_elements(coalesce(p_rows,'[]'::jsonb))
  loop
    row_date := nullif(row_data->>'event_date','')::date;

    if row_date is null or row_date < p_start_date or row_date > p_end_date then
      raise exception 'Custom event date is outside the allowed range';
    end if;

    if nullif(trim(coalesce(row_data->>'title','')),'') is null then
      continue;
    end if;

    insert into public.special_schedule_entries(
      shul_id,event_date,title,event_time,approximate,note,sort_order,active
    )
    values(
      p_shul_id,
      row_date,
      trim(row_data->>'title'),
      case
        when nullif(row_data->>'event_time','') is null then null
        else (row_data->>'event_time')::time
      end,
      coalesce((row_data->>'approximate')::boolean,false),
      'monthly_custom_event',
      coalesce((row_data->>'sort_order')::integer,100),
      true
    );

    insert into public.special_schedule_days(
      shul_id,event_date,title,replace_normal_schedule,confirmed_at,confirmed_by
    )
    values(
      p_shul_id,row_date,'Monthly Special Event',false,now(),auth.uid()
    )
    on conflict (shul_id,event_date) do nothing;
  end loop;

  delete from public.special_schedule_days d
  where d.shul_id=p_shul_id
    and d.event_date between p_start_date and p_end_date
    and d.title='Monthly Special Event'
    and d.replace_normal_schedule=false
    and not exists(
      select 1 from public.special_schedule_entries e
      where e.shul_id=d.shul_id
        and e.event_date=d.event_date
        and e.active=true
    )
    and not exists(
      select 1 from public.schedule_overrides o
      where o.shul_id=d.shul_id
        and o.event_date=d.event_date
        and o.active=true
    );
end;
$$;

revoke all on function public.save_monthly_custom_events(uuid,date,date,jsonb) from public;
grant execute on function public.save_monthly_custom_events(uuid,date,date,jsonb) to anon;
grant execute on function public.save_monthly_custom_events(uuid,date,date,jsonb) to authenticated;
