import { readdir, readFile, writeFile, unlink } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

export function redactCIText(text, env = process.env) {
  let result = text;
  for (const [name, value] of Object.entries(env)) {
    if (!/(?:KEY|TOKEN|SECRET|PASSWORD|DATABASE_URL)/i.test(name) || !value || value.length < 8)
      continue;
    for (const encoded of [value, JSON.stringify(value).slice(1, -1)])
      result = result.split(encoded).join("[REDACTED]");
  }
  return result
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[REDACTED]")
    .replace(/\bsb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, "[REDACTED]")
    .replace(/\bbase64-[A-Za-z0-9_-]{32,}/g, "[REDACTED]");
}

export async function sanitizeEvidence(root, env = process.env) {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) await sanitizeEvidence(path, env);
    else if (entry.isFile() && entry.name.endsWith(".zip")) {
      // Browser traces can embed cookies and request headers. Keep screenshots and contexts instead.
      await unlink(path);
    } else if (entry.isFile() && /\.(json|md|txt|log|html|xml)$/i.test(entry.name)) {
      const original = await readFile(path, "utf8");
      const redacted = redactCIText(original, env);
      if (redacted !== original) await writeFile(path, redacted);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.includes("--stdin")) {
    let text = "";
    for await (const chunk of process.stdin) text += chunk;
    process.stdout.write(redactCIText(text));
  } else {
    for (const root of ["artifacts", "test-results", "playwright-report"])
      await sanitizeEvidence(resolve(root));
    console.log("CI evidence sanitized; trace archives excluded.");
  }
}
