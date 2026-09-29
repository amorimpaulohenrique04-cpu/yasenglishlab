import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

const stories = [
  {
    id: "design-system-foundations--core-states",
    name: "core-states",
    viewport: { width: 1440, height: 1000 },
  },
  {
    id: "design-system-foundations--form-controls",
    name: "form-controls",
    viewport: { width: 1024, height: 1000 },
  },
  {
    id: "design-system-layout--desktop-shell",
    name: "desktop-shell",
    viewport: { width: 1440, height: 900 },
  },
  {
    id: "design-system-layout--mobile-shell",
    name: "mobile-shell",
    viewport: { width: 390, height: 844 },
  },
] as const;

async function openStory(page: Page, id: string) {
  await page.goto(`/iframe.html?id=${id}&viewMode=story`);
  await page.waitForLoadState("networkidle");
}

async function assertA11y(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();

  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

for (const story of stories) {
  test(`${story.name} has no automated WCAG A/AA violations and produces evidence`, async ({
    page,
  }, testInfo: TestInfo) => {
    await page.setViewportSize(story.viewport);
    await openStory(page, story.id);
    await assertA11y(page);
    await page.screenshot({ path: testInfo.outputPath(`${story.name}.png`), fullPage: true });
  });
}

test("tabs support keyboard navigation and visible selection", async ({ page }) => {
  await openStory(page, "design-system-foundations--navigation-and-overlays");
  const overview = page.getByRole("tab", { name: "Visão geral" });
  const skills = page.getByRole("tab", { name: "Habilidades" });

  await overview.focus();
  await page.keyboard.press("ArrowRight");

  await expect(skills).toBeFocused();
  await expect(skills).toHaveAttribute("aria-selected", "true");
});

test("dialog closes with Escape", async ({ page }) => {
  await openStory(page, "design-system-foundations--navigation-and-overlays");
  await page.getByRole("button", { name: "Abrir diálogo" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
