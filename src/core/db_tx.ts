// Ported from pocketbase/core/db_tx.go

import type { Database } from "bun:sqlite";
import type { App } from "./app.ts";

type TxContext = {
  app: App;
  db: () => Database;
  getTxInfo: () => TxAppInfo | null;
  runWithTxInfo: <T>(info: TxAppInfo, fn: () => T) => T;
};

const transactionQueues = new WeakMap<Database, Promise<void>>();
const activeTransactions = new WeakSet<Database>();

// RunInTransaction wraps fn into a transaction for the regular app database.
//
// It is safe to nest RunInTransaction calls as long as you use the callback's txApp.
export async function RunInTransaction(
  ctx: TxContext,
  fn: (txApp: App) => Error | null | Promise<Error | null>,
): Promise<Error | null> {
  const existing = ctx.getTxInfo();
  if (existing) {
    return (await ctx.runWithTxInfo(existing, () => fn(ctx.app))) ?? null;
  }

  const db = ctx.db();
  const release = await acquireTransaction(db);
  const txInfo = new TxAppInfo(true);
  let txErr: Error | null = null;
  let started = false;

  try {
    db.run("BEGIN");
    started = true;
    txErr = await ctx.runWithTxInfo(txInfo, async () => {
      let result: Error | null;
      try {
        result = (await fn(ctx.app)) ?? null;
      } catch (error) {
        result = asError(error);
      }
      if (!result) {
        result = await txInfo.runBeforeCommitFuncs();
      }
      return result;
    });

    if (txErr) {
      db.run("ROLLBACK");
    } else {
      db.run("COMMIT");
    }
    started = false;
  } catch (error) {
    txErr = joinErrors(txErr, asError(error));
    if (started) {
      try {
        db.run("ROLLBACK");
      } catch (rollbackError) {
        txErr = joinErrors(txErr, asError(rollbackError));
      }
    }
  } finally {
    release();
  }

  const afterErr = await txInfo.runAfterFuncs(txErr);
  return joinErrors(txErr, afterErr);
}

// RunInTransactionSync wraps fn into a transaction for the regular app database.
//
// It is safe to nest RunInTransactionSync calls as long as you use the callback's txApp.
export function RunInTransactionSync(ctx: TxContext, fn: (txApp: App) => Error | null): Error | null {
  const existing = ctx.getTxInfo();
  if (existing) {
    return ctx.runWithTxInfo(existing, () => fn(ctx.app)) ?? null;
  }

  const db = ctx.db();
  if (activeTransactions.has(db) || transactionQueues.has(db)) {
    return new Error("cannot start a synchronous transaction while an asynchronous transaction is active");
  }
  activeTransactions.add(db);
  const txInfo = new TxAppInfo(false);
  let txErr: Error | null = null;
  let started = false;

  try {
    db.run("BEGIN");
    started = true;
    txErr = ctx.runWithTxInfo(txInfo, () => {
      const result = fn(ctx.app);
      if (result instanceof Promise) {
        return new Error("async transaction handlers are not supported in sync transactions");
      }
      return result ?? txInfo.runBeforeCommitFuncsSync();
    });

    if (txErr) {
      db.run("ROLLBACK");
    } else {
      db.run("COMMIT");
    }
    started = false;
  } catch (error) {
    txErr = joinErrors(txErr, asError(error));
    if (started) {
      try {
        db.run("ROLLBACK");
      } catch (rollbackError) {
        txErr = joinErrors(txErr, asError(rollbackError));
      }
    }
  } finally {
    activeTransactions.delete(db);
  }

  const afterErr = txInfo.runAfterFuncsSync(txErr);
  return joinErrors(txErr, afterErr);
}

// AuxRunInTransaction wraps fn into a transaction for the auxiliary app database.
//
// It is safe to nest RunInTransaction calls as long as you use the callback's txApp.
export async function AuxRunInTransaction(
  ctx: TxContext,
  fn: (txApp: App) => Error | null | Promise<Error | null>,
): Promise<Error | null> {
  return RunInTransaction(ctx, fn);
}

// AuxRunInTransactionSync wraps fn into a transaction for the auxiliary app database.
//
// It is safe to nest RunInTransaction calls as long as you use the callback's txApp.
export function AuxRunInTransactionSync(ctx: TxContext, fn: (txApp: App) => Error | null): Error | null {
  return RunInTransactionSync(ctx, fn);
}

