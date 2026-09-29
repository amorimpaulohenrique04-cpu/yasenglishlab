# RLS authorization tests

Executable authorization evidence lives in `supabase/tests/rls_permissions.sql` so the same policies that ship in migrations are exercised against PostgreSQL.

The suite proves positive and negative cases for:

- student ownership isolation;
- assigned vs unrelated teacher access;
- staff AAL2 enforcement;
- support denial of privileged billing records;
- admin AAL1 denial and AAL2 access;
- paid material and recording entitlements;
- direct role/entitlement/progress/booking mutation denial;
- anonymous denial.

CI replays migrations and the full SQL permission matrix on two fresh databases. Policy review without execution is not accepted as evidence.
