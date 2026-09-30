alter table public.shuls
  add column if not exists country_code text not null default 'US';

alter table public.zmanim_settings
  add column if not exists country_code text not null default 'US';

alter table public.schedule_entries
  add column if not exists group_period text not null default 'individual';

alter table public.schedule_entries
  drop constraint if exists schedule_entries_group_period_check;

alter table public.schedule_entries
  add constraint schedule_entries_group_period_check
  check (group_period in ('individual','week_earliest','month_earliest'));

alter table public.schedule_entries
  drop constraint if exists valid_timing_source;

alter table public.schedule_entries
  add constraint valid_timing_source
  check (
    timing_source is null
    or timing_source in ('fixed','plag','sunset','candle_lighting','shema_gra','follows','none')
  );

create or replace function public.create_shul_onboarding(
  p_name text,
  p_country_code text,
  p_postal_code text,
  p_timezone text,
  p_shabbos_end_minutes integer,
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
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if nullif(trim(p_name),'') is null then raise exception 'Shul name is required'; end if;

  normalized_country := upper(coalesce(nullif(trim(p_country_code),''),'US'));
  if nullif(trim(p_postal_code),'') is null then raise exception 'Postal code is required'; end if;
  if p_shabbos_end_minutes < 1 or p_shabbos_end_minutes > 180 then
    raise exception 'End-of-day offset must be between 1 and 180 minutes';
  end if;

  insert into public.shuls(name,country_code,postal_code,timezone,customer_status,vertical)
  values(trim(p_name),normalized_country,trim(p_postal_code),
         coalesce(nullif(trim(p_timezone),''),'America/New_York'),'pilot','synagogue')
  returning id into new_shul_id;

  insert into public.shul_memberships(shul_id,user_id,role)
  values(new_shul_id,auth.uid(),'owner');

  insert into public.zmanim_settings(shul_id,country_code,postal_code,fast_end_minutes,source_status)
  values(new_shul_id,normalized_country,trim(p_postal_code),p_shabbos_end_minutes,'sample_fallback');

  for row_data in select * from jsonb_array_elements(coalesce(p_schedule_rows,'[]'::jsonb))
  loop
    insert into public.schedule_entries(
      shul_id,day_of_week,service_type,service_time,label,sort_order,active,
      timing_source,timing_offset_minutes,service,display_name,
      round_to_minutes,round_direction,use_weekly_earliest,weekly_group,follows_text,group_period
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
      coalesce(nullif(row_data->>'group_period',''),'individual')
    );
  end loop;

  return new_shul_id;
end;
$$;

revoke execute on function public.create_shul_onboarding(text,text,text,text,integer,jsonb) from public, anon;
grant execute on function public.create_shul_onboarding(text,text,text,text,integer,jsonb) to authenticated;
