// Ported from pocketbase/tools/dbutils/select.go

const selectRegex = /(?:\s+as\s+|\s+)([\w\-_.]+)$/i;

export function aliasOrIdentifier(columnOrTableIdentifier: string): string {
  const matches = selectRegex.exec(columnOrTableIdentifier);

  if (matches && matches[1]) {
    return matches[1];
  }

  return columnOrTableIdentifier;
}
