import { execFileSync } from "node:child_process";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { loginCanonicalTeacher } from "../helpers/teacher-mfa";

const password = process.env.CANONICAL_E2E_PASSWORD;
if (process.env.CANONICAL_E2E !== "1" || !password)
  throw new Error("Teacher students E2E requires canonical local fixture.");

test("Students list and profile workspace", async ({ page }) => {
  test.setTimeout(240_000);
  await loginCanonicalTeacher(page, password);
  await page.goto("/teacher/alunos");

  const tabs = page.getByRole("tablist", { name: "Filtrar alunos por acompanhamento" });
  for (const name of ["Todos os alunos", "Precisam de atenção", "Com pendências", "Sem atividade"])
    await expect(tabs.getByRole("tab", { name })).toBeVisible({ timeout: 30_000 });

  // Sorting
  const table = page.getByRole("table");
  const progressHeader = table.getByRole("columnheader", { name: /Progresso/ });
  await progressHeader.getByRole("button").click();
  await expect(page).toHaveURL(/order=progress/);
  await expect(progressHeader).toHaveAttribute("aria-sort", "descending");

  // Search
  await page.getByLabel("Buscar aluno por nome ou turma").fill("Cohort Student A");
  await expect(page).toHaveURL(/q=Cohort(\+|%20)Student(\+|%20)A/);
  await expect(table.getByRole("link", { name: "Cohort Student A", exact: true })).toBeVisible();
  await expect(table.getByRole("link", { name: /Cohort Student B/ })).toHaveCount(0);

  // Kebab
  await page.getByRole("button", { name: "Mais ações para Cohort Student A" }).first().click();
  await expect(page.getByRole("menuitem", { name: "Sessões do aluno" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Ver perfil" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(
    table.getByRole("link", { name: "Abrir perfil de Cohort Student A" }).first(),
  ).toHaveAttribute("href", /\/teacher\/alunos\//);

  // Profile
  await table.getByRole("link", { name: "Cohort Student A", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Cohort Student A", level: 1 })).toBeVisible({
    timeout: 30_000,
  });
  const profileTabs = page.getByRole("tablist", { name: "Seções do perfil pedagógico" });
  for (const tab of [/^Resumo/, /^Atividades/, /^Avaliações/, /^Notas internas/])
    await expect(profileTabs.getByRole("tab", { name: tab })).toBeVisible();

  await profileTabs.getByRole("tab", { name: /^Atividades/ }).click();
  await expect(page.getByRole("heading", { name: "Histórico de atividades" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sessões, presença e tarefas" })).toBeVisible();
  // Independent pagination footers for events and sessions.
  await expect(page.locator("footer").filter({ hasText: /registros de atividade/ })).toBeVisible();
  await expect(page.locator("footer").filter({ hasText: /sessões/ })).toBeVisible();
  expect(await page.getByRole("navigation", { name: "Paginação" }).count()).toBeGreaterThanOrEqual(
    2,
  );

  await profileTabs.getByRole("tab", { name: /^Resumo/ }).click();
  await expect(page.getByRole("heading", { name: "Progresso curricular" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Acompanhamento", level: 2 })).toBeVisible();
  for (const label of ["7 dias", "Anterior"])
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/na semana anterior/)).toHaveCount(0);
  await page.getByRole("button", { name: "Como calculamos" }).click();
  const how = page.getByRole("dialog", { name: "Como calculamos" });
  await expect(how).toBeVisible();
  await expect(how).toContainText(/alerta de sete dias/);
  await page.keyboard.press("Escape");
  await expect(how).toBeHidden();
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations).toEqual([]);
});

test("Students list: next actions, pending tab, portfolio", async ({ page }) => {
  test.setTimeout(240_000);
  await loginCanonicalTeacher(page, password);
  await page.goto("/teacher/alunos");
  const actions = page.getByRole("region", { name: "Próximas ações" });
  await expect(actions).toBeVisible({ timeout: 30_000 });
  const hrefs = await actions
    .locator("ul a")
    .evaluateAll((links) => links.map((a) => a.getAttribute("href") ?? ""));
  if (hrefs.length > 0)
    expect(hrefs.some((h) => /\/teacher\/(revisoes|alunos)/.test(h))).toBe(true);

  const pendingTab = page
    .getByRole("tablist", { name: "Filtrar alunos por acompanhamento" })
    .getByRole("tab", { name: /Com pendências/ });
  await pendingTab.click();
  await expect(page).toHaveURL(/tab=pending/);
  await expect(pendingTab).toHaveAttribute("aria-selected", "true");
  await expect(pendingTab).toContainText(/\d/);
  await page.goto("/teacher/alunos");

  // Desktop: the portfolio is an always-open section beside "Próximas ações".
  const dist = page.getByRole("heading", { name: "Distribuição por curso" });
  await expect(page.getByRole("heading", { name: "Visão da carteira" }).first()).toBeVisible();
  await expect(dist).toBeVisible();
  const portfolioDesktop = page.locator("details").filter({ hasText: "Visão da carteira" }).first();
  await expect(portfolioDesktop.locator("summary")).toBeHidden();
  await expect(page.getByText(/Base: \d+ alunos? matriculados?/)).toBeVisible();
  await expect(page.getByText(/\d+ alunos? aguardando matrícula/)).toBeVisible();
  await expect(portfolioDesktop).not.toContainText("Sem matrícula");

  // Mobile: collapsed <details> that opens on click.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/teacher/alunos");
  const portfolio = page.locator("details").filter({ hasText: "Visão da carteira" }).first();
  await expect(portfolio).toBeVisible({ timeout: 30_000 });
  await expect(portfolio).not.toHaveAttribute("open", /.*/);
  await portfolio.locator("summary").click();
  await expect(portfolio).toHaveAttribute("open", /.*/);
  await expect(portfolio.getByRole("heading", { name: "Distribuição por curso" })).toBeVisible();
  await expect(portfolio).not.toContainText("Sem matrícula");
});

test("Student profile: pending review CTA and follow-up card", async ({ page }) => {
  test.setTimeout(240_000);
  // Earlier specs (teacher-pedagogy, teacher-entry-workspace) review and consume the fixture's
  // pending items, so this test restores its own precondition.
  execFileSync(process.execPath, ["scripts/setup-canonical-e2e.mjs"], {
    env: process.env,
    stdio: "inherit",
  });
  await loginCanonicalTeacher(page, password);
  await page.goto("/teacher/alunos?tab=pending");
  const table = page.getByRole("table");
  await expect(table).toBeVisible({ timeout: 30_000 });
  const hrefs = await table
    .getByRole("link", { name: /^Abrir perfil de / })
    .evaluateAll((links) => links.map((a) => a.getAttribute("href") ?? ""));
  expect(
    hrefs.length,
    "canonical fixture must have a student with a pending review",
  ).toBeGreaterThan(0);
  // Every student in "Com pendências" has a review waiting, so the profile must lead with it.
  for (const href of hrefs.slice(0, 2)) {
    await page.goto(href);
    await expect(
      page.getByRole("heading", { name: "Acompanhamento", level: 2, exact: true }),
    ).toBeVisible({
      timeout: 30_000,
    });
    for (const label of ["Engajamento", "Ritmo", "Última interação", "Próxima sessão"])
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    // Hero CTA carries a context line about the submission it opens.
    await expect(page.getByText(/Enviad[ao] há/).first()).toBeVisible();
    const cta = page.getByRole("link", { name: /^Revisar (prática|teste de entrada)$/ }).first();
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", /^\/teacher\/revisoes\//);
    await page.getByRole("button", { name: "Mais ações" }).click();
    await expect(
      page.getByRole("menuitem", { name: /Pedir novo teste|Novo teste solicitado/ }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
  }
});

test("Students list: axe on mobile", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await loginCanonicalTeacher(page, password);
  await page.goto("/teacher/alunos");
  await expect(page.getByRole("heading", { name: "Próximas ações" })).toBeVisible({
    timeout: 30_000,
  });
  await page.screenshot({
    path: "harness/evidence/teacher-students-refinement/list-mobile.png",
    fullPage: false,
  });
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations).toEqual([]);
});

test("Student profile: mobile evidence", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await loginCanonicalTeacher(page, password);
  await page.goto("/teacher/alunos");
  const link = page.getByRole("link", { name: /^Abrir perfil de Cohort Student A/ }).first();
  await expect(link).toBeVisible({ timeout: 30_000 });
  await page.goto((await link.getAttribute("href")) ?? "/teacher/alunos");
  await expect(page.getByRole("heading", { name: "Cohort Student A", level: 1 })).toBeVisible({
    timeout: 30_000,
  });
  await page.screenshot({
    path: "harness/evidence/teacher-students-refinement/profile-mobile.png",
    fullPage: false,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(1);
  // Panels fade in (CSS and Motion, which animates inline opacity); measure contrast on the
  // settled colors, not a mid-fade frame.
  await page.waitForFunction(
    () =>
      document.getAnimations().every((animation) => animation.playState !== "running") &&
      [...document.querySelectorAll<HTMLElement>("main [style*='opacity']")].every(
        (element) => getComputedStyle(element).opacity === "1",
      ),
  );
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations).toEqual([]);
});

test("Students list: metadata contrast and minimum font size", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginCanonicalTeacher(page, password);
  await page.goto("/teacher/alunos");
  await expect(page.getByRole("table")).toBeVisible({ timeout: 30_000 });
  const result = await page.evaluate(() => {
    const parse = (c: string) => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m?.[1]) return null;
      const [r = 0, g = 0, b = 0, a = 1] = m[1]
        .split(/[ ,/]+/)
        .filter(Boolean)
        .map(Number);
      return { r, g, b, a };
    };
    const lum = (c: { r: number; g: number; b: number }) => {
      const f = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    };
    const blend = (
      top: NonNullable<ReturnType<typeof parse>>,
      bot: { r: number; g: number; b: number },
    ) => ({
      r: top.r * top.a + bot.r * (1 - top.a),
      g: top.g * top.a + bot.g * (1 - top.a),
      b: top.b * top.a + bot.b * (1 - top.a),
    });
    const bgOf = (el: Element) => {
      const stack: NonNullable<ReturnType<typeof parse>>[] = [];
      for (let n: Element | null = el; n; n = n.parentElement) {
        const c = parse(getComputedStyle(n).backgroundColor);
        if (c && c.a > 0) {
          stack.push(c);
          if (c.a >= 1) break;
        }
      }
      let base = { r: 255, g: 255, b: 255 };
      for (const c of stack.reverse()) base = blend(c, base);
      return base;
    };
    const low: string[] = [];
    const small: string[] = [];
    const main = document.querySelector("main") ?? document.body;
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    const seen = new Set<Element>();
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      const el = t.parentElement;
      if (!el || seen.has(el) || !t.textContent?.trim()) continue;
      seen.add(el);
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (cs.visibility === "hidden" || cs.display === "none" || rect.width === 0) continue;
      // Decorative text (aria-hidden) is exempt from WCAG 1.4.3.
      if (el.closest('[aria-hidden="true"]')) continue;
      const label = `${el.tagName}.${String(el.className).slice(0, 30)}"${t.textContent.trim().slice(0, 24)}"`;
      if (parseFloat(cs.fontSize) < 12) small.push(`${label} ${cs.fontSize}`);
      const fg = parse(cs.color);
      if (!fg) continue;
      const bg = bgOf(el);
      const eff = blend(fg, bg);
      const l1 = lum(eff);
      const l2 = lum(bg);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const disabled = el.closest("[disabled],[aria-disabled=true]");
      if (ratio < 4.5 && !disabled) low.push(`${label} ${ratio.toFixed(2)}`);
    }
    return { low, small };
  });
  expect(result.small, `font-size < 12px: ${result.small.join(" | ")}`).toEqual([]);
  expect(result.low, `contrast < 4.5: ${result.low.join(" | ")}`).toEqual([]);
});
