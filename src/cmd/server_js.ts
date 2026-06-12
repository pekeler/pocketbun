// PocketBun-only: CLI utilities for server-side JavaScript hook and migration maintenance.

import { Command } from "../tools/cli/command.ts";

const rootValueFlags = new Set(["dir", "hooksDir", "hooksPool", "migrationsDir", "publicDir"]);

export function NewServerJSCommand(): Command {
  const command = new Command({
    use: "server-js",
    short: "Server-side JavaScript utilities",
  });

  command.addCommand(newServerJSUpgradeSourceCommand());
  return command;
}

export function isServerJSSourceUpgradeCommand(args: string[]): boolean {
  const positional: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? "";
    if (arg === "--") {
      break;
    }
    if (arg.startsWith("--")) {
      const eqIndex = arg.indexOf("=");
      const name = eqIndex >= 0 ? arg.slice(2, eqIndex) : arg.slice(2);
      if (eqIndex < 0 && rootValueFlags.has(name)) {
        index += 1;
      }
      continue;
    }
    if (arg.startsWith("-")) {
      continue;
    }

    positional.push(arg);
    if (positional.length >= 2) {
      break;
    }
  }

  return positional[0] === "server-js" && positional[1] === "upgrade-source";
}

function newServerJSUpgradeSourceCommand(): Command {
  const state = {
    check: false,
    dryRun: false,
    extensions: [".js", ".ts", ".mjs", ".mts", ".cjs", ".cts"],
  };

  const command = new Command({
    use: "upgrade-source [paths...]",
    short: "Upgrade deprecated server-side JavaScript aliases",
    long: `Rewrites older PocketBun server-side JavaScript code from deprecated compatibility aliases to the preferred names.

This includes deprecated Go-style exported app, record, DateTime, form, ApiError, ValidationError, and hook handler names; PocketBun package aliases and config keys; and older generated collection migrations that need app.forMigrations().

By default it scans ./pb_hooks and ./pb_migrations. Pass explicit files or directories to limit the rewrite.`,
    example: [
      "pocketbun server-js upgrade-source",
      "pocketbun server-js upgrade-source --check",
      "pocketbun server-js upgrade-source pb_hooks/main.pb.ts",
    ].join("\n"),
    silenceUsage: true,
  });

  command.persistentFlags().boolVar(state, "check", "check", state.check, "report files that would change without writing");
  command.persistentFlags().boolVar(state, "dryRun", "dry-run", state.dryRun, "print the planned rewrite without writing");
  command
    .persistentFlags()
    .stringSliceVar(state, "extensions", "extensions", state.extensions, "comma-separated file extensions to scan");

  command.runE = async (_cmd, args) => {
    const { runJSVMCaseCodemod } = await import("../plugins/jsvm/case_codemod.ts");
    const summary = await runJSVMCaseCodemod(args, {
      check: state.check,
      dryRun: state.dryRun,
      extensions: state.extensions,
    });

    for (const file of summary.files) {
      if (!file.changed) {
        continue;
      }
      const action = state.check || state.dryRun ? "would rewrite" : "rewrote";
      console.log(`${action} ${file.path} (${file.replacements} replacement${file.replacements === 1 ? "" : "s"})`);
    }

    if (summary.scanned === 0) {
      console.log("No matching server-side JavaScript files found.");
    } else if (summary.changed === 0) {
      console.log(
        `No deprecated server-side JavaScript aliases found in ${summary.scanned} file${summary.scanned === 1 ? "" : "s"}.`,
      );
    } else {
      const action = state.check || state.dryRun ? "would change" : "changed";
      console.log(
        `${action} ${summary.changed} of ${summary.scanned} file${summary.scanned === 1 ? "" : "s"} (${summary.replacements} replacement${summary.replacements === 1 ? "" : "s"}).`,
      );
    }

    if (state.check && summary.changed > 0) {
      return new Error("deprecated server-side JavaScript aliases found");
    }
    return null;
  };

  return command;
}
