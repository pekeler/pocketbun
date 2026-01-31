// PocketBun-only: rewrites dbx placeholders for bun:sqlite compatibility.

export function rewriteDbxIdentifiers(sql: string): string {
  let result = "";
  let i = 0;
  let mode: QuoteMode = "none";

  while (i < sql.length) {
    const char = sql[i] ?? "";

    if (mode === "line_comment") {
      result += char;
      i += 1;
      if (char === "\n" || char === "\r") {
        mode = "none";
      }
      continue;
    }

    if (mode === "block_comment") {
      result += char;
      i += 1;
      if (char === "*" && sql[i] === "/") {
        result += sql[i] ?? "";
        i += 1;
        mode = "none";
      }
      continue;
    }

    if (mode === "none") {
      if (char === "-" && sql[i + 1] === "-") {
        mode = "line_comment";
        result += "--";
        i += 2;
        continue;
      }
      if (char === "/" && sql[i + 1] === "*") {
        mode = "block_comment";
        result += "/*";
        i += 2;
        continue;
      }
      if (char === "'") {
        mode = "single";
        result += char;
        i += 1;
        continue;
      }
      if (char === '"') {
        mode = "double";
        result += char;
        i += 1;
        continue;
      }
      if (char === "`") {
        mode = "backtick";
        result += char;
        i += 1;
        continue;
      }
      if (char === "[") {
        if (sql[i + 1] === "[") {
          const end = sql.indexOf("]]", i + 2);
          if (end === -1) {
            result += char;
            i += 1;
            continue;
          }
          const inner = sql.slice(i + 2, end);
          result += quoteDbxIdentifier(inner);
          i = end + 2;
          continue;
        }
        mode = "bracket";
        result += char;
        i += 1;
        continue;
      }
      if (char === "{" && sql[i + 1] === "{") {
        const end = sql.indexOf("}}", i + 2);
        if (end === -1) {
          result += char;
          i += 1;
          continue;
        }
        const inner = sql.slice(i + 2, end);
        result += quoteDbxIdentifier(inner);
        i = end + 2;
        continue;
      }

      result += char;
      i += 1;
      continue;
    }

    result += char;
    i += 1;

    if (mode === "single" && char === "'") {
      if (sql[i] === "'") {
        result += sql[i] ?? "";
        i += 1;
      } else {
        mode = "none";
      }
      continue;
    }

    if (mode === "double" && char === '"') {
      if (sql[i] === '"') {
        result += sql[i] ?? "";
        i += 1;
      } else {
        mode = "none";
      }
      continue;
    }

    if (mode === "backtick" && char === "`") {
      if (sql[i] === "`") {
        result += sql[i] ?? "";
        i += 1;
      } else {
        mode = "none";
      }
      continue;
    }

    if (mode === "bracket" && char === "]") {
      if (sql[i] === "]") {
        result += sql[i] ?? "";
        i += 1;
      } else {
        mode = "none";
      }
    }
  }

  return result;
}

type QuoteMode =
  | "none"
  | "single"
  | "double"
  | "backtick"
  | "bracket"
  | "line_comment"
  | "block_comment";

function quoteDbxIdentifier(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "[]";
  }
  const parts = trimmed.split(".");
  return parts.map((part) => quoteIdentifierPart(part)).join(".");
}

function quoteIdentifierPart(value: string): string {
  const trimmed = value.trim();
  if (trimmed === "*") {
    return "*";
  }
  const stripped = stripIdentifierQuotes(trimmed);
  return `[${escapeIdentifier(stripped)}]`;
}

function stripIdentifierQuotes(value: string): string {
  if (value.startsWith("[[") && value.endsWith("]]")) {
    return value.slice(2, -2);
  }
  if (value.startsWith("[") && value.endsWith("]")) {
    return value.slice(1, -1);
  }
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("`") && value.endsWith("`"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function escapeIdentifier(value: string): string {
  return value.replace(/\]/g, "]]");
}
