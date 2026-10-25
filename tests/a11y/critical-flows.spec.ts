import AxeBuilder from "@axe-core/playwright";
import { settledPage } from "../helpers/settled-frame";
import { expect, test, type Page } from "@playwright/test";

import { canonicalTeacherSessionId, loginCanonicalTeacher } from "../helpers/teacher-mfa";
import { loginCanonicalAdmin } from "../helpers/admin-mfa";

const email = "canonical.student@example.test";
const password = process.env.CANONICAL_E2E_PASSWORD;

if (process.env.CANONICAL_E2E !== "1" || !password) {
  throw new Error("A11y critical-flow tests require the canonical local Supabase fixture.");
}

async function assertAxe(page: Page) {
  const results = await new AxeBuilder({ page: await settledPage(page) })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

async function login(page: Page, loginEmail = email) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(loginEmail);
  await page.getByLabel("Senha").fill(password!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/home$/);
}

test("login exposes landmarks, labels, keyboard focus and WCAG A/AA compliance", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  await expect(page.getByLabel("E-mail")).toBeVisible();
  await expect(page.getByLabel("Senha")).toBeVisible();

  await page.getByLabel("E-mail").focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Senha")).toBeFocused();
  await assertAxe(page);
});

test("Home and Aulas preserve landmarks, focusable navigation and axe compliance", async ({
  page,
}) => {
  await login(page);

  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Olá 👋" })).toBeVisible();

  const primaryAction = page.getByRole("link", { name: "Começar aula →" });
  await primaryAction.focus();
  await expect(primaryAction).toBeFocused();
  await expect(
    page.getByRole("progressbar", { name: "Conclusão de Yas Foundations" }),
  ).toBeVisible();
  await assertAxe(page);

  if ((page.viewportSize()?.width ?? 1440) < 1024) {
    const menuButton = page.getByRole("button", { name: "Abrir navegação" });
    await menuButton.focus();
    await expect(menuButton).toBeFocused();
    await menuButton.click();
    const mobileNav = page.getByRole("navigation", { name: "Navegação mobile" });
    await expect(mobileNav).toBeVisible();
    await assertAxe(page);
    await mobileNav.getByRole("link", { name: "Aulas", exact: true }).click();
  } else {
    const navigation = page.getByRole("navigation").first();
    await expect(navigation).toBeVisible();
    const aulasLink = navigation.getByRole("link", { name: "Aulas", exact: true });
    await aulasLink.focus();
    await expect(aulasLink).toBeFocused();
    await assertAxe(page);
    await aulasLink.click();
  }

  await expect(page.getByRole("heading", { name: "Aulas", exact: true })).toBeVisible();
  await expect(page.getByRole("main")).toBeVisible();
  await assertAxe(page);

  // A completed module is collapsed; open its summary before following its link.
  const firstModule = page
    .locator("details")
    .filter({ has: page.getByRole("link", { name: "Abrir módulo →", includeHidden: true }) })
    .first();
  if ((await firstModule.getAttribute("open")) === null)
    await firstModule.locator("summary").click();
  const moduleLink = firstModule.getByRole("link", { name: "Abrir módulo →" });
  await expect(moduleLink).toBeVisible();
  await moduleLink.focus();
  await expect(moduleLink).toBeFocused();
  await Promise.all([page.waitForURL(/\/aulas\/[^/]+\/modulos\/[^/]+$/), moduleLink.click()]);
  await expect(page).toHaveURL(/\/aulas\/[^/]+\/modulos\/[^/]+$/);
  await expect(page.getByRole("heading", { level: 1, name: "Getting Started" })).toBeVisible();
  await assertAxe(page);

  const lessonLink = page.getByRole("link", { name: /aula →$/ }).first();
  await lessonLink.focus();
  await expect(lessonLink).toBeFocused();
  await lessonLink.click();
  await expect(page).toHaveURL(/\/aulas\/[^/]+\/modulos\/[^/]+\/aulas\/[^/]+$/);
  await expect(page.getByRole("heading", { level: 1, name: "Welcome to Yas" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navegação entre aulas" })).toBeVisible();
  await assertAxe(page);
});

test("Materiais preserves search labels, keyboard focus and WCAG A/AA compliance", async ({
  page,
}) => {
  await login(page);
  await page.goto("/materiais");

  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Materiais", exact: true })).toBeVisible();
  await expect(page.getByLabel("Buscar materiais")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Categorias de materiais" })).toBeVisible();

  const favorite = page.getByRole("button", { name: "Favoritar Welcome Summary" });
  await favorite.focus();
  await expect(favorite).toBeFocused();
  await assertAxe(page);
});

test("Prática exposes skill availability, keyboard controls and WCAG A/AA compliance", async ({
  page,
}) => {
  await login(page);
  await page.goto("/pratica");

  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Prática", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Escolha uma habilidade" })).toBeVisible();

  const vocabulary = page.getByRole("link", { name: /Vocabulário/ }).first();
  await vocabulary.focus();
  await expect(vocabulary).toBeFocused();
  await assertAxe(page);

  // The hero starts the recommended practice, or resumes it when another project already opened it.
  await page
    .getByRole("button", { name: "Começar prática →", exact: true })
    .or(page.getByRole("link", { name: "Continuar →", exact: true }))
    .first()
    .click();
  // Multi-question practices open on a pre-task screen first.
  const start = page.getByRole("button", { name: "Começar", exact: true });
  await expect(start.or(page.getByRole("radio").first())).toBeVisible();
  if (await start.isVisible()) {
    await assertAxe(page);
    await start.click();
  }
  const answer = page.getByRole("radio").first();
  await answer.focus();
  await expect(answer).toBeFocused();
  await assertAxe(page);
});

test("Progresso preserves semantic indicators, navigation and WCAG A/AA compliance", async ({
  page,
}) => {
  await login(page);

  if ((page.viewportSize()?.width ?? 1440) < 1024) {
    const menuButton = page.getByRole("button", { name: "Abrir navegação" });
    await menuButton.click();
    const mobileNav = page.getByRole("navigation", { name: "Navegação mobile" });
    const progressLink = mobileNav.getByRole("link", { name: "Progresso", exact: true });
    await progressLink.focus();
    await expect(progressLink).toBeFocused();
    await progressLink.click();
  } else {
    const navigation = page.getByRole("navigation").first();
    const progressLink = navigation.getByRole("link", { name: "Progresso", exact: true });
    await progressLink.focus();
    await expect(progressLink).toBeFocused();
    await progressLink.click();
  }

  await expect(page.getByRole("heading", { name: "Progresso", exact: true })).toBeVisible();
  await expect(page.getByText("Nível CEFR ainda não disponível")).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Pontuação desta avaliação" })).toBeVisible();
  await assertAxe(page);
});

test("Agenda exposes booking states, disabled eligibility and WCAG A/AA compliance", async ({
  page,
}) => {
  await login(page);
  await page.goto("/agenda");

  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Agenda", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sessões disponíveis" })).toBeVisible();

  const reserve = page.getByRole("button", { name: "Reservar" }).first();
  await reserve.focus();
  await expect(reserve).toBeFocused();

  const entitlementBlocked = page.getByRole("button", { name: "Acesso não disponível" });
  await expect(entitlementBlocked).toHaveCount(2);
  await expect(entitlementBlocked.first()).toBeDisabled();

  await assertAxe(page);
});

