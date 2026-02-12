// Ported from pocketbase/plugins/ghupdate/ghupdate.go

import { existsSync } from "node:fs";
import { mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { App } from "../../core/app.ts";
import { LocalTempDirName } from "../../core/base_paths.ts";
import { Extract } from "../../tools/archive/extract.ts";
import { cyan, green, hiBlack, yellow } from "../../tools/cli/color.ts";
import { Command } from "../../tools/cli/command.ts";
import { YesNoPrompt } from "../../tools/osutils/cmd.ts";
import { Release } from "./release.ts";

// HttpClient is a base HTTP client interface (usually used for test purposes).
export interface HttpClient {
  Do(req: Request): Promise<Response>;
}

const defaultHttpClient: HttpClient = {
  Do: async (req: Request): Promise<Response> => fetch(req),
};

// Config defines the config options of the ghupdate plugin.
//
// NB! This plugin is considered experimental and its config options may change in the future.
export type Config = {
  // Owner specifies the account owner of the repository (default to "pocketbase").
  Owner?: string;

  // Repo specifies the name of the repository (default to "pocketbase").
  Repo?: string;

  // ArchiveExecutable specifies the name of the executable file in the release archive
  // (default to "pocketbase"; an additional ".exe" check is also performed as a fallback).
  ArchiveExecutable?: string;

  // Optional signal to use when fetching and downloading the latest release.
  Context?: AbortSignal | null;

  // The HTTP client to use when fetching and downloading the latest release.
  // Defaults to fetch().
  HttpClient?: HttpClient;
};

// MustRegister registers the ghupdate plugin to the provided app instance
// and panic if it fails.
export function MustRegister(app: App, rootCmd: Command | null, config: Config): void {
  const err = Register(app, rootCmd, config);
  if (err) {
    throw err;
  }
}

// Register registers the ghupdate plugin to the provided app instance.
export function Register(app: App, rootCmd: Command | null, config: Config): Error | null {
  const normalized: Config = { ...config };

  if (!normalized.Owner) {
    normalized.Owner = "pocketbase";
  }

  if (!normalized.Repo) {
    normalized.Repo = "pocketbase";
  }

  if (!normalized.ArchiveExecutable) {
    normalized.ArchiveExecutable = "pocketbase";
  }

  if (!normalized.HttpClient) {
    normalized.HttpClient = defaultHttpClient;
  }

  const plugin = new GhUpdatePlugin(app, rootCmd?.Version ?? "", normalized);
  if (rootCmd) {
    rootCmd.AddCommand(plugin.updateCmd());
  }

  return null;
}

class GhUpdatePlugin {
  app: App;
  config: Config;
  currentVersion: string;

  constructor(app: App, currentVersion: string, config: Config) {
    this.app = app;
    this.currentVersion = currentVersion;
    this.config = config;
  }

  updateCmd(): Command {
    const state = { withBackup: true };

    const command = new Command({
      Use: "update",
      Short: "Automatically updates the current app executable with the latest available version",
      SilenceUsage: true,
    });

    command.RunE = async () => {
      let needConfirm = false;
      if (isMaybeRunningInDocker()) {
        needConfirm = true;
        yellow("NB! It seems that you are in a Docker container.\n");
        yellow(
          "The update command may not work as expected in this context because usually the version of the app is managed by the container image itself.\n",
        );
      } else if (isMaybeRunningInNixOS()) {
        needConfirm = true;
        yellow("NB! It seems that you are in a NixOS.\n");
        yellow(
          "Due to the non-standard filesystem implementation of the environment, the update command may not work as expected.\n",
        );
      }

      if (needConfirm) {
        const confirm = YesNoPrompt("Do you want to proceed with the update?", false);
        if (!confirm) {
          console.log("The command has been cancelled.");
          return null;
        }
      }

      return this.update(state.withBackup);
    };

    command
      .PersistentFlags()
      .BoolVar(state, "withBackup", "backup", true, "Creates a pb_data backup at the end of the update process");

    return command;
  }

  async update(withBackup: boolean): Promise<Error | null> {
    try {
      yellow("Fetching release information...\n");

      const latest = await fetchLatestRelease(
        this.config.Context ?? null,
        this.config.HttpClient ?? defaultHttpClient,
        this.config.Owner ?? "pocketbase",
        this.config.Repo ?? "pocketbase",
      );

      if (compareVersions(trimVersionPrefix(this.currentVersion), trimVersionPrefix(latest.Tag)) <= 0) {
        green("You already have the latest version %s.\n", this.currentVersion);
        return null;
      }

      const suffix = archiveSuffix(runtimeGoOS(), runtimeGoArch());
      if (suffix === "") {
        return new Error("unsupported platform");
      }

      const asset = latest.findAssetBySuffix(suffix);

      const releaseDir = join(this.app.DataDir(), LocalTempDirName);
      await rm(releaseDir, { recursive: true, force: true });
      await mkdir(releaseDir, { recursive: true });

      try {
        yellow("Downloading %s...\n", asset.Name);

        // download the release asset
        const assetZip = join(releaseDir, asset.Name);
        await downloadFile(
          this.config.Context ?? null,
          this.config.HttpClient ?? defaultHttpClient,
          asset.DownloadUrl,
          assetZip,
        );

        yellow("Extracting %s...\n", asset.Name);

        const extractDir = join(releaseDir, `extracted_${asset.Name}`);
        await rm(extractDir, { recursive: true, force: true });

        Extract(assetZip, extractDir);

        yellow("Replacing the executable...\n");

        const oldExec = currentExecutablePath();
        const renamedOldExec = `${oldExec}.old`;
        await rm(renamedOldExec, { force: true });

        let newExec = join(extractDir, this.config.ArchiveExecutable ?? "pocketbase");
        let primaryErr: unknown = null;
        try {
          await stat(newExec);
        } catch (err) {
          primaryErr = err;
          // try again with an .exe extension
          newExec = `${newExec}.exe`;
          try {
            await stat(newExec);
          } catch (fallbackErr) {
            return new Error(
              `the executable in the extracted path is missing or it is inaccessible: ${String(primaryErr)}, ${String(fallbackErr)}`,
            );
          }
        }

        // rename the current executable
        try {
          await rename(oldExec, renamedOldExec);
        } catch (err) {
          return new Error(`failed to rename the current executable: ${String(err)}`);
        }

        const tryToRevertExecChanges = async (): Promise<void> => {
          try {
            await rename(renamedOldExec, oldExec);
          } catch (revertErr) {
            this.app
              .Logger()
              .Debug("Failed to revert executable", "old", renamedOldExec, "new", oldExec, "error", String(revertErr));
          }
        };

        // replace with the extracted binary
        try {
          await rename(newExec, oldExec);
        } catch (err) {
          await tryToRevertExecChanges();
          return new Error(`failed replacing the executable: ${String(err)}`);
        }

        if (withBackup) {
          yellow("Creating pb_data backup...\n");

          const backupName = `@update_${latest.Tag}.zip`;
          const backupErr = await this.app.CreateBackup(this.config.Context ?? null, backupName);
          if (backupErr) {
            await tryToRevertExecChanges();
            return backupErr;
          }
        }

        hiBlack("---\n");
        green("Update completed successfully! You can start the executable as usual.\n");

        // print the release notes
        if (latest.Body !== "") {
          process.stdout.write("\n");
          cyan("Here is a list with some of the %s changes:\n", latest.Tag);
          // remove the update command note to avoid "stuttering"
          // (@todo consider moving to a config option)
          const releaseNotes = trimReleaseUpdateNote(latest.Body, this.config.ArchiveExecutable ?? "pocketbase");
          cyan("%s\n\n", releaseNotes);
        }

        return null;
      } finally {
        await rm(releaseDir, { recursive: true, force: true });
      }
    } catch (err) {
      return err instanceof Error ? err : new Error(String(err));
    }
  }
}

async function fetchLatestRelease(
  signal: AbortSignal | null,
  client: HttpClient,
  owner: string,
  repo: string,
): Promise<Release> {
  const url = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;

  const req = new Request(url, {
    method: "GET",
    signal: signal ?? undefined,
  });

  const res = await client.Do(req);
  const rawBody = await res.text();

  // http.Client doesn't treat non 2xx responses as error
  if (res.status >= 400) {
    throw new Error(`(${res.status}) failed to fetch latest releases:\n${rawBody}`);
  }

  let parsed: unknown;
  try {
    parsed = rawBody === "" ? {} : JSON.parse(rawBody);
  } catch (err) {
    throw new Error(`failed to decode latest release payload: ${String(err)}`);
  }

  return Release.fromJson(parsed);
}

async function downloadFile(signal: AbortSignal | null, client: HttpClient, url: string, destPath: string): Promise<void> {
  const req = new Request(url, {
    method: "GET",
    signal: signal ?? undefined,
  });

  const res = await client.Do(req);

  // http.Client doesn't treat non 2xx responses as error
  if (res.status >= 400) {
    throw new Error(`(${res.status}) failed to send download file request`);
  }

  // ensure that the dest parent dir(s) exist
  await mkdir(dirname(destPath), { recursive: true });
  await writeFile(destPath, new Uint8Array(await res.arrayBuffer()));
}

function trimReleaseUpdateNote(body: string, executable: string): string {
  const note = `> _To update the prebuilt executable you can run \`./${executable} update\`._`;
  return body.replace(note, "").trim();
}

function trimVersionPrefix(version: string): string {
  return version.startsWith("v") ? version.slice(1) : version;
}

function currentExecutablePath(): string {
  const candidate = process.argv[1] && process.argv[1] !== "" ? process.argv[1] : process.execPath;
  return resolve(candidate);
}

function runtimeGoOS(): string {
  if (process.platform === "win32") {
    return "windows";
  }
  return process.platform;
}

function runtimeGoArch(): string {
  switch (process.arch) {
    case "x64":
      return "amd64";
    case "arm64":
      return "arm64";
    case "arm":
      return "arm";
    default:
      return process.arch;
  }
}

function archiveSuffix(goos: string, goarch: string): string {
  switch (goos) {
    case "linux":
      switch (goarch) {
        case "amd64":
          return "_linux_amd64.zip";
        case "arm64":
          return "_linux_arm64.zip";
        case "arm":
          return "_linux_armv7.zip";
      }
      break;
    case "darwin":
      switch (goarch) {
        case "amd64":
          return "_darwin_amd64.zip";
        case "arm64":
          return "_darwin_arm64.zip";
      }
      break;
    case "windows":
      switch (goarch) {
        case "amd64":
          return "_windows_amd64.zip";
        case "arm64":
          return "_windows_arm64.zip";
      }
      break;
  }

  return "";
}

export function compareVersions(a: string, b: string): number {
  const aSplit = a.split(".");
  const aTotal = aSplit.length;

  const bSplit = b.split(".");
  const bTotal = bSplit.length;

  let limit = aTotal;
  if (bTotal > aTotal) {
    limit = bTotal;
  }

  for (let i = 0; i < limit; i += 1) {
    let x = 0;
    let y = 0;

    if (i < aTotal) {
      x = Number.parseInt(aSplit[i] ?? "", 10) || 0;
    }

    if (i < bTotal) {
      y = Number.parseInt(bSplit[i] ?? "", 10) || 0;
    }

    if (x < y) {
      return 1; // b is newer
    }

    if (x > y) {
      return -1; // a is newer
    }
  }

  return 0; // equal
}

// note: not completely reliable as it may not work on all platforms
// but should at least provide a warning for the most common use cases
function isMaybeRunningInDocker(): boolean {
  return existsSync("/.dockerenv");
}

// note: untested
function isMaybeRunningInNixOS(): boolean {
  return existsSync("/etc/NIXOS");
}
