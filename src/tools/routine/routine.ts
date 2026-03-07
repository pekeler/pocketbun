// Ported from pocketbase/tools/routine/routine.go

const FireAndForgetStackLimit = 2 << 10;

function getRecoveredStack(error: unknown): string | null {
  const stack =
    error instanceof Error && typeof error.stack === "string" && error.stack ? error.stack : new Error(String(error)).stack;

  if (!stack) {
    return null;
  }

  return stack.slice(0, FireAndForgetStackLimit);
}

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
