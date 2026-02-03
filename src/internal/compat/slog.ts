// PocketBun-only: minimal slog shim for logger BatchHandler parity.

export type Context = unknown;

export class Level {
  #value: number;

  constructor(value: number) {
    this.#value = value;
  }

  Level(): Level {
    return this;
  }

  Value(): number {
    return this.#value;
  }

  valueOf(): number {
    return this.#value;
  }

  toString(): string {
    return globalThis.String(this.#value);
  }
}

export const LevelDebug = new Level(-4);
export const LevelInfo = new Level(0);
export const LevelWarn = new Level(4);
export const LevelError = new Level(8);

export interface Leveler {
  Level(): Level;
}

export enum Kind {
  Any = 0,
  Group = 1,
}

export class Value {
  #kind: Kind;
  #value: unknown;

  constructor(kind: Kind, value: unknown) {
    this.#kind = kind;
    this.#value = value;
  }

  Kind(): Kind {
    return this.#kind;
  }

  Any(): unknown {
    return this.#value;
  }

  Group(): Attr[] {
    return this.#kind === Kind.Group ? (this.#value as Attr[]) : [];
  }

  Resolve(): Value {
    const candidate = this.#value as { LogValue?: () => Value } | null;
    if (candidate && typeof candidate.LogValue === "function") {
      const resolved = candidate.LogValue();
      return resolved instanceof Value ? resolved : this;
    }

    return this;
  }

  equals(other: Value): boolean {
    return this.#kind === other.#kind && this.#value === other.#value;
  }
}

export class Attr {
  Key: string;
  Value: Value;

  constructor(key: string, value: Value) {
    this.Key = key;
    this.Value = value;
  }

  Equal(other: Attr): boolean {
    return this.Key === other.Key && this.Value.equals(other.Value);
  }
}

export class Record {
  Time: Date;
  Level: Level;
  Message: string;
  PC: number;
  #attrs: Attr[];

  constructor(time: Date, level: Level, message: string, pc: number) {
    this.Time = time;
    this.Level = level;
    this.Message = message;
    this.PC = pc;
    this.#attrs = [];
  }

  NumAttrs(): number {
    return this.#attrs.length;
  }

  Attrs(fn: (attr: Attr) => boolean): void {
    for (const attr of this.#attrs) {
      if (!fn(attr)) {
        break;
      }
    }
  }

  AddAttrs(...attrs: Attr[]): void {
    this.#attrs.push(...attrs);
  }

  Add(key: string, value: unknown): void {
    this.AddAttrs(Any(key, value));
  }

  Clone(): Record {
    const clone = new Record(this.Time, this.Level, this.Message, this.PC);
    clone.#attrs = [...this.#attrs];
    return clone;
  }
}

export interface Handler {
  Enabled(ctx: Context, level: Level): boolean;
  Handle(ctx: Context, record: Record): Error | null | Promise<Error | null>;
  WithAttrs(attrs: Attr[]): Handler;
  WithGroup(name: string): Handler;
}

class NoopHandler implements Handler {
  Enabled(_ctx: Context, _level: Level): boolean {
    return true;
  }

  Handle(_ctx: Context, _record: Record): Error | null {
    return null;
  }

  WithAttrs(_attrs: Attr[]): Handler {
    return this;
  }

  WithGroup(_name: string): Handler {
    return this;
  }
}

export class Logger {
  #handler: Handler;

  constructor(handler: Handler) {
    this.#handler = handler;
  }

  Enabled(ctx: Context, level: Level): boolean {
    return this.#handler.Enabled(ctx, level);
  }

  Handler(): Handler {
    return this.#handler;
  }

  WithGroup(name: string): Logger {
    if (!name) {
      return this;
    }
    return new Logger(this.#handler.WithGroup(name));
  }

  With(...args: unknown[]): Logger {
    return this.WithAttrs(argsToAttrs(args));
  }

  WithAttrs(attrs: Attr[]): Logger {
    if (attrs.length === 0) {
      return this;
    }
    return new Logger(this.#handler.WithAttrs(attrs));
  }

  Log(ctx: Context, level: Level, message: string, ...args: unknown[]): void {
    if (!this.#handler.Enabled(ctx, level)) {
      return;
    }
    const record = new Record(new Date(), level, message, 0);
    const attrs = argsToAttrs(args);
    if (attrs.length > 0) {
      record.AddAttrs(...attrs);
    }
    const result = this.#handler.Handle(ctx, record);
    if (result instanceof Promise) {
      void result.catch(() => {});
    }
  }

  LogAttrs(ctx: Context, level: Level, message: string, ...attrs: Attr[]): void {
    if (!this.#handler.Enabled(ctx, level)) {
      return;
    }
    const record = new Record(new Date(), level, message, 0);
    if (attrs.length > 0) {
      record.AddAttrs(...attrs);
    }
    const result = this.#handler.Handle(ctx, record);
    if (result instanceof Promise) {
      void result.catch(() => {});
    }
  }

  Debug(message: string, ...args: unknown[]): void {
    this.Log({}, LevelDebug, message, ...args);
  }

  Info(message: string, ...args: unknown[]): void {
    this.Log({}, LevelInfo, message, ...args);
  }

  Warn(message: string, ...args: unknown[]): void {
    this.Log({}, LevelWarn, message, ...args);
  }

  Error(message: string, ...args: unknown[]): void {
    this.Log({}, LevelError, message, ...args);
  }
}

export function New(handler: Handler): Logger {
  return new Logger(handler);
}

let defaultLogger = new Logger(new NoopHandler());

export function Default(): Logger {
  return defaultLogger;
}

export function SetDefault(logger: Logger): void {
  defaultLogger = logger;
}

export function NewRecord(time: Date, level: Level, message: string, pc: number): Record {
  return new Record(time, level, message, pc);
}

export function Any(key: string, value: unknown): Attr {
  return new Attr(key, new Value(Kind.Any, value));
}

export function Int(key: string, value: number): Attr {
  return Any(key, value);
}

export function String(key: string, value: string): Attr {
  return Any(key, value);
}

export function Group(key: string, ...attrs: Attr[]): Attr {
  return new Attr(key, new Value(Kind.Group, attrs));
}

function argsToAttrs(args: unknown[]): Attr[] {
  if (args.length === 0) {
    return [];
  }
  const attrs: Attr[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg instanceof Attr) {
      attrs.push(arg);
      continue;
    }
    if (arg && typeof arg === "object" && "Key" in arg && "Value" in arg) {
      const candidate = arg as Attr;
      if (candidate.Key && candidate.Value instanceof Value) {
        attrs.push(candidate);
        continue;
      }
    }
    if (typeof arg === "string") {
      const value = i + 1 < args.length ? args[i + 1] : undefined;
      attrs.push(Any(arg, value));
      i += 1;
      continue;
    }
    attrs.push(Any(globalThis.String(arg), undefined));
  }
  return attrs;
}
