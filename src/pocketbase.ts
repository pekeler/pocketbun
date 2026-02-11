// Ported from pocketbase/pocketbase.go.

import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { NewServeCommand } from "./cmd/serve.ts";
import { NewSuperuserCommand } from "./cmd/superuser.ts";
import { BaseApp, type BaseAppConfig } from "./core/base.ts";
import { TerminateEvent } from "./core/events.ts";
import { ModerncDepsCheckHookId, checkModerncDeps } from "./modernc_versions_check.ts";
import { Command } from "./tools/cli/command.ts";
import { existInSlice } from "./tools/list/list.ts";
import { IsProbablyTransientRuntime } from "./tools/osutils/run.ts";
import { FireAndForget } from "./tools/routine/routine.ts";

// Version of PocketBun.
export const Version = resolvePocketBunVersion();

function resolvePocketBunVersion(): string {
  if (process.env.POCKETBUN_VERSION) {
    return process.env.POCKETBUN_VERSION;
  }

  // PocketBun-only: read package.json from known source/dist-relative paths so
  // npm-installed binaries report the PocketBun version instead of "(untracked)".
  const versionFromPackage = readPocketBunPackageVersion();
  if (versionFromPackage) {
    return versionFromPackage;
  }

  return process.env.npm_package_version ?? "(untracked)";
}

function readPocketBunPackageVersion(): string | null {
  const candidates = ["../package.json", "../../package.json"];
  for (const relativePath of candidates) {
    try {
      const raw = readFileSync(new URL(relativePath, import.meta.url), "utf8");
      const parsed = JSON.parse(raw) as { name?: string; version?: string };
      if (parsed.name === "pocketbun" && typeof parsed.version === "string" && parsed.version.length > 0) {
        return parsed.version;
      }
    } catch {
      // ignore read/parse errors while trying known candidate paths
    }
  }

  return null;
}

export type PocketBaseConfig = {
  // hide the default console server info on app startup
  HideStartBanner?: boolean;
  // optional default values for the console flags
  DefaultDev?: boolean;
  DefaultDataDir?: string;
  DefaultEncryptionEnv?: string;
  DefaultQueryTimeout?: number;
  // optional DB configurations (currently ignored for bun:sqlite)
  DataMaxOpenConns?: number;
  DataMaxIdleConns?: number;
  AuxMaxOpenConns?: number;
  AuxMaxIdleConns?: number;
  DBConnect?: unknown;
  // legacy BaseAppConfig-style overrides for convenience
  dataDir?: string;
  encryptionEnv?: string;
  isDev?: boolean;
};

export type Config = PocketBaseConfig;

type FlagState = {
  devFlag: boolean;
  dataDirFlag: string;
  encryptionEnvFlag: string;
  queryTimeout: number;
};

const DefaultQueryTimeoutSeconds = 30;

// PocketBase defines a PocketBun app launcher with CLI support.
export class PocketBase extends BaseApp {
  RootCmd: Command;
  App: BaseApp;
  devFlag: boolean;
  dataDirFlag: string;
  encryptionEnvFlag: string;
  queryTimeout: number;
  hideStartBanner: boolean;

  constructor(config: PocketBaseConfig = {}) {
    const normalized = normalizePocketBaseConfig(config);
    const flags = buildFlagState(normalized);
    const rootCmd = newRootCommand();

    eagerParseFlags(rootCmd, flags);

    const baseConfig: BaseAppConfig = {
      isDev: flags.devFlag,
      dataDir: flags.dataDirFlag,
      encryptionEnv: flags.encryptionEnvFlag,
    };

    super(baseConfig);

    this.RootCmd = rootCmd;
    this.App = this;
    this.devFlag = flags.devFlag;
    this.dataDirFlag = flags.dataDirFlag;
    this.encryptionEnvFlag = flags.encryptionEnvFlag;
    this.queryTimeout = flags.queryTimeout;
    this.hideStartBanner = normalized.HideStartBanner ?? false;

    this.RootCmd.SetHelpCommand(new Command({ Hidden: true }));

    this.OnBootstrap().Bind({
      Id: ModerncDepsCheckHookId,
      Func: (be) => {
        const err = be.Next();
        if (err) {
          return err;
        }
        FireAndForget(() => {
          checkModerncDeps(be.App);
        });
        return null;
      },
    });
  }

  // Start registers the default system commands and executes the root command.
  async Start(): Promise<Error | null> {
    this.RootCmd.AddCommand(NewSuperuserCommand(this));
    this.RootCmd.AddCommand(NewServeCommand(this, !this.hideStartBanner));
    return this.Execute();
  }

