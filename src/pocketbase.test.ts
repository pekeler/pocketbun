// Ported from pocketbase/pocketbase_test.go

import { describe, expect, it } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { newPocketBase, newPocketBaseWithConfig, type PocketBaseConfig, version } from "./pocketbase.ts";
import { removeDirWithRetry } from "./tests/fs.ts";
import { Command } from "./tools/cli/command.ts";

function withArgs(args: string[], fn: () => void): void {
  const original = [...process.argv];
  try {
    process.argv = original.slice(0, 2);
    process.argv.push(...args);
    fn();
  } finally {
    process.argv = original;
  }
}

function skipBootstrap(app: unknown): boolean {
  return (app as { skipBootstrap: () => boolean }).skipBootstrap();
}

describe("pocketbase", () => {
  it.serial("newPocketBase", () => {
    withArgs(["--dir=test_dir", "--encryptionEnv=test_encryption_env", "--debug=true"], () => {
      const app = newPocketBase();

      expect(app).not.toBeNull();
      expect(app.rootCmd).not.toBeNull();
      expect(app.app).not.toBeNull();
      expect(app.dataDir()).toBe("test_dir");
      expect(app.encryptionEnv()).toBe("test_encryption_env");
    });
  });

  it.serial("newPocketBaseWithConfig", () => {
    const app = newPocketBaseWithConfig({
      defaultDataDir: "test_dir",
      defaultEncryptionEnv: "test_encryption_env",
      hideStartBanner: true,
    } satisfies PocketBaseConfig);

    expect(app).not.toBeNull();
    expect(app.rootCmd).not.toBeNull();
    expect(app.app).not.toBeNull();
    expect(app.hideStartBanner).toBe(true);
    expect(app.dataDir()).toBe("test_dir");
    expect(app.encryptionEnv()).toBe("test_encryption_env");
  });

  it.serial("newPocketBaseWithConfigAndFlags", () => {
    withArgs(["--dir=test_dir_flag", "--encryptionEnv=test_encryption_env_flag", "--debug=false"], () => {
      const app = newPocketBaseWithConfig({
        defaultDataDir: "test_dir",
        defaultEncryptionEnv: "test_encryption_env",
        hideStartBanner: true,
      } satisfies PocketBaseConfig);

      expect(app).not.toBeNull();
      expect(app.rootCmd).not.toBeNull();
      expect(app.app).not.toBeNull();
      expect(app.hideStartBanner).toBe(true);
      expect(app.dataDir()).toBe("test_dir_flag");
      expect(app.encryptionEnv()).toBe("test_encryption_env_flag");
    });
  });

  it.serial("newPocketBase defaults data dir to cwd for package-managed CLI paths", async () => {
    const originalArgv = [...process.argv];

    try {
      process.argv = [originalArgv[0] ?? "bun", join(tmpdir(), "node_modules", ".bin", "pocketbun")];
      const expectedDataDir = join(process.cwd(), "pb_data");

      const app = newPocketBase();
      expect(app.dataDir()).toBe(expectedDataDir);
    } finally {
      process.argv = originalArgv;
    }
  });

  it.serial("skipBootstrap", async () => {
    const original = [...process.argv];
    const tempDir = await mkdtemp(join(tmpdir(), "temp_pb_data-"));
    let bootstrappedApp: ReturnType<typeof newPocketBaseWithConfig> | null = null;

    try {
      const app0 = newPocketBaseWithConfig({ defaultDataDir: tempDir });
      bootstrappedApp = app0;
      app0.bootstrap();
      expect(skipBootstrap(app0)).toBe(true);

      process.argv = original.slice(0, 2);
      process.argv.push("demo");
      const app1 = newPocketBaseWithConfig({ defaultDataDir: tempDir });
      app1.rootCmd.addCommand(new Command({ use: "test" }));
      expect(skipBootstrap(app1)).toBe(true);

      const flagScenarios = [
        { name: "help", short: "h" },
        { name: "version", short: "v" },
      ];

      for (const scenario of flagScenarios) {
        process.argv = original.slice(0, 2);
        process.argv.push(`--${scenario.name}`);
        const app2 = newPocketBaseWithConfig({ defaultDataDir: tempDir });
        expect(skipBootstrap(app2)).toBe(true);

        process.argv = original.slice(0, 2);
        process.argv.push(`-${scenario.short}`);
        const app3 = newPocketBaseWithConfig({ defaultDataDir: tempDir });
        expect(skipBootstrap(app3)).toBe(true);

        process.argv = original.slice(0, 2);
        process.argv.push("custom", `--${scenario.name}`);
        const app4 = newPocketBaseWithConfig({ defaultDataDir: tempDir });
        const customCmd4 = new Command({ use: "custom" });
        customCmd4.persistentFlags().boolP(scenario.name, scenario.short, false, "");
        app4.rootCmd.addCommand(customCmd4);
        expect(skipBootstrap(app4)).toBe(false);

        process.argv = original.slice(0, 2);
        process.argv.push("custom", `-${scenario.short}`);
        const app5 = newPocketBaseWithConfig({ defaultDataDir: tempDir });
        const customCmd5 = new Command({ use: "custom" });
        customCmd5.persistentFlags().boolP(scenario.name, scenario.short, false, "");
        app5.rootCmd.addCommand(customCmd5);
        expect(skipBootstrap(app5)).toBe(false);
      }
    } finally {
      process.argv = original;
      bootstrappedApp?.resetBootstrapState();
      await removeDirWithRetry(tempDir);
    }
  });

  it.serial("execute returns command errors", async () => {
    const original = [...process.argv];
    const tempDir = await mkdtemp(join(tmpdir(), "temp_pb_data-"));

    try {
      process.argv = original.slice(0, 2);
      process.argv.push("custom");

      const app = newPocketBaseWithConfig({ defaultDataDir: tempDir });
      app.rootCmd.addCommand(
        new Command({
          use: "custom",
          runE: () => new Error("custom command failed"),
        }),
      );

      const err = await app.execute();
      expect(err).toBeInstanceOf(Error);
      expect(err?.message).toBe("custom command failed");
    } finally {
      process.argv = original;
      await removeDirWithRetry(tempDir);
    }
  });

  it("version resolves to the PocketBun package version", () => {
    expect(version).not.toBe("(untracked)");
    expect(version).toContain("-pocketbun.");
  });
});
