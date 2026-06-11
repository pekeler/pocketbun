// PocketBun-only: tests for JSVM maintenance commands.

import { describe, expect, it } from "bun:test";
import { Command } from "../tools/cli/command.ts";
import { NewJSVMCommand, isJSVMLowercaseCommand } from "./jsvm.ts";

describe("JSVM command", () => {
  it("detects lowercase command before hook loading", () => {
    expect(isJSVMLowercaseCommand(["jsvm", "lowercase"])).toBeTrue();
    expect(isJSVMLowercaseCommand(["--dir", "pb_data", "jsvm", "lowercase", "--check"])).toBeTrue();
    expect(isJSVMLowercaseCommand(["serve"])).toBeFalse();
    expect(isJSVMLowercaseCommand(["jsvm"])).toBeFalse();
  });

  it("prints lowercase command help", async () => {
    const root = new Command({ Use: "pocketbun" });
    root.AddCommand(NewJSVMCommand());

    const [cmd, _args, findErr] = root.Find(["jsvm", "lowercase"]);
    if (findErr) {
      throw findErr;
    }

    let out = "";
    cmd.SetOut({
      write: (chunk: string) => {
        out += chunk;
      },
    });

    const err = await root.Execute(["jsvm", "lowercase", "--help"]);

    expect(err).toBeNull();
    expect(out).toContain("Rewrites older PocketBun pb_hooks/pb_migrations code");
    expect(out).toContain("pocketbun jsvm lowercase --check");
  });
});
