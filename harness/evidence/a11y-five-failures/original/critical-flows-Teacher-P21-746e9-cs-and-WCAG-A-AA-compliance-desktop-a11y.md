# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: critical-flows.spec.ts >> Teacher P21 operations pages preserve form semantics and WCAG A/AA compliance
- Location: tests\a11y\critical-flows.spec.ts:227:5

# Error details

```
Error: [
  {
    "id": "aria-prohibited-attr",
    "impact": "serious",
    "tags": [
      "cat.aria",
      "wcag2a",
      "wcag412",
      "EN-301-549",
      "EN-9.4.1.2",
      "RGAAv4",
      "RGAA-7.1.1"
    ],
    "description": "Ensure ARIA attributes are not prohibited for an element's role",
    "help": "Elements must only use permitted ARIA attributes",
    "helpUrl": "https://dequeuniversity.com/rules/axe/4.13/aria-prohibited-attr?application=playwright",
    "nodes": [
      {
        "any": [],
        "all": [],
        "none": [
          {
            "id": "aria-prohibited-attr",
            "data": {
              "role": null,
              "nodeName": "div",
              "messageKey": "noRoleSingular",
              "prohibited": [
                "aria-label"
              ]
            },
            "relatedNodes": [],
            "impact": "serious",
            "message": "aria-label attribute cannot be used on a div with no valid role attribute."
          }
        ],
        "impact": "serious",
        "html": "<div class=\"teacher-operations-module__w4zjFq__page\" aria-busy=\"true\" aria-label=\"Carregando área do professor\">",
        "target": [
          ":root"
        ],
        "failureSummary": "Fix all of the following:\n  aria-label attribute cannot be used on a div with no valid role attribute."
      }
    ]
  }
]

expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 47

- Array []
+ Array [
+   Object {
+     "description": "Ensure ARIA attributes are not prohibited for an element's role",
+     "help": "Elements must only use permitted ARIA attributes",
+     "helpUrl": "https://dequeuniversity.com/rules/axe/4.13/aria-prohibited-attr?application=playwright",
+     "id": "aria-prohibited-attr",
+     "impact": "serious",
+     "nodes": Array [
+       Object {
+         "all": Array [],
+         "any": Array [],
+         "failureSummary": "Fix all of the following:
+   aria-label attribute cannot be used on a div with no valid role attribute.",
+         "html": "<div class=\"teacher-operations-module__w4zjFq__page\" aria-busy=\"true\" aria-label=\"Carregando área do professor\">",
+         "impact": "serious",
+         "none": Array [
+           Object {
+             "data": Object {
+               "messageKey": "noRoleSingular",
+               "nodeName": "div",
+               "prohibited": Array [
+                 "aria-label",
+               ],
+               "role": null,
+             },
+             "id": "aria-prohibited-attr",
+             "impact": "serious",
+             "message": "aria-label attribute cannot be used on a div with no valid role attribute.",
+             "relatedNodes": Array [],
+           },
+         ],
+         "target": Array [
+           ":root",
+         ],
+       },
+     ],
+     "tags": Array [
+       "cat.aria",
+       "wcag2a",
+       "wcag412",
+       "EN-301-549",
+       "EN-9.4.1.2",
+       "RGAAv4",
+       "RGAA-7.1.1",
+     ],
+   },
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=f3e1]:
  - generic [ref=f3e2]:
    - complementary [ref=f3e3]:
      - link "Yas English Lab · Professor" [ref=f3e5] [cursor=pointer]:
        - /url: /teacher
        - generic [ref=f3e6]: Yas
        - generic [ref=f3e7]: English Lab · Professor
      - navigation "Navegação do professor" [ref=f3e8]:
        - list [ref=f3e9]:
          - listitem [ref=f3e10]:
            - link "Início" [ref=f3e11] [cursor=pointer]:
              - /url: /teacher
          - listitem [ref=f3e17]:
            - link "Sessões" [ref=f3e18] [cursor=pointer]:
              - /url: /teacher/sessoes
          - listitem [ref=f3e24]:
            - link "Turmas" [ref=f3e25] [cursor=pointer]:
              - /url: /teacher/turmas
          - listitem [ref=f3e31]:
            - link "Alunos" [ref=f3e32] [cursor=pointer]:
              - /url: /teacher/alunos
          - listitem [ref=f3e38]:
            - link "Revisões" [ref=f3e39] [cursor=pointer]:
              - /url: /teacher/revisoes
          - listitem [ref=f3e45]:
            - link "Disponibilidade" [ref=f3e46] [cursor=pointer]:
              - /url: /teacher/disponibilidade
      - generic [ref=f3e52]: Teacher Operations
    - generic [ref=f3e53]:
      - banner [ref=f3e54]:
        - generic [ref=f3e55]: Área do professor
        - link "Yasmin Yasmin" [ref=f3e58] [cursor=pointer]:
          - /url: /profile
          - img "Yasmin" [ref=f3e59]:
            - generic [aria-hidden] [ref=f3e60]: "Y"
          - generic [ref=f3e61]: Yasmin
      - main [ref=f3e62]:
        - generic [ref=f3e64]:
          - generic [ref=f3e66]:
            - heading "Disponibilidade" [level=1] [ref=f3e67]
            - paragraph [ref=f3e68]: Defina intervalos explícitos para seus encontros.
          - generic [ref=f3e70]:
            - generic [ref=f3e71]:
              - generic [ref=f3e72]: Início com fuso *
              - textbox "Início com fuso *" [ref=f3e73]:
                - /placeholder: 2026-10-10T09:00:00-03:00
            - generic [ref=f3e75]:
              - generic [ref=f3e76]: Término com fuso *
              - textbox "Término com fuso *" [ref=f3e77]:
                - /placeholder: 2026-10-10T18:00:00-03:00
            - button "Adicionar intervalo" [ref=f3e79] [cursor=pointer]
  - button "Open Next.js Dev Tools" [ref=f3e86] [cursor=pointer]
  - alert [ref=f3e90]
```

