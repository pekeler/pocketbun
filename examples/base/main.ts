// Ported from pocketbase/examples/base/main.go

import { join } from "node:path";
import {
  mustRegisterServerJSAsync,
  newPocketBase,
  registerMigrateCmd,
  serveStatic,
  templateLangJS,
  type ServeEvent,
} from "../../index.ts";
import { IsProbablyGoRun } from "../../src/tools/osutils/run.ts";

export async function main(): Promise<void> {
  const app = newPocketBase();

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
  app.rootCmd.persistentFlags().boolVar(
    flags,
    "hooksWatch",
    "hooksWatch",
    flags.hooksWatch,
    "auto restart the app on pb_hooks file change; it has no effect on Windows",
  );
  app.rootCmd.persistentFlags().intVar(
    flags,
    "hooksPool",
    "hooksPool",
    flags.hooksPool,
    "the total prewarmed runtime instances for server-side JavaScript hooks",
  );
  app.rootCmd.persistentFlags().stringVar(
    flags,
    "migrationsDir",
    "migrationsDir",
    flags.migrationsDir,
    "the directory with the user defined migrations",
  );
  app.rootCmd.persistentFlags().boolVar(
    flags,
    "automigrate",
    "automigrate",
    flags.automigrate,
    "enable/disable auto migrations",
  );
  app.rootCmd.persistentFlags().stringVar(
    flags,
    "publicDir",
    "publicDir",
    flags.publicDir,
    "the directory to serve static files",
  );
  app.rootCmd.persistentFlags().boolVar(
    flags,
    "indexFallback",
    "indexFallback",
    flags.indexFallback,
    "fallback the request to index.html on missing static path, e.g. when pretty urls are used with SPA",
  );

  app.rootCmd.parseFlags(process.argv.slice(2));

  // ---------------------------------------------------------------
  // Plugins and hooks:
  // ---------------------------------------------------------------

  // PocketBun-only async variant to avoid sync fs startup work in server-side JavaScript setup.
  // load server-side JavaScript hooks and migrations
  await mustRegisterServerJSAsync(app, {
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
  app.onServe().bind({
    func: (e: ServeEvent) => {
      if (!e.router.hasRoute("GET", "/{path...}")) {
        e.router.get("/{path...}", serveStatic(flags.publicDir, flags.indexFallback));
      }

      return e.next();
    },
    priority: 999, // execute as latest as possible to allow users to provide their own route
  });

  const err = await app.start();
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