test("Teacher Operations keeps real MFA, keyboard attendance controls and WCAG A/AA compliance", async ({
  page,
}) => {
  await loginCanonicalTeacher(page, password!);
  await page.goto("/teacher/sessoes/" + canonicalTeacherSessionId);
  await page.getByRole("tab", { name: "Participantes", exact: true }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Teacher Ops · Conversation Practice" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Participantes" })).toBeVisible();

  const present = page.getByRole("button", { name: "Marcar Teacher Ops Student como Presente" });
  const absent = page.getByRole("button", { name: "Marcar Teacher Ops Student como Ausente" });

  await present.focus();
  await expect(present).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(absent).toBeFocused();

  await assertAxe(page);
});

test("Admin Content exposes keyboard navigation and WCAG A/AA compliance", async ({ page }) => {
  if (!password) throw new Error("CANONICAL_E2E_PASSWORD is required.");

  await loginCanonicalAdmin(page, password);
  await page.goto("/admin/content?kind=modules");
  await expect(page.getByRole("main")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Administração de conteúdo", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Módulos", exact: true })).toBeVisible();

  const createModule = page.getByRole("button", { name: "Novo módulo" });
  await createModule.focus();
  await expect(createModule).toBeFocused();
  await assertAxe(page);
});

test("Admin and Teacher operation overviews preserve landmarks, focus and WCAG A/AA compliance", async ({
  page,
}) => {
  await loginCanonicalAdmin(page, password!);
  await page.goto("/admin");
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Visão geral", exact: true })).toBeVisible();
  const enrollments = page.getByRole("link", { name: "Abrir Matrículas" }).first();
  await enrollments.focus();
  await expect(enrollments).toBeFocused();
  await assertAxe(page);

  await page.context().clearCookies();
  await loginCanonicalTeacher(page, password!);
  await page.goto("/teacher");
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Próxima atividade", exact: true })).toBeVisible();
  const mobileMenu = page.getByRole("button", {
    name: "Abrir navegação do professor",
    exact: true,
  });
  if (await mobileMenu.isVisible()) await mobileMenu.click();
  const reviews = page.getByRole("link", { name: "Revisões", exact: true });
  await reviews.focus();
  await expect(reviews).toBeFocused();
  await assertAxe(page);
});

