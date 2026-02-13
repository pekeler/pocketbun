// Ported from pocketbase/core/view.go (view helpers and query-to-fields parsing).

import type { App } from "./app.ts";
import type { CollectionRow } from "./collection_model.ts";
import type { Field, MultiValuer } from "./field.ts";
import { JSONEach } from "../tools/dbutils/json.ts";
import { columnify } from "../tools/inflector/inflector.ts";
import { pseudorandomString } from "../tools/security/random.ts";
import { Tokenizer } from "../tools/tokenizer/tokenizer.ts";
import { Collection, collectionFromRow } from "./collection_model.ts";
import { FieldNameId } from "./field.ts";
import { BoolField } from "./field_bool.ts";
import { JSONField } from "./field_json.ts";
import { NumberField } from "./field_number.ts";
import { RelationField } from "./field_relation.ts";
import { TextField } from "./field_text.ts";
import { FieldsList, NewFieldsList } from "./fields_list.ts";
import { Record as RecordModel, type RecordData } from "./record_model.ts";

// DeleteView drops the specified view name.
//
// This method is a no-op if a view with the provided name doesn't exist.
//
// NB! Be aware that this method is vulnerable to SQL injection and the
// "dangerousViewName" argument must come only from trusted input!
export function DeleteView(app: App, dangerousViewName: string): Error | null {
  const trimmedName = dangerousViewName.trim();
  if (!trimmedName) {
    return new Error("missing view name");
  }

  const existing = app
    .db()
    .query<{ type?: string }, [string]>("select type from sqlite_schema where lower(name) = lower(?) limit 1")
    .get(trimmedName);
  if (existing?.type && existing.type !== "view") {
    return new Error("not a view table");
  }

  try {
    app.db().run(`DROP VIEW IF EXISTS {{${trimmedName}}}`);
    return null;
  } catch (error) {
    return error as Error;
  }
}

// SaveView creates (or updates already existing) persistent SQL view.
//
// NB! Be aware that this method is vulnerable to SQL injection and
// its arguments must come only from trusted input!
export async function SaveView(app: App, dangerousViewName: string, dangerousSelectQuery: string): Promise<Error | null> {
  const trimmedName = dangerousViewName.trim();
  if (!trimmedName) {
    return new Error("missing view name");
  }

  return app.RunInTransaction(async (txApp) => {
    const deleteErr = DeleteView(txApp, trimmedName);
    if (deleteErr) {
      return deleteErr;
    }

    let query = dangerousSelectQuery.trim();
    query = query.replace(/^;+|;+$/g, "");
    if (!query) {
      return new Error("missing view query");
    }

    const tk = new Tokenizer(query);
    tk.separators(";");
    const parts = tk.scanAll();
    if (parts.length > 1) {
      return new Error("multiple statements are not supported");
    }

    const viewQuery = `CREATE VIEW {{${trimmedName}}} AS SELECT * FROM (${query})`;
    try {
      txApp.db().run(viewQuery);
    } catch (error) {
      return error as Error;
    }

    try {
      txApp.TableInfo(trimmedName);
    } catch (error) {
      DeleteView(txApp, trimmedName);
      return error as Error;
    }

    return null;
  });
}

export function SaveViewSync(app: App, dangerousViewName: string, dangerousSelectQuery: string): Error | null {
  const trimmedName = dangerousViewName.trim();
  if (!trimmedName) {
    return new Error("missing view name");
  }

  return app.RunInTransactionSync((txApp) => {
    const deleteErr = DeleteView(txApp, trimmedName);
    if (deleteErr) {
      return deleteErr;
    }

    let query = dangerousSelectQuery.trim();
    query = query.replace(/^;+|;+$/g, "");
    if (!query) {
      return new Error("missing view query");
    }

    const tk = new Tokenizer(query);
    tk.separators(";");
    const parts = tk.scanAll();
    if (parts.length > 1) {
      return new Error("multiple statements are not supported");
    }

    const viewQuery = `CREATE VIEW {{${trimmedName}}} AS SELECT * FROM (${query})`;
    try {
      txApp.db().run(viewQuery);
    } catch (error) {
      return error as Error;
    }

    try {
      txApp.TableInfo(trimmedName);
    } catch (error) {
      DeleteView(txApp, trimmedName);
      return error as Error;
    }

    return null;
  });
}

