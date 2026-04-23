// PocketBun-only: library helper to run migrations without CLI commands.

import { bootstrapIfNeededAsync, type App } from "./app.ts";

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

// migrateAsync is a PocketBun-only async alternative to migrate().
export async function migrateAsync(app: App, mode: MigrateMode = "all"): Promise<void> {
  await bootstrapIfNeededAsync(app);

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
