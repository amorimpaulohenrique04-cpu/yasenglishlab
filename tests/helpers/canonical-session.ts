import { expect, test, type BrowserContext, type Page } from "@playwright/test";

type Cookies = Awaited<ReturnType<BrowserContext["cookies"]>>;
const sessions = new Map<string, Cookies>();
const authCookie = /^sb-.+-auth-token(?:\.\d+)?$/;

function key(identity: string) {
  return `${test.info().project.use.baseURL}|${identity}`;
}

/** Reuse a real AAL2 login within this worker; never persist tokens to artifacts. */
export async function restoreCanonicalSession(
  page: Page,
  identity: string,
  destination: string,
  expected: RegExp,
) {
  const cookies = sessions.get(key(identity));
  if (!cookies) return false;
  await page.context().clearCookies({ name: authCookie });
  await page.context().addCookies(cookies);
  await page.goto(destination);
  await expect(page).toHaveURL(expected);
  return true;
}

export async function rememberCanonicalSession(page: Page, identity: string) {
  const cookies = (await page.context().cookies()).filter((cookie) => authCookie.test(cookie.name));
  if (!cookies.length) throw new Error("Authenticated fixture has no session cookies.");
  sessions.set(key(identity), cookies);
}
