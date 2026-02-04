// PocketBun-only: minimal cobra-compatible command/flag parser for CLI support.

type FlagType = "string" | "bool" | "int" | "stringSlice";
type FlagValue = string | boolean | number | string[];

type FlagTarget = {
  obj: Record<string, unknown>;
  key: string;
};

class Flag {
  name: string;
  shorthand: string | null;
  usage: string;
  type: FlagType;
  defaultValue: FlagValue;
  value: FlagValue;
  target: FlagTarget | null;
  isSet = false;

  constructor(options: {
    name: string;
    shorthand?: string | null;
    usage: string;
    type: FlagType;
    defaultValue: FlagValue;
    target?: FlagTarget | null;
  }) {
    this.name = options.name;
    this.shorthand = options.shorthand ?? null;
    this.usage = options.usage;
    this.type = options.type;
    this.defaultValue = options.defaultValue;
    this.value = cloneFlagValue(options.defaultValue);
    this.target = options.target ?? null;
    this.apply(this.value);
  }

  setValue(value: FlagValue): void {
    this.value = value;
    this.isSet = true;
    this.apply(value);
  }

  private apply(value: FlagValue): void {
    if (!this.target) {
      return;
    }
    this.target.obj[this.target.key] = value;
  }
}

export class FlagSet {
  #flags = new Map<string, Flag>();
  #shorthand = new Map<string, Flag>();

  static merge(...sets: FlagSet[]): FlagSet {
    const merged = new FlagSet();
    for (const set of sets) {
      for (const flag of set.values()) {
        merged.addFlag(flag);
      }
    }
    return merged;
  }

  StringVar(target: Record<string, unknown>, key: string, name: string, value: string, usage: string): Flag {
    return this.addFlag(
      new Flag({
        name,
        usage,
        type: "string",
        defaultValue: value,
        target: { obj: target, key },
      }),
    );
  }

  StringVarP(
    target: Record<string, unknown>,
    key: string,
    name: string,
    shorthand: string,
    value: string,
    usage: string,
  ): Flag {
    return this.addFlag(
      new Flag({
        name,
        shorthand,
        usage,
        type: "string",
        defaultValue: value,
        target: { obj: target, key },
      }),
    );
  }

  StringSliceVar(target: Record<string, unknown>, key: string, name: string, value: string[], usage: string): Flag {
    return this.addFlag(
      new Flag({
        name,
        usage,
        type: "stringSlice",
        defaultValue: [...value],
        target: { obj: target, key },
      }),
    );
  }

  StringSliceVarP(
    target: Record<string, unknown>,
    key: string,
    name: string,
    shorthand: string,
    value: string[],
    usage: string,
  ): Flag {
    return this.addFlag(
      new Flag({
        name,
        shorthand,
        usage,
        type: "stringSlice",
        defaultValue: [...value],
        target: { obj: target, key },
      }),
    );
  }

  BoolVar(target: Record<string, unknown>, key: string, name: string, value: boolean, usage: string): Flag {
    return this.addFlag(
      new Flag({
        name,
        usage,
        type: "bool",
        defaultValue: value,
        target: { obj: target, key },
      }),
    );
  }

  BoolVarP(target: Record<string, unknown>, key: string, name: string, shorthand: string, value: boolean, usage: string): Flag {
    return this.addFlag(
      new Flag({
        name,
        shorthand,
        usage,
        type: "bool",
        defaultValue: value,
        target: { obj: target, key },
      }),
    );
  }

  BoolP(name: string, shorthand: string, value: boolean, usage: string): Flag {
    const holder: Record<string, unknown> = { value };
    return this.BoolVarP(holder, "value", name, shorthand, value, usage);
  }

  IntVar(target: Record<string, unknown>, key: string, name: string, value: number, usage: string): Flag {
    return this.addFlag(
      new Flag({
        name,
        usage,
        type: "int",
        defaultValue: value,
        target: { obj: target, key },
      }),
    );
  }

  IntVarP(target: Record<string, unknown>, key: string, name: string, shorthand: string, value: number, usage: string): Flag {
    return this.addFlag(
      new Flag({
        name,
        shorthand,
        usage,
        type: "int",
        defaultValue: value,
        target: { obj: target, key },
      }),
    );
  }

