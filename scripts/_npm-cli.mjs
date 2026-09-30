import { spawnSync } from "node:child_process";

export function npmCliInvocation(args, runtime = {}) {
  const execPath = runtime.execPath ?? process.execPath;
  const npmExecPath = runtime.npmExecPath ?? process.env.npm_execpath;

  if (!npmExecPath) {
    throw new Error(
      "npm_execpath is unavailable. Run this verifier through an npm script so npm-cli.js can be invoked without a shell.",
    );
  }

  return {
    command: execPath,
    args: [npmExecPath, ...args],
  };
}

export function spawnNpmSync(args, options = {}) {
  const invocation = npmCliInvocation(args);
  return spawnSync(invocation.command, invocation.args, options);
}