// TxAppInfo represents an active transaction context associated to an existing app instance.
export class TxAppInfo {
  // Deviation: upstream uses a mutex; Bun's single-threaded runtime doesn't require it.
  #beforeCommitFuncs: Array<() => Error | null | Promise<Error | null>> = [];
  #afterFuncs: Array<(txErr: Error | null) => Error | null | Promise<Error | null>> = [];

  constructor(private readonly async: boolean) {}

  IsAsync(): boolean {
    return this.async;
  }

  // BeforeCommit registers work that must finish after the transaction callback
  // but before the database commit.
  BeforeCommit(fn: () => Error | null | Promise<Error | null>) {
    this.#beforeCommitFuncs.push(fn);
  }

  // OnComplete registers the provided callback that will be invoked
  // once the related transaction ends (either completes successfully or rollbacked with an error).
  //
  // The callback receives the transaction error (if any) as its argument.
  // Any additional errors returned by the OnComplete callbacks will be
  // joined together with txErr when returning the final transaction result.
  OnComplete(fn: (txErr: Error | null) => Error | null | Promise<Error | null>) {
    this.#afterFuncs.push(fn);
  }

  async runBeforeCommitFuncs(): Promise<Error | null> {
    const errors: Error[] = [];
    for (const fn of this.#beforeCommitFuncs) {
      const err = await fn();
      if (err) {
        errors.push(err);
      }
    }
    this.#beforeCommitFuncs = [];
    return combineErrors(errors);
  }

  runBeforeCommitFuncsSync(): Error | null {
    const errors: Error[] = [];
    for (const fn of this.#beforeCommitFuncs) {
      const result = fn();
      if (result instanceof Promise) {
        errors.push(new Error("async transaction BeforeCommit handlers are not supported in sync transactions"));
      } else if (result) {
        errors.push(result);
      }
    }
    this.#beforeCommitFuncs = [];
    return combineErrors(errors);
  }

  // note: can be called only once because TxAppInfo is cleared
  async runAfterFuncs(txErr: Error | null): Promise<Error | null> {
    const errors: Error[] = [];
    for (const fn of this.#afterFuncs) {
      const err = await fn(txErr);
      if (err) {
        errors.push(err);
      }
    }
    this.#afterFuncs = [];
    return combineErrors(errors);
  }

  // runAfterFuncsSync executes OnComplete handlers and fails on async callbacks.
  runAfterFuncsSync(txErr: Error | null): Error | null {
    const errors: Error[] = [];
    for (const fn of this.#afterFuncs) {
      const result = fn(txErr);
      if (result instanceof Promise) {
        errors.push(new Error("async transaction OnComplete handlers are not supported in sync transactions"));
        continue;
      }
      if (result) {
        errors.push(result);
      }
    }
    this.#afterFuncs = [];
    return combineErrors(errors);
  }
}

async function acquireTransaction(db: Database): Promise<() => void> {
  const previous = transactionQueues.get(db) ?? Promise.resolve();
  let unlock = () => {};
  const current = new Promise<void>((resolve) => {
    unlock = resolve;
  });
  const tail = previous.then(() => current);
  transactionQueues.set(db, tail);
  await previous;
  activeTransactions.add(db);

  return () => {
    activeTransactions.delete(db);
    unlock();
    if (transactionQueues.get(db) === tail) {
      transactionQueues.delete(db);
    }
  };
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function combineErrors(errors: Error[]): Error | null {
  if (errors.length === 0) {
    return null;
  }
  if (errors.length === 1) {
    return errors[0] ?? null;
  }
  return new AggregateError(errors, errors.map((err) => err.message).join("\n"));
}

function joinErrors(...errors: Array<Error | null | undefined>): Error | null {
  const flattened: Error[] = [];
  for (const err of errors) {
    if (!err) {
      continue;
    }
    if (err instanceof AggregateError) {
      for (const inner of err.errors) {
        if (inner instanceof Error) {
          flattened.push(inner);
        }
      }
      continue;
    }
    flattened.push(err);
  }

  if (flattened.length === 0) {
    return null;
  }
  if (flattened.length === 1) {
    return flattened[0] ?? null;
  }

  return new AggregateError(flattened, flattened.map((err) => err.message).join("\n"));
}
