// PocketBun-only: tests for the CLI command compatibility shim behavior.

import { describe, expect, it } from "bun:test";
import { Command } from "./command.ts";

describe("Command", () => {
  it("accepts lower-camel command and flag aliases", async () => {
    const root = new Command({ use: "pocketbun", short: "pocketbun CLI" });
    const state = { dev: false, name: "" };
    root.persistentFlags().boolVar(state, "dev", "dev", false, "dev mode");
    root.persistentFlags().stringVar(state, "name", "name", "", "name");
    root.addCommand(
      new Command({
        use: "serve",
        run: () => {
          state.name += "-ran";
        },
      }),
    );

    const err = await root.execute(["--dev", "--name", "test", "serve"]);

    expect(err).toBeNull();
    expect(state).toEqual({ dev: true, name: "test-ran" });
    expect(root.find(["serve"])[0].use).toBe("serve");
  });

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
    root.AddCommand(new Command({ Use: "upgrade-source", Short: "Upgrade deprecated aliases" }));

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
    expect(out).toContain("upgrade-source  Upgrade deprecated aliases");
  });

  it("Execute prints long help text when available", async () => {
    const root = new Command({
      Use: "pocketbun",
      Short: "short description",
      Long: "long description\nwith details\n",
    });

    let out = "";
    root.SetOut({
      write: (chunk: string) => {
        out += chunk;
      },
    });

    const err = await root.Execute(["--help"]);
    expect(err).toBeNull();
    expect(out.startsWith("long description\nwith details\n\nUsage:")).toBeTrue();
    expect(out).not.toContain("short description");
  });

  it("Execute prints command examples when available", async () => {
    const root = new Command({
      Use: "pocketbun",
      Short: "pocketbun CLI",
      Example: "pocketbun serve --http 127.0.0.1:8090",
    });

    let out = "";
    root.SetOut({
      write: (chunk: string) => {
        out += chunk;
      },
    });

    const err = await root.Execute(["--help"]);
    expect(err).toBeNull();
    expect(out).toContain("Examples:");
    expect(out).toContain("pocketbun serve --http 127.0.0.1:8090");
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

  it("Resolve selects commands without executing them", () => {
    const root = new Command({ Use: "pocketbun" });
    const state = { workers: 1, http: "", ran: false };
    root.FParseErrWhitelist.UnknownFlags = true;
    root.PersistentFlags().IntVar(state, "workers", "workers", 1, "workers");
    const serve = new Command({
      Use: "serve",
      Run: () => {
        state.ran = true;
      },
    });
    serve.PersistentFlags().StringVar(state, "http", "http", "", "http address");
    root.AddCommand(serve);

    const [before, beforeArgs, beforeErr] = root.Resolve(["--workers=3", "serve", "--http", "127.0.0.1:9000"]);
    expect(beforeErr).toBeNull();
    expect(before).toBe(serve);
    expect(beforeArgs).toEqual([]);
    expect(state).toEqual({ workers: 3, http: "127.0.0.1:9000", ran: false });

    const [after, afterArgs, afterErr] = root.resolve(["serve", "--workers", "4", "--http=127.0.0.1:9001"]);
    expect(afterErr).toBeNull();
    expect(after).toBe(serve);
    expect(afterArgs).toEqual([]);
    expect(state).toEqual({ workers: 4, http: "127.0.0.1:9001", ran: false });
  });

  it("rejects non-integer int flags", async () => {
    const root = new Command({ Use: "pocketbun" });
    const state = { workers: 1 };
    root.SetErr({ write: () => {} });
    root.PersistentFlags().IntVar(state, "workers", "workers", 1, "workers");

    const err = await root.Execute(["--workers=2.5"]);

    expect(err?.message).toBe('invalid value "2.5" for --workers: expected an integer');
    expect(state.workers).toBe(1);

    const emptyErr = await root.Execute(["--workers="]);
    expect(emptyErr?.message).toBe('invalid value "" for --workers: expected an integer');
    expect(state.workers).toBe(1);
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
