// Ported from pocketbase/plugins/migratecmd/automigrate.go

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { App } from "../../core/app.ts";
import type { Collection } from "../../core/collection_model.ts";
import type { CollectionRequestEvent } from "../../core/events.ts";
import type { Config } from "./migratecmd.ts";
import { DefaultMigrationsTable } from "../../core/migrations_runner.ts";
import { ErrEmptyTemplate, TemplateLangJS, goDiffTemplate, jsDiffTemplate } from "./templates.ts";

export type PluginContext = {
  app: App;
  config: Config;
};

// automigrateOnCollectionChange handles the automigration snapshot
// generation on collection change request event (create/update/delete).
export async function automigrateOnCollectionChange(p: PluginContext, e: CollectionRequestEvent): Promise<Error | null> {
  let err: Error | null = null;
  let oldCollection: Collection | null = null;

  if (!e.Collection.IsNew()) {
    try {
      oldCollection = p.app.FindCollectionByNameOrId(e.Collection.id);
    } catch (error) {
      err = error as Error;
      if (err?.message !== "collection not found") {
        return err;
      }
    }
  }

  let nextResult: unknown = null;
  try {
    nextResult = await e.Next();
  } catch (error) {
    return error as Error;
  }
  if (nextResult instanceof Error) {
    return nextResult;
  }

  let newCollection: Collection | null = null;
  try {
    newCollection = p.app.FindCollectionByNameOrId(e.Collection.id);
  } catch (error) {
    err = error as Error;
    if (err?.message !== "collection not found") {
      return err;
    }
  }

  // for now exclude OAuth2 configs from the migration
  if (oldCollection && oldCollection.IsAuth()) {
    oldCollection.OAuth2.Providers = null;
  }
  if (newCollection && newCollection.IsAuth()) {
    newCollection.OAuth2.Providers = null;
  }

  const dir = p.config.Dir ?? "";
  let template = "";
  try {
    if (p.config.TemplateLang === TemplateLangJS) {
      template = jsDiffTemplate(newCollection, oldCollection);
    } else {
      template = goDiffTemplate(dir, newCollection, oldCollection);
    }
  } catch (error) {
    if (error === ErrEmptyTemplate) {
      return null; // no changes
    }
    return error as Error;
  }

  let action = "";
  if (!newCollection && oldCollection) {
    action = `deleted_${normalizeCollectionName(oldCollection.name)}`;
  } else if (!oldCollection && newCollection) {
    action = `created_${normalizeCollectionName(newCollection.name)}`;
  } else if (oldCollection) {
    action = `updated_${normalizeCollectionName(oldCollection.name)}`;
  }

  const fileName = `${Math.floor(Date.now() / 1000)}_${action}.${p.config.TemplateLang}`;
  const filePath = join(dir, fileName);

  return await p.app.RunInTransaction(async (txApp) => {
    try {
      txApp
        .db()
        .query(`insert into ${DefaultMigrationsTable} (file, applied) values (?, ?)`)
        .run(fileName, Math.trunc(Date.now() * 1000));
    } catch (error) {
      return error as Error;
    }

    // ensure that the local migrations dir exist
    try {
      mkdirSync(dir, { recursive: true });
    } catch (error) {
      return new Error(`failed to create migration dir: ${String(error)}`);
    }

    try {
      writeFileSync(filePath, template);
    } catch (error) {
      return new Error(`failed to save automigrate file: ${String(error)}`);
    }

    return null;
  });
}

function normalizeCollectionName(name: string): string {
  // adds an extra "_" suffix to the name in case the collection ends
  // with "test" to prevent accidentally resulting in "_test.go"/"_test.js" files
  if (name.toLowerCase().endsWith("test")) {
    return `${name}_`;
  }

  return name;
}
