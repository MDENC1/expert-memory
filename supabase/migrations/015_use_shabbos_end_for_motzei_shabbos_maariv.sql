alter table public.schedule_entries
  drop constraint if exists valid_timing_source;

alter table public.schedule_entries
  add constraint valid_timing_source
  check (
    timing_source is null
    or timing_source in (
      'fixed','follows','none',
      'plag','sunset',
      'dawn_72fix','dawn_benish',
      'sunrise_default',
      'shema_gra','shema_benish','shema_ma72fix',
      'midday','midday_benish',
      'mincha_gra','mincha_benish','mincha_ma72fix',
      'ketana_gra','ketana_benish','ketana_ma72fix',
      'plag_gra','plag_benish','plag_ma72fix',
      'sunset_default',
      'night_gra180','night_benish','night_72fix',
      'shabbos_end'
    )
  );

alter table public.schedule_entries
  drop constraint if exists schedule_entries_zman_family_check;

alter table public.schedule_entries
  add constraint schedule_entries_zman_family_check
  check (
    zman_family is null
    or zman_family in (
      'dawn','sunrise','shema','midday',
      'mincha_gedolah','mincha_ketana','plag','sunset','nightfall',
      'shabbos_end'
    )
  );

update public.schedule_entries
set timing_source='shabbos_end',
    zman_family='shabbos_end',
    use_shul_zman_default=false,
    timing_offset_minutes=0,
    round_to_minutes=null,
    round_direction=null,
    group_period='individual',
    use_weekly_earliest=false
where service_type='Maariv'
  and day_of_week=6
  and display_name='Shabbos Maariv'
  and rule_group_id='shabbos-maariv'
  and timing_source='night_gra180'
  and use_shul_zman_default=true;
