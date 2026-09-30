alter table public.schedule_entries
  add column if not exists rule_group_id text;

update public.schedule_entries
set rule_group_id = coalesce(
  nullif(weekly_group,''),
  md5(concat_ws('|',
    shul_id::text,
    coalesce(service_type,''),
    coalesce(display_name,''),
    coalesce(sort_order::text,''),
    coalesce(timing_source,''),
    coalesce(service_time::text,''),
    coalesce(timing_offset_minutes::text,''),
    coalesce(round_to_minutes::text,''),
    coalesce(round_direction,''),
    coalesce(group_period,''),
    coalesce(zman_family,''),
    coalesce(use_shul_zman_default::text,''),
    coalesce(follows_text,'')
  ))
)
where rule_group_id is null or rule_group_id='';

create or replace function public.create_shul_onboarding(
  p_name text,
  p_country_code text,
  p_postal_code text,
  p_timezone text,
  p_myzmanim_location_id text,
  p_location_metadata jsonb,
  p_shabbos_end_minutes integer,
  p_zman_defaults jsonb,
  p_schedule_rows jsonb
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  new_shul_id uuid;
  row_data jsonb;
  normalized_country text;
  normalized_defaults jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if nullif(trim(p_name),'') is null then raise exception 'Shul name is required'; end if;

  normalized_country := upper(coalesce(nullif(trim(p_country_code),''),'US'));
  if nullif(trim(p_postal_code),'') is null then raise exception 'Postal code is required'; end if;
  if nullif(trim(p_timezone),'') is null then raise exception 'Verified time zone is required'; end if;
  if nullif(trim(p_myzmanim_location_id),'') is null then raise exception 'Verified MyZmanim location is required'; end if;

  if p_shabbos_end_minutes < 1 or p_shabbos_end_minutes > 180 then
    raise exception 'End-of-day offset must be between 1 and 180 minutes';
  end if;

  normalized_defaults := jsonb_build_object(
    'dawn', coalesce(nullif(p_zman_defaults->>'dawn',''),'72fix'),
    'shema', coalesce(nullif(p_zman_defaults->>'shema',''),'gra'),
    'midday', coalesce(nullif(p_zman_defaults->>'midday',''),'standard'),
    'mincha', coalesce(nullif(p_zman_defaults->>'mincha',''),'gra'),
    'nightfall', coalesce(nullif(p_zman_defaults->>'nightfall',''),'gra')
  );

  insert into public.shuls(name,country_code,postal_code,timezone,customer_status,vertical)
  values(trim(p_name),normalized_country,trim(p_postal_code),trim(p_timezone),'pilot','synagogue')
  returning id into new_shul_id;

  insert into public.shul_memberships(shul_id,user_id,role)
  values(new_shul_id,auth.uid(),'owner');

  insert into public.zmanim_settings(
    shul_id,country_code,postal_code,myzmanim_location_id,fast_end_minutes,
    source_status,zman_defaults,location_metadata,location_verified_at
  )
  values(
    new_shul_id,normalized_country,trim(p_postal_code),trim(p_myzmanim_location_id),
    p_shabbos_end_minutes,'myzmanim',normalized_defaults,
    coalesce(p_location_metadata,'{}'::jsonb),now()
  );

  for row_data in select * from jsonb_array_elements(coalesce(p_schedule_rows,'[]'::jsonb))
  loop
    insert into public.schedule_entries(
      shul_id,day_of_week,service_type,service_time,label,sort_order,active,
      timing_source,timing_offset_minutes,service,display_name,
      round_to_minutes,round_direction,use_weekly_earliest,weekly_group,follows_text,
      group_period,zman_family,use_shul_zman_default,rule_group_id
    )
    values(
      new_shul_id,
      (row_data->>'day_of_week')::smallint,
      row_data->>'service_type',
      case when nullif(row_data->>'service_time','') is null then null else (row_data->>'service_time')::time end,
      nullif(row_data->>'label',''),
      coalesce((row_data->>'sort_order')::integer,0),
      coalesce((row_data->>'active')::boolean,true),
      coalesce(nullif(row_data->>'timing_source',''),'fixed'),
      coalesce((row_data->>'timing_offset_minutes')::integer,0),
      nullif(row_data->>'service',''),
      nullif(row_data->>'display_name',''),
      case when nullif(row_data->>'round_to_minutes','') is null then null else (row_data->>'round_to_minutes')::integer end,
      nullif(row_data->>'round_direction',''),
      coalesce((row_data->>'use_weekly_earliest')::boolean,false),
      nullif(row_data->>'weekly_group',''),
      nullif(row_data->>'follows_text',''),
      coalesce(nullif(row_data->>'group_period',''),'individual'),
      nullif(row_data->>'zman_family',''),
      coalesce((row_data->>'use_shul_zman_default')::boolean,false),
      coalesce(nullif(row_data->>'rule_group_id',''),gen_random_uuid()::text)
    );
  end loop;

  return new_shul_id;
end;
$$;

create or replace function public.update_shul_setup(
  p_shul_id uuid,
  p_name text,
  p_country_code text,
  p_postal_code text,
  p_timezone text,
  p_myzmanim_location_id text,
  p_location_metadata jsonb,
  p_shabbos_end_minutes integer,
  p_zman_defaults jsonb,
  p_schedule_rows jsonb
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  row_data jsonb;
  normalized_country text;
  normalized_defaults jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_shul_admin(p_shul_id) then raise exception 'Admin access required'; end if;
  if nullif(trim(p_name),'') is null then raise exception 'Shul name is required'; end if;

  normalized_country := upper(coalesce(nullif(trim(p_country_code),''),'US'));
  if nullif(trim(p_postal_code),'') is null then raise exception 'Postal code is required'; end if;
  if nullif(trim(p_timezone),'') is null then raise exception 'Verified time zone is required'; end if;
  if nullif(trim(p_myzmanim_location_id),'') is null then raise exception 'Verified MyZmanim location is required'; end if;

  if p_shabbos_end_minutes < 1 or p_shabbos_end_minutes > 180 then
    raise exception 'End-of-day offset must be between 1 and 180 minutes';
  end if;

  normalized_defaults := jsonb_build_object(
    'dawn', coalesce(nullif(p_zman_defaults->>'dawn',''),'72fix'),
    'shema', coalesce(nullif(p_zman_defaults->>'shema',''),'gra'),
    'midday', coalesce(nullif(p_zman_defaults->>'midday',''),'standard'),
    'mincha', coalesce(nullif(p_zman_defaults->>'mincha',''),'gra'),
    'nightfall', coalesce(nullif(p_zman_defaults->>'nightfall',''),'gra')
  );

  update public.shuls
  set name=trim(p_name),
      country_code=normalized_country,
      postal_code=trim(p_postal_code),
      timezone=trim(p_timezone)
  where id=p_shul_id;

  if not found then raise exception 'Shul not found'; end if;

  insert into public.zmanim_settings(
    shul_id,country_code,postal_code,myzmanim_location_id,fast_end_minutes,
    source_status,zman_defaults,location_metadata,location_verified_at,updated_at
  )
  values(
    p_shul_id,normalized_country,trim(p_postal_code),trim(p_myzmanim_location_id),
    p_shabbos_end_minutes,'myzmanim',normalized_defaults,
    coalesce(p_location_metadata,'{}'::jsonb),now(),now()
  )
  on conflict (shul_id) do update set
    country_code=excluded.country_code,
    postal_code=excluded.postal_code,
    myzmanim_location_id=excluded.myzmanim_location_id,
    fast_end_minutes=excluded.fast_end_minutes,
    source_status='myzmanim',
    zman_defaults=excluded.zman_defaults,
    location_metadata=excluded.location_metadata,
    location_verified_at=excluded.location_verified_at,
    updated_at=now();

  delete from public.schedule_entries where shul_id=p_shul_id;

  for row_data in select * from jsonb_array_elements(coalesce(p_schedule_rows,'[]'::jsonb))
  loop
    insert into public.schedule_entries(
      shul_id,day_of_week,service_type,service_time,label,sort_order,active,
      timing_source,timing_offset_minutes,service,display_name,
      round_to_minutes,round_direction,use_weekly_earliest,weekly_group,follows_text,
      group_period,zman_family,use_shul_zman_default,rule_group_id
    )
    values(
      p_shul_id,
      (row_data->>'day_of_week')::smallint,
      row_data->>'service_type',
      case when nullif(row_data->>'service_time','') is null then null else (row_data->>'service_time')::time end,
      nullif(row_data->>'label',''),
      coalesce((row_data->>'sort_order')::integer,0),
      coalesce((row_data->>'active')::boolean,true),
      coalesce(nullif(row_data->>'timing_source',''),'fixed'),
      coalesce((row_data->>'timing_offset_minutes')::integer,0),
      nullif(row_data->>'service',''),
      nullif(row_data->>'display_name',''),
      case when nullif(row_data->>'round_to_minutes','') is null then null else (row_data->>'round_to_minutes')::integer end,
      nullif(row_data->>'round_direction',''),
      coalesce((row_data->>'use_weekly_earliest')::boolean,false),
      nullif(row_data->>'weekly_group',''),
      nullif(row_data->>'follows_text',''),
      coalesce(nullif(row_data->>'group_period',''),'individual'),
      nullif(row_data->>'zman_family',''),
      coalesce((row_data->>'use_shul_zman_default')::boolean,false),
      coalesce(nullif(row_data->>'rule_group_id',''),gen_random_uuid()::text)
    );
  end loop;

  return p_shul_id;
end;
$$;

revoke execute on function public.update_shul_setup(uuid,text,text,text,text,text,jsonb,integer,jsonb,jsonb) from public, anon;
grant execute on function public.update_shul_setup(uuid,text,text,text,text,text,jsonb,integer,jsonb,jsonb) to authenticated;
