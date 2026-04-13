// Ported from vendor/pocketbase-benchmarks/benchmarks/schema.go.
// PocketBun-only: loads the upstream schema JSON from the vendored Go source to avoid drift.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const schemaFilePath = fileURLToPath(new URL("../../vendor/pocketbase-benchmarks/benchmarks/schema.go", import.meta.url));
const schemaSource = readFileSync(schemaFilePath, "utf8");

// PocketBun-only: keep only collections required for benchmark scenarios to avoid
// importing unrelated system collections that have strict update validation rules.
const benchmarkCollections = new Set<string>([
  "_superusers",
  "users",
  "organizations",
  "permissions",
  "posts10k",
  "posts25k",
  "posts50k",
  "posts100k",
  "benchmarks",
]);

export const benchmarkSchema = extractBenchmarkSchema(schemaSource);

function extractBenchmarkSchema(rawSource: string): string {
  const fullSchemaRaw = extractSchemaJson(rawSource);
  const parsed = JSON.parse(fullSchemaRaw) as Array<Record<string, unknown>>;
  const filtered = parsed.filter((entry) => benchmarkCollections.has(typeof entry.name === "string" ? entry.name : ""));
  return JSON.stringify(filtered);
}

function extractSchemaJson(rawSource: string): string {
  const marker = "const schema = `";
  const markerIndex = rawSource.indexOf(marker);
  if (markerIndex < 0) {
    throw new Error(`failed to find schema marker in ${schemaFilePath}`);
  }

  const bodyStart = markerIndex + marker.length;
  const bodyEnd = rawSource.indexOf("\n`\n\nvar deleteIgnore", bodyStart);
  if (bodyEnd < 0) {
    throw new Error(`failed to find schema end marker in ${schemaFilePath}`);
  }

  return rawSource.slice(bodyStart, bodyEnd).replaceAll('` + "`" + `', "`");
}
