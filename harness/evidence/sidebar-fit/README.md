# Sidebar fit + Prática weekly summary — golden promotion

PR: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/pull/85

Official CI run 39092962804 (head fe7d88f) failed only `Preview (visual)`: desktop goldens
`home`, `aulas`, `progresso` differed by ~1% of pixels. Tablet/mobile passed (no sidebar there).

Review of the CI diff images: every changed pixel is inside the sidebar (tighter vertical rhythm from the
intentional dvh-based compaction). Page content is identical. The product owner explicitly approved the
promotion on 2026-10-18. The CI-rendered `*-actual.png` files were promoted to
`tests/visual/goldens/desktop/{home,aulas,progresso}-linux.png`.

Not updated: the `*-win32.png` desktop baselines (local Windows runs only). The machine had ~1 GB free, not
enough for the Supabase + Playwright golden stack. Regenerate with `npm run test:visual:update` on Windows.
