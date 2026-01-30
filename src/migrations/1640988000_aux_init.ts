// Ported from pocketbase/migrations/1640988000_aux_init.go @ v0.36.1 (9b036fb1)

import type { App } from "../core/app.ts";
import { SystemMigrations } from "../core/migrations_runner.ts";

SystemMigrations.add({
  file: "1640988000_aux_init.go",
  up: (app: App) => {
    app.auxDb().run(`
      CREATE TABLE IF NOT EXISTS _logs (
        id TEXT PRIMARY KEY DEFAULT ('r'||lower(hex(randomblob(7)))) NOT NULL,
        level INTEGER DEFAULT 0 NOT NULL,
        message TEXT DEFAULT '' NOT NULL,
        data JSON DEFAULT '{}' NOT NULL,
        created TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ')) NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_logs_level on _logs (level);
      CREATE INDEX IF NOT EXISTS idx_logs_message on _logs (message);
      CREATE INDEX IF NOT EXISTS idx_logs_created_hour on _logs (strftime('%Y-%m-%d %H:00:00', created));
    `);
  },
  down: (app: App) => {
    app.auxDb().run("DROP TABLE IF EXISTS _logs");
  },
  reapplyCondition: (app: App) => !app.auxHasTable("_logs"),
});
