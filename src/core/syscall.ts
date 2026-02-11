// Ported from pocketbase/core/syscall.go

type ExecveFunc = (argv0: string, argv: string[], envv: string[]) => Error;

let execveImpl: ExecveFunc = defaultExecve;

// execve invokes the execve(2) system call.
export function execve(argv0: string, argv: string[], envv: string[]): Error {
  return execveImpl(argv0, argv, envv);
}

// setExecveForTests overrides the execve implementation and is intended for tests.
export function setExecveForTests(fn: ExecveFunc | null): void {
  execveImpl = fn ?? defaultExecve;
}

function defaultExecve(argv0: string, argv: string[], envv: string[]): Error {
  if (isLikelyBunTestRunnerProcess()) {
    return new Error("execve is disabled under bun test runner");
  }

  const cmd = buildExecCmd(argv0, argv);

  try {
    Bun.spawn({
      cmd,
      env: envvToRecord(envv),
      cwd: process.cwd(),
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }

  // Deviation: Bun doesn't expose in-process execve, so we re-exec by spawning
  // the replacement process with the same argv/env and then exiting.
  process.exit(0);
}

function isLikelyBunTestRunnerProcess(): boolean {
  if (process.env.NODE_ENV !== "test") {
    return false;
  }

  const argv1 = process.argv[1] ?? "";
  return /\.test\.[cm]?[jt]s$/.test(argv1);
}

function buildExecCmd(argv0: string, argv: string[]): string[] {
  if (argv.length === 0) {
    return [argv0];
  }

  const cmd = [...argv];
  cmd[0] = argv0;
  return cmd;
}

function envvToRecord(envv: string[]): Record<string, string> {
  const env: Record<string, string> = {};

  for (const raw of envv) {
    const separatorIndex = raw.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = raw.slice(0, separatorIndex);
    env[key] = raw.slice(separatorIndex + 1);
  }

  return env;
}
