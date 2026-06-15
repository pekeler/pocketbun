// PocketBun-only: tests for server-side JavaScript maintenance commands.

import { describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "../tools/cli/command.ts";
import { NewHooksCommand, NewServerJSCommand, isHooksBuildCommand, isServerJSSourceUpgradeCommand } from "./server_js.ts";

describe("server-side JavaScript command", () => {
  it("detects source upgrade commands before hook loading", () => {
    expect(isServerJSSourceUpgradeCommand(["server-js", "upgrade-source"])).toBeTrue();
    expect(isServerJSSourceUpgradeCommand(["--dir", "pb_data", "server-js", "upgrade-source", "--check"])).toBeTrue();
    expect(isServerJSSourceUpgradeCommand(["server-js", "lowercase"])).toBeFalse();
    expect(isServerJSSourceUpgradeCommand(["serve"])).toBeFalse();
    expect(isServerJSSourceUpgradeCommand(["server-js"])).toBeFalse();
  });

  it("detects hook build commands before hook loading", () => {
    expect(isHooksBuildCommand(["hooks", "build"])).toBeTrue();
    expect(isHooksBuildCommand(["--hooksDir", "pb_hooks", "hooks", "build", "--outDir", "dist/pb_hooks"])).toBeTrue();
    expect(isHooksBuildCommand(["hooks"])).toBeFalse();
    expect(isHooksBuildCommand(["server-js", "upgrade-source"])).toBeFalse();
  });

  it("prints upgrade-source command help", async () => {
    const root = new Command({ Use: "pocketbun" });
    root.AddCommand(NewServerJSCommand());

    const [cmd, _args, findErr] = root.Find(["server-js", "upgrade-source"]);
    if (findErr) {
      throw findErr;
    }

    let out = "";
    cmd.SetOut({
      write: (chunk: string) => {
        out += chunk;
      },
    });

    const err = await root.Execute(["server-js", "upgrade-source", "--help"]);

    expect(err).toBeNull();
    expect(out).toContain("deprecated compatibility aliases");
    expect(out).toContain("app, record, DateTime, form, ApiError, ValidationError");
    expect(out).toContain("pocketbun server-js upgrade-source --check");
  });

  it("does not register the old lowercase command", async () => {
    const root = new Command({ Use: "pocketbun" });
    root.AddCommand(NewServerJSCommand());

    const [serverCmd, _args, serverFindErr] = root.Find(["server-js"]);
    if (serverFindErr) {
      throw serverFindErr;
    }

    let serverHelp = "";
    serverCmd.SetOut({
      write: (chunk: string) => {
        serverHelp += chunk;
      },
    });

    const helpErr = await root.Execute(["server-js", "--help"]);
    expect(helpErr).toBeNull();
    expect(serverHelp).toContain("upgrade-source");
    expect(serverHelp).not.toContain("lowercase");

    const [legacyCmd, legacyArgs, legacyFindErr] = root.Find(["server-js", "lowercase"]);
    expect(legacyFindErr?.message).toBe("unknown command: lowercase");
    expect(legacyCmd.name()).toBe("server-js");
    expect(legacyArgs).toEqual(["lowercase"]);
  });

  it("prints hooks build command help", async () => {
    const root = new Command({ Use: "pocketbun" });
    root.AddCommand(NewHooksCommand());

    const [cmd, _args, findErr] = root.Find(["hooks", "build"]);
    if (findErr) {
      throw findErr;
    }

    let out = "";
    cmd.SetOut({
      write: (chunk: string) => {
        out += chunk;
      },
    });

    const err = await root.Execute(["hooks", "build", "--help"]);

    expect(err).toBeNull();
    expect(out).toContain("Bundles PocketBun server hook entry files");
    expect(out).toContain("pocketbun hooks build --hooksDir pb_hooks --outDir dist/pb_hooks");
    expect(out).toContain("--hooksFilesPattern");
  });

  it("runs hooks build command", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "pocketbun-hooks-build-"));
    const hooksDir = join(rootDir, "pb_hooks");
    const outDir = join(rootDir, "dist", "pb_hooks");
    const root = new Command({ Use: "pocketbun" });
    root.AddCommand(NewHooksCommand());

    await mkdir(hooksDir, { recursive: true });
    await writeFile(join(hooksDir, "main.pb.ts"), `routerAdd("GET", "/hello", (event) => event.json(200, {}));\n`);

    const previousLog = console.log;
    const logs: string[] = [];
    console.log = (...args: unknown[]) => {
      logs.push(args.join(" "));
    };

    try {
      const err = await root.Execute(["hooks", "build", "--hooksDir", hooksDir, "--outDir", outDir]);

      expect(err).toBeNull();
      expect(await readdir(outDir)).toEqual(["main.pb.js"]);
      expect(logs.join("\n")).toContain("Bundled 1 server hook");
    } finally {
      console.log = previousLog;
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});
