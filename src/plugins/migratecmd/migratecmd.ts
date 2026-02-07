// Ported from pocketbase/plugins/migratecmd/migratecmd.go

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { App } from "../../core/app.ts";
import { collectionFromRow, type CollectionRow } from "../../core/collection_model.ts";
import { MigrationsList } from "../../core/migrations_list.ts";
import { AppMigrations, MigrationsRunner, SystemMigrations } from "../../core/migrations_runner.ts";
import { Command } from "../../tools/cli/command.ts";
import { snakecase } from "../../tools/inflector/inflector.ts";
import { YesNoPrompt } from "../../tools/osutils/cmd.ts";
import { automigrateOnCollectionChange } from "./automigrate.ts";
import {
  TemplateLangGo,
  TemplateLangJS,
  goBlankTemplate,
  goSnapshotTemplate,
  jsBlankTemplate,
  jsSnapshotTemplate,
} from "./templates.ts";
export { TemplateLangGo, TemplateLangJS } from "./templates.ts";

// Config defines the config options of the migratecmd plugin.
export type Config = {
  // Dir specifies the directory with the user defined migrations.
  //
  // If not set it fallbacks to a relative "pb_data/../pb_migrations" (for js)
  // or "pb_data/../migrations" (for go) directory.
  Dir?: string;

  // Automigrate specifies whether to enable automigrations.
  Automigrate?: boolean;

  // TemplateLang specifies the template language to use when
  // generating migrations - js or go (default).
  TemplateLang?: string;
};

// MustRegister registers the migratecmd plugin to the provided app instance
// and panic if it fails.
export function MustRegister(app: App, rootCmd: Command | null, config: Config): void {
  const err = Register(app, rootCmd, config);
  if (err) {
    throw err;
  }
}

// Register registers the migratecmd plugin to the provided app instance.
export function Register(app: App, rootCmd: Command | null, config: Config): Error | null {
  const normalized: Config = { ...config };

  if (!normalized.TemplateLang) {
    normalized.TemplateLang = TemplateLangGo;
  }

  if (!normalized.Dir) {
    if (normalized.TemplateLang === TemplateLangJS) {
      normalized.Dir = join(app.DataDir(), "../pb_migrations");
    } else {
      normalized.Dir = join(app.DataDir(), "../migrations");
    }
  }

  const plugin = new MigrateCmdPlugin(app, normalized);

  // attach the migrate command
  if (rootCmd) {
    rootCmd.AddCommand(plugin.createCommand());
  }

  // watch for collection changes
  if (normalized.Automigrate) {
    app.OnCollectionCreateRequest().BindFunc((e) => plugin.automigrateOnCollectionChange(e));
    app.OnCollectionUpdateRequest().BindFunc((e) => plugin.automigrateOnCollectionChange(e));
    app.OnCollectionDeleteRequest().BindFunc((e) => plugin.automigrateOnCollectionChange(e));
  }

  return null;
}

export class MigrateCmdPlugin {
  app: App;
  config: Config;

  constructor(app: App, config: Config) {
    this.app = app;
    this.config = config;
  }

  createCommand(): Command {
    const cmdDesc = `Supported arguments are:
- up            - runs all available migrations
- down [number] - reverts the last [number] applied migrations
- create name   - creates new blank migration template file
- collections   - creates new migration file with snapshot of the local collections configuration
- history-sync  - ensures that the _migrations history table doesn't have references to deleted migration files
`;

    const command = new Command({
      Use: "migrate",
      Short: "Executes app DB migration scripts",
      Long: cmdDesc,
      ValidArgs: ["up", "down", "create", "collections"],
      SilenceUsage: true,
    });

    command.RunE = async (_command, args) => {
      const cmd = args.length > 0 ? (args[0] ?? "") : "";

      switch (cmd) {
        case "create": {
          const { error } = await this.migrateCreateHandler("", args.slice(1), true);
          if (error) {
            return error;
          }
          break;
        }
        case "collections": {
          const { error } = await this.migrateCollectionsHandler(args.slice(1), true);
          if (error) {
            return error;
          }
          break;
        }
        default: {
          // note: system migrations are always applied as part of the bootstrap process
          const list = new MigrationsList();
          list.Copy(SystemMigrations);
          list.Copy(AppMigrations);

          const runner = new MigrationsRunner(this.app, list);
          const err = runner.Run(...args);
          if (err) {
            return err;
          }
          break;
        }
      }

      return null;
    };

    return command;
  }

  async migrateCreateHandler(
    template: string,
    args: string[],
    interactive: boolean,
  ): Promise<{ fileName: string; error: Error | null }> {
    if (args.length < 1) {
      return { fileName: "", error: new Error("missing migration file name") };
    }

    const name = args[0] ?? "";
    const dir = this.config.Dir ?? "";

    const filename = `${Math.floor(Date.now() / 1000)}_${snakecase(name)}.${this.config.TemplateLang}`;

    const resultFilePath = join(dir, filename);

    if (interactive) {
      const confirm = YesNoPrompt(`Do you really want to create migration ${JSON.stringify(resultFilePath)}?`, false);
      if (!confirm) {
        console.log("The command has been cancelled");
        return { fileName: "", error: null };
      }
    }

    // get default create template
    if (!template) {
      try {
        if (this.config.TemplateLang === TemplateLangJS) {
          template = jsBlankTemplate();
        } else {
          template = goBlankTemplate(dir);
        }
      } catch (error) {
        return { fileName: "", error: new Error(`failed to resolve create template: ${String(error)}`) };
      }
    }

    // ensure that the migrations dir exist
    try {
      await mkdir(dir, { recursive: true });
    } catch (error) {
      return { fileName: "", error: error as Error };
    }

    // save the migration file
    try {
      await writeFile(resultFilePath, template);
    } catch (error) {
      return {
        fileName: "",
        error: new Error(`failed to save migration file ${JSON.stringify(resultFilePath)}: ${String(error)}`),
      };
    }

    if (interactive) {
      console.log(`Successfully created file ${JSON.stringify(resultFilePath)}`);
    }

    return { fileName: filename, error: null };
  }

  async migrateCollectionsHandler(args: string[], interactive: boolean): Promise<{ fileName: string; error: Error | null }> {
    const createArgs = ["collections_snapshot", ...args];

    let collections: CollectionRow[] = [];
    try {
      collections = this.app.CollectionQuery().OrderBy("created ASC").All<CollectionRow>();
    } catch (error) {
      return { fileName: "", error: new Error(`failed to fetch migrations list: ${String(error)}`) };
    }

    const models = collections.map((row) => collectionFromRow(row));

    let template = "";
    try {
      if (this.config.TemplateLang === TemplateLangJS) {
        template = jsSnapshotTemplate(models);
      } else {
        template = goSnapshotTemplate(this.config.Dir ?? "", models);
      }
    } catch (error) {
      return { fileName: "", error: new Error(`failed to resolve template: ${String(error)}`) };
    }

    return await this.migrateCreateHandler(template, createArgs, interactive);
  }

  automigrateOnCollectionChange(e: Parameters<typeof automigrateOnCollectionChange>[1]): Promise<Error | null> {
    return automigrateOnCollectionChange(this, e);
  }
}
