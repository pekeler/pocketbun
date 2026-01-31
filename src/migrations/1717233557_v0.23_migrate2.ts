// Ported from pocketbase/migrations/1717233557_v0.23_migrate2.go
// Note: uses direct SQL/JSON updates instead of upstream core helpers to mirror behavior
// while those helpers are not yet ported.

import type { App } from "../core/app.ts";
import { SystemMigrations } from "../core/migrations_runner.ts";

const FILE_NAME = "1717233557_v0.23_migrate2.go";

SystemMigrations.register(up, undefined, FILE_NAME);

function up(app: App): void {
  const db = app.db();
  db.run("CREATE INDEX IF NOT EXISTS idx__collections_type on _collections (type);");

  const collectionNames = ["_mfas", "_otps"];
  for (const name of collectionNames) {
    const row = db.query("select id, deleteRule from _collections where name = ?").get(name) as
      | { id: string; deleteRule: string | null }
      | undefined;
    if (!row || row.deleteRule == null) {
      continue;
    }

    db.query("update _collections set deleteRule = NULL where id = ?").run(row.id);
  }
}
