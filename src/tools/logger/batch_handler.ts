// Ported from pocketbase/tools/logger/batch_handler.go

import type { Log } from "./log.ts";
import * as slog from "../../internal/compat/slog.ts";
import { ValidationError, ValidationErrors } from "../../internal/compat/validation.ts";
import { JSONMap } from "../types/json_map.ts";

class Mutex {
  lock(): void {}
  unlock(): void {}
}

export type BatchOptions = {
  // WriteFunc processes the batched logs.
  // Deviation: allow Promise return to support async persistence in Bun.
  WriteFunc: (ctx: slog.Context, logs: Log[]) => Error | null | Promise<Error | null>;

  // BeforeAddFunc is optional function that is invoked every time
  // before a new log is added to the batch queue.
  //
  // Return false to skip adding the log into the batch queue.
  BeforeAddFunc?: (ctx: slog.Context, log: Log) => boolean;

  // Level reports the minimum level to log.
  // Levels with lower levels are discarded.
  // If nil, the Handler uses slog.LevelInfo.
  Level?: slog.Leveler;

  // BatchSize specifies how many logs to accumulate before calling WriteFunc.
  // If not set or 0, fallback to 100 by default.
  BatchSize?: number;
};

type ResolvedBatchOptions = {
  WriteFunc: (ctx: slog.Context, logs: Log[]) => Error | null | Promise<Error | null>;
  BeforeAddFunc?: (ctx: slog.Context, log: Log) => boolean;
  Level: slog.Leveler;
  BatchSize: number;
};

// NewBatchHandler creates a slog compatible handler that writes JSON
// logs on batches (default to 100), using the given options.
//
// Panics if BatchOptions.WriteFunc is not defined.
//
// Example:
//
// 	l := slog.New(logger.NewBatchHandler(logger.BatchOptions{
// 	    WriteFunc: func(ctx context.Context, logs []*Log) error {
// 	        for _, l := range logs {
// 	            fmt.Println(l.Level, l.Message, l.Data)
// 	        }
// 	        return nil
// 	    }
// 	}))
// 	l.Info("Example message", "title", "lorem ipsum")
export function NewBatchHandler(options: BatchOptions): BatchHandler {
  if (!options.WriteFunc) {
    throw new Error("options.WriteFunc must be set");
  }

  const resolvedOptions: ResolvedBatchOptions = {
    WriteFunc: options.WriteFunc,
    BeforeAddFunc: options.BeforeAddFunc,
    Level: options.Level ?? slog.LevelInfo,
    BatchSize: options.BatchSize || 100,
  };

  return new BatchHandler({
    mux: new Mutex(),
    options: resolvedOptions,
  });
}

// BatchHandler is a slog handler that writes records on batches.
//
// The log records attributes are formatted in JSON.
//
// Requires the BatchOptions.WriteFunc option to be defined.
export class BatchHandler implements slog.Handler {
  mux: Mutex;
  parent?: BatchHandler;
  options: ResolvedBatchOptions;
  group = "";
  attrs: slog.Attr[] = [];
  logs: Log[] = [];

  constructor(params: {
    mux: Mutex;
    options: ResolvedBatchOptions;
    parent?: BatchHandler;
    group?: string;
    attrs?: slog.Attr[];
  }) {
    this.mux = params.mux;
    this.parent = params.parent;
    this.group = params.group ?? "";
    this.attrs = params.attrs ?? [];

    this.options = params.options;
  }

  // Enabled reports whether the handler handles records at the given level.
  //
  // The handler ignores records whose level is lower.
  Enabled(_ctx: slog.Context, level: slog.Level): boolean {
    return level >= this.options.Level.Level();
  }

  // WithGroup returns a new BatchHandler that starts a group.
  //
  // All logger attributes will be resolved under the specified group name.
  WithGroup(name: string): slog.Handler {
    if (!name) {
      return this;
    }

    return new BatchHandler({
      parent: this,
      mux: this.mux,
      options: this.options,
      group: name,
    });
  }

  // WithAttrs returns a new BatchHandler loaded with the specified attributes.
  WithAttrs(attrs: slog.Attr[]): slog.Handler {
    if (attrs.length === 0) {
      return this;
    }

    return new BatchHandler({
      parent: this,
      mux: this.mux,
      options: this.options,
      attrs,
    });
  }

  // Handle formats the slog.Record argument as JSON object and adds it
  // to the batch queue.
  //
  // If the batch queue threshold has been reached, the WriteFunc option
  // is invoked with the accumulated logs which in turn will reset the batch queue.
  Handle(ctx: slog.Context, record: slog.Record): Error | null {
    let r = record;

    if (this.group) {
      this.mux.lock();
      const attrs: slog.Attr[] = [...this.attrs];
      this.mux.unlock();

      r.Attrs((a) => {
        attrs.push(a);
        return true;
      });

      r = slog.NewRecord(r.Time, r.Level, r.Message, r.PC);
      r.AddAttrs(slog.Group(this.group, ...attrs));
    } else if (this.attrs.length > 0) {
      r = r.Clone();
      this.mux.lock();
      r.AddAttrs(...this.attrs);
      this.mux.unlock();
    }

    if (this.parent) {
      return this.parent.Handle(ctx, r);
    }

    const data: Record<string, unknown> = {};

    r.Attrs((a) => {
      if (this.resolveAttr(data, a)) {
        return true;
      }
      return false;
    });

    const log: Log = {
      Time: r.Time,
      Level: r.Level,
      Message: r.Message,
      Data: new JSONMap(sortObjectKeys(data) as Record<string, unknown>),
    };

    if (this.options.BeforeAddFunc && !this.options.BeforeAddFunc(ctx, log)) {
      return null;
    }

    this.mux.lock();
    this.logs.push(log);
    const totalLogs = this.logs.length;
    this.mux.unlock();

    if (totalLogs >= this.options.BatchSize) {
      const result = this.WriteAll(ctx);
      if (result instanceof Promise) {
        void result;
      } else if (result) {
        return result;
      }
    }

    return null;
  }

