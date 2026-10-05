# Agent Plan

## Active task

**admin-home-approved-design**

Branch `refactor/admin-home-approved-design`, based on `main`.

1. Preserve the Admin home Server Component contract: the same four reads stay inside one `Promise.all`, with no new data source, route, migration, auth, RLS, or Server Action.
2. Refactor only `src/app/(protected)/(admin)/admin/page.tsx` and `src/app/(protected)/(admin)/admin/admin-overview.module.css` unless a real shell defect appears.
3. Map the reference to real data: Leads, active Cohorts, Placement Review Pending, and Student Decision. Omit fake search, notifications, charts, agenda, payments, reports, and settings.
4. Build the hierarchy as header, metric strip, operational onboarding summary, priority tasks, and real shortcuts/lists with responsive CSS modules and existing primitives.
5. Validate with changed-file Prettier/ESLint, typecheck, focused Admin a11y/smoke, visual review at 1440x900, 834x1112, and 390x844, then `verify:agent`, `verify:ui`, and one final `verify:full`.
