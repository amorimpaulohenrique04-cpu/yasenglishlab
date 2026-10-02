import { createHmac } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, type Page } from "@playwright/test";

export const canonicalTeacherEmail = "canonical.teacher@example.test";
export const canonicalOtherTeacherEmail = "canonical.teacher-b@example.test";
export const canonicalOtherTeacherSessionId = "88200000-0000-4000-8000-000000000002";
export const canonicalTeacherSessionId = "88200000-0000-4000-8000-000000000001";

function secretPathFor(email: string): string {
  if (email === canonicalTeacherEmail) return join(tmpdir(), "yas-canonical-teacher-totp.secret");
  return join(tmpdir(), `yas-${email.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-totp.secret`);
}
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

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

async function resolveTotpSecret(page: Page, email: string): Promise<string> {
  await page.getByLabel("Código do autenticador").waitFor();
  const manualSecret = page.locator(".yas-mfa-secret");
  const secretPath = secretPathFor(email);

  if (await manualSecret.isVisible()) {
    const secret = (await manualSecret.textContent())?.trim();
    if (!secret) {
      throw new Error("MFA enrollment did not expose a canonical TOTP secret.");
    }
    writeFileSync(secretPath, secret, { encoding: "utf8", mode: 0o600 });
    return secret;
  }

  if (!existsSync(secretPath)) {
    throw new Error(
      `Verified canonical Teacher MFA exists for ${email} but its temporary test secret is absent.`,
    );
  }

  return readFileSync(secretPath, "utf8").trim();
}

async function loginTeacherAccount(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login?next=%2Fteacher");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page).toHaveURL(/\/mfa\?next=%2Fteacher/i);
  await expect(
    page.getByRole("heading", { name: "Verificação em duas etapas obrigatória" }),
  ).toBeVisible();

  const secret = await resolveTotpSecret(page, email);
  const protectedResponse = await page.request.get("/teacher", { maxRedirects: 0 });
  expect(protectedResponse.status()).toBe(307);
  expect(protectedResponse.headers().location).toContain("/mfa");
  await page.getByLabel("Código do autenticador").fill(totp(secret));
  await page.getByRole("button", { name: "Verificar código" }).click();

  await expect(page).toHaveURL(/\/teacher$/);
  await expect(page.getByRole("heading", { name: "Próxima atividade" })).toBeVisible();
}

export async function loginCanonicalTeacher(
  page: Page,
  password: string,
  _options: { next?: string } = {},
): Promise<void> {
  void _options;
  await loginTeacherAccount(page, canonicalTeacherEmail, password);
}

export async function loginCanonicalOtherTeacher(page: Page, password: string): Promise<void> {
  await loginTeacherAccount(page, canonicalOtherTeacherEmail, password);
}
