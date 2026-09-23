# Latest Shul Magnet product requirements — 2026-09-23

This branch is the safe integration branch for merging the real Supabase-connected Lovable app with the latest approved UX/product requirements.

## Existing real backend
- Current pilot shul: `e102b001-e0d4-4cd1-9a9f-2705b315f74a`
- Preserve existing `shuls`, `schedule_entries`, `special_schedule_days`, `special_schedule_entries`
- Preserve and use the newer tables already created by the Lovable/Supabase migration: `schedule_overrides`, `notices_events`, `monthly_setup`, `zmanim_settings`, `fast_day_overrides`, `magnets`, `immediate_pushes`
- Never commit Supabase secrets/.env to GitHub.

## Approved UI / behavior
- Dashboard | Calendar | Monthly Setup | Notices & Events | Magnets | Settings
- Dashboard preview defaults to today in shul timezone with previous / Today / next date controls.
- Magnet is 648x480 monochrome.
- Header: shul name; subheader: full English date LTR + full Hebrew date RTL.
- One optional Priority Box only; hide it when empty. PUSH NOW takes precedence.
- No wording “Yom Tov transition” and no “Before Shabbos” under Candle Lighting.
- Priority box can show Candle Lighting, Shabbos Ends, Fast Begins/Ends, Begin Prep After, Yom Tov Candle Lighting, Yom Tov Ends.
- After header/priority: vertical 60/40. Top 60% = Zmanim + Shul, bottom 40% = Notices.
- Within top 60%: 40% Zmanim / 60% Shul.
- Zmanim chronological: Sunrise, Chatzos, Plag, Shkia, Sundown, Chatzos Layla.
- Shul side contains effective minyanim + special services/events, chronological, with dynamic font sizing.
- Monthly special times (Hakafos, Yizkor, special Yom Tov Shacharis, etc.) flow into the Shul list.
- Battery percentage in magnet footer.

## Triage
- 3 = Most Important, 2 = Important, 1 = Least Important.
- Regular weekly minyanim are the default low layer.
- Yom Tov/special davening is Most Important and overrides lower-priority duplicate Shacharis/Mincha/Maariv.
- User-created Schedule Change/Event can have a triage level.
- Calendar and preview must use the same resolved schedule.

## Monthly Setup
- Group by Yom Tov/occasion.
- Tishrei groups: Rosh Hashana, Tzom Gedalia, Yom Kippur, Sukkos, Hoshana Rabbah, Shemini Atzeres, Simchas Torah.
- Nissan: Erev Pesach, Pesach Days 1–2, Pesach Days 7–8.
- Sivan: Shavuos.
- Every Yom Tov has Shacharis setup.
- Shacharis supports fixed shul time OR Sunrise + offset; manual per-date/year override preserves the underlying rule.
- Begin Prep After is a separate MyZmanim-derived threshold.
- After-nightfall Yom Tov candle lighting and Yom Tov Ends use Settings end-of-day offset.
- First-night Erev Yom Tov candle lighting remains the correct pre-sunset time.

## Settings
- Edit shul name and ZIP and save to Supabase.
- End-of-day rule: 42 / 60 / 72 / custom integer minutes after sunset.
- MyZmanim status/source admin-only. Do not claim live API data unless live integration is actually available.

## Calendar
- Show actual minyanim, special times, events, Rosh Chodesh/Yom Tov/fast labels in each day; never “1 scheduled”.
- Every Shabbos automatically shows the Parsha (Diaspora schedule).
- Clicking a day shows effective schedule, date preview, and editable existing events/notices.
- Add Print Calendar button for clean landscape monthly print/PDF with actual content.

## Notices & Events
- Create, edit, archive/unarchive, delete.
- Recurrence support.
- Triage selector.
- PUSH NOW max 2/day server-side; PUSH NOW occupies Priority Box.

## Magnets
- Healthy / Needs Attention / Total are clickable filters.
- Real device rows with battery and last check-in.
- Needs Attention drilldown includes household/contact details.
