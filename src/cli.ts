// Ported from pocketbase/examples/base/main.go.
// Deviation: moved into src so the published CLI doesn't depend on examples/.

import type { ServeEvent } from "./core/events.ts";
import { Static as serveStatic } from "./apis/base.ts";
import { NewServerJSCommand, isServerJSSourceUpgradeCommand } from "./cmd/server_js.ts";
import { MustRegisterAsync as registerServerJS } from "./plugins/jsvm/jsvm.ts";
import { MustRegister as registerMigrateCmd, TemplateLangJS as templateLangJS } from "./plugins/migratecmd/migratecmd.ts";
import { newPocketBase } from "./pocketbase.ts";

export async function main(): Promise<void> {
  const app = newPocketBase();
  const args = process.argv.slice(2);

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

  app.rootCmd.persistentFlags().stringVar(flags, "hooksDir", "hooksDir", flags.hooksDir, "the directory with JavaScript hooks");
  app.rootCmd
    .persistentFlags()
    .boolVar(
      flags,
      "hooksWatch",
      "hooksWatch",
      flags.hooksWatch,
      "auto restart the app on pb_hooks file change; it has no effect on Windows",
    );
  app.rootCmd
    .persistentFlags()
    .intVar(
      flags,
      "hooksPool",
      "hooksPool",
      flags.hooksPool,
      "the total prewarmed runtime instances for server-side JavaScript hooks",
    );
  app.rootCmd
    .persistentFlags()
    .stringVar(flags, "migrationsDir", "migrationsDir", flags.migrationsDir, "the directory with the user defined migrations");
  app.rootCmd
    .persistentFlags()
    .boolVar(flags, "automigrate", "automigrate", flags.automigrate, "enable/disable auto migrations");
  app.rootCmd
    .persistentFlags()
    .stringVar(flags, "publicDir", "publicDir", flags.publicDir, "the directory to serve static files");
  app.rootCmd
    .persistentFlags()
    .boolVar(
      flags,
      "indexFallback",
      "indexFallback",
      flags.indexFallback,
      "fallback the request to index.html on missing static path, e.g. when pretty urls are used with SPA",
    );

  app.rootCmd.addCommand(NewServerJSCommand());
  app.rootCmd.parseFlags(args);

  if (isServerJSSourceUpgradeCommand(args)) {
    const err = await app.rootCmd.execute(args);
    if (err) {
      console.error(err);
      process.exit(1);
    }
    return;
  }

  // ---------------------------------------------------------------
  // Plugins and hooks:
  // ---------------------------------------------------------------

  // load server-side JavaScript hooks and migrations
  await registerServerJS(app, {
    migrationsDir: flags.migrationsDir,
    hooksDir: flags.hooksDir,
    hooksWatch: flags.hooksWatch,
    hooksPoolSize: flags.hooksPool,
  });

  // migrate command (with js templates)
  registerMigrateCmd(app, app.rootCmd, {
    templateLang: templateLangJS,
    automigrate: flags.automigrate,
    dir: flags.migrationsDir,
  });

  // static route to serves files from the provided public dir
  // (if publicDir exists and the route path is not already defined)
  app.OnServe().Bind({
    Func: (e: ServeEvent) => {
      if (!e.Router.HasRoute("GET", "/{path...}")) {
        e.Router.GET("/{path...}", serveStatic(flags.publicDir, flags.indexFallback));
      }

      return e.Next();
    },
    Priority: 999, // execute as latest as possible to allow users to provide their own route
  });

  const err = await app.start();
  if (err) {
    console.error(err);
    process.exit(1);
  }
}

// PocketBun deviation: resolve pb_public from the current working directory.
function defaultPublicDir(): string {
  return "./pb_public";
}

if (import.meta.main) {
  await main();
}
