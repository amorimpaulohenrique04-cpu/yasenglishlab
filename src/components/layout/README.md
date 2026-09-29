# Yas layout primitives

- `AppShell` — desktop shell composition; collapses to one-column content at the layout breakpoint.
- `Sidebar` — deep-purple primary navigation for desktop/tablet-wide contexts.
- `Topbar` — start/end slots for search, mobile menu trigger, notifications and profile controls.
- `ContentContainer` — shared horizontal rhythm/max-width.

Mobile navigation is intentionally composed with the reusable `Drawer` primitive instead of shrinking the desktop Sidebar into an unreadable column.

These are layout primitives, not complete product pages.
