// Ported from pocketbase/tools/routine/routine.go

export function FireAndForget(fn: () => void | Promise<void>): void {
  queueMicrotask(() => {
    try {
      const result = fn();
      if (result && typeof (result as Promise<void>).catch === "function") {
        (result as Promise<void>).catch((error) => {
          console.warn("RECOVERED FROM PANIC (safe to ignore):", error);
        });
      }
    } catch (error) {
      console.warn("RECOVERED FROM PANIC (safe to ignore):", error);
    }
  });
}