test("Teacher P21 operations pages preserve form semantics and WCAG A/AA compliance", async ({
  page,
}) => {
  await loginCanonicalTeacher(page, password!);

  for (const target of [
    "/teacher/sessoes",
    "/teacher/turmas",
    "/teacher/alunos",
    "/teacher/revisoes",
  ]) {
    await page.goto(target);
    await expect(page.getByRole("main")).toBeVisible();
    await assertAxe(page);
  }

  await page.goto("/teacher/disponibilidade");
  await expect(page.getByRole("main")).toBeVisible();
  // Desktop keeps the composer inline; narrow viewports open it as a drawer.
  let composer = page.locator("[data-composer]");
  if (!(await composer.isVisible())) {
    await page.getByRole("button", { name: "Adicionar horário", exact: true }).first().click();
    composer = page.getByRole("dialog", { name: "Adicionar horário" });
    await expect(composer).toBeVisible();
  }
  // Required fields append " *" to their accessible name.
  for (const label of [/^Data do horário/, /^Horário de início/, /^Horário de término/]) {
    const control = composer.getByLabel(label);
    await expect(control).toBeVisible();
    await control.focus();
    await expect(control).toBeFocused();
  }
  await assertAxe(page);

  await page.goto("/teacher/sessoes/nova");
  await expect(page.getByRole("main")).toBeVisible();
  const title = page.getByLabel("Título");
  await expect(title).toBeVisible();
  await title.focus();
  await expect(title).toBeFocused();
  await assertAxe(page);
});

test("P21 Student Agenda detail and MANUAL_AUDIO input are accessible", async ({ page }) => {
  await login(page, "canonical.home-now@example.test");
  await page.goto("/agenda/88400000-0000-4000-8000-000000000002");
  await expect(page.getByRole("main")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Home Fixture · Session happening now", exact: true }),
  ).toBeVisible();
  await assertAxe(page);

  await page.context().clearCookies();
  await login(page, "canonical.cohort-student@example.test");
  await page.goto("/pratica?skill=SPEAKING");
  const activity = page.locator(".yas-practice-activity-card").filter({
    has: page.getByRole("heading", { name: "Falar sobre o seu dia", exact: true }),
  });
  await activity.getByRole("button", { name: "Praticar →" }).click();
  await expect(page).toHaveURL(/\/pratica\/[0-9a-f-]+$/);
  const audio = page.getByLabel("Arquivo de áudio (até 25 MiB)");
  await expect(audio).toBeVisible();
  await audio.focus();
  await expect(audio).toBeFocused();
  await expect(page.getByRole("button", { name: "Gravar áudio" })).toBeVisible();
  await assertAxe(page);
  await page.screenshot({
    path: `harness/evidence/pr80-gates/audio-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test("P21 recorded-video Admin upload state is accessible before publication", async ({ page }) => {
  await loginCanonicalAdmin(page, password!, {
    next: "/admin/content/8c100000-0000-4000-8000-000000000001?kind=lesson_assets",
    destination: /\/admin\/content\/8c100000-0000-4000-8000-000000000001\?kind=lesson_assets$/,
  });
  await expect(page.getByRole("heading", { name: "Vídeo gravado" })).toBeVisible();
  const prepare = page.getByRole("button", { name: "Preparar envio de vídeo" });
  await prepare.focus();
  await expect(prepare).toBeFocused();
  await assertAxe(page);
});

test("Stage 12A practice builder preserves keyboard steps and accessible fields", async ({
  page,
}) => {
  test.setTimeout(90000);
  await loginCanonicalTeacher(page, password!);
  await page.goto("/teacher/praticas/nova");
  // Every Information field is reachable by label and accepts keyboard focus. Módulo and Aula stay
  // disabled until their parent is chosen, so each is checked right after it becomes enabled.
  const focusable = async (label: string) => {
    const control = page.getByLabel(label, { exact: true });
    await expect(control).toBeVisible();
    await expect(control).toBeEnabled();
    await control.focus();
    await expect(control).toBeFocused();
    return control;
  };
  await (await focusable("Título *")).fill(`Prática a11y ${Date.now()}`);
  await (
    await focusable("Objetivo *")
  ).fill("Ao final você consegue cumprimentar alguém em inglês.");
  await assertAxe(page);
  for (const label of ["Curso *", "Módulo *", "Aula *"]) {
    const select = await focusable(label);
    await expect(select.locator("option:not([value=''])").first()).toBeAttached();
    await select.selectOption({ index: 1 });
  }
  const next = page.getByRole("button", { name: "Salvar e continuar", exact: true });
  await next.focus();
  await expect(next).toBeFocused();
  await page.keyboard.press("Enter");
  // The step change moves focus to the new stage heading.
  await expect(page.getByRole("heading", { name: "Questões", exact: true })).toBeFocused();
  await expect(page.getByRole("textbox", { name: "Enunciado", exact: true })).toBeVisible();
  await assertAxe(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("Stage 12B entry assessment editor preserves keyboard order and accessible fields", async ({
  page,
}) => {
  test.setTimeout(90000);
  await loginCanonicalAdmin(page, password!, {
    next: "/admin/assessments/new",
    destination: /\/admin\/assessments\/new$/,
  });
  const title = page.getByLabel("Título da avaliação *", { exact: true });
  await expect(title).toBeEnabled();
  await title.focus();
  await expect(title).toBeFocused();
  await title.press("Tab");
  await expect(page.getByLabel("Objetivo da avaliação *", { exact: true })).toBeFocused();
  await assertAxe(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