  // Execute initializes the application (if needed) and executes the root command.
  async Execute(): Promise<Error | null> {
    if (!this.skipBootstrap()) {
      await this.bootstrapAsync();
    }

    let commandErr: Error | null = null;
    let resolveDone: (() => void) | null = null;
    const done = new Promise<void>((resolve) => {
      resolveDone = resolve;
    });

    const signalHandler = () => {
      if (resolveDone) {
        resolveDone();
        resolveDone = null;
      }
    };

    process.once("SIGINT", signalHandler);
    process.once("SIGTERM", signalHandler);

    void Promise.resolve(this.RootCmd.Execute())
      .then((err) => {
        if (err) {
          commandErr = err;
        }
        signalHandler();
      })
      .catch((err) => {
        commandErr = err instanceof Error ? err : new Error(String(err));
        signalHandler();
      });

    await done;

    process.off("SIGINT", signalHandler);
    process.off("SIGTERM", signalHandler);

    const terminateEvent = new TerminateEvent(this);
    const result = this.OnTerminate().Trigger(terminateEvent, (e) => {
      e.App.resetBootstrapState();
      return null;
    });

    if (result instanceof Promise) {
      const resolved = await result;
      if (resolved instanceof Error) {
        return resolved;
      }
      return commandErr;
    }

    if (result instanceof Error) {
      return result;
    }

    return commandErr;
  }

  private skipBootstrap(): boolean {
    const flags = ["-h", "--help", "-v", "--version"];

    if (this.isBootstrapped()) {
      return true;
    }

    const [cmd, _args, err] = this.RootCmd.Find(process.argv.slice(2));
    if (err) {
      return true;
    }

    for (const arg of process.argv) {
      if (!existInSlice(arg, flags)) {
        continue;
      }

      const trimmed = arg.replace(/^-+/, "");
      if (trimmed.length > 1 && cmd.Flags().Lookup(trimmed) == null) {
        return true;
      }
      if (trimmed.length === 1 && cmd.Flags().ShorthandLookup(trimmed) == null) {
        return true;
      }
    }

    return false;
  }
}

// New creates a new PocketBase instance with the default configuration.
export function New(): PocketBase {
  const { withTransientRuntime } = inspectRuntime();
  return NewWithConfig({ DefaultDev: withTransientRuntime });
}

// NewWithConfig creates a new PocketBase instance with the provided config.
export function NewWithConfig(config: PocketBaseConfig): PocketBase {
  return new PocketBase(config);
}

function normalizePocketBaseConfig(config: PocketBaseConfig): PocketBaseConfig {
  const normalized: PocketBaseConfig = { ...config };

  if (!normalized.DefaultDataDir && config.dataDir) {
    normalized.DefaultDataDir = config.dataDir;
  }
  if (!normalized.DefaultEncryptionEnv && config.encryptionEnv) {
    normalized.DefaultEncryptionEnv = config.encryptionEnv;
  }
  if (normalized.DefaultDev == null && config.isDev != null) {
    normalized.DefaultDev = config.isDev;
  }

  if (!normalized.DefaultDataDir) {
    const { baseDir } = inspectRuntime();
    normalized.DefaultDataDir = join(baseDir, "pb_data");
  }

  if (normalized.DefaultQueryTimeout == null || normalized.DefaultQueryTimeout === 0) {
    normalized.DefaultQueryTimeout = DefaultQueryTimeoutSeconds;
  }

  return normalized;
}

function buildFlagState(config: PocketBaseConfig): FlagState {
  return {
    devFlag: config.DefaultDev ?? false,
    dataDirFlag: config.DefaultDataDir ?? "./pb_data",
    encryptionEnvFlag: config.DefaultEncryptionEnv ?? "",
    queryTimeout: config.DefaultQueryTimeout ?? DefaultQueryTimeoutSeconds,
  };
}

function newRootCommand(): Command {
  const name = basename(process.argv[1] ?? process.argv[0] ?? "pocketbase");
  const root = new Command({
    Use: name,
    Short: `${name} CLI`,
    Version,
  });

  root.FParseErrWhitelist.UnknownFlags = true;
  root.CompletionOptions.DisableDefaultCmd = true;
  root.SetErr(newErrWriter());

  return root;
}

function eagerParseFlags(root: Command, state: FlagState): void {
  root.PersistentFlags().StringVar(state, "dataDirFlag", "dir", state.dataDirFlag, "the PocketBase data directory");
  root
    .PersistentFlags()
    .StringVar(
      state,
      "encryptionEnvFlag",
      "encryptionEnv",
      state.encryptionEnvFlag,
      "the env variable whose value of 32 characters will be used \nas encryption key for the app settings (default none)",
    );
  root
    .PersistentFlags()
    .BoolVar(state, "devFlag", "dev", state.devFlag, "enable dev mode, aka. printing logs and sql statements to the console");
  root
    .PersistentFlags()
    .IntVar(state, "queryTimeout", "queryTimeout", state.queryTimeout, "the default SELECT queries timeout in seconds");

  // ignore parse errors (full parsing happens on Execute).
  root.ParseFlags(process.argv.slice(2));
}

function inspectRuntime(): { baseDir: string; withTransientRuntime: boolean } {
  const withTransientRuntime = IsProbablyTransientRuntime();
  // PocketBun deviation: use the current working directory as runtime base dir
  // so package-managed and script entrypoints don't default to node_modules/bin-adjacent paths.
  return { baseDir: process.cwd(), withTransientRuntime };
}

function newErrWriter(): { write: (chunk: string) => void } {
  return {
    write: (chunk: string) => {
      const prefix = Bun.enableANSIColors ? (Bun.color("red", "ansi-256") ?? "") : "";
      const colored = prefix ? `${prefix}${chunk}\u001b[0m` : chunk;
      process.stderr.write(colored);
    },
  };
}