// CreateViewFields creates a new FieldsList from the provided select query.
//
// There are some caveats:
// - The select query must have an "id" column.
// - Wildcard ("*") columns are not supported to avoid accidentally leaking sensitive data.
//
// NB! Be aware that this method is vulnerable to SQL injection and the
// "dangerousSelectQuery" argument must come only from trusted input!
export async function CreateViewFields(app: App, dangerousSelectQuery: string): Promise<FieldsList> {
  const result = NewFieldsList();
  const suggested = parseQueryToFields(app, dangerousSelectQuery);

  // note wrap in a transaction in case the dangerousSelectQuery contains
  // multiple statements allowing us to rollback on any error
  const txErr = await app.RunInTransaction(async (txApp) => {
    const info = await getQueryTableInfo(txApp, dangerousSelectQuery);
    let hasId = false;

    for (const row of info) {
      if (row.Name === FieldNameId) {
        hasId = true;
      }

      const suggestedField = suggested.get(row.Name);
      const field = suggestedField?.field ?? defaultViewField(row.Name);
      result.Add(field);
    }

    if (!hasId) {
      return new Error("missing required id column (you can use `(ROW_NUMBER() OVER()) as id` if you don't have one)");
    }

    return null;
  });

  if (txErr) {
    throw txErr;
  }

  return result;
}

export function CreateViewFieldsSync(app: App, dangerousSelectQuery: string): FieldsList {
  const result = NewFieldsList();
  const suggested = parseQueryToFields(app, dangerousSelectQuery);

  // note wrap in a transaction in case the dangerousSelectQuery contains
  // multiple statements allowing us to rollback on any error
  const txErr = app.RunInTransactionSync((txApp) => {
    const info = getQueryTableInfoSync(txApp, dangerousSelectQuery);
    let hasId = false;

    for (const row of info) {
      if (row.Name === FieldNameId) {
        hasId = true;
      }

      const suggestedField = suggested.get(row.Name);
      const field = suggestedField?.field ?? defaultViewField(row.Name);
      result.Add(field);
    }

    if (!hasId) {
      return new Error("missing required id column (you can use `(ROW_NUMBER() OVER()) as id` if you don't have one)");
    }

    return null;
  });

  if (txErr) {
    throw txErr;
  }

  return result;
}

export function FindRecordByViewFile(
  app: App,
  viewCollectionModelOrIdentifier: Collection | string,
  fileFieldName: string,
  filename: string,
): RecordModel {
  const initialView = getCollectionByModelOrIdentifier(app, viewCollectionModelOrIdentifier);
  if (!initialView) {
    throw new Error("unknown collection identifier - must be collection model, id or name");
  }

  if (!initialView.IsView()) {
    throw new Error("not a view collection");
  }

  let view: Collection = initialView;
  const findFirstNonViewQueryFileField = (level: number): QueryField => {
    if (level > 5) {
      throw new Error("reached the max recursion level of view collection file field queries");
    }

    const queryFields = parseQueryToFields(app, view.ViewQuery);

    for (const item of queryFields.values()) {
      if (!item.collection || !item.original || item.field.GetName() !== fileFieldName) {
        continue;
      }

      if (item.collection.IsView()) {
        view = item.collection;
        fileFieldName = item.original.GetName();
        return findFirstNonViewQueryFileField(level + 1);
      }

      return item;
    }

    throw new Error("no query file field found");
  };

  const qf = findFirstNonViewQueryFileField(1);
  const cleanFieldName = columnify(qf.original!.GetName());
  const tableName = qf.collection!.name;

  let sql = `select {{${tableName}}}.* from {{${tableName}}}`;
  const params: Array<string> = [];

  const multi = qf.original as unknown as MultiValuer;
  if (!multi || typeof multi.IsMultiple !== "function" || !multi.IsMultiple()) {
    sql += ` where [[${cleanFieldName}]] = ?`;
    params.push(filename);
  } else {
    sql += ` inner join ${JSONEach(cleanFieldName)} as {{_je_file}} on [[_je_file.value]] = ?`;
    params.push(filename);
  }
  sql += " limit 1";

  const row = app
    .db()
    .query(sql)
    .get(...params);
  if (!row || typeof row !== "object") {
    throw new Error("record not found");
  }

  return RecordModel.fromRow(qf.collection!, row as RecordData);
}

