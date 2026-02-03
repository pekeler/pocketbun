// Ported from pocketbase/tools/osutils/run.go

import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

export let runDirs = [tmpdir(), cacheDir()];

// IsProbablyGoRun loosely checks if the current program was started with "go run".
export function IsProbablyGoRun(): boolean {
  const arg0 = process.argv[0] ?? "";

  for (const dir of runDirs) {
    if (dir && arg0.startsWith(dir)) {
      return true;
    }
  }

  return false;
}

// Test helper: updates the runDirs cache for deterministic scenarios.
export function setRunDirsForTest(next: string[]): void {
  runDirs = next;
}

function cacheDir(): string {
  const env = process.env.GOCACHE;
  if (env === "off") {
    return "";
  }

  if (env) {
    return env;
  }

  if (process.platform === "win32") {
    return process.env.LOCALAPPDATA ?? process.env.APPDATA ?? "";
  }

  const home = homedir();
  if (!home) {
    return "";
  }

  if (process.platform === "darwin") {
    return join(home, "Library", "Caches");
  }

  const xdg = process.env.XDG_CACHE_HOME;
  if (xdg) {
    return xdg;
  }

  return join(home, ".cache");
}