# Test source

```ts
  1   | import AxeBuilder from "@axe-core/playwright";
  2   | import { expect, test, type Page } from "@playwright/test";
  3   | 
  4   | import { canonicalTeacherSessionId, loginCanonicalTeacher } from "../helpers/teacher-mfa";
  5   | import { loginCanonicalAdmin } from "../helpers/admin-mfa";
  6   | 
  7   | const email = "canonical.student@example.test";
  8   | const password = process.env.CANONICAL_E2E_PASSWORD;
  9   | 
  10  | if (process.env.CANONICAL_E2E !== "1" || !password) {
  11  |   throw new Error("A11y critical-flow tests require the canonical local Supabase fixture.");
  12  | }
  13  | 
  14  | async function assertAxe(page: Page) {
  15  |   const results = await new AxeBuilder({ page })
  16  |     .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
  17  |     .analyze();
> 18  |   expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
      |                                                                           ^ Error: [
  19  | }
  20  | 
  21  | async function login(page: Page, loginEmail = email) {
  22  |   await page.goto("/login");
  23  |   await page.getByLabel("E-mail").fill(loginEmail);
  24  |   await page.getByLabel("Senha").fill(password!);
  25  |   await page.getByRole("button", { name: "Entrar" }).click();
  26  |   await expect(page).toHaveURL(/\/home$/);
  27  | }
  28  | 
  29  | test("login exposes landmarks, labels, keyboard focus and WCAG A/AA compliance", async ({
  30  |   page,
  31  | }) => {
  32  |   await page.goto("/login");
  33  |   await expect(page.getByRole("main")).toBeVisible();
  34  |   await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  35  |   await expect(page.getByLabel("E-mail")).toBeVisible();
  36  |   await expect(page.getByLabel("Senha")).toBeVisible();
  37  | 
  38  |   await page.getByLabel("E-mail").focus();
  39  |   await page.keyboard.press("Tab");
  40  |   await expect(page.getByLabel("Senha")).toBeFocused();
  41  |   await assertAxe(page);
  42  | });
  43  | 
  44  | test("Home and Aulas preserve landmarks, focusable navigation and axe compliance", async ({
  45  |   page,
  46  | }) => {
  47  |   await login(page);
  48  | 
  49  |   await expect(page.getByRole("main")).toBeVisible();
  50  |   await expect(page.getByRole("heading", { name: "Olá 👋" })).toBeVisible();
  51  | 
  52  |   const primaryAction = page.getByRole("link", { name: "Começar aula →" });
  53  |   await primaryAction.focus();
  54  |   await expect(primaryAction).toBeFocused();
  55  |   await expect(
  56  |     page.getByRole("progressbar", { name: "Conclusão de Yas Foundations" }),
  57  |   ).toBeVisible();
  58  |   await assertAxe(page);
  59  | 
  60  |   if ((page.viewportSize()?.width ?? 1440) < 1024) {
  61  |     const menuButton = page.getByRole("button", { name: "Abrir navegação" });
  62  |     await menuButton.focus();
  63  |     await expect(menuButton).toBeFocused();
  64  |     await menuButton.click();
  65  |     const mobileNav = page.getByRole("navigation", { name: "Navegação mobile" });
  66  |     await expect(mobileNav).toBeVisible();
  67  |     await assertAxe(page);
  68  |     await mobileNav.getByRole("link", { name: "Aulas", exact: true }).click();
  69  |   } else {
  70  |     const navigation = page.getByRole("navigation").first();
  71  |     await expect(navigation).toBeVisible();
  72  |     const aulasLink = navigation.getByRole("link", { name: "Aulas", exact: true });
  73  |     await aulasLink.focus();
  74  |     await expect(aulasLink).toBeFocused();
  75  |     await assertAxe(page);
  76  |     await aulasLink.click();
  77  |   }
  78  | 
  79  |   await expect(page.getByRole("heading", { name: "Aulas", exact: true })).toBeVisible();
  80  |   await expect(page.getByRole("main")).toBeVisible();
  81  |   await assertAxe(page);
  82  | 
  83  |   const moduleLink = page.getByRole("link", { name: "Abrir módulo →" });
  84  |   await moduleLink.focus();
  85  |   await expect(moduleLink).toBeFocused();
  86  |   await moduleLink.click();
  87  |   await expect(page).toHaveURL(/\/aulas\/[^/]+\/modulos\/[^/]+$/);
  88  |   await expect(page.getByRole("heading", { level: 1, name: "Getting Started" })).toBeVisible();
  89  |   await assertAxe(page);
  90  | 
  91  |   const lessonLink = page.getByRole("link", { name: /aula →$/ }).first();
  92  |   await lessonLink.focus();
  93  |   await expect(lessonLink).toBeFocused();
  94  |   await lessonLink.click();
  95  |   await expect(page).toHaveURL(/\/aulas\/[^/]+\/modulos\/[^/]+\/aulas\/[^/]+$/);
  96  |   await expect(page.getByRole("heading", { level: 1, name: "Welcome to Yas" })).toBeVisible();
  97  |   await expect(page.getByRole("navigation", { name: "Navegação entre aulas" })).toBeVisible();
  98  |   await assertAxe(page);
  99  | });
  100 | 
  101 | test("Materiais preserves search labels, keyboard focus and WCAG A/AA compliance", async ({
  102 |   page,
  103 | }) => {
  104 |   await login(page);
  105 |   await page.goto("/materiais");
  106 | 
  107 |   await expect(page.getByRole("main")).toBeVisible();
  108 |   await expect(page.getByRole("heading", { name: "Materiais", exact: true })).toBeVisible();
  109 |   await expect(page.getByLabel("Buscar materiais")).toBeVisible();
  110 |   await expect(page.getByRole("navigation", { name: "Categorias de materiais" })).toBeVisible();
  111 | 
  112 |   const favorite = page.getByRole("button", { name: "Favoritar Welcome Summary" });
  113 |   await favorite.focus();
  114 |   await expect(favorite).toBeFocused();
  115 |   await assertAxe(page);
  116 | });
  117 | 
  118 | test("Prática exposes skill availability, keyboard controls and WCAG A/AA compliance", async ({
```