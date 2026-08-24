#!/usr/bin/env bun
// PocketBun-only helper: summarize PocketBun/PocketBase factor range
// from upstream benchmark markdown result files.

import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";

function usage() {
  console.log(`Usage:
  bun scripts/bench_upstream_factor_summary.js [--dir <results-dir>]

Defaults:
  --dir benchmarks/results

The script loads all *.md files in the directory whose names include
"pocketbase" or "pocketbun", computes mean Completed times per scenario for
each side, then reports:
- smallest factor (PocketBun/PocketBase)
- largest factor (PocketBun/PocketBase)
- geometric mean factor across comparable scenarios
- summed mean Completed time across all summed scenarios
`);
}

function parseArgs(argv) {
  let resultsDir = "benchmarks/results";

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dir") {
      const next = argv[i + 1];
      if (!next) {
        throw new Error("missing value for --dir");
      }
      resultsDir = next;
      i += 1;
      continue;
    }
    if (arg === "-h" || arg === "--help") {
      usage();
      process.exit(0);
    }
    throw new Error(`unknown argument: ${arg}`);
  }

  return { resultsDir: resolve(resultsDir) };
}

function normalizeScenarioName(name) {
  // Upstream auth-refresh scenario names include random record ids.
  return name.replace(/query:`\/[a-z0-9]{15}`/g, "query:`/<id>`");
}

function parseGoDurationToNs(raw) {
  const trimmed = raw.trim();
  const token = /([0-9]+(?:\.[0-9]+)?)(ns|us|µs|ms|s|m|h)/g;

  let total = 0;
  let consumed = "";
  let match = token.exec(trimmed);
  while (match) {
    const value = Number(match[1]);
    const unit = match[2];
    consumed += match[0];

    switch (unit) {
      case "ns":
        total += value;
        break;
      case "us":
      case "µs":
        total += value * 1e3;
        break;
      case "ms":
        total += value * 1e6;
        break;
      case "s":
        total += value * 1e9;
        break;
      case "m":
        total += value * 60 * 1e9;
        break;
      case "h":
        total += value * 60 * 60 * 1e9;
        break;
      default:
        throw new Error(`unsupported duration unit: ${unit}`);
    }

    match = token.exec(trimmed);
  }

  if (consumed !== trimmed) {
    throw new Error(`unsupported duration format: ${raw}`);
  }

  return total;
}

async function parseResultFile(pathname) {
  const file = Bun.file(pathname);
  const scenarios = new Map();

  let category = "";
  let pending = null;

  for (const line of (await file.text()).split(/\r?\n/)) {
    if (line.startsWith("## ")) {
      category = line.slice(3).trim();
      continue;
    }

    if (line.startsWith("#### ")) {
      const rawName = line.slice(5).trim();
      pending = {
        key: normalizeScenarioName(rawName),
        rawName,
        category,
        completedNs: NaN,
        errors: null,
      };
      continue;
    }

    if (!pending) {
      continue;
    }

    const completed = line.match(
      /Completed:\s*([0-9]+(?:\.[0-9]+)?(?:ns|us|µs|ms|s|m|h)(?:[0-9]+(?:\.[0-9]+)?(?:ns|us|µs|ms|s|m|h))*)/,
    );
    if (completed) {
      pending.completedNs = parseGoDurationToNs(completed[1]);
      continue;
    }

    const errors = line.match(/Errors:\s*(\d+)/);
    if (errors) {
      pending.errors = Number(errors[1]);
      scenarios.set(pending.key, pending);
      pending = null;
    }
  }

  return scenarios;
}

function discoverResultFiles(resultsDir, needle) {
  const names = readdirSync(resultsDir);
  return names
    .filter((name) => name.endsWith(".md") && name.includes(needle))
    .map((name) => resolve(join(resultsDir, name)))
    .sort();
}

async function aggregateScenarioMeans(filePaths) {
  const aggregates = new Map();
  const nonEmptyFiles = [];

  for (const filePath of filePaths) {
    const scenarios = await parseResultFile(filePath);
    if (scenarios.size === 0) {
      continue;
    }
    nonEmptyFiles.push(filePath);

    for (const row of scenarios.values()) {
      if ((row.errors ?? 0) !== 0) {
        continue;
      }
      if (!Number.isFinite(row.completedNs) || row.completedNs <= 0) {
        continue;
      }

      const existing = aggregates.get(row.key) ?? {
        key: row.key,
        scenario: row.rawName,
        category: row.category,
        sumNs: 0,
        count: 0,
      };

      existing.sumNs += row.completedNs;
      existing.count += 1;
      if (!existing.scenario && row.rawName) {
        existing.scenario = row.rawName;
      }
      if (!existing.category && row.category) {
        existing.category = row.category;
      }
      aggregates.set(row.key, existing);
    }
  }

  for (const item of aggregates.values()) {
    item.meanNs = item.sumNs / item.count;
  }

  return { aggregates, nonEmptyFiles };
}

function geometricMean(values) {
  if (values.length === 0) {
    return NaN;
  }
  const sumLogs = values.reduce((acc, value) => acc + Math.log(value), 0);
  return Math.exp(sumLogs / values.length);
}

function formatFactor(value) {
  return value.toFixed(2);
}

