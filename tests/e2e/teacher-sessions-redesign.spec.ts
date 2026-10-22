import { mkdir } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { canonicalTeacherSessionId, loginCanonicalTeacher } from "../helpers/teacher-mfa";

const password = process.env.CANONICAL_E2E_PASSWORD;
if (process.env.CANONICAL_E2E !== "1" || !password)
  throw new Error("Sessions redesign E2E requires the canonical local fixture.");

async function evidence(page: Page, name: string) {
  await mkdir("harness/evidence/teacher-sessions-redesign/screenshots", { recursive: true });
  const dialog = page.getByRole("dialog").first();
  const modalVisible = await dialog.isVisible();
  if (modalVisible) {
    const box = await dialog.boundingBox();
    expect(box?.y).toBeLessThanOrEqual(1);
    if (page.viewportSize()!.width >= 850)
      expect(box?.width).toBeLessThanOrEqual(name.startsWith("availability") ? 1024 : 480);
  }
  await page.screenshot({
    path: `harness/evidence/teacher-sessions-redesign/screenshots/${name}.png`,
    fullPage: !modalVisible,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(1);
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
      .violations,
  ).toEqual([]);
}

test("Sessions filters, calendar, drawers, details and real report exports", async ({ page }) => {
  test.setTimeout(180_000);
  await loginCanonicalTeacher(page, password!);
  await page.goto("/teacher/sessoes?status=all&q=Teacher+Ops+Student");
  await expect(
    page.getByRole("heading", { name: "Teacher Ops · Conversation Practice", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Buscar")).toHaveValue("Teacher Ops Student");
  await evidence(page, "agenda-desktop");
  await page.getByRole("link", { name: "Abrir sessão", exact: true }).first().click();
  await page.getByRole("tab", { name: "Participantes", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Teacher Ops Student", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Trilha de navegação" })
    .getByRole("link", { name: "Sessões", exact: true })
    .click();
  await expect(page.getByLabel("Buscar")).toHaveValue("Teacher Ops Student");
  await page.getByRole("button", { name: "Consultar disponibilidade", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Disponibilidade do professor" })).toBeVisible();
  await evidence(page, "availability-desktop");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Consultar disponibilidade", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Cadastrar link do Meet", exact: true }).click();
  await evidence(page, "meet-desktop");
  await page.keyboard.press("Escape");
  for (const [label, width, height] of [
    ["desktop", 1440, 1000],
    ["tablet", 834, 1112],
    ["mobile", 390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto("/teacher/sessoes?status=all");
    await expect(page.getByRole("heading", { name: "Suas sessões", exact: true })).toBeVisible();
    await evidence(page, `list-${label}`);
    if (label === "mobile") {
      await page.getByRole("button", { name: "Consultar disponibilidade", exact: true }).click();
      await evidence(page, "availability-mobile");
      await page.keyboard.press("Escape");
    }
    await page.getByRole("link", { name: "Semana", exact: true }).click();
    await expect(page).toHaveURL(/view=week/);
    await evidence(page, `week-${label}`);
    await page.getByRole("link", { name: "Mês", exact: true }).click();
    await expect(page).toHaveURL(/view=month/);
    await evidence(page, `month-${label}`);
    await page.goto(`/teacher/sessoes/${canonicalTeacherSessionId}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await evidence(page, `detail-${label}`);
    await page.goto("/teacher/sessoes/nova");
    await expect(page.getByLabel("Título da sessão")).toBeVisible();
    await evidence(page, `create-${label}`);
    await page.goto("/teacher/sessoes/relatorios");
    await expect(
      page.getByRole("heading", { name: "Relatórios de sessões", exact: true }),
    ).toBeVisible();
    await evidence(page, `reports-${label}`);
  }
  const csv = await page.request.get("/teacher/sessoes/relatorios/exportar?format=csv");
  expect(csv.status()).toBe(200);
  expect(csv.headers()["cache-control"]).toContain("no-store");
  expect(await csv.text()).toContain("Definições");
  expect(await csv.text()).not.toContain("meeting_ref");
  const pdf = await page.request.get("/teacher/sessoes/relatorios/exportar?format=pdf");
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-disposition"]).toContain("attachment");
  expect((await PDFDocument.load(await pdf.body())).getPageCount()).toBeGreaterThan(0);
});

test("Resource form keeps failed input and persists instructions without a fake file", async ({
  page,
}) => {
  await loginCanonicalTeacher(page, password!);
  await page.goto(`/teacher/sessoes/${canonicalTeacherSessionId}`);
  await page.getByRole("tab", { name: "Recursos e tarefas", exact: true }).click();
  await page.getByRole("button", { name: "Adicionar recurso", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Adicionar recurso" })).toBeVisible();
  await page.getByLabel(/^Título do recurso/).fill("Redesign · instruções da sessão");
  await page
    .getByLabel("Instruções", { exact: true })
    .fill("Revisar os exemplos antes da próxima sessão.");
  await page.getByLabel("Data do prazo (opcional)").fill("2026-12-01");
  await page.getByRole("button", { name: "Atribuir recurso ou tarefa", exact: true }).click();
  await expect(
    page.getByText("Informe data e horário do prazo, ou deixe ambos vazios."),
  ).toBeVisible();
  await expect(page.getByLabel(/^Título do recurso/)).toHaveValue(
    "Redesign · instruções da sessão",
  );
  await page.getByLabel("Horário do prazo (opcional)").fill("18:00");
  await page.getByRole("button", { name: "Atribuir recurso ou tarefa", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Redesign · instruções da sessão", exact: true }).first(),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: "Recursos e tarefas", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Redesign · instruções da sessão", exact: true }).first(),
  ).toBeVisible();
});

test("Workspace filters apply without a submit and Ctrl+K opens a session", async ({ page }) => {
  await loginCanonicalTeacher(page, password!);
  await page.goto("/teacher/sessoes?status=all");
  await page.getByLabel("Tipo", { exact: true }).selectOption("CONVERSATION_LAB");
  await expect(page).toHaveURL(/type=CONVERSATION_LAB/);
  await page.getByLabel("Buscar").fill("Teacher Ops Student");
  await expect(page).toHaveURL(/q=Teacher\+Ops\+Student/);
  await expect(
    page.getByRole("heading", { name: "Teacher Ops · Conversation Practice", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Control+k");
  const palette = page.getByRole("dialog", { name: "Busca rápida" });
  await expect(palette).toBeVisible();
  await palette.getByRole("combobox", { name: "Busca rápida" }).fill("Teacher Ops Conversation");
  await expect(
    palette.getByRole("option", { name: /Teacher Ops · Conversation Practice/ }),
  ).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/teacher/sessoes/${canonicalTeacherSessionId}`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Teacher Ops · Conversation Practice",
  );
});

test("Report download is unavailable to an unauthenticated request", async ({ request }) => {
  const response = await request.get("/teacher/sessoes/relatorios/exportar?format=pdf", {
    maxRedirects: 0,
  });
  expect([301, 302, 303, 307, 308, 401, 403]).toContain(response.status());
  expect(response.headers()["content-type"] ?? "").not.toContain("application/pdf");
});
