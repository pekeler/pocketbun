// PocketBun-only: models encoding/json/v2's Deterministic option for JavaScript maps.

export function deterministicJSONStringify(value: unknown): string {
  return JSON.stringify(normalize(value)) ?? "null";
}

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalize);
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  const withJSON = value as { toJSON?: () => unknown };
  if (typeof withJSON.toJSON === "function") {
    return normalize(withJSON.toJSON());
  }

  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(source).sort()) {
    result[key] = normalize(source[key]);
  }
  return result;
}
