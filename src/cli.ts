// Ported from pocketbase/examples/base/main.go.
// Deviation: moved into src so the published CLI doesn't depend on examples/.

import type { ServeEvent } from "./core/events.ts";
import { Static } from "./apis/base.ts";
import { NewServerJSCommand, isServerJSLowercaseCommand } from "./cmd/server_js.ts";
import { MustRegisterAsync as RegisterJSVM } from "./plugins/jsvm/jsvm.ts";
import { MustRegister as RegisterMigrateCmd, TemplateLangJS } from "./plugins/migratecmd/migratecmd.ts";
import { New } from "./pocketbase.ts";

export async function main(): Promise<void> {
  const app = New();
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
    "the total prewarmed runtime instances for server-side JavaScript hooks",
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

  app.RootCmd.AddCommand(NewServerJSCommand());
  app.RootCmd.ParseFlags(args);

  if (isServerJSLowercaseCommand(args)) {
    const err = await app.RootCmd.Execute(args);
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
  app.OnServe().Bind({
    Func: (e: ServeEvent) => {
      if (!e.Router.HasRoute("GET", "/{path...}")) {
        e.Router.GET("/{path...}", Static(flags.publicDir, flags.indexFallback));
      }

      return e.Next();
    },
    Priority: 999, // execute as latest as possible to allow users to provide their own route
  });

  const err = await app.Start();
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
