create table if not exists public.shul_memberships (
  shul_id uuid not null references public.shuls(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('owner','admin','editor','viewer')),
  created_at timestamptz not null default now(),
  primary key (shul_id,user_id)
);

alter table public.shul_memberships enable row level security;

create or replace function public.is_shul_member(target_shul_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists (
    select 1
    from public.shul_memberships m
    where m.shul_id = target_shul_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_shul_admin(target_shul_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists (
    select 1
    from public.shul_memberships m
    where m.shul_id = target_shul_id
      and m.user_id = auth.uid()
      and m.role in ('owner','admin')
  );
$$;

drop policy if exists "members read own memberships" on public.shul_memberships;
create policy "members read own memberships"
on public.shul_memberships for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "authenticated read member shuls" on public.shuls;
create policy "authenticated read member shuls"
on public.shuls for select
to authenticated
using (public.is_shul_member(id));

drop policy if exists "authenticated admins update shuls" on public.shuls;
create policy "authenticated admins update shuls"
on public.shuls for update
to authenticated
using (public.is_shul_admin(id))
with check (public.is_shul_admin(id));

do $$
declare
  t text;
begin
  foreach t in array array[
    'schedule_entries','schedule_overrides','notices_events','monthly_setup',
    'zmanim_settings','fast_day_overrides','magnets','immediate_pushes',
    'special_schedule_days','special_schedule_entries','shul_annual_events',
    'shul_annual_event_years','shul_calendar_preferences'
  ]
  loop
    execute format('drop policy if exists "authenticated members read" on public.%I', t);
    execute format(
      'create policy "authenticated members read" on public.%I for select to authenticated using (public.is_shul_member(shul_id))',
      t
    );

    execute format('drop policy if exists "authenticated admins manage" on public.%I', t);
    execute format(
      'create policy "authenticated admins manage" on public.%I for all to authenticated using (public.is_shul_admin(shul_id)) with check (public.is_shul_admin(shul_id))',
      t
    );
  end loop;
end $$;

create or replace function public.create_shul_onboarding(
  p_name text,
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
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if nullif(trim(p_name),'') is null then
    raise exception 'Shul name is required';
  end if;

  if p_postal_code !~ '^[0-9]{5}$' then
    raise exception 'ZIP code must be 5 digits';
  end if;

  if p_shabbos_end_minutes < 1 or p_shabbos_end_minutes > 180 then
    raise exception 'End-of-day offset must be between 1 and 180 minutes';
  end if;

  insert into public.shuls(name,postal_code,timezone,customer_status,vertical)
  values(trim(p_name),p_postal_code,coalesce(nullif(trim(p_timezone),''),'America/New_York'),'pilot','synagogue')
  returning id into new_shul_id;

  insert into public.shul_memberships(shul_id,user_id,role)
  values(new_shul_id,auth.uid(),'owner');

  insert into public.zmanim_settings(shul_id,postal_code,fast_end_minutes,source_status)
  values(new_shul_id,p_postal_code,p_shabbos_end_minutes,'sample_fallback');

  for row_data in select * from jsonb_array_elements(coalesce(p_schedule_rows,'[]'::jsonb))
  loop
    insert into public.schedule_entries(
      shul_id,day_of_week,service_type,service_time,label,sort_order,active,
      timing_source,timing_offset_minutes,service,display_name,
      round_to_minutes,round_direction,use_weekly_earliest,weekly_group,follows_text
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
      nullif(row_data->>'follows_text','')
    );
  end loop;

  return new_shul_id;
end;
$$;

revoke all on function public.create_shul_onboarding(text,text,text,integer,jsonb) from public;
grant execute on function public.create_shul_onboarding(text,text,text,integer,jsonb) to authenticated;
