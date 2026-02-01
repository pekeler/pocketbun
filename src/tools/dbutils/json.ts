// Ported from pocketbase/tools/dbutils/json.go

export function JSONEach(column: string): string {
  return `json_each(CASE WHEN iif(json_valid([[${column}]]), json_type([[${column}]])='array', FALSE) THEN [[${column}]] ELSE json_array([[${column}]]) END)`;
}

// JSONArrayLength returns JSON_ARRAY_LENGTH SQLite string expression
// with some normalizations for non-json columns.
//
// It works with both json and non-json column values.
//
// Returns 0 for empty string or NULL column values.
export function JSONArrayLength(column: string): string {
  return `json_array_length(CASE WHEN iif(json_valid([[${column}]]), json_type([[${column}]])='array', FALSE) THEN [[${column}]] ELSE (CASE WHEN [[${column}]] = '' OR [[${column}]] IS NULL THEN json_array() ELSE json_array([[${column}]]) END) END)`;
}

// JSONExtract returns a JSON_EXTRACT SQLite string expression with
// some normalizations for non-json columns.
export function JSONExtract(column: string, path: string): string {
  const normalizedPath = path !== "" && !path.startsWith("[") ? `.${path}` : path;
  return `(CASE WHEN json_valid([[${column}]]) THEN JSON_EXTRACT([[${column}]], '$${normalizedPath}') ELSE JSON_EXTRACT(json_object('pb', [[${column}]]), '$.pb${normalizedPath}') END)`;
}
