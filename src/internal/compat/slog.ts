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
  Handle(ctx: Context, record: Record): Error | null;
  WithAttrs(attrs: Attr[]): Handler;
  WithGroup(name: string): Handler;
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
}

export function New(handler: Handler): Logger {
  return new Logger(handler);
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
