// Ported from pocketbase/tools/osutils/run.go

import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

export let transientRuntimeDirs = [tmpdir(), cacheDir()];

// IsProbablyTransientRuntime loosely checks whether the current program was
// launched from a temporary/cache runtime directory (eg. bundled/transient runs).
// Upstream PocketBase names this helper IsProbablyGoRun.
export function IsProbablyTransientRuntime(): boolean {
  const arg0 = process.argv[0] ?? "";

  for (const dir of transientRuntimeDirs) {
    if (dir && arg0.startsWith(dir)) {
      return true;
    }
  }

  return false;
}

// Test helper: updates the transient runtime dirs cache for deterministic scenarios.
export function setTransientRuntimeDirsForTest(next: string[]): void {
  transientRuntimeDirs = next;
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
