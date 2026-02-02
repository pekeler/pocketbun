// PocketBun-only: library helper to run migrations without CLI commands.

import type { App } from "./app.ts";

export type MigrateMode = "all" | "system" | "app";

export function migrate(app: App, mode: MigrateMode = "all"): void {
  if (!app.isBootstrapped()) {
    app.bootstrap();
  }

  switch (mode) {
    case "system":
      app.runSystemMigrations();
      break;
    case "app":
      app.runAppMigrations();
      break;
    case "all":
    default:
      app.runAllMigrations();
      break;
  }
}
