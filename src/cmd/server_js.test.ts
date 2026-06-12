// PocketBun-only: tests for server-side JavaScript maintenance commands.

import { describe, expect, it } from "bun:test";
import { Command } from "../tools/cli/command.ts";
import { NewServerJSCommand, isServerJSLowercaseCommand } from "./server_js.ts";

describe("server-side JavaScript command", () => {
  it("detects lowercase command before hook loading", () => {
    expect(isServerJSLowercaseCommand(["server-js", "lowercase"])).toBeTrue();
    expect(isServerJSLowercaseCommand(["--dir", "pb_data", "server-js", "lowercase", "--check"])).toBeTrue();
    expect(isServerJSLowercaseCommand(["serve"])).toBeFalse();
    expect(isServerJSLowercaseCommand(["server-js"])).toBeFalse();
  });

  it("prints lowercase command help", async () => {
    const root = new Command({ Use: "pocketbun" });
    root.AddCommand(NewServerJSCommand());

    const [cmd, _args, findErr] = root.Find(["server-js", "lowercase"]);
    if (findErr) {
      throw findErr;
    }

    let out = "";
    cmd.SetOut({
      write: (chunk: string) => {
        out += chunk;
      },
    });

    const err = await root.Execute(["server-js", "lowercase", "--help"]);

    expect(err).toBeNull();
    expect(out).toContain("Rewrites older PocketBun pb_hooks/pb_migrations code");
    expect(out).toContain("pocketbun server-js lowercase --check");
  });
});
