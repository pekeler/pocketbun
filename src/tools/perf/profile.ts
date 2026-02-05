// PocketBun-only: lightweight profiling utilities for local benchmarks.

type ProfileStat = {
  count: number;
  totalMs: number;
  maxMs: number;
};

const enabled =
  process.env.POCKETBUN_PROFILE === "1" ||
  process.env.POCKETBUN_PROFILE_HOOKS === "1" ||
  process.env.POCKETBUN_PROFILE_ROUTER === "1";

const stats = new Map<string, ProfileStat>();

export function profileEnabled(): boolean {
  return enabled;
}

export function recordProfile(label: string, durationMs: number): void {
  if (!enabled) {
    return;
  }
  const entry = stats.get(label);
  if (entry) {
    entry.count += 1;
    entry.totalMs += durationMs;
    if (durationMs > entry.maxMs) {
      entry.maxMs = durationMs;
    }
    return;
  }
  stats.set(label, { count: 1, totalMs: durationMs, maxMs: durationMs });
}

export function profileSummary(limit = 20): string {
  if (!enabled) {
    return "";
  }
  const rows = [...stats.entries()].map(([label, stat]) => {
    const avgMs = stat.totalMs / stat.count;
    return { label, ...stat, avgMs };
  });
  rows.sort((a, b) => b.totalMs - a.totalMs);
  const top = rows.slice(0, limit);

  return top
    .map(
      (row) =>
        `${row.label} count=${row.count} total=${row.totalMs.toFixed(2)}ms avg=${row.avgMs.toFixed(
          4,
        )}ms max=${row.maxMs.toFixed(2)}ms`,
    )
    .join("\n");
}

export function resetProfile(): void {
  stats.clear();
}
