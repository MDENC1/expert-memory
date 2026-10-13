create or replace function public.save_monthly_custom_events(
  p_shul_id uuid,
  p_start_date date,
  p_end_date date,
  p_rows jsonb
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  row_data jsonb;
  row_date date;
  row_key uuid;
  row_title text;
  row_time time;
  row_location text;
  row_details text;
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

  update public.notices_events n
  set archived_at=now(), active=false, updated_at=now()
  where n.shul_id=p_shul_id
    and n.linked_special_event_key is not null
    and n.display_start between p_start_date and p_end_date
    and not exists(
      select 1
      from jsonb_array_elements(coalesce(p_rows,'[]'::jsonb)) incoming
      where nullif(incoming->>'event_key','')::uuid=n.linked_special_event_key
    );

  delete from public.special_schedule_entries
  where shul_id=p_shul_id
    and event_date between p_start_date and p_end_date
    and note='monthly_custom_event';

  for row_data in
    select * from jsonb_array_elements(coalesce(p_rows,'[]'::jsonb))
  loop
    row_date := nullif(row_data->>'event_date','')::date;
    row_key := coalesce(nullif(row_data->>'event_key','')::uuid,gen_random_uuid());
    row_title := nullif(trim(coalesce(row_data->>'title','')),'');
    row_time := case
      when nullif(row_data->>'event_time','') is null then null
      else (row_data->>'event_time')::time
    end;
    row_location := nullif(trim(coalesce(row_data->>'location','')),'');
    row_details := nullif(trim(coalesce(row_data->>'details','')),'');

    if row_date is null or row_date < p_start_date or row_date > p_end_date then
      raise exception 'Custom event date is outside the allowed range';
    end if;

    if row_title is null then
      continue;
    end if;

    insert into public.special_schedule_entries(
      shul_id,event_date,title,event_time,approximate,note,sort_order,active,linked_event_key
    )
    values(
      p_shul_id,row_date,row_title,row_time,
      coalesce((row_data->>'approximate')::boolean,false),
      'monthly_custom_event',
      coalesce((row_data->>'sort_order')::integer,100),
      true,row_key
    );

    insert into public.notices_events(
      shul_id,content_type,title,details,location,display_start,display_end,event_time,
      recurring,active,priority_level,linked_special_event_key
    )
    values(
      p_shul_id,'Event',row_title,row_details,row_location,row_date,row_date,row_time,
      false,true,2,row_key
    )
    on conflict (shul_id,linked_special_event_key) do update set
      content_type='Event',
      title=excluded.title,
      details=excluded.details,
      location=excluded.location,
      display_start=excluded.display_start,
      display_end=excluded.display_end,
      event_time=excluded.event_time,
      active=true,
      archived_at=null,
      updated_at=now();

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
