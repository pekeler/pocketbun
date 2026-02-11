// Ported from pocketbase/pocketbase_test.go

import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { New, NewWithConfig, type PocketBaseConfig, Version } from "./pocketbase.ts";
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
  it.serial("New", () => {
    withArgs(["--dir=test_dir", "--encryptionEnv=test_encryption_env", "--debug=true"], () => {
      const app = New();

      expect(app).not.toBeNull();
      expect(app.RootCmd).not.toBeNull();
      expect(app.App).not.toBeNull();
      expect(app.DataDir()).toBe("test_dir");
      expect(app.EncryptionEnv()).toBe("test_encryption_env");
    });
  });

  it.serial("NewWithConfig", () => {
    const app = NewWithConfig({
      DefaultDataDir: "test_dir",
      DefaultEncryptionEnv: "test_encryption_env",
      HideStartBanner: true,
    } satisfies PocketBaseConfig);

    expect(app).not.toBeNull();
    expect(app.RootCmd).not.toBeNull();
    expect(app.App).not.toBeNull();
    expect(app.hideStartBanner).toBe(true);
    expect(app.DataDir()).toBe("test_dir");
    expect(app.EncryptionEnv()).toBe("test_encryption_env");
  });

  it.serial("NewWithConfigAndFlags", () => {
    withArgs(["--dir=test_dir_flag", "--encryptionEnv=test_encryption_env_flag", "--debug=false"], () => {
      const app = NewWithConfig({
        DefaultDataDir: "test_dir",
        DefaultEncryptionEnv: "test_encryption_env",
        HideStartBanner: true,
      } satisfies PocketBaseConfig);

      expect(app).not.toBeNull();
      expect(app.RootCmd).not.toBeNull();
      expect(app.App).not.toBeNull();
      expect(app.hideStartBanner).toBe(true);
      expect(app.DataDir()).toBe("test_dir_flag");
      expect(app.EncryptionEnv()).toBe("test_encryption_env_flag");
    });
  });

  it.serial("New defaults data dir to cwd for package-managed CLI paths", async () => {
    const originalArgv = [...process.argv];

    try {
      process.argv = [originalArgv[0] ?? "bun", join(tmpdir(), "node_modules", ".bin", "pocketbun")];
      const expectedDataDir = join(process.cwd(), "pb_data");

      const app = New();
      expect(app.DataDir()).toBe(expectedDataDir);
    } finally {
      process.argv = originalArgv;
    }
  });

  it.serial("skipBootstrap", async () => {
    const original = [...process.argv];
    const tempDir = await mkdtemp(join(tmpdir(), "temp_pb_data-"));

    try {
      const app0 = NewWithConfig({ DefaultDataDir: tempDir });
      app0.bootstrap();
      expect(skipBootstrap(app0)).toBe(true);

      process.argv = original.slice(0, 2);
      process.argv.push("demo");
      const app1 = NewWithConfig({ DefaultDataDir: tempDir });
      app1.RootCmd.AddCommand(new Command({ Use: "test" }));
      expect(skipBootstrap(app1)).toBe(true);

      const flagScenarios = [
        { name: "help", short: "h" },
        { name: "version", short: "v" },
      ];

      for (const scenario of flagScenarios) {
        process.argv = original.slice(0, 2);
        process.argv.push(`--${scenario.name}`);
        const app2 = NewWithConfig({ DefaultDataDir: tempDir });
        expect(skipBootstrap(app2)).toBe(true);

        process.argv = original.slice(0, 2);
        process.argv.push(`-${scenario.short}`);
        const app3 = NewWithConfig({ DefaultDataDir: tempDir });
        expect(skipBootstrap(app3)).toBe(true);

        process.argv = original.slice(0, 2);
        process.argv.push("custom", `--${scenario.name}`);
        const app4 = NewWithConfig({ DefaultDataDir: tempDir });
        const customCmd4 = new Command({ Use: "custom" });
        customCmd4.PersistentFlags().BoolP(scenario.name, scenario.short, false, "");
        app4.RootCmd.AddCommand(customCmd4);
        expect(skipBootstrap(app4)).toBe(false);

        process.argv = original.slice(0, 2);
        process.argv.push("custom", `-${scenario.short}`);
        const app5 = NewWithConfig({ DefaultDataDir: tempDir });
        const customCmd5 = new Command({ Use: "custom" });
        customCmd5.PersistentFlags().BoolP(scenario.name, scenario.short, false, "");
        app5.RootCmd.AddCommand(customCmd5);
        expect(skipBootstrap(app5)).toBe(false);
      }
    } finally {
      process.argv = original;
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it.serial("Execute returns command errors", async () => {
    const original = [...process.argv];
    const tempDir = await mkdtemp(join(tmpdir(), "temp_pb_data-"));

    try {
      process.argv = original.slice(0, 2);
      process.argv.push("custom");

      const app = NewWithConfig({ DefaultDataDir: tempDir });
      app.RootCmd.AddCommand(
        new Command({
          Use: "custom",
          RunE: () => new Error("custom command failed"),
        }),
      );

      const err = await app.Execute();
      expect(err).toBeInstanceOf(Error);
      expect(err?.message).toBe("custom command failed");
    } finally {
      process.argv = original;
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("Version resolves to the PocketBun package version", () => {
    expect(Version).not.toBe("(untracked)");
    expect(Version).toContain("-pocketbun.");
  });
});
