// Ported from pocketbase/tools/dbutils/index.go

import { Tokenizer } from "../tokenizer/tokenizer.ts";

const indexRegex =
  /create\s+(unique\s+)?\s*index\s*(if\s+not\s+exists\s+)?(\S*)\s+on\s+(\S*)\s*\(([\s\S]*)\)(?:\s*where\s+([\s\S]*))?/im;
const indexColumnRegex = /^([\s\S]+?)(?:\s+collate\s+([\w]+))?(?:\s+(asc|desc))?$/im;
const trimChars = "`\"'[]\r\n\t\f\v ";

// IndexColumn represents a single parsed SQL index column.
export type IndexColumn = {
  name: string;
  collate: string;
  sort: string;
};

// Index represents a single parsed SQL CREATE INDEX expression.
export class Index {
  schemaName = "";
  indexName = "";
  tableName = "";
  where = "";
  columns: IndexColumn[] = [];
  unique = false;
  optional = false;

  // isValid checks if the current Index contains the minimum required fields to be considered valid.
  isValid(): boolean {
    return this.indexName !== "" && this.tableName !== "" && this.columns.length > 0;
  }

  // build returns a CREATE INDEX SQL string from the current index parts.
  build(): string {
    if (!this.isValid()) {
      return "";
    }

    const parts: string[] = [];

    parts.push("CREATE ");

    if (this.unique) {
      parts.push("UNIQUE ");
    }

    parts.push("INDEX ");

    if (this.optional) {
      parts.push("IF NOT EXISTS ");
    }

    if (this.schemaName !== "") {
      parts.push("`", this.schemaName, "`.");
    }

    parts.push("`", this.indexName, "` ");
    parts.push("ON `", this.tableName, "` (");

    if (this.columns.length > 1) {
      parts.push("\n  ");
    }

    let hasCol = false;
    for (const col of this.columns) {
      const trimmedColName = col.name.trim();
      if (trimmedColName === "") {
        continue;
      }

      if (hasCol) {
        parts.push(",\n  ");
      }

      if (trimmedColName.includes("(") || trimmedColName.includes(" ")) {
        parts.push(trimmedColName);
      } else {
        parts.push("`", trimmedColName, "`");
      }

      if (col.collate !== "") {
        parts.push(" COLLATE ", col.collate);
      }

      if (col.sort !== "") {
        parts.push(" ", col.sort.toUpperCase());
      }

      hasCol = true;
    }

    if (hasCol && this.columns.length > 1) {
      parts.push("\n");
    }

    parts.push(")");

    if (this.where !== "") {
      parts.push(" WHERE ", this.where);
    }

    return parts.join("");
  }
}

// parseIndex parses the provided CREATE INDEX SQL string into Index struct.
export function parseIndex(createIndexExpr: string): Index {
  const result = new Index();

  const matches = indexRegex.exec(createIndexExpr);
  if (!matches || matches.length !== 7) {
    return result;
  }

  result.unique = (matches[1] ?? "").trim() !== "";
  result.optional = (matches[2] ?? "").trim() !== "";

  const nameTk = new Tokenizer(matches[3] ?? "");
  nameTk.separators(".");
  const nameParts = nameTk.scanAll();

  if (nameParts.length === 2) {
    result.schemaName = trimByCutset(nameParts[0] ?? "", trimChars);
    result.indexName = trimByCutset(nameParts[1] ?? "", trimChars);
  } else if (nameParts.length > 0) {
    result.indexName = trimByCutset(nameParts[0] ?? "", trimChars);
  }

  result.tableName = trimByCutset(matches[4] ?? "", trimChars);

  const columnsTk = new Tokenizer(matches[5] ?? "");
  columnsTk.separators(",");
  const rawColumns = columnsTk.scanAll();

  result.columns = [];

  for (const col of rawColumns) {
    const colMatches = indexColumnRegex.exec(col);
    if (!colMatches || colMatches.length !== 4) {
      continue;
    }

    const trimmedName = trimByCutset(colMatches[1] ?? "", trimChars);
    if (trimmedName === "") {
      continue;
    }

    result.columns.push({
      name: trimmedName,
      collate: (colMatches[2] ?? "").trim(),
      sort: (colMatches[3] ?? "").toUpperCase(),
    });
  }

  result.where = (matches[6] ?? "").trim();

  return result;
}

// findSingleColumnUniqueIndex returns the first matching single column unique index.
export function findSingleColumnUniqueIndex(indexes: string[], column: string): [Index, boolean] {
  for (const idx of indexes) {
    const index = parseIndex(idx);
    if (
      index.unique &&
      index.columns.length === 1 &&
      index.columns[0]?.name.toLowerCase() === column.toLowerCase()
    ) {
      return [index, true];
    }
  }

  return [new Index(), false];
}

// Deprecated: use [_, ok] = findSingleColumnUniqueIndex(indexes, column) instead.
//
// hasSingleColumnUniqueIndex loosely checks whether the specified column has
// a single column unique index (WHERE statements are ignored).
export function hasSingleColumnUniqueIndex(column: string, indexes: string[]): boolean {
  return findSingleColumnUniqueIndex(indexes, column)[1];
}

function trimByCutset(value: string, cutset: string): string {
  if (value === "") {
    return "";
  }

  let start = 0;
  let end = value.length;

  while (start < end && cutset.includes(value[start] ?? "")) {
    start += 1;
  }

  while (end > start && cutset.includes(value[end - 1] ?? "")) {
    end -= 1;
  }

  return value.slice(start, end);
}
