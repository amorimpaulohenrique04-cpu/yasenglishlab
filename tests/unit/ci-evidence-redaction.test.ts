import { mkdtemp, mkdir, readFile, writeFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { redactCIText, sanitizeEvidence } from "../../scripts/ci/redact-ci-evidence.mjs";

it("redacts credentials without hiding a failed check or invalidating its JSON", () => {
  const key = "sb_" + "secret_" + "x".repeat(32);
  const cookie = "base64-" + "a".repeat(80);
  const password = "sensitive" + "-test-password";
  const source = JSON.stringify({
    status: "failed",
    error: "URL assertion",
    key,
    cookie,
    password,
  });
  const result = redactCIText(source, { CANONICAL_E2E_PASSWORD: password });
  expect(source).toContain(key);
  expect(result).not.toContain(key);
  expect(result).not.toContain(cookie);
  expect(result).not.toContain(password);
  expect(JSON.parse(result)).toMatchObject({ status: "failed", error: "URL assertion" });
});

it("keeps screenshots and error contexts while excluding authentication-bearing trace archives", async () => {
  const root = await mkdtemp(join(tmpdir(), "yas-ci-evidence-"));
  await mkdir(join(root, "nested"));
  await writeFile(join(root, "nested", "trace.zip"), "trace fixture");
  await writeFile(join(root, "screen.png"), "png fixture");
  await writeFile(
    join(root, "error-context.md"),
    "Assertion failed; token=" + "eyJ" + "abc.def.ghi",
  );
  await sanitizeEvidence(root, {});
  await expect(access(join(root, "nested", "trace.zip"))).rejects.toThrow();
  expect(await readFile(join(root, "screen.png"), "utf8")).toBe("png fixture");
  expect(await readFile(join(root, "error-context.md"), "utf8")).toBe(
    "Assertion failed; token=[REDACTED]",
  );
});
