import { expect, type Page } from "@playwright/test";

/** Explain the overflowing element rather than only reporting a width difference. */
export async function assertNoDocumentOverflow(page: Page) {
  const result = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const overflow = document.documentElement.scrollWidth - width;
    const elements =
      overflow > 1
        ? [...document.querySelectorAll("body *")]
            .filter((element) => {
              const rect = element.getBoundingClientRect();
              return rect.width > 0 && (rect.right > width + 1 || rect.left < -1);
            })
            .slice(0, 12)
            .map((element) => ({
              tag: element.tagName,
              class: element.className,
              width: Math.round(element.getBoundingClientRect().width),
            }))
        : [];
    return { overflow, elements };
  });
  expect(result.overflow, JSON.stringify(result.elements)).toBeLessThanOrEqual(1);
}
