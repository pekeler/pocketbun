// Ported from vendor/pocketbase-benchmarks/benchmarks/bench.go.

export class BenchResult {
  Errors: Error[];
  BestMs: number;
  WorstMs: number;
  CompletedMs: number;

  constructor(errors: Error[], bestMs: number, worstMs: number, completedMs: number) {
    this.Errors = errors;
    this.BestMs = bestMs;
    this.WorstMs = worstMs;
    this.CompletedMs = completedMs;
  }

  String(): string {
    return [
      "```",
      `┌─ Best:      ${formatDuration(this.BestMs)}`,
      `├─ Worst:     ${formatDuration(this.WorstMs)}`,
      `├─ Completed: ${formatDuration(this.CompletedMs)}`,
      `└─ Errors:    ${this.Errors.length}`,
      "```",
    ].join("\n");
  }
}

// A negative concurrency indicates no limit
// (aka. an async task will be fired for each iteration).
export async function bench(
  action: (i: number) => Promise<void>,
  iterations: number,
  concurrency: number,
): Promise<BenchResult> {
  if (iterations < 1) {
    throw new Error("iterations must be >= 1");
  }

  const totalStart = performance.now();
  const errors: Error[] = [];
  const times = Array.from<number>({ length: iterations }).fill(0);

  const runAction = async (i: number): Promise<void> => {
    const start = performance.now();
    try {
      await action(i);
    } catch (error) {
      errors.push(toError(error));
    } finally {
      times[i] = performance.now() - start;
    }
  };

  if (concurrency < 0) {
    const tasks = Array.from({ length: iterations }, async (_unused, i) => {
      await runAction(i);
    });
    await Promise.all(tasks);
  } else {
    const maxWorkers = Math.max(1, Math.min(concurrency, iterations));
    let index = 0;
    const workers = Array.from({ length: maxWorkers }, async () => {
      while (true) {
        const current = index;
        index += 1;
        if (current >= iterations) {
          return;
        }

        await runAction(current);
      }
    });

    await Promise.all(workers);
  }

  const completedMs = performance.now() - totalStart;
  const firstTime = times[0] ?? 0;

  let bestMs = firstTime;
  let worstMs = firstTime;

  for (const durationMs of times) {
    if (durationMs < bestMs) {
      bestMs = durationMs;
    }
    if (durationMs > worstMs) {
      worstMs = durationMs;
    }
  }

  return new BenchResult(errors, bestMs, worstMs, completedMs);
}

function toError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }
  return new Error(String(value));
}

function formatDuration(durationMs: number): string {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return "0s";
  }

  if (durationMs >= 1000) {
    return `${trimFixed(durationMs / 1000, 9)}s`;
  }

  if (durationMs >= 1) {
    return `${trimFixed(durationMs, 6)}ms`;
  }

  const microseconds = durationMs * 1000;
  if (microseconds >= 1) {
    return `${trimFixed(microseconds, 3)}µs`;
  }

  const nanoseconds = durationMs * 1_000_000;
  return `${Math.round(nanoseconds)}ns`;
}

function trimFixed(value: number, digits: number): string {
  return value
    .toFixed(digits)
    .replace(/(?:\.0+|(?:(\.[0-9]*?)0+))$/, "$1")
    .replace(/\.$/, "");
}