  Lookup(name: string): Flag | null {
    return this.#flags.get(name) ?? null;
  }

  ShorthandLookup(short: string): Flag | null {
    return this.#shorthand.get(short) ?? null;
  }

  Parse(args: string[], allowUnknown = false): { args: string[]; error: Error | null } {
    const remaining: string[] = [];
    let index = 0;

    while (index < args.length) {
      const arg = args[index] ?? "";
      if (arg === "--") {
        remaining.push(...args.slice(index + 1));
        break;
      }

      if (arg.startsWith("--") && arg.length > 2) {
        const eqIndex = arg.indexOf("=");
        const name = eqIndex >= 0 ? arg.slice(2, eqIndex) : arg.slice(2);
        const flag = this.Lookup(name);
        if (!flag) {
          if (allowUnknown) {
            remaining.push(arg);
            index += 1;
            continue;
          }
          return { args: remaining, error: new Error(`unknown flag: --${name}`) };
        }

        if (flag.type === "bool") {
          const value = eqIndex >= 0 ? arg.slice(eqIndex + 1) : "";
          flag.setValue(eqIndex >= 0 ? parseBool(value) : true);
          index += 1;
          continue;
        }

        let value = "";
        if (eqIndex >= 0) {
          value = arg.slice(eqIndex + 1);
        } else {
          index += 1;
          if (index >= args.length) {
            return { args: remaining, error: new Error(`missing value for --${name}`) };
          }
          value = args[index] ?? "";
        }
        applyFlagValue(flag, value);
        index += 1;
        continue;
      }

      if (arg.startsWith("-") && arg.length > 1) {
        const short = arg.slice(1);
        if (short.length !== 1) {
          remaining.push(arg);
          index += 1;
          continue;
        }

        const flag = this.ShorthandLookup(short);
        if (!flag) {
          if (allowUnknown) {
            remaining.push(arg);
            index += 1;
            continue;
          }
          return { args: remaining, error: new Error(`unknown shorthand flag: -${short}`) };
        }

        if (flag.type === "bool") {
          flag.setValue(true);
          index += 1;
          continue;
        }

        index += 1;
        if (index >= args.length) {
          return { args: remaining, error: new Error(`missing value for -${short}`) };
        }
        const value = args[index] ?? "";
        applyFlagValue(flag, value);
        index += 1;
        continue;
      }

      remaining.push(arg);
      index += 1;
    }

    return { args: remaining, error: null };
  }

  values(): Flag[] {
    return Array.from(this.#flags.values());
  }

  private addFlag(flag: Flag): Flag {
    this.#flags.set(flag.name, flag);
    if (flag.shorthand) {
      this.#shorthand.set(flag.shorthand, flag);
    }
    return flag;
  }
}

export type CommandArgsValidator = (cmd: Command, args: string[]) => Error | null;
export type CommandRun = (cmd: Command, args: string[]) => void;
export type CommandRunE = (cmd: Command, args: string[]) => Error | null | Promise<Error | null>;

export class Command {
  Use = "";
  Short = "";
  Long = "";
  Version = "";
  SilenceUsage = false;
  ValidArgs: string[] = [];
  Args: CommandArgsValidator | null = null;
  Run: CommandRun | null = null;
  RunE: CommandRunE | null = null;
  Hidden = false;
  FParseErrWhitelist: { UnknownFlags?: boolean } = {};
  CompletionOptions: { DisableDefaultCmd?: boolean } = {};

  #flags = new FlagSet();
  #persistentFlags = new FlagSet();
  #children: Command[] = [];
  #parent: Command | null = null;
  #errWriter: { write: (chunk: string) => void } | null = null;

  constructor(values: Partial<Command> = {}) {
    Object.assign(this, values);
  }

  AddCommand(...cmds: Array<Command | undefined | null>): void {
    for (const cmd of cmds) {
      if (!cmd) {
        continue;
      }
      cmd.#parent = this;
      this.#children.push(cmd);
    }
  }

  RemoveCommand(...cmds: Array<Command | undefined | null>): void {
    const remove = new Set(cmds.filter(Boolean) as Command[]);
    this.#children = this.#children.filter((child) => !remove.has(child));
  }