type QueryField = {
  field: Field;
  collection: Collection | null;
  original: Field | null;
};

function defaultViewField(name: string): Field {
  const field = new JSONField();
  field.Name = name;
  field.MaxSize = 1;
  return field;
}

const castRegex = new RegExp("^cast\\s*\\(.*\\s+as\\s+(\\w+)\\s*\\)$", "is");

function parseQueryToFields(app: App, selectQuery: string): Map<string, QueryField> {
  const parser = new IdentifiersParser();
  parser.parse(selectQuery);

  const collections = findCollectionsByIdentifiers(app, parser.tables);
  const result = new Map<string, QueryField>();

  const mainTable = parser.tables.length > 0 ? parser.tables[0] : null;

  for (const col of parser.columns) {
    const colLower = col.original.toLowerCase();

    if (col.alias === FieldNameId) {
      const field = new TextField();
      field.Name = col.alias;
      field.System = true;
      field.Required = true;
      field.PrimaryKey = true;
      field.Pattern = "^[a-z0-9]+$";
      result.set(col.alias, { field, collection: null, original: null });
      continue;
    }

    if (colLower.startsWith("count(") || colLower.startsWith("total(")) {
      const field = new NumberField();
      field.Name = col.alias;
      result.set(col.alias, { field, collection: null, original: null });
      continue;
    }

    const castMatch = castRegex.exec(colLower);
    if (castMatch && castMatch[1]) {
      switch (castMatch[1]) {
        case "real":
        case "integer":
        case "int":
        case "decimal":
        case "numeric": {
          const field = new NumberField();
          field.Name = col.alias;
          result.set(col.alias, { field, collection: null, original: null });
          continue;
        }
        case "text": {
          const field = new TextField();
          field.Name = col.alias;
          result.set(col.alias, { field, collection: null, original: null });
          continue;
        }
        case "boolean":
        case "bool": {
          const field = new BoolField();
          field.Name = col.alias;
          result.set(col.alias, { field, collection: null, original: null });
          continue;
        }
      }
    }

    const parts = col.original.split(".");
    let fieldName = "";
    let collection: Collection | null = null;

    if (parts.length === 2) {
      fieldName = parts[1] ?? "";
      collection = collections.get(parts[0] ?? "") ?? null;
    } else {
      fieldName = parts[0] ?? "";
      collection = mainTable ? (collections.get(mainTable.alias) ?? null) : null;
    }

    if (!collection) {
      result.set(col.alias, {
        field: defaultViewField(col.alias),
        collection: null,
        original: null,
      });
      continue;
    }

    if (fieldName === "*") {
      throw new Error("dynamic column names are not supported");
    }

    let found: Field | null = null;
    for (const f of collection.Fields) {
      if (f.GetName().toLowerCase() === fieldName.toLowerCase()) {
        found = f;
        break;
      }
    }

    if (!found) {
      result.set(col.alias, { field: defaultViewField(col.alias), collection, original: null });
      continue;
    }

    if (fieldName.toLowerCase() === FieldNameId.toLowerCase()) {
      const rel = new RelationField();
      rel.Name = col.alias;
      rel.MaxSelect = 1;
      rel.CollectionId = collection.id;
      result.set(col.alias, { field: rel, collection, original: found });
      continue;
    }

    const tempCollection = app.findCollectionByNameOrId(collection.id);
    if (!tempCollection) {
      throw new Error(`missing expected collection ${collection.id}`);
    }
    const cloneSource = tempCollection.Fields.GetById(found.GetId());
    if (!cloneSource) {
      throw new Error(
        `missing expected field "${found.GetName()}" ("${found.GetId()}") in collection "${tempCollection.name}"`,
      );
    }

    const clone = cloneField(cloneSource);
    clone.SetId(`_clone_${pseudorandomString(4)}`);
    clone.SetName(col.alias);

    result.set(col.alias, { field: clone, collection, original: found });
  }

  return result;
}

