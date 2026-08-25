// Ported from vendor/pocketbase-benchmarks/benchmarks/bench.go.

import { captureBenchRequests, type ExternalBenchRequest } from "./request.ts";

let iterationLimit = 0;

// PocketBun-only: cap each scenario during the discarded benchmark warmup.
export function setBenchIterationLimit(limit: number): void {
  iterationLimit = Math.max(0, Math.floor(limit));
}

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
    const lines = [
      "```",
      `┌─ Best:      ${formatDuration(this.BestMs)}`,
      `├─ Worst:     ${formatDuration(this.WorstMs)}`,
      `├─ Completed: ${formatDuration(this.CompletedMs)}`,
      `└─ Errors:    ${this.Errors.length}`,
    ];
    if (this.Errors.length > 0) {
      lines.push(` └─ sample error: ${this.Errors[0]!.message}`);
    }
    lines.push("```");
    return lines.join("\n");
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

  iterations = iterationLimit > 0 ? Math.min(iterations, iterationLimit) : iterations;

  const externalLoadUrl = process.env.POCKETBUN_BENCH_EXTERNAL_LOAD_URL?.trim();
  if (externalLoadUrl) {
    return await externalBench(externalLoadUrl, action, iterations, concurrency);
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

async function externalBench(
  externalLoadUrl: string,
  action: (i: number) => Promise<void>,
  iterations: number,
  concurrency: number,
): Promise<BenchResult> {
  const preparationErrors: Error[] = [];
  const requests = await captureBenchRequests(async () => {
    for (let i = 0; i < iterations; i += 1) {
      try {
        await action(i);
      } catch (error) {
        preparationErrors.push(toError(error));
      }
    }
  });

  const response = await fetch(`${externalLoadUrl.replace(/\/$/, "")}/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-PocketBun-Benchmark-Token": process.env.POCKETBUN_BENCH_EXTERNAL_LOAD_TOKEN ?? "",
    },
    body: JSON.stringify({ requests, concurrency } satisfies { requests: ExternalBenchRequest[]; concurrency: number }),
  });
  if (!response.ok) {
    throw new Error(`external benchmark load service failed with status ${response.status}: ${await response.text()}`);
  }

  const result = (await response.json()) as {
    bestMs?: unknown;
    worstMs?: unknown;
    completedMs?: unknown;
    errorCount?: unknown;
    sampleError?: unknown;
  };
  const bestMs = Number(result.bestMs);
  const worstMs = Number(result.worstMs);
  const completedMs = Number(result.completedMs);
  const errorCount = Number(result.errorCount);
  if (
    !Number.isFinite(bestMs) ||
    !Number.isFinite(worstMs) ||
    !Number.isFinite(completedMs) ||
    !Number.isSafeInteger(errorCount) ||
    errorCount < 0 ||
    errorCount > requests.length
  ) {
    throw new Error("external benchmark load service returned invalid metrics");
  }

  const externalErrors = Array.from(
    { length: errorCount },
    (_, index) =>
      new Error(index === 0 && typeof result.sampleError === "string" ? result.sampleError : "external request failed"),
  );
  return new BenchResult([...preparationErrors, ...externalErrors], bestMs, worstMs, completedMs);
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
