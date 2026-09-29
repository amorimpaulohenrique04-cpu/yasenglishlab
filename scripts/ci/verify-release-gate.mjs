import { spawnSync } from "node:child_process";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

const sha = argument("--sha") ?? process.env.RELEASE_SHA;
const gate = argument("--gate") ?? process.env.RELEASE_GATE;
const repository = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;

if (!sha || !/^[0-9a-f]{40}$/i.test(sha)) fail("RELEASE_SHA must be a full 40-character commit SHA.");
if (gate !== "APPROVE") fail('Release gate input must be exactly "APPROVE".');
if (!repository || !token) fail("GITHUB_REPOSITORY and GITHUB_TOKEN are required.");

const ancestor = spawnSync("git", ["merge-base", "--is-ancestor", sha, "origin/main"]);
if (ancestor.status !== 0) fail("Release SHA is not an ancestor of origin/main.");

async function github(path) {
  const response = await fetch(`https://api.github.com/repos/${repository}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) {
    fail(`GitHub API ${path} failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

const runs = await github(`/actions/runs?head_sha=${sha}&status=completed&per_page=100`);
const greenCi = runs.workflow_runs?.find(
  (run) => run.name === "Yas CI" && run.conclusion === "success",
);
if (!greenCi) fail("Release SHA does not have a successful completed Yas CI run.");

const pulls = await github(`/commits/${sha}/pulls`);
const mergedPull = pulls.find((pull) => pull.merged_at);
if (!mergedPull) fail("Release SHA is not associated with a merged pull request.");

const reviews = await github(`/pulls/${mergedPull.number}/reviews?per_page=100`);
const approved = reviews.some(
  (review) =>
    review.state === "APPROVED" &&
    review.user?.login &&
    review.user.login !== mergedPull.user?.login,
);
if (!approved) {
  fail(`PR #${mergedPull.number} has no approval from a reviewer other than its author.`);
}

console.log(
  `✓ Release gate passed for ${sha}: green Yas CI run #${greenCi.run_number}, reviewed PR #${mergedPull.number}.`,
);