  PersistentFlags(): FlagSet {
    return this.#persistentFlags;
  }

  Flags(): FlagSet {
    return FlagSet.merge(this.inheritedFlags(), this.#persistentFlags, this.#flags);
  }

  ParseFlags(args: string[]): Error | null {
    const allowUnknown = this.allowsUnknownFlags();
    const { error } = this.Flags().Parse(args, allowUnknown);
    return error;
  }

  Find(args: string[]): [Command, string[], Error | null] {
    if (args.length === 0) {
      return [this, [], null];
    }

    const arg0 = args[0] ?? "";
    if (arg0.startsWith("-")) {
      return [this, args, null];
    }

    const child = this.#children.find((cmd) => cmd.name() === arg0);
    if (!child) {
      return [this, args, new Error(`unknown command: ${arg0}`)];
    }

    return child.Find(args.slice(1));
  }

  async Execute(args: string[] = process.argv.slice(2)): Promise<Error | null> {
    const [cmd, cmdArgs, findErr] = this.Find(args);
    if (findErr) {
      this.writeError(findErr.message);
      return findErr;
    }

    const allowUnknown = cmd.allowsUnknownFlags();
    const { args: remaining, error } = cmd.Flags().Parse(cmdArgs, allowUnknown);
    if (error) {
      cmd.writeError(error.message);
      return error;
    }

    if (cmd.Args) {
      const argErr = cmd.Args(cmd, remaining);
      if (argErr) {
        cmd.writeError(argErr.message);
        return argErr;
      }
    }

    if (cmd.RunE) {
      const result = await cmd.RunE(cmd, remaining);
      return result ?? null;
    }

    if (cmd.Run) {
      cmd.Run(cmd, remaining);
    }

    return null;
  }

  SetErr(writer: { write: (chunk: string) => void }): void {
    this.#errWriter = writer;
  }

  SetHelpCommand(_cmd: Command): void {
    // TODO: implement help subcommand handling when needed.
  }

  name(): string {
    const trimmed = this.Use.trim();
    if (!trimmed) {
      return "";
    }
    const parts = trimmed.split(/\s+/);
    return parts[0] ?? trimmed;
  }

  private inheritedFlags(): FlagSet {
    const sets: FlagSet[] = [];
    let current: Command | null = this.#parent;
    while (current) {
      sets.unshift(current.#persistentFlags);
      current = current.#parent;
    }
    return FlagSet.merge(...sets);
  }

  private allowsUnknownFlags(): boolean {
    if (this.FParseErrWhitelist.UnknownFlags) {
      return true;
    }
    let current: Command | null = this.#parent;
    while (current) {
      if (current.FParseErrWhitelist.UnknownFlags) {
        return true;
      }
      current = current.#parent;
    }
    return false;
  }

  private writeError(message: string): void {
    if (!message) {
      return;
    }
    if (this.#errWriter) {
      this.#errWriter.write(`${message}\n`);
      return;
    }
    process.stderr.write(`${message}\n`);
  }
}

function applyFlagValue(flag: Flag, raw: string): void {
  switch (flag.type) {
    case "int": {
      const parsed = Number.parseInt(raw, 10);
      flag.setValue(Number.isFinite(parsed) ? parsed : 0);
      return;
    }
    case "stringSlice": {
      const parts = raw === "" ? [""] : raw.split(",");
      const existing = flag.isSet && Array.isArray(flag.value) ? flag.value : [];
      flag.setValue([...existing, ...parts]);
      return;
    }
    case "bool": {
      flag.setValue(parseBool(raw));
      return;
    }
    default:
      flag.setValue(raw);
      return;
  }
}

function parseBool(raw: string): boolean {
  const normalized = raw.trim().toLowerCase();
  if (
    normalized === "" ||
    normalized === "1" ||
    normalized === "t" ||
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "y" ||
    normalized === "on"
  ) {
    return true;
  }
  if (
    normalized === "0" ||
    normalized === "f" ||
    normalized === "false" ||
    normalized === "no" ||
    normalized === "n" ||
    normalized === "off"
  ) {
    return false;
  }
  return Boolean(raw);
}

function cloneFlagValue(value: FlagValue): FlagValue {
  if (Array.isArray(value)) {
    return [...value];
  }
  return value;
}
