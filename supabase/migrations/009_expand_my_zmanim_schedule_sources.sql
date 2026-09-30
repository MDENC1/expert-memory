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
      'night_gra180','night_benish','night_72fix'
    )
  );
