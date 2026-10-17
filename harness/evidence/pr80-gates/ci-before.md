# CI #703 before repair

Run: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/39004676948
Head: 0592091c47c343a0aedfbdfd8e7cf5e821a568ef. Actions checkout: merge SHA 5d16e7601886b96f42fdbe88637e6b0c52040714.

Compared jobs use Ubuntu 24, Node 24.21.0, npm ci and the same lockfile. Quality/e2e compile; visual fails. Only npm/Chromium caches are restored; no shared Next output or build cache was found. No evidence supports changing runner isolation. Local Node is 24.19.0, a recorded environment difference.

## visual — job 117315072512

```text
2026-10-17T05:06:00.1317579Z ⚠ No build cache found. Please configure build caching for faster rebuilds. Read more: https://nextjs.org/docs/messages/no-cache
2026-10-17T05:06:13.6436918Z Error: Turbopack build failed with 10 errors:
2026-10-17T05:06:13.6451979Z next/font/google queries have exactly one entry
2026-10-17T05:06:13.6455079Z - next/font/google queries have exactly one entry
2026-10-17T05:06:13.6455703Z Error while looking up import map: next/font/google queries have exactly one entry
2026-10-17T05:06:13.6457946Z - next/font/google queries have exactly one entry
2026-10-17T05:06:13.6467044Z next/font/google queries have exactly one entry
2026-10-17T05:06:13.6470325Z - next/font/google queries have exactly one entry
2026-10-17T05:06:13.6470875Z Error while looking up import map: next/font/google queries have exactly one entry
2026-10-17T05:06:13.6472689Z - next/font/google queries have exactly one entry
2026-10-17T05:06:13.6482968Z next/font/google queries have exactly one entry
2026-10-17T05:06:13.6485831Z - next/font/google queries have exactly one entry
2026-10-17T05:06:13.6486572Z Error while looking up import map: next/font/google queries have exactly one entry
2026-10-17T05:06:13.6488544Z - next/font/google queries have exactly one entry
2026-10-17T05:06:13.6498518Z next/font/google queries have exactly one entry
2026-10-17T05:06:13.6501568Z - next/font/google queries have exactly one entry
2026-10-17T05:06:13.6502153Z Error while looking up import map: next/font/google queries have exactly one entry
2026-10-17T05:06:13.6503738Z - next/font/google queries have exactly one entry
2026-10-17T05:06:13.6517465Z next/font/google queries have exactly one entry
2026-10-17T05:06:13.6522165Z - next/font/google queries have exactly one entry
2026-10-17T05:06:13.6523135Z Error while looking up import map: next/font/google queries have exactly one entry
2026-10-17T05:06:13.6525739Z - next/font/google queries have exactly one entry
2026-10-17T05:06:13.6540721Z next/font/google queries have exactly one entry
2026-10-17T05:06:13.6544640Z - next/font/google queries have exactly one entry
2026-10-17T05:06:13.6545265Z Error while looking up import map: next/font/google queries have exactly one entry
2026-10-17T05:06:13.6547254Z - next/font/google queries have exactly one entry
2026-10-17T05:06:13.6558369Z next/font/google queries have exactly one entry
2026-10-17T05:06:13.6561578Z - next/font/google queries have exactly one entry
2026-10-17T05:06:13.6562210Z Error while looking up import map: next/font/google queries have exactly one entry
2026-10-17T05:06:13.6563962Z - next/font/google queries have exactly one entry
2026-10-17T05:06:13.6578552Z next/font/google queries have exactly one entry
2026-10-17T05:06:13.6583160Z - next/font/google queries have exactly one entry
2026-10-17T05:06:13.6584015Z Error while looking up import map: next/font/google queries have exactly one entry
2026-10-17T05:06:13.6586479Z - next/font/google queries have exactly one entry
2026-10-17T05:06:13.6601659Z next/font/google queries have exactly one entry
2026-10-17T05:06:13.6605062Z - next/font/google queries have exactly one entry
2026-10-17T05:06:13.6605606Z Error while looking up import map: next/font/google queries have exactly one entry
2026-10-17T05:06:13.6607994Z - next/font/google queries have exactly one entry
2026-10-17T05:06:13.6622176Z next/font/google queries have exactly one entry
2026-10-17T05:06:13.6625560Z - next/font/google queries have exactly one entry
2026-10-17T05:06:13.6626119Z Error while looking up import map: next/font/google queries have exactly one entry
2026-10-17T05:06:13.6627819Z - next/font/google queries have exactly one entry
```

## e2e — job 117315072552

```text
2026-10-17T05:06:10.7558114Z ⚠ No build cache found. Please configure build caching for faster rebuilds. Read more: https://nextjs.org/docs/messages/no-cache
2026-10-17T05:08:58.4093781Z   37 passed (2.4m)
2026-10-17T05:08:58.4126320Z ##[notice]  37 passed (2.4m)
2026-10-17T05:08:58.9884012Z Error: Expected at least 1 practice_completed event(s).
```

## accessibility — job 117315072618

```text
2026-10-17T05:06:13.0421302Z ⚠ No build cache found. Please configure build caching for faster rebuilds. Read more: https://nextjs.org/docs/messages/no-cache
    TimeoutError: locator.click: Timeout 10000ms exceeded.
      - waiting for locator('.yas-practice-activity-card').filter({ has: getByRole('heading', { name: 'Canonical Speaking Review', exact: true }) }).getByRole('button', { name: 'Praticar →' })
2026-10-17T05:08:10.9973387Z     TimeoutError: locator.click: Timeout 10000ms exceeded.
2026-10-17T05:08:10.9975063Z       - waiting for locator('.yas-practice-activity-card').filter({ has: getByRole('heading', { name: 'Canonical Speaking Review', exact: true }) }).getByRole('button', { name: 'Praticar →' })
2026-10-17T05:08:10.9989113Z     TimeoutError: locator.click: Timeout 10000ms exceeded.
2026-10-17T05:08:10.9990667Z       - waiting for locator('.yas-practice-activity-card').filter({ has: getByRole('heading', { name: 'Canonical Speaking Review', exact: true }) }).getByRole('button', { name: 'Praticar →' })
2026-10-17T05:08:11.0004313Z   2 failed
2026-10-17T05:08:11.0006051Z   32 passed (1.6m)
2026-10-17T05:08:11.0009438Z ##[notice]  2 failed
  32 passed (1.6m)
2026-10-17T05:08:11.0749656Z ✗ Accessibility checks: 2 failed test(s).
```

