// Ported from pocketbase/examples/base/main.go

import { join } from "node:path";
import type { ServeEvent } from "../../src/core/events.ts";
import { Static } from "../../src/apis/base.ts";
import { MustRegisterAsync as RegisterJSVM } from "../../src/plugins/jsvm/jsvm.ts";
import { MustRegister as RegisterMigrateCmd, TemplateLangJS } from "../../src/plugins/migratecmd/migratecmd.ts";
import { New } from "../../src/pocketbase.ts";
import { IsProbablyGoRun } from "../../src/tools/osutils/run.ts";

export async function main(): Promise<void> {
  const app = New();

  // ---------------------------------------------------------------
  // Optional plugin flags:
  // ---------------------------------------------------------------

  const flags = {
    hooksDir: "",
    hooksWatch: true,
    hooksPool: 15,
    migrationsDir: "",
    automigrate: true,
    publicDir: defaultPublicDir(),
    indexFallback: true,
  };

  app.RootCmd.PersistentFlags().StringVar(flags, "hooksDir", "hooksDir", flags.hooksDir, "the directory with the JS app hooks");
  app.RootCmd.PersistentFlags().BoolVar(
    flags,
    "hooksWatch",
    "hooksWatch",
    flags.hooksWatch,
    "auto restart the app on pb_hooks file change; it has no effect on Windows",
  );
  app.RootCmd.PersistentFlags().IntVar(
    flags,
    "hooksPool",
    "hooksPool",
    flags.hooksPool,
    "the total prewarm goja.Runtime instances for the JS app hooks execution",
  );
  app.RootCmd.PersistentFlags().StringVar(
    flags,
    "migrationsDir",
    "migrationsDir",
    flags.migrationsDir,
    "the directory with the user defined migrations",
  );
  app.RootCmd.PersistentFlags().BoolVar(
    flags,
    "automigrate",
    "automigrate",
    flags.automigrate,
    "enable/disable auto migrations",
  );
  app.RootCmd.PersistentFlags().StringVar(
    flags,
    "publicDir",
    "publicDir",
    flags.publicDir,
    "the directory to serve static files",
  );
  app.RootCmd.PersistentFlags().BoolVar(
    flags,
    "indexFallback",
    "indexFallback",
    flags.indexFallback,
    "fallback the request to index.html on missing static path, e.g. when pretty urls are used with SPA",
  );

  app.RootCmd.ParseFlags(process.argv.slice(2));

  // ---------------------------------------------------------------
  // Plugins and hooks:
  // ---------------------------------------------------------------

  // PocketBun-only async variant to avoid sync fs startup work in JSVM setup.
  // load jsvm (pb_hooks and pb_migrations)
  await RegisterJSVM(app, {
    MigrationsDir: flags.migrationsDir,
    HooksDir: flags.hooksDir,
    HooksWatch: flags.hooksWatch,
    HooksPoolSize: flags.hooksPool,
  });

  // migrate command (with js templates)
  RegisterMigrateCmd(app, app.RootCmd, {
    TemplateLang: TemplateLangJS,
    Automigrate: flags.automigrate,
    Dir: flags.migrationsDir,
  });

  // static route to serves files from the provided public dir
  // (if publicDir exists and the route path is not already defined)
  app.onServe().bind({
    func: (e: ServeEvent) => {
      if (!e.Router.HasRoute("GET", "/{path...}")) {
        e.Router.GET("/{path...}", Static(flags.publicDir, flags.indexFallback));
      }

      return e.Next();
    },
    priority: 999, // execute as latest as possible to allow users to provide their own route
  });

  const err = await app.Start();
  if (err) {
    console.error(err);
    process.exit(1);
  }
}

// the default pb_public dir location is relative to the executable
function defaultPublicDir(): string {
  if (IsProbablyGoRun()) {
    return "./pb_public";
  }

  const execPath = process.argv[1] ?? process.argv[0] ?? "";
  return join(execPath, "../pb_public");
}

if (import.meta.main) {
  await main();
}
