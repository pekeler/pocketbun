// Ported from pocketbase/examples/base/main.go.
// Deviation: moved into src so the published CLI doesn't depend on examples/.

import type { ServeEvent } from "./core/events.ts";
import { Static as serveStatic } from "./apis/base.ts";
import { NewHooksCommand, NewServerJSCommand, isHooksBuildCommand, isServerJSSourceUpgradeCommand } from "./cmd/server_js.ts";
import { ClusterEnvRole, clusterEnabled, validateWorkerCount } from "./internal/cluster/context.ts";
import { MustRegisterAsync as registerServerJS } from "./plugins/jsvm/jsvm.ts";
import { MustRegister as registerMigrateCmd, TemplateLangJS as templateLangJS } from "./plugins/migratecmd/migratecmd.ts";
import { newPocketBase, registerDefaultCommands } from "./pocketbase.ts";

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
    workers: 1,
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
  app.rootCmd
    .persistentFlags()
    .intVar(flags, "workers", "workers", flags.workers, "number of PocketBun HTTP worker processes (default 1)");

  app.rootCmd.addCommand(NewHooksCommand());
  app.rootCmd.addCommand(NewServerJSCommand());
  const parseErr = app.rootCmd.parseFlags(args);
  if (parseErr) {
    throw parseErr;
  }

  // migrate command (with js templates)
  registerMigrateCmd(app, app.rootCmd, {
    templateLang: templateLangJS,
    automigrate: flags.automigrate,
    dir: flags.migrationsDir,
  });
  const defaultCommands = registerDefaultCommands(app);

  const isHelpOrVersion = args.some((arg) => arg === "-h" || arg === "--help" || arg === "-v" || arg === "--version");
  if (!isHelpOrVersion) {
    const workersError = validateWorkerCount(flags.workers);
    if (workersError) {
      throw workersError;
    }

    if (flags.workers > 1) {
      if (process.env[ClusterEnvRole]) {
        const { attachClusterWorker } = await import("./internal/cluster/worker.ts");
        attachClusterWorker();
      } else {
        const [selected, _remaining, resolveErr] = app.rootCmd.resolve(args);
        if (resolveErr) {
          throw resolveErr;
        }
        if (selected !== defaultCommands.serve) {
          throw new Error("--workers greater than 1 is only supported with the serve command");
        }

        const { runClusterPrimary } = await import("./internal/cluster/primary.ts");
        await runClusterPrimary({
          workers: flags.workers,
          dataDir: app.dataDir(),
          httpAddr: defaultCommands.serveState.httpAddr || "127.0.0.1:8090",
          showStartBanner: !app.hideStartBanner,
        });
        return;
      }
    }
  }

  if (isServerJSSourceUpgradeCommand(args) || isHooksBuildCommand(args)) {
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

  if (clusterEnabled()) {
    const { clusterWorkerShutdownRequested, notifyClusterWorkerStopped } = await import("./internal/cluster/worker.ts");
    if (clusterWorkerShutdownRequested()) {
      await notifyClusterWorkerStopped();
      return;
    }
  }

  const err = await app.execute();
  if (clusterEnabled()) {
    const { notifyClusterWorkerStopped } = await import("./internal/cluster/worker.ts");
    await notifyClusterWorkerStopped();
  }
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
