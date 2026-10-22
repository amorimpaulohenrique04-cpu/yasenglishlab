# Noto Sans for server PDF reports

Static Noto Sans Regular, unmodified, from the archived official Noto distribution:

- https://github.com/notofonts/noto-fonts/blob/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf
- License: report-noto-sans-LICENSE.txt (SIL Open Font License 1.1)
- SHA-256: b85c38ecea8a7cfb39c24e395a4007474fa5a4fc864f6ee33309eb4948d232d5

Used only by the server-side PDF generator. The app interface keeps its approved Inter/Montserrat fonts. A static TTF avoids the WOFF2 variable-font subsetting failure reproduced by session-report-pdf.test.ts.
