# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: placement.spec.ts >> Student onboarding, persisted Assessment and choice have labels, keyboard and WCAG AA
- Location: tests\a11y\placement.spec.ts:31:5

# Error details

```
Error: expect(locator).toBeFocused() failed

Locator:  getByLabel('Sua resposta')
Expected: focused
Received: inactive
Timeout:  5000ms

Call log:
  - Expect "toBeFocused" getByLabel('Sua resposta') with timeout 5000ms
  - waiting for getByLabel('Sua resposta')
    14 × locator resolved to <select class="yas-field-control" id="_R_1uatpesndl9et5rlb_">…</select>
       - unexpected value "inactive"

```

```yaml
- combobox "Sua resposta":
  - option "Selecione uma opção"
  - option "I work from home." [selected]
  - option "I works from home."
```

# Test source

```ts
  1  | import AxeBuilder from "@axe-core/playwright";
  2  | import { createClient } from "@supabase/supabase-js";
  3  | import { expect, test, type Page } from "@playwright/test";
  4  | import { loginCanonicalTeacher } from "../helpers/teacher-mfa";
  5  | import { loginCanonicalAdmin } from "../helpers/admin-mfa";
  6  | const password = process.env.CANONICAL_E2E_PASSWORD;
  7  | if (!password) throw new Error("Placement accessibility requires canonical local Supabase.");
  8  | async function check(page: Page) {
  9  |   await expect(page.getByRole("main")).toBeVisible();
  10 |   const result = await new AxeBuilder({ page })
  11 |     .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
  12 |     .analyze();
  13 |   expect(result.violations).toEqual([]);
  14 |   expect(
  15 |     await page.evaluate(
  16 |       () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  17 |     ),
  18 |   ).toBeLessThanOrEqual(1);
  19 | }
  20 | async function login(page: Page, suffix: string) {
  21 |   await page.goto("/login");
  22 |   await page.getByLabel("E-mail").fill(`canonical.placement-${suffix}@example.test`);
  23 |   await page.getByLabel("Senha").fill(password!);
  24 |   const response = page.waitForResponse(
  25 |     (r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/login",
  26 |   );
  27 |   await page.getByRole("button", { name: "Entrar", exact: true }).click();
  28 |   expect((await response).status()).toBeLessThan(400);
  29 |   await expect(page).toHaveURL(/\/home$/);
  30 | }
  31 | test("Student onboarding, persisted Assessment and choice have labels, keyboard and WCAG AA", async ({
  32 |   page,
  33 |   browser,
  34 | }) => {
  35 |   await login(page, "resume");
  36 |   await page.goto("/onboarding/assessment");
  37 |   await page.getByLabel("Sua resposta").focus();
> 38 |   await expect(page.getByLabel("Sua resposta")).toBeFocused();
     |                                                 ^ Error: expect(locator).toBeFocused() failed
  39 |   await page.keyboard.press("Tab");
  40 |   await expect(page.getByRole("button", { name: "Item anterior" })).not.toBeFocused();
  41 |   await check(page);
  42 |   const context = await browser.newContext(),
  43 |     ready = await context.newPage();
  44 |   await login(ready, "ready");
  45 |   await ready.goto("/onboarding");
  46 |   await check(ready);
  47 |   const nextAction = ready.getByRole("button", { name: "Ver recomendação e turmas" });
  48 |   const choiceAction = ready.getByRole("link", { name: "Escolher turma" });
  49 |   await ((await nextAction.count()) ? nextAction : choiceAction).focus();
  50 |   await ready.keyboard.press("Enter");
  51 |   await expect(ready).toHaveURL(/\/onboarding\/placement$/);
  52 |   await check(ready);
  53 |   await context.close();
  54 | });
  55 | test("Teacher scoped review preserves keyboard and WCAG AA", async ({ browser }) => {
  56 |   const admin = createClient(
  57 |     process.env.NEXT_PUBLIC_SUPABASE_URL!,
  58 |     process.env.SUPABASE_SERVICE_ROLE_KEY!,
  59 |     { auth: { persistSession: false } },
  60 |   );
  61 |   const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
  62 |   const u = users.users.find((u) => u.email === "canonical.placement-pending@example.test");
  63 |   const { data: c } = await admin
  64 |     .from("placement_cases")
  65 |     .select("id")
  66 |     .eq("user_id", u!.id)
  67 |     .single();
  68 |   const teacher = await browser.newContext(),
  69 |     page = await teacher.newPage();
  70 |   await loginCanonicalTeacher(page, password!);
  71 |   await page.goto("/teacher/revisoes/placement");
  72 |   await check(page);
  73 |   await page.goto(`/teacher/revisoes/placement/${c!.id}`);
  74 |   await page.getByLabel("Feedback para o aluno").focus();
  75 |   await page.keyboard.press("Tab");
  76 |   await expect(page.getByLabel("Confiança na recomendação")).toBeFocused();
  77 |   await check(page);
  78 |   await teacher.close();
  79 | });
  80 | test("Admin queue preserves keyboard and WCAG AA", async ({ browser }) => {
  81 |   const staff = await browser.newContext(),
  82 |     staffPage = await staff.newPage();
  83 |   await loginCanonicalAdmin(staffPage, password!);
  84 |   await staffPage.goto("/admin/enrollments");
  85 |   await staffPage.getByLabel("Filtrar por etapa").focus();
  86 |   await staffPage.keyboard.press("Tab");
  87 |   await expect(staffPage.getByRole("button", { name: "Filtrar", exact: true })).toBeFocused();
  88 |   await check(staffPage);
  89 |   await staff.close();
  90 | });
  91 | 
```