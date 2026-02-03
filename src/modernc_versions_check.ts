// Ported from pocketbase/modernc_versions_check.go

import type { App } from "./core/app.ts";

// ModerncDepsCheckHookId is the id of the hook that performs the modernc.org/* deps checks.
export const ModerncDepsCheckHookId = "pbModerncDepsCheck";

// checkModerncDeps validates modernc sqlite dependencies in PocketBase.
// Deviation: PocketBun uses Bun's built-in SQLite and doesn't rely on modernc.org/sqlite, so this is a no-op.
export function checkModerncDeps(_app: App): void {
  // noop
}
