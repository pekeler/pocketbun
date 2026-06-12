// PocketBun-only: tests for server-side JavaScript maintenance commands.

import { describe, expect, it } from "bun:test";
import { Command } from "../tools/cli/command.ts";
import { NewServerJSCommand, isServerJSSourceUpgradeCommand } from "./server_js.ts";

describe("server-side JavaScript command", () => {
  it("detects source upgrade commands before hook loading", () => {
    expect(isServerJSSourceUpgradeCommand(["server-js", "upgrade-source"])).toBeTrue();
    expect(isServerJSSourceUpgradeCommand(["--dir", "pb_data", "server-js", "upgrade-source", "--check"])).toBeTrue();
    expect(isServerJSSourceUpgradeCommand(["server-js", "lowercase"])).toBeFalse();
    expect(isServerJSSourceUpgradeCommand(["serve"])).toBeFalse();
    expect(isServerJSSourceUpgradeCommand(["server-js"])).toBeFalse();
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
    expect(out).toContain("Rewrites older PocketBun server-side JavaScript code");
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
});
