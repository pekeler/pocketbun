// Ported from pocketbase/tools/filesystem/internal/s3blob/s3/tests/headers.go

export function ExpectHeaders(headers: Headers, expectations: Record<string, string>): boolean {
  for (const [key, expected] of Object.entries(expectations)) {
    const value = headers.get(key) ?? "";
    let pattern = expected;
    if (!pattern.startsWith("^") || !pattern.endsWith("$")) {
      pattern = `^${escapeRegex(pattern)}$`;
    }
    const regex = new RegExp(pattern);
    if (!regex.test(value)) {
      return false;
    }
  }
  return true;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