function formatDurationNs(ns) {
  if (!Number.isFinite(ns)) {
    return "n/a";
  }
  if (ns >= 60 * 60 * 1e9) {
    return `${(ns / (60 * 60 * 1e9)).toFixed(3)}h`;
  }
  if (ns >= 60 * 1e9) {
    return `${(ns / (60 * 1e9)).toFixed(3)}m`;
  }
  if (ns >= 1e9) {
    return `${(ns / 1e9).toFixed(3)}s`;
  }
  if (ns >= 1e6) {
    return `${(ns / 1e6).toFixed(3)}ms`;
  }
  if (ns >= 1e3) {
    return `${(ns / 1e3).toFixed(3)}us`;
  }
  return `${ns.toFixed(0)}ns`;
}

async function main() {
  const { resultsDir } = parseArgs(process.argv.slice(2));

  const pocketbaseFiles = discoverResultFiles(resultsDir, "pocketbase");
  const pocketbunFiles = discoverResultFiles(resultsDir, "pocketbun");

  if (pocketbaseFiles.length === 0) {
    throw new Error(`no *pocketbase*.md files found in ${resultsDir}`);
  }
  if (pocketbunFiles.length === 0) {
    throw new Error(`no *pocketbun*.md files found in ${resultsDir}`);
  }

  const pocketbase = await aggregateScenarioMeans(pocketbaseFiles);
  const pocketbun = await aggregateScenarioMeans(pocketbunFiles);

  if (pocketbase.nonEmptyFiles.length === 0) {
    throw new Error("no PocketBase files with parseable benchmark rows");
  }
  if (pocketbun.nonEmptyFiles.length === 0) {
    throw new Error("no PocketBun files with parseable benchmark rows");
  }

  const factors = [];
  for (const [key, pb] of pocketbase.aggregates.entries()) {
    const pbu = pocketbun.aggregates.get(key);
    if (!pbu) {
      continue;
    }
    if (!(pb.meanNs > 0) || !(pbu.meanNs > 0)) {
      continue;
    }
    factors.push({
      key,
      scenario: pb.scenario,
      category: pb.category,
      factor: pbu.meanNs / pb.meanNs,
      pocketbaseMeanNs: pb.meanNs,
      pocketbunMeanNs: pbu.meanNs,
    });
  }

  if (factors.length === 0) {
    throw new Error("no comparable scenarios between PocketBase and PocketBun");
  }

  const smallest = factors.reduce((best, row) => (row.factor < best.factor ? row : best));
  const largest = factors.reduce((best, row) => (row.factor > best.factor ? row : best));
  const gmean = geometricMean(factors.map((row) => row.factor));
  const pocketbaseAllScenarioMeans = [...pocketbase.aggregates.values()].filter((row) => row.meanNs > 0);
  const pocketbunAllScenarioMeans = [...pocketbun.aggregates.values()].filter((row) => row.meanNs > 0);
  const pocketbaseTotalMeanNs = pocketbaseAllScenarioMeans.reduce((acc, row) => acc + row.meanNs, 0);
  const pocketbunTotalMeanNs = pocketbunAllScenarioMeans.reduce((acc, row) => acc + row.meanNs, 0);
  const totalCompletedFactor = pocketbunTotalMeanNs / pocketbaseTotalMeanNs;

  console.log(`results dir: ${resultsDir}`);
  console.log(`PocketBase files loaded: ${pocketbase.nonEmptyFiles.length}`);
  console.log(`PocketBun files loaded: ${pocketbun.nonEmptyFiles.length}`);
  console.log(`comparable scenarios: ${factors.length}`);
  console.log(`PocketBase scenarios summed: ${pocketbaseAllScenarioMeans.length}`);
  console.log(`PocketBun scenarios summed: ${pocketbunAllScenarioMeans.length}`);
  console.log("");
  console.log(
    `smallest factor A (PocketBun/PocketBase): ${formatFactor(smallest.factor)}x [${smallest.category} | ${smallest.scenario}]`,
  );
  console.log(
    `largest factor B (PocketBun/PocketBase): ${formatFactor(largest.factor)}x [${largest.category} | ${largest.scenario}]`,
  );
  console.log(`geometric mean C (PocketBun/PocketBase): ${formatFactor(gmean)}x`);
  console.log(
    `sum mean completed D (all summed scenarios): PocketBase=${formatDurationNs(pocketbaseTotalMeanNs)}, PocketBun=${formatDurationNs(pocketbunTotalMeanNs)}, PocketBun/PocketBase=${formatFactor(totalCompletedFactor)}x`,
  );
  console.log("");

  if (gmean <= 1) {
    console.log(
      `PocketBun is between ${formatFactor(1 / smallest.factor)} times faster and ${formatFactor(largest.factor)} times slower than PocketBase, with a geometric mean of being ${formatFactor(1 / gmean)} times faster.`,
    );
  } else {
    console.log(
      `PocketBun is between ${formatFactor(1 / smallest.factor)} times faster and ${formatFactor(largest.factor)} times slower than PocketBase, with a geometric mean of being ${formatFactor(gmean)} times slower.`,
    );
  }

  if (totalCompletedFactor <= 1) {
    console.log(
      `By summed mean Completed time across all summed scenarios, PocketBun is ${formatFactor(1 / totalCompletedFactor)} times faster than PocketBase.`,
    );
  } else {
    console.log(
      `By summed mean Completed time across all summed scenarios, PocketBun is ${formatFactor(totalCompletedFactor)} times slower than PocketBase.`,
    );
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
