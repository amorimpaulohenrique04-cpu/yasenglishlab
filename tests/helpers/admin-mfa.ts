import { createHmac } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, type Page } from "@playwright/test";

export const canonicalAdminEmail = "canonical.admin@example.test";

const secretPath = join(tmpdir(), "yas-canonical-admin-totp.secret");
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const lastSubmittedStep = new Map<string, number>();

function decodeBase32(value: string): Buffer {
  const normalized = value.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const character of normalized) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error("Invalid canonical TOTP secret.");
    bits += index.toString(2).padStart(5, "0");
  }

  const bytes: number[] = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  }
  return Buffer.from(bytes);
}

function totp(secret: string, now = Date.now()): string {
  const counter = BigInt(Math.floor(now / 30_000));
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(counter);
  const digest = createHmac("sha1", decodeBase32(secret)).update(buffer).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

async function freshTotp(secret: string, key: string): Promise<string> {
  let now = Date.now();
  const previousStep = lastSubmittedStep.get(key);
  if (previousStep !== undefined && Math.floor(now / 30_000) <= previousStep) {
    await new Promise((resolve) => setTimeout(resolve, 30_000 - (now % 30_000) + 100));
    now = Date.now();
  }

  const step = Math.floor(now / 30_000);
  lastSubmittedStep.set(key, step);
  return totp(secret, now);
}

async function resolveTotpSecret(page: Page, path = secretPath): Promise<string> {
  await page.getByLabel("Código do autenticador").waitFor({ timeout: 15_000 });
  const manualSecret = page.locator(".yas-mfa-secret");

  if (await manualSecret.isVisible()) {
    const secret = (await manualSecret.textContent())?.trim();
    if (!secret) throw new Error("MFA enrollment did not expose a canonical TOTP secret.");
    writeFileSync(path, secret, { encoding: "utf8", mode: 0o600 });
    return secret;
  }

  if (!existsSync(path)) {
    throw new Error("Verified canonical Admin MFA exists but its temporary test secret is absent.");
  }

  return readFileSync(path, "utf8").trim();
}

export async function loginCanonicalAdmin(
  page: Page,
  password: string,
  options: { email?: string; next?: string; destination?: RegExp; multi?: boolean } = {},
): Promise<void> {
  const next = options.next ?? "/admin/content?kind=modules";
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  await page.getByLabel("E-mail").fill(options.email ?? canonicalAdminEmail);
  await page.getByLabel("Senha").fill(password);
  const response = page.waitForResponse(
    (item) => item.request().method() === "POST" && new URL(item.url()).pathname === "/login",
  );
  await page.getByRole("button", { name: "Entrar" }).click();
  expect((await response).status()).toBeLessThan(400);

  await expect(page).toHaveURL(/\/mfa\?next=/i, { timeout: 15_000 });
  await expect(
    page.getByRole("heading", { name: "Verificação em duas etapas obrigatória" }),
  ).toBeVisible();

  const totpPath = options.multi ? join(tmpdir(), "yas-canonical-multi-totp.secret") : secretPath;
  const secret = await resolveTotpSecret(page, totpPath);
  await page.getByLabel("Código do autenticador").fill(await freshTotp(secret, totpPath));
  await page.getByRole("button", { name: "Verificar código" }).click();
  await expect(page).toHaveURL(options.destination ?? /\/admin\/content\?kind=modules$/, {
    timeout: 60_000,
  });
}
