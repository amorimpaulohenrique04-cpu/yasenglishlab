import { createHmac } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { chromium, expect } from "@playwright/test";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const outputDir = join(process.cwd(), "harness/evidence/admin-home-approved-design");

function decodeBase32(value) {
  const normalized = value.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const character of normalized) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error("Invalid canonical TOTP secret.");
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  }
  return Buffer.from(bytes);
}

function totp(secret, now = Date.now()) {
  const counter = BigInt(Math.floor(now / 30_000));
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(counter);
  const digest = createHmac("sha1", decodeBase32(secret)).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

async function loginAdmin(page, baseURL, password) {
  await page.goto(`${baseURL}/login?next=${encodeURIComponent("/admin")}`);
  await page.getByLabel("E-mail").fill("canonical.admin@example.test");
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/mfa\?next=/i, { timeout: 15_000 });

  const secretLocator = page.locator(".yas-mfa-secret");
  let secret;
  if (await secretLocator.isVisible()) {
    secret = (await secretLocator.textContent())?.trim();
  } else {
    const secretPath = join(tmpdir(), "yas-canonical-admin-totp.secret");
    if (!existsSync(secretPath)) throw new Error("Missing canonical Admin TOTP secret.");
    secret = readFileSync(secretPath, "utf8").trim();
  }
  if (!secret) throw new Error("Missing canonical Admin TOTP secret.");

  await page.getByLabel("Código do autenticador").fill(totp(secret));
  await page.getByRole("button", { name: "Verificar código" }).click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: 60_000 });
}

async function checkViewport(browser, baseURL, password, name, viewport) {
  const page = await browser.newPage({ viewport });
  await loginAdmin(page, baseURL, password);
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Visão geral", exact: true })).toBeVisible();
  const enrollments = page.getByRole("link", { name: "Abrir Matrículas" }).first();
  await enrollments.focus();
  await expect(enrollments).toBeFocused();
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  if (overflow) throw new Error(`${name} has horizontal overflow.`);
  await page.screenshot({ path: join(outputDir, `admin-${name}.png`), fullPage: true });
  await page.close();
}

const baseURL = process.env.APP_URL ?? "http://127.0.0.1:3101";
const password = process.env.CANONICAL_E2E_PASSWORD;
if (!password) throw new Error("CANONICAL_E2E_PASSWORD is required.");
mkdirSync(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  await checkViewport(browser, baseURL, password, "desktop", { width: 1440, height: 900 });
  await checkViewport(browser, baseURL, password, "tablet", { width: 834, height: 1112 });
  await checkViewport(browser, baseURL, password, "mobile", { width: 390, height: 844 });
  console.log("Admin home visual/focus checks passed for desktop, tablet and mobile.");
} finally {
  await browser.close();
}
