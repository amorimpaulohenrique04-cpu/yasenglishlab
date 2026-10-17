# Yas typography assets

Inter (variable 100–900) and Montserrat (700/800) are the exact WOFF2 bytes emitted by the existing successful Next 16.3.8 build of this repository before the PR #80 gate repair. All seven Inter and five Montserrat subsets are retained; Montserrat's two weights share the same variable subset files. No glyph, weight, unicode range or fallback metric was changed.

`manifest.json` records SHA-256 and the original generated asset name for each file. `src/app/fonts.css` preserves the generated font-face declarations and fallback metrics; the root layout preloads the two Latin subsets as before. The CSS custom properties remain `--yas-font-inter` and `--yas-font-montserrat`.

Source: [Google Fonts Inter](https://fonts.google.com/specimen/Inter) and [Google Fonts Montserrat](https://fonts.google.com/specimen/Montserrat). Fonts are distributed under the accompanying SIL Open Font License files, obtained from the respective [Inter](https://github.com/google/fonts/tree/main/ofl/inter) and [Montserrat](https://github.com/google/fonts/tree/main/ofl/montserrat) directories.

Reason: Next 16.3.8's Google font URL parser fails when the upstream CSS returns extensionless URLs containing query parameters. A controlled reproduction produced the CI error; see [Next #99114](https://github.com/vercel/next.js/issues/99114) and [fix #100158](https://github.com/vercel/next.js/pull/100158). Vendoring eliminates runtime build dependency on Google responses without changing the bundler or the font design.

When updating typography, review the product goldens and licenses, update the manifest, and retain the offline build and integrity checks. Do not replace these assets merely to make a visual test pass.