function cloneField(field: Field): Field {
  const list = new FieldsList();
  list.Add(field);
  const cloned = FieldsList.fromJSON(JSON.stringify(list));
  return cloned[0]!;
}

function getCollectionByModelOrIdentifier(app: App, value: Collection | string): Collection | null {
  if (typeof value === "string") {
    return app.findCollectionByNameOrId(value);
  }

  if (value instanceof Collection) {
    return value;
  }

  return null;
}

function findCollectionsByIdentifiers(app: App, tables: Identifier[]): Map<string, Collection> {
  const names: string[] = [];
  for (const table of tables) {
    if (table.alias.includes("(")) {
      continue;
    }
    names.push(table.original);
  }

  if (names.length === 0) {
    return new Map();
  }

  const placeholders = names.map(() => "?").join(",");
  const rows = app
    .db()
    .query(
      `select id, name, system, type, fields, indexes, listRule, viewRule, createRule, updateRule, deleteRule, options, created, updated from _collections where name in (${placeholders})`,
    )
    .all(...names) as CollectionRow[];

  const collections = rows.map((row) => collectionFromRow(row));
  const map = new Map<string, Collection>();
  for (const table of tables) {
    for (const collection of collections) {
      if (collection.name === table.original) {
        map.set(table.alias, collection);
      }
    }
  }

  return map;
}

export async function getQueryTableInfo(app: App, selectQuery: string) {
  const tempView = `_temp_${pseudorandomString(6)}`;

  let info: ReturnType<App["TableInfo"]> = [];

  const txErr = await app.RunInTransaction(async (txApp) => {
    const err = await SaveView(txApp, tempView, selectQuery);
    if (err) {
      return err;
    }

    try {
      info = txApp.TableInfo(tempView);
    } catch (error) {
      DeleteView(txApp, tempView);
      return error as Error;
    }

    return DeleteView(txApp, tempView);
  });

  if (txErr) {
    throw txErr;
  }

  return info;
}

export function getQueryTableInfoSync(app: App, selectQuery: string) {
  const tempView = `_temp_${pseudorandomString(6)}`;

  let info: ReturnType<App["TableInfo"]> = [];

  const txErr = app.RunInTransactionSync((txApp) => {
    const err = SaveViewSync(txApp, tempView, selectQuery);
    if (err) {
      return err;
    }

    try {
      info = txApp.TableInfo(tempView);
    } catch (error) {
      DeleteView(txApp, tempView);
      return error as Error;
    }

    return DeleteView(txApp, tempView);
  });

  if (txErr) {
    throw txErr;
  }

  return info;
}

const joinReplaceRegex =
  /\s+(full\s+outer\s+join|left\s+outer\s+join|right\s+outer\s+join|full\s+join|cross\s+join|inner\s+join|outer\s+join|left\s+join|right\s+join|join)\s+?/gim;
