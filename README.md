# Magnets Admin Starter

Starter implementation of the multi-tenant organization portal for the Magnets project.

## What is included

- Organization dashboard
- Month-view schedule/calendar
- English + Hebrew date labels
- Multi-day selection
- Schedule templates
- "Add Notice" workflow
- Immediate-push counter (2/day in the demo)
- E-paper style screen preview
- Device/fleet status page
- Company Super Admin page
- Supabase/Postgres starter schema
- Row Level Security starter policies
- Server-side immediate-push limit function

## Run locally

1. Install Node.js 20+
2. `npm install`
3. `npm run dev`

The frontend currently uses local mock data on purpose. This lets the UX be refined before a real Supabase project is connected.

## Recommended production stack

- Frontend: React + TypeScript
- Source control: GitHub
- Database/Auth/API: Supabase
- Visual/rapid editing: Lovable, synced with GitHub
- Screen rendering: server-side worker/function
- Device API: authenticated low-bandwidth endpoint for cellular magnets

## Next development steps

1. Connect Supabase auth.
2. Replace mock data with organization-scoped queries.
3. Add a real Hebrew-calendar/zmanim data service.
4. Add date-range schedule editor with custom overrides.
5. Add preview rendering using the exact 648x480 production template.
6. Add organization onboarding wizard.
7. Add secure device provisioning/API credentials.
8. Add push queue semantics that match the final LTE-M/NB-IoT wake architecture.
9. Add audit logging and support "View as Organization" controls.
10. Add automated tests and GitHub Actions.

## Security note

The included migration is a starter, not a complete production security review. Super-admin authorization should be implemented with a trusted custom-claims/role design, and device endpoints should not use ordinary end-user sessions.
