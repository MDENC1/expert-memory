alter table public.schedule_entries
  drop constraint if exists valid_timing_source;

alter table public.schedule_entries
  add constraint valid_timing_source
  check (
    timing_source is null
    or timing_source in (
      'fixed','follows','none',
      'plag','sunset',
      'dawn_72','dawn_72fix',
      'sunrise_default',
      'shema_gra','shema_benish_shabbos','shema_ma72fix',
      'midday',
      'mincha_gra','mincha_ma72fix',
      'ketana_gra','ketana_ma72fix',
      'plag_gra','plag_benish_shabbos','plag_ma72fix',
      'sunset_default',
      'night_shabbos','night_72fix','night_gra180','night_gra225','night_gra240'
    )
  );
