import type { Page } from "@playwright/test";

/**
 * Waits for a settled frame before an axe scan: the document has loaded, finite CSS/Motion
 * animations and transitions have finished (looping indicators are ignored), and no inline
 * Motion opacity is mid-fade. Entry animations otherwise make axe measure washed-out colors.
 * Dynamic pages stream their metadata, so after a Server Action redirect the <title> arrives
 * after the body; the frame also waits for it.
 * Gives up after 10s and scans anyway, so a page that never settles still reports its result.
 */
export async function settledPage(page: Page): Promise<Page> {
  await page.waitForLoadState("load");
  await page
    .waitForFunction(
      () =>
        document.title.trim() !== "" &&
        document
          .getAnimations()
          .every(
            (animation) =>
              animation.playState !== "running" ||
              animation.effect?.getTiming().iterations === Infinity,
          ) &&
        [...document.querySelectorAll<HTMLElement>("[style*='opacity']")].every((element) => {
          const opacity = Number(getComputedStyle(element).opacity);
          return opacity === 0 || opacity === 1;
        }),
      undefined,
      { timeout: 10_000 },
    )
    .catch(() => undefined);
  return page;
}
