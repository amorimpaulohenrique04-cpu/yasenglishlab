# Domain modules

Business rules are organized by domain, not by technical file type.

## Current implementation

- `domain/` — shared entity schemas, types, analytics taxonomy and entitlement primitives.
- `auth/` — reusable authentication/security rules that do not depend on presentation.
- `learning/` — the canonical vertical slice, split into:
  - `domain/` for learning models and deterministic progress rules;
  - `application/` for queries/commands and ports;
  - `ui/` for learning-specific presentation composed from shared primitives.

Server adapters for domain ports live under `src/server/`, not inside Client Components.

## Future domains

Create a module only when real behavior exists. Expected product areas include practice, materials, assessments, schedule/live classes, billing, profile/notifications and staff experiences.

Do not create empty directory trees in advance.

## Dependency direction

```text
routes / UI
    ↓
application use cases
    ↓
domain rules + ports
    ↓
server-only adapters
    ↓
Supabase / external providers
```

Presentation must not become the system of record, and privileged provider/database access must not move into the browser.

See `docs/ARCHITECTURE.md` and the canonical learning slice before adding a new domain.
