# src/lib

Client-safe infrastructure helpers and shared utilities live here.

## Boundary

- Code in this directory may be imported by browser bundles unless a narrower boundary says otherwise.
- Never import server secrets or `src/server/*` from this directory.
- Browser Supabase code may use only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Domain rules belong in `src/modules/`, not in generic utility files.
