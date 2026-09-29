# src/server

Server-only infrastructure belongs here.

## Boundary
- Server modules must use `import "server-only"` when they can expose privileged behavior or secrets.
- `SUPABASE_SERVICE_ROLE_KEY` is allowed only in this boundary.
- Client components and `src/lib/` must never import from `src/server/`.
- External providers should be wrapped here or behind domain adapters rather than called directly from UI code.
