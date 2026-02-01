// Ported from pocketbase/tools/routine/routine.go

export function FireAndForget(fn: () => void): void {
  queueMicrotask(() => {
    try {
      fn();
    } catch (error) {
      console.warn("RECOVERED FROM PANIC (safe to ignore):", error);
    }
  });
}
