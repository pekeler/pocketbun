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

  stringVar(target: Record<string, unknown>, key: string, name: string, value: string, usage: string): Flag {
    return this.StringVar(target, key, name, value, usage);
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

  stringVarP(
    target: Record<string, unknown>,
    key: string,
    name: string,
    shorthand: string,
    value: string,
    usage: string,
  ): Flag {
    return this.StringVarP(target, key, name, shorthand, value, usage);
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

  stringSliceVar(target: Record<string, unknown>, key: string, name: string, value: string[], usage: string): Flag {
    return this.StringSliceVar(target, key, name, value, usage);
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

  stringSliceVarP(
    target: Record<string, unknown>,
    key: string,
    name: string,
    shorthand: string,
    value: string[],
    usage: string,
  ): Flag {
    return this.StringSliceVarP(target, key, name, shorthand, value, usage);
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

  boolVar(target: Record<string, unknown>, key: string, name: string, value: boolean, usage: string): Flag {
    return this.BoolVar(target, key, name, value, usage);
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

  boolVarP(target: Record<string, unknown>, key: string, name: string, shorthand: string, value: boolean, usage: string): Flag {
    return this.BoolVarP(target, key, name, shorthand, value, usage);
  }

  BoolP(name: string, shorthand: string, value: boolean, usage: string): Flag {
    const holder: Record<string, unknown> = { value };
    return this.BoolVarP(holder, "value", name, shorthand, value, usage);
  }

  boolP(name: string, shorthand: string, value: boolean, usage: string): Flag {
    return this.BoolP(name, shorthand, value, usage);
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

  intVar(target: Record<string, unknown>, key: string, name: string, value: number, usage: string): Flag {
    return this.IntVar(target, key, name, value, usage);
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

  intVarP(target: Record<string, unknown>, key: string, name: string, shorthand: string, value: number, usage: string): Flag {
    return this.IntVarP(target, key, name, shorthand, value, usage);
  }

  Lookup(name: string): Flag | null {
    return this.#flags.get(name) ?? null;
  }

  lookup(name: string): Flag | null {
    return this.Lookup(name);
  }

  ShorthandLookup(short: string): Flag | null {
    return this.#shorthand.get(short) ?? null;
  }

  shorthandLookup(short: string): Flag | null {
    return this.ShorthandLookup(short);
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

  parse(args: string[], allowUnknown = false): { args: string[]; error: Error | null } {
    return this.Parse(args, allowUnknown);
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
  Example = "";
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
  #helpCommand: Command | null = null;
  #parent: Command | null = null;
  #errWriter: { write: (chunk: string) => void } | null = null;
  #outWriter: { write: (chunk: string) => void } | null = null;

  constructor(values: Partial<Command> = {}) {
    Object.assign(this, values);
  }

  get use(): string {
    return this.Use;
  }

  set use(value: string) {
    this.Use = value;
  }

  get short(): string {
    return this.Short;
  }

  set short(value: string) {
    this.Short = value;
  }

  get long(): string {
    return this.Long;
  }

  set long(value: string) {
    this.Long = value;
  }

  get example(): string {
    return this.Example;
  }

  set example(value: string) {
    this.Example = value;
  }

  get version(): string {
    return this.Version;
  }

  set version(value: string) {
    this.Version = value;
  }

  get silenceUsage(): boolean {
    return this.SilenceUsage;
  }

  set silenceUsage(value: boolean) {
    this.SilenceUsage = value;
  }

  get validArgs(): string[] {
    return this.ValidArgs;
  }

  set validArgs(value: string[]) {
    this.ValidArgs = value;
  }

  get args(): CommandArgsValidator | null {
    return this.Args;
  }

  set args(value: CommandArgsValidator | null) {
    this.Args = value;
  }

  get run(): CommandRun | null {
    return this.Run;
  }

  set run(value: CommandRun | null) {
    this.Run = value;
  }

  get runE(): CommandRunE | null {
    return this.RunE;
  }

  set runE(value: CommandRunE | null) {
    this.RunE = value;
  }

  get hidden(): boolean {
    return this.Hidden;
  }

  set hidden(value: boolean) {
    this.Hidden = value;
  }

  get fParseErrWhitelist(): { UnknownFlags?: boolean } {
    return this.FParseErrWhitelist;
  }

  set fParseErrWhitelist(value: { UnknownFlags?: boolean }) {
    this.FParseErrWhitelist = value;
  }

  get completionOptions(): { DisableDefaultCmd?: boolean } {
    return this.CompletionOptions;
  }

  set completionOptions(value: { DisableDefaultCmd?: boolean }) {
    this.CompletionOptions = value;
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

  addCommand(...cmds: Array<Command | undefined | null>): void {
    this.AddCommand(...cmds);
  }

  RemoveCommand(...cmds: Array<Command | undefined | null>): void {
    const remove = new Set(cmds.filter(Boolean) as Command[]);
    this.#children = this.#children.filter((child) => !remove.has(child));
  }

  removeCommand(...cmds: Array<Command | undefined | null>): void {
    this.RemoveCommand(...cmds);
  }

  PersistentFlags(): FlagSet {
    return this.#persistentFlags;
  }

  persistentFlags(): FlagSet {
    return this.PersistentFlags();
  }

  Flags(): FlagSet {
    return FlagSet.merge(this.inheritedFlags(), this.#persistentFlags, this.#flags);
  }

  flags(): FlagSet {
    return this.Flags();
  }

  ParseFlags(args: string[]): Error | null {
    const allowUnknown = this.allowsUnknownFlags();
    const { error } = this.Flags().Parse(args, allowUnknown);
    return error;
  }

  parseFlags(args: string[]): Error | null {
    return this.ParseFlags(args);
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
      // Treat non-flag tokens as positional args for runnable/leaf commands.
      // Only surface unknown-command errors for pure parent commands.
      if (this.RunE || this.Run) {
        return [this, args, null];
      }
      return [this, args, new Error(`unknown command: ${arg0}`)];
    }

    return child.Find(args.slice(1));
  }

  find(args: string[]): [Command, string[], Error | null] {
    return this.Find(args);
  }

  async Execute(args: string[] = process.argv.slice(2)): Promise<Error | null> {
    let [cmd, cmdArgs, findErr] = this.Find(args);
    if (findErr) {
      this.writeError(findErr.message);
      return findErr;
    }

    if (cmd.shouldShowHelp(cmdArgs)) {
      cmd.printHelp();
      return null;
    }

    if (cmd.shouldShowVersion(cmdArgs)) {
      cmd.printVersion();
      return null;
    }

    let allowUnknown = cmd.allowsUnknownFlags();
    let { args: remaining, error } = cmd.Flags().Parse(cmdArgs, allowUnknown);
    if (error) {
      cmd.writeError(error.message);
      return error;
    }

    // Allow root persistent flags before subcommands, e.g. `pocketbun --dev serve`.
    if (cmd === this && !cmd.RunE && !cmd.Run && remaining.length > 0) {
      const [nestedCmd, nestedArgs, nestedErr] = this.Find(remaining);
      if (nestedErr) {
        this.writeError(nestedErr.message);
        return nestedErr;
      }

      if (nestedCmd !== this) {
        cmd = nestedCmd;
        cmdArgs = nestedArgs;

        if (cmd.shouldShowHelp(cmdArgs)) {
          cmd.printHelp();
          return null;
        }

        if (cmd.shouldShowVersion(cmdArgs)) {
          cmd.printVersion();
          return null;
        }

        allowUnknown = cmd.allowsUnknownFlags();
        ({ args: remaining, error } = cmd.Flags().Parse(cmdArgs, allowUnknown));
        if (error) {
          cmd.writeError(error.message);
          return error;
        }
      }
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

    if (!cmd.RunE && !cmd.Run && remaining.length === 0 && cmd.hasVisibleChildren()) {
      cmd.printHelp();
    }

    return null;
  }

  async execute(args: string[] = process.argv.slice(2)): Promise<Error | null> {
    return this.Execute(args);
  }

  SetErr(writer: { write: (chunk: string) => void }): void {
    this.#errWriter = writer;
  }

  setErr(writer: { write: (chunk: string) => void }): void {
    this.SetErr(writer);
  }

  SetOut(writer: { write: (chunk: string) => void }): void {
    this.#outWriter = writer;
  }

  setOut(writer: { write: (chunk: string) => void }): void {
    this.SetOut(writer);
  }

  SetHelpCommand(cmd: Command): void {
    if (this.#helpCommand) {
      this.RemoveCommand(this.#helpCommand);
    }

    this.#helpCommand = cmd;

    // Allow callers to disable help command registration by passing an
    // empty-use command (matching the current PocketBun root command usage).
    if (!cmd.name()) {
      return;
    }

    this.AddCommand(cmd);
  }

  setHelpCommand(cmd: Command): void {
    this.SetHelpCommand(cmd);
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

  private writeOutput(message: string): void {
    if (!message) {
      return;
    }
    if (this.#outWriter) {
      this.#outWriter.write(message);
      return;
    }
    process.stdout.write(message);
  }

  private hasVisibleChildren(): boolean {
    return this.#children.some((child) => !child.Hidden);
  }

  private shouldShowHelp(args: string[]): boolean {
    if (this.Flags().Lookup("help") || this.Flags().ShorthandLookup("h")) {
      return false;
    }
    return args.includes("--help") || args.includes("-h");
  }

  private shouldShowVersion(args: string[]): boolean {
    if (!this.Version) {
      return false;
    }
    if (this.Flags().Lookup("version") || this.Flags().ShorthandLookup("v")) {
      return false;
    }
    return args.includes("--version") || args.includes("-v");
  }

  private printVersion(): void {
    if (!this.Version) {
      return;
    }
    this.writeOutput(`${this.Version}\n`);
  }

  private printHelp(): void {
    const lines: string[] = [];

    const description = this.Long || this.Short;
    if (description) {
      lines.push(description.trimEnd(), "");
    }

    lines.push("Usage:");
    lines.push(`  ${this.Use}${this.hasVisibleChildren() ? " [command]" : ""}`);

    if (this.Example) {
      lines.push("", "Examples:", this.Example.trimEnd());
    }

    const visibleChildren = this.#children.filter((child) => !child.Hidden);
    if (visibleChildren.length > 0) {
      lines.push("", "Available Commands:");
      const commandNameWidth = Math.max(...visibleChildren.map((child) => child.name().length), 14) + 2;
      for (const child of visibleChildren) {
        const name = child.name().padEnd(commandNameWidth, " ");
        lines.push(`  ${name}${child.Short}`);
      }
    }

    const flags = this.Flags().values();
    const showBuiltinHelp = !this.Flags().Lookup("help") && !this.Flags().ShorthandLookup("h");
    const showBuiltinVersion = Boolean(this.Version) && !this.Flags().Lookup("version") && !this.Flags().ShorthandLookup("v");
    if (flags.length > 0 || showBuiltinHelp || showBuiltinVersion) {
      const flagRows: Array<{ label: string; usage: string }> = [];
      for (const flag of flags) {
        const shorthand = flag.shorthand ? `-${flag.shorthand}, ` : "    ";
        flagRows.push({ label: `${shorthand}--${flag.name}`, usage: flag.usage });
      }
      if (showBuiltinHelp) {
        flagRows.push({ label: "-h, --help", usage: "help" });
      }
      if (showBuiltinVersion) {
        flagRows.push({ label: "-v, --version", usage: "version" });
      }
      const labelWidth = Math.max(...flagRows.map((row) => row.label.length), 14) + 2;

      lines.push("", "Flags:");
      for (const row of flagRows) {
        const usage = row.usage.replaceAll("\n", `\n${" ".repeat(labelWidth + 2)}`);
        lines.push(`  ${row.label.padEnd(labelWidth, " ")}${usage}`);
      }
    }

    this.writeOutput(`${lines.join("\n")}\n`);
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