  // SetLevel updates the handler options level to the specified one.
  SetLevel(level: slog.Level): void {
    this.mux.lock();
    this.options.Level = level;
    this.mux.unlock();
  }

  // WriteAll writes all accumulated Log entries and resets the batch queue.
  async WriteAll(ctx: slog.Context): Promise<Error | null> {
    if (this.parent) {
      // invoke recursively the parent level handler since the most
      // top level one is holding the logs queue.
      return await this.parent.WriteAll(ctx);
    }

    this.mux.lock();

    const totalLogs = this.logs.length;

    // no logs to write
    if (totalLogs === 0) {
      this.mux.unlock();
      return null;
    }

    // create a copy of the logs slice to prevent blocking during write
    const logs = [...this.logs];
    this.logs = []; // reset

    this.mux.unlock();

    try {
      const err = await this.options.WriteFunc(ctx, logs);
      if (err) {
        this.mux.lock();
        this.logs.push(...logs);
        this.mux.unlock();
        return err;
      }

      return null;
    } catch (error) {
      this.mux.lock();
      this.logs.push(...logs);
      this.mux.unlock();
      return error as Error;
    }
  }

  // resolveAttr writes attr into data.
  resolveAttr(data: Record<string, unknown>, attr: slog.Attr): boolean {
    const emptyAttr = new slog.Attr("", new slog.Value(slog.Kind.Any, undefined));

    // ensure that the attr value is resolved before doing anything else
    attr.Value = attr.Value.Resolve();

    if (attr.Equal(emptyAttr)) {
      return true; // ignore empty attrs
    }

    if (attr.Value.Kind() === slog.Kind.Group) {
      const attrs = attr.Value.Group();
      if (attrs.length === 0) {
        return true; // ignore empty groups
      }

      // create a submap to wrap the resolved group attributes
      const groupData: Record<string, unknown> = {};

      for (const subAttr of attrs) {
        this.resolveAttr(groupData, subAttr);
      }

      if (Object.keys(groupData).length > 0) {
        data[attr.Key] = groupData;
      }
    } else {
      data[attr.Key] = normalizeLogAttrValue(attr.Value.Any());
    }

    return true;
  }
}

function normalizeLogAttrValue(rawAttrValue: unknown): unknown {
  if (rawAttrValue instanceof ValidationErrors) {
    return normalizeErrorMap(rawAttrValue.errors);
  }

  if (rawAttrValue instanceof Error) {
    const ve = extractValidationErrors(rawAttrValue);
    if (ve) {
      return {
        data: normalizeErrorMap(ve),
        raw: serializeLogError(rawAttrValue),
      };
    }

    return serializeLogError(rawAttrValue);
  }

  if (isPlainObject(rawAttrValue)) {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rawAttrValue)) {
      out[key] = normalizeLogAttrValue(value);
    }
    return out;
  }

  return rawAttrValue;
}

function normalizeErrorMap(errors: Record<string, Error | null>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(errors)) {
    out[key] = serializeLogError(value);
  }
  return out;
}

function extractValidationErrors(err: Error): Record<string, Error | null> | null {
  let current: unknown = err;
  while (current && typeof current === "object") {
    if (current instanceof ValidationErrors) {
      return current.errors;
    }

    current = (current as { cause?: unknown }).cause;
  }

  return null;
}

function serializeLogError(err: unknown): unknown {
  if (err == null) {
    return null;
  }

  if (err instanceof ValidationError) {
    return err.message;
  }

  if (err instanceof ValidationErrors) {
    return err.message;
  }

  if (typeof err === "object") {
    const candidate = err as { MarshalJSON?: () => unknown; toJSON?: () => unknown };
    if (typeof candidate.MarshalJSON === "function") {
      return candidate.MarshalJSON();
    }
    if (typeof candidate.toJSON === "function") {
      return candidate.toJSON();
    }
  }

  if (err instanceof Error) {
    return err.message;
  }

  if (typeof err === "string") {
    return err;
  }
  if (typeof err === "number" || typeof err === "boolean" || typeof err === "bigint") {
    return err;
  }
  if (typeof err === "symbol") {
    return err.description ?? err.toString();
  }
  if (typeof err === "object") {
    return err;
  }

  return globalThis.String(err);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sortObjectKeys(value: unknown): unknown {
  if (!isPlainObject(value)) {
    return value;
  }

  const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
  const out: Record<string, unknown> = {};
  for (const [key, val] of entries) {
    out[key] = sortObjectKeys(val);
  }

  return out;
}