const discardReplaceRegex = /\s+(where|group\s+by|having|order|limit|with)\s+?/gim;
const commentsReplaceRegex = /\/\*[\s\S]*?\*\/|--.+$/gm;

type Identifier = {
  original: string;
  alias: string;
};

export class IdentifiersParser {
  columns: Identifier[] = [];
  tables: Identifier[] = [];

  parse(selectQuery: string): void {
    let str = selectQuery.trim().replace(/^;+|;+$/g, "");
    str = str.replace(commentsReplaceRegex, " ");
    str = str.replace(joinReplaceRegex, " __pb_join__ ");
    str = str.replace(discardReplaceRegex, " __pb_discard__ ");

    const tk = new Tokenizer(str);
    tk.separators(",", " ", "\n", "\t");
    tk.keepSeparator(true);

    let skip = false;
    let partType = "";
    let activeBuilder: string[] | null = null;
    const selectParts: string[] = [];
    const fromParts: string[] = [];
    const joinParts: string[] = [];

    for (;;) {
      const token = tk.scan();
      if (token === null) {
        break;
      }

      const trimmed = token.trim().toLowerCase();

      switch (trimmed) {
        case "select":
          skip = false;
          partType = "select";
          activeBuilder = selectParts;
          break;
        case "distinct":
          break;
        case "from":
          skip = false;
          partType = "from";
          activeBuilder = fromParts;
          break;
        case "__pb_join__":
          skip = false;
          if (partType === "join") {
            joinParts.push(",");
          }
          partType = "join";
          activeBuilder = joinParts;
          break;
        case "__pb_discard__":
          skip = true;
          break;
        default: {
          const isJoin = partType === "join";
          if (isJoin && trimmed === "on") {
            skip = true;
          }
          if (!skip && activeBuilder) {
            activeBuilder.push(" ");
            activeBuilder.push(token);
          }
          break;
        }
      }
    }

    this.columns = extractIdentifiers(selectParts.join(""));
    const froms = extractIdentifiers(fromParts.join(""));
    const joins = extractIdentifiers(joinParts.join(""));
    this.tables = froms.concat(joins);
  }
}

function extractIdentifiers(rawExpression: string): Identifier[] {
  const rawTk = new Tokenizer(rawExpression);
  rawTk.separators(",");
  const rawIdentifiers = rawTk.scanAll();

  const result: Identifier[] = [];

  for (const rawIdentifier of rawIdentifiers) {
    const tk = new Tokenizer(rawIdentifier);
    tk.separators(" ", "\n", "\t");
    const parts = tk.scanAll();
    result.push(identifierFromParts(parts));
  }

  return result;
}

function identifierFromParts(parts: string[]): Identifier {
  let result: Identifier = { original: "", alias: "" };

  switch (parts.length) {
    case 3:
      if (parts[1]?.toLowerCase() !== "as") {
        throw new Error(`invalid identifier part - expected "as", got ${parts[1]}`);
      }
      result = { original: parts[0] ?? "", alias: parts[2] ?? "" };
      break;
    case 2:
      result = { original: parts[0] ?? "", alias: parts[1] ?? "" };
      break;
    case 1: {
      const subParts = (parts[0] ?? "").split(".");
      result = { original: parts[0] ?? "", alias: subParts[subParts.length - 1] ?? "" };
      break;
    }
    default:
      throw new Error(`invalid identifier parts ${JSON.stringify(parts)}`);
  }

  result.original = trimRawIdentifier(result.original);
  result.alias = trimRawIdentifier(result.alias, "'");
  return result;
}

function trimRawIdentifier(rawIdentifier: string, extraTrimChars = ""): string {
  let trimChars = '`"[];';
  if (extraTrimChars) {
    trimChars += extraTrimChars;
  }

  const parts = rawIdentifier.split(".");
  for (let i = 0; i < parts.length; i += 1) {
    parts[i] = trimByCutset(parts[i] ?? "", trimChars);
  }

  return parts.join(".");
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
