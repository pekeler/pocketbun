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

  it("Execute prints help with --help", async () => {
    const root = new Command({ Use: "pocketbun", Short: "pocketbun CLI" });
    root.AddCommand(new Command({ Use: "serve", Short: "Starts the web server" }));

    let out = "";
    root.SetOut({
      write: (chunk: string) => {
        out += chunk;
      },
    });

    const err = await root.Execute(["--help"]);
    expect(err).toBeNull();
    expect(out).toContain("Usage:");
    expect(out).toContain("pocketbun [command]");
    expect(out).toContain("Available Commands:");
    expect(out).toContain("serve");
  });

  it("Execute prints help for bare root command with subcommands", async () => {
    const root = new Command({ Use: "pocketbun", Short: "pocketbun CLI" });
    root.AddCommand(new Command({ Use: "serve", Short: "Starts the web server" }));

    let out = "";
    root.SetOut({
      write: (chunk: string) => {
        out += chunk;
      },
    });

    const err = await root.Execute([]);
    expect(err).toBeNull();
    expect(out).toContain("Usage:");
    expect(out).toContain("pocketbun [command]");
  });

  it("Execute prints version with --version", async () => {
    const root = new Command({ Use: "pocketbun", Version: "0.36.2-pocketbun.0" });

    let out = "";
    root.SetOut({
      write: (chunk: string) => {
        out += chunk;
      },
    });

    const err = await root.Execute(["--version"]);
    expect(err).toBeNull();
    expect(out.trim()).toBe("0.36.2-pocketbun.0");
  });

  it("Execute handles root flags before subcommands", async () => {
    const root = new Command({ Use: "pocketbun" });
    const state = { dev: false, ran: false };
    root.PersistentFlags().BoolVar(state, "dev", "dev", false, "dev mode");
    root.AddCommand(
      new Command({
        Use: "serve",
        Run: () => {
          state.ran = true;
        },
      }),
    );

    const err = await root.Execute(["--dev", "serve"]);
    expect(err).toBeNull();
    expect(state.dev).toBeTrue();
    expect(state.ran).toBeTrue();
  });

  it("Execute passes positional args to runnable leaf command", async () => {
    const root = new Command({ Use: "pocketbun" });
    const received: string[] = [];

    root.AddCommand(
      new Command({
        Use: "upsert",
        Run: (_cmd, args) => {
          received.push(...args);
        },
      }),
    );

    const err = await root.Execute(["upsert", "admin@example.com", "change-me"]);
    expect(err).toBeNull();
    expect(received).toEqual(["admin@example.com", "change-me"]);
  });
});
