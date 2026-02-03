// Ported from pocketbase/core/db_tx.go

import type { Database } from "bun:sqlite";
import type { App } from "./app.ts";

type TxContext = {
  app: App;
  db: () => Database;
  getTxInfo: () => TxAppInfo | null;
  setTxInfo: (info: TxAppInfo | null) => void;
};

// RunInTransaction wraps fn into a transaction for the regular app database.
//
// It is safe to nest RunInTransaction calls as long as you use the callback's txApp.
export async function RunInTransaction(
  ctx: TxContext,
  fn: (txApp: App) => Error | null | Promise<Error | null>,
): Promise<Error | null> {
  if (ctx.getTxInfo()) {
    return (await fn(ctx.app)) ?? null;
  }

  const txInfo = new TxAppInfo();
  ctx.setTxInfo(txInfo);
  let txErr: Error | null = null;

  ctx.db().run("BEGIN");
  try {
    txErr = (await fn(ctx.app)) ?? null;
  } catch (error) {
    txErr = error as Error;
  }

  if (txErr) {
    ctx.db().run("ROLLBACK");
  } else {
    ctx.db().run("COMMIT");
  }

  ctx.setTxInfo(null);
  const afterErr = await txInfo.runAfterFuncs(txErr);
  return joinErrors(txErr, afterErr);
}

// RunInTransactionSync wraps fn into a transaction for the regular app database.
//
// It is safe to nest RunInTransactionSync calls as long as you use the callback's txApp.
export function RunInTransactionSync(ctx: TxContext, fn: (txApp: App) => Error | null): Error | null {
  if (ctx.getTxInfo()) {
    return fn(ctx.app) ?? null;
  }

  const txInfo = new TxAppInfo();
  ctx.setTxInfo(txInfo);
  let txErr: Error | null = null;

  ctx.db().run("BEGIN");
  try {
    const result = fn(ctx.app);
    if (result instanceof Promise) {
      txErr = new Error("async transaction handlers are not supported in sync transactions");
    } else {
      txErr = result ?? null;
    }
  } catch (error) {
    txErr = error as Error;
  }

  if (txErr) {
    ctx.db().run("ROLLBACK");
  } else {
    ctx.db().run("COMMIT");
  }

  ctx.setTxInfo(null);
  const afterErr = txInfo.runAfterFuncsSync(txErr);
  return joinErrors(txErr, afterErr);
}

// AuxRunInTransaction wraps fn into a transaction for the auxiliary app database.
//
// It is safe to nest RunInTransaction calls as long as you use the callback's txApp.
export async function AuxRunInTransaction(
  app: App,
  db: () => Database,
  fn: (txApp: App) => Error | null | Promise<Error | null>,
): Promise<Error | null> {
  let txErr: Error | null = null;
  db().run("BEGIN");
  try {
    txErr = (await fn(app)) ?? null;
  } catch (error) {
    txErr = error as Error;
  }

  if (txErr) {
    db().run("ROLLBACK");
  } else {
    db().run("COMMIT");
  }

  return txErr;
}

// AuxRunInTransactionSync wraps fn into a transaction for the auxiliary app database.
//
// It is safe to nest RunInTransaction calls as long as you use the callback's txApp.
export function AuxRunInTransactionSync(app: App, db: () => Database, fn: (txApp: App) => Error | null): Error | null {
  let txErr: Error | null = null;
  db().run("BEGIN");
  try {
    const result = fn(app);
    if (result instanceof Promise) {
      txErr = new Error("async transaction handlers are not supported in sync transactions");
    } else {
      txErr = result ?? null;
    }
  } catch (error) {
    txErr = error as Error;
  }

  if (txErr) {
    db().run("ROLLBACK");
  } else {
    db().run("COMMIT");
  }

  return txErr;
}

// TxAppInfo represents an active transaction context associated to an existing app instance.
export class TxAppInfo {
  // Deviation: upstream uses a mutex; Bun's single-threaded runtime doesn't require it.
  #afterFuncs: Array<(txErr: Error | null) => Error | null | Promise<Error | null>> = [];

  // OnComplete registers the provided callback that will be invoked
  // once the related transaction ends (either completes successfully or rollbacked with an error).
  //
  // The callback receives the transaction error (if any) as its argument.
  // Any additional errors returned by the OnComplete callbacks will be
  // joined together with txErr when returning the final transaction result.
  OnComplete(fn: (txErr: Error | null) => Error | null | Promise<Error | null>) {
    this.#afterFuncs.push(fn);
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

    if (errors.length === 0) {
      return null;
    }
    if (errors.length === 1) {
      return errors[0] ?? null;
    }
    return new AggregateError(errors, errors.map((err) => err.message).join("\n"));
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

    if (errors.length === 0) {
      return null;
    }
    if (errors.length === 1) {
      return errors[0] ?? null;
    }
    return new AggregateError(errors, errors.map((err) => err.message).join("\n"));
  }
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
