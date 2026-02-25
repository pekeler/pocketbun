// PocketBun-only: rewrites dbx placeholders for bun:sqlite compatibility.

const rewriteCache = new Map<string, string>();
const maxRewriteCacheEntries = 2048;
const paramNamesCache = new Map<string, readonly string[]>();
const maxParamNamesCacheEntries = 2048;
const emptyParamNames = Object.freeze([]) as readonly string[];

function getCachedRewrite(sql: string): string | null {
  const cached = rewriteCache.get(sql);
  if (cached == null) {
    return null;
  }
  // refresh insertion order for basic LRU-like behavior
  rewriteCache.delete(sql);
  rewriteCache.set(sql, cached);
  return cached;
}

function setCachedRewrite(sql: string, rewritten: string): void {
  rewriteCache.set(sql, rewritten);
  if (rewriteCache.size <= maxRewriteCacheEntries) {
    return;
  }
  const oldest = rewriteCache.keys().next().value as string | undefined;
  if (oldest) {
    rewriteCache.delete(oldest);
  }
}

function getCachedParamNames(sql: string): readonly string[] | null {
  const cached = paramNamesCache.get(sql);
  if (cached == null) {
    return null;
  }
  // refresh insertion order for basic LRU-like behavior
  paramNamesCache.delete(sql);
  paramNamesCache.set(sql, cached);
  return cached;
}

function setCachedParamNames(sql: string, names: readonly string[]): void {
  paramNamesCache.set(sql, names);
  if (paramNamesCache.size <= maxParamNamesCacheEntries) {
    return;
  }
  const oldest = paramNamesCache.keys().next().value as string | undefined;
  if (oldest) {
    paramNamesCache.delete(oldest);
  }
}

export function rewriteDbxIdentifiers(sql: string): string {
  // Fast path: no dbx placeholder delimiters in the SQL.
  // This covers the majority of hot-path record DML queries.
  if (sql.indexOf("[") === -1 && sql.indexOf("{") === -1) {
    return sql;
  }

  const cached = getCachedRewrite(sql);
  if (cached != null) {
    return cached;
  }

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
      if (char === "{" && sql[i + 1] === ":") {
        const end = sql.indexOf("}", i + 2);
        if (end === -1) {
          result += char;
          i += 1;
          continue;
        }
        result += "?";
        i = end + 1;
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

  setCachedRewrite(sql, result);
  return result;
}

export function extractDbxParamNames(sql: string): readonly string[] {
  if (sql.indexOf("{:") === -1) {
    return emptyParamNames;
  }

  const cached = getCachedParamNames(sql);
  if (cached != null) {
    return cached;
  }

  const names: string[] = [];
  let i = 0;
  let mode: QuoteMode = "none";

  while (i < sql.length) {
    const char = sql[i] ?? "";

    if (mode === "line_comment") {
      i += 1;
      if (char === "\n" || char === "\r") {
        mode = "none";
      }
      continue;
    }

    if (mode === "block_comment") {
      i += 1;
      if (char === "*" && sql[i] === "/") {
        i += 1;
        mode = "none";
      }
      continue;
    }

    if (mode === "none") {
      if (char === "-" && sql[i + 1] === "-") {
        mode = "line_comment";
        i += 2;
        continue;
      }
      if (char === "/" && sql[i + 1] === "*") {
        mode = "block_comment";
        i += 2;
        continue;
      }
      if (char === "'") {
        mode = "single";
        i += 1;
        continue;
      }
      if (char === '"') {
        mode = "double";
        i += 1;
        continue;
      }
      if (char === "`") {
        mode = "backtick";
        i += 1;
        continue;
      }
      if (char === "[") {
        if (sql[i + 1] === "[") {
          const end = sql.indexOf("]]", i + 2);
          if (end === -1) {
            i += 1;
            continue;
          }
          i = end + 2;
          continue;
        }
        mode = "bracket";
        i += 1;
        continue;
      }
      if (char === "{" && sql[i + 1] === "{") {
        const end = sql.indexOf("}}", i + 2);
        if (end === -1) {
          i += 1;
          continue;
        }
        i = end + 2;
        continue;
      }
      if (char === "{" && sql[i + 1] === ":") {
        const end = sql.indexOf("}", i + 2);
        if (end === -1) {
          i += 1;
          continue;
        }
        const name = sql.slice(i + 2, end).trim();
        if (name) {
          names.push(name);
        }
        i = end + 1;
        continue;
      }

      i += 1;
      continue;
    }

    i += 1;

    if (mode === "single" && char === "'") {
      if (sql[i] === "'") {
        i += 1;
      } else {
        mode = "none";
      }
      continue;
    }

    if (mode === "double" && char === '"') {
      if (sql[i] === '"') {
        i += 1;
      } else {
        mode = "none";
      }
      continue;
    }

    if (mode === "backtick" && char === "`") {
      if (sql[i] === "`") {
        i += 1;
      } else {
        mode = "none";
      }
      continue;
    }

    if (mode === "bracket" && char === "]") {
      if (sql[i] === "]") {
        i += 1;
      } else {
        mode = "none";
      }
    }
  }

  if (names.length === 0) {
    setCachedParamNames(sql, emptyParamNames);
    return emptyParamNames;
  }

  const frozen = Object.freeze(names.slice()) as readonly string[];
  setCachedParamNames(sql, frozen);
  return frozen;
}

type QuoteMode = "none" | "single" | "double" | "backtick" | "bracket" | "line_comment" | "block_comment";

function quoteDbxIdentifier(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "``";
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
  return `\`${escapeIdentifier(stripped)}\``;
}

function stripIdentifierQuotes(value: string): string {
  if (value.startsWith("[[") && value.endsWith("]]")) {
    return value.slice(2, -2);
  }
  if (value.startsWith("[") && value.endsWith("]")) {
    return value.slice(1, -1);
  }
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("`") && value.endsWith("`"))) {
    return value.slice(1, -1);
  }
  return value;
}

function escapeIdentifier(value: string): string {
  return value.replace(/`/g, "``");
}
