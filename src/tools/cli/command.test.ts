// PocketBun-only: tests for the CLI command compatibility shim behavior.

import { describe, expect, it } from "bun:test";
import { Command } from "./command.ts";

describe("Command", () => {
  it("SetHelpCommand registers named help command", () => {
    const root = new Command({ Use: "root" });
    const help = new Command({ Use: "help", Hidden: true });

    root.SetHelpCommand(help);

    const [found, _args, err] = root.Find(["help"]);
    expect(err).toBeNull();
    expect(found).toBe(help);
  });

  it("SetHelpCommand replaces previous help command", () => {
    const root = new Command({ Use: "root" });
    const help1 = new Command({ Use: "help", Hidden: true });
    const help2 = new Command({ Use: "help", Hidden: true });

    root.SetHelpCommand(help1);
    root.SetHelpCommand(help2);

    const [found, _args, err] = root.Find(["help"]);
    expect(err).toBeNull();
    expect(found).toBe(help2);
  });

  it("SetHelpCommand does not register empty-use command", () => {
    const root = new Command({ Use: "root" });
    const disabledHelp = new Command({ Hidden: true });

    root.SetHelpCommand(disabledHelp);

    const [found, args, err] = root.Find(["help"]);
    expect(found).toBe(root);
    expect(args).toEqual(["help"]);
    expect(err).toBeInstanceOf(Error);
    expect(err?.message).toContain("unknown command");
  });
});
