interface SqlCaseResult {
  name: string;
  exitCode: number;
}
interface SqlRunnerOptions {
  spawn?: (
    command: string,
    args: string[],
    options: { stdio: "inherit"; env: Record<string, string | undefined> },
  ) => {
    status: number | null;
    error?: { code?: string };
  };
  log?: (message: string) => void;
  error?: (message: string) => void;
  env?: Record<string, string | undefined>;
  execPath?: string;
}
export function runSqlSuite(
  suite: string,
  files: string[],
  options?: SqlRunnerOptions,
): { results: SqlCaseResult[]; exitCode: number };
