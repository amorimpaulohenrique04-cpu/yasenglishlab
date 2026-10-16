import { pathToFileURL } from "node:url";

export function requireSuccessfulGates(results) {
  const failures = Object.entries(results).filter(([, result]) => result !== "success");
  if (!Object.keys(results).length || failures.length) {
    throw new Error(
      `Required gates failed: ${failures.map(([name, state]) => `${name}=${state}`).join(", ") || "no results"}`,
    );
  }
}

export function requirePreview(codeChanged, suites) {
  if (codeChanged === "false" && suites === "skipped") return;
  requireSuccessfulGates({ changes: codeChanged === "true" ? "success" : "failure", suites });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv[2] === "preview") {
    requirePreview(process.env.CODE_CHANGED, process.env.SUITES);
  } else {
    requireSuccessfulGates(
      Object.fromEntries(
        ["SUPPLY_CHAIN", "QUALITY", "DATABASE", "SIMULATIONS", "PREVIEW"].map((name) => [
          name,
          process.env[name],
        ]),
      ),
    );
  }
  console.log("Every required gate passed.");
}
