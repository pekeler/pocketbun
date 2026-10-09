// Ported from pocketbase/tools/routine/routine.go

const RecoveredStackLimit = 2 << 10;

function getRecoveredStack(error: unknown): string | null {
  const stack =
    error instanceof Error && typeof error.stack === "string" && error.stack ? error.stack : new Error(String(error)).stack;

  if (!stack) {
    return null;
  }

  return new TextDecoder().decode(
    new TextEncoder().encode(stack.slice(0, RecoveredStackLimit)).subarray(0, RecoveredStackLimit),
    { stream: true },
  );
}

// FireAndForget executes f() in a new go routine and auto recovers if panic.
//
// **Note:** Use this only if you are not interested in the result of f()
// and don't want to block the parent go routine.
// Deviation: Bun schedules the callback as a microtask instead of a Go routine.
export function FireAndForget(fn: () => void | Promise<void>): void {
  queueMicrotask(() => {
    const logRecovered = (error: unknown): void => {
      console.warn("RECOVERED FROM PANIC (safe to ignore):", error);
      const stack = getRecoveredStack(error);
      if (stack) {
        console.warn(stack);
      }
    };

    try {
      const result = fn();
      if (result && typeof (result as Promise<void>).catch === "function") {
        (result as Promise<void>).catch((error) => {
          logRecovered(error);
        });
      }
    } catch (error) {
      logRecovered(error);
    }
  });
}

// SafeWrap wraps the provided function with auto panic recover handling
// and returns any eventual panic as regular error.
export function SafeWrap(fn: () => Error | null): () => Error | null {
  return () => {
    try {
      return fn();
    } catch (error) {
      return new Error(`[SafeWrap] recovered from panic: ${String(error)}\n${getRecoveredStack(error) ?? ""}`);
    }
  };
}
