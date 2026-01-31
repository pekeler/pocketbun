// Ported from pocketbase/core/record_field_resolver.go

import type { App } from "./app.ts";
import type { Collection } from "./collection.ts";
import type { RequestInfo } from "./event_request.ts";
import type { FieldResolver, ResolverResult } from "../tools/search/field_resolver.ts";

export class RecordFieldResolver implements FieldResolver {
  app: App;
  baseCollection: Collection;
  requestInfo: RequestInfo | null;
  staticRequestInfo: Record<string, unknown>;
  allowedFields: string[];
  allowHiddenFields: boolean;
  joins: unknown[];
  listRuleJoins: Map<string, Collection> | null;
  joinAliasSuffix: string;
  baseCollectionAlias: string;

  constructor(
    app: App,
    baseCollection: Collection,
    requestInfo: RequestInfo | null,
    allowHiddenFields: boolean,
  ) {
    this.app = app;
    this.baseCollection = baseCollection;
    this.requestInfo = requestInfo;
    this.allowHiddenFields = allowHiddenFields;
    this.joins = [];
    this.listRuleJoins = null;
    this.joinAliasSuffix = "";
    this.baseCollectionAlias = "";
    this.allowedFields = [
      "^\\w+[\\w\\.\\:]*$",
      "^\\@request\\.context$",
      "^\\@request\\.method$",
      "^\\@request\\.auth\\.[\\w\\.\\:]*\\w+$",
      "^\\@request\\.body\\.[\\w\\.\\:]*\\w+$",
      "^\\@request\\.query\\.[\\w\\.\\:]*\\w+$",
      "^\\@request\\.headers\\.[\\w\\.\\:]*\\w+$",
      "^\\@collection\\.\\w+(\\:\\w+)?\\.[\\w\\.\\:]*\\w+$",
    ];

    this.staticRequestInfo = {};
    if (this.requestInfo) {
      this.staticRequestInfo.context = this.requestInfo.context;
      this.staticRequestInfo.method = this.requestInfo.method;
      this.staticRequestInfo.query = this.requestInfo.query;
      this.staticRequestInfo.headers = this.requestInfo.headers;
      this.staticRequestInfo.body = this.requestInfo.body;
      this.staticRequestInfo.auth = null;
      if (this.requestInfo.auth) {
        this.staticRequestInfo.auth = this.requestInfo.auth.export({
          includeHidden: true,
          ignoreEmailVisibility: true,
        });
      }
    }
  }

  setAllowedFields(newAllowedFields: string[]): void {
    this.allowedFields = [...newAllowedFields];
  }

  setAllowHiddenFields(allowHiddenFields: boolean): void {
    this.allowHiddenFields = allowHiddenFields;
  }

  resolve(fieldName: string): ResolverResult {
    return parseAndRun(fieldName, this);
  }

  resolveStaticRequestField(...path: string[]): ResolverResult {
    if (path.length === 0) {
      throw new Error("at least one path key should be provided");
    }

    const last = path[path.length - 1] ?? "";
    const [lastProp, modifier] = splitModifier(last);
    path[path.length - 1] = lastProp;

    let resultVal: unknown = null;
    let extractErr: Error | null = null;

    try {
      resultVal = extractNestedVal(this.staticRequestInfo, ...path);
    } catch (error) {
      extractErr = error as Error;
    }

    if (modifier === issetModifier) {
      if (extractErr) {
        return { identifier: "FALSE", params: [], nullFallback: "auto" };
      }
      return { identifier: "TRUE", params: [], nullFallback: "auto" };
    }

    if (typeof resultVal === "string") {
      const field = getCollectionField(this.baseCollection, path[path.length - 1] ?? "");
      if (field?.type === FieldTypeNumber) {
        const parsed = Number.parseFloat(resultVal);
        if (Number.isFinite(parsed)) {
          resultVal = parsed;
        }
      }
    } else if (
      typeof resultVal !== "number" &&
      typeof resultVal !== "boolean" &&
      resultVal !== null
    ) {
      try {
        resultVal = JSON.stringify(resultVal);
      } catch {
        resultVal = String(resultVal);
      }
    }

    if (modifier !== "" && modifier !== lowerModifier) {
      throw new Error(`invalid modifier sequence ${lastProp}:${modifier}`);
    }

    if (resultVal === null || resultVal === undefined) {
      return { identifier: "NULL", params: [], nullFallback: "auto" };
    }

    if (modifier === lowerModifier) {
      return { identifier: "LOWER(?)", params: [resultVal], nullFallback: "auto" };
    }

    return { identifier: "?", params: [resultVal], nullFallback: "auto" };
  }

  loadCollection(collectionNameOrId: string): Collection | null {
    if (
      collectionNameOrId === this.baseCollection.name ||
      collectionNameOrId === this.baseCollection.id
    ) {
      return this.baseCollection;
    }
    return this.app.findCollectionByNameOrId(collectionNameOrId);
  }

  registerJoin(): void {
    // TODO: join handling will be added when relation resolution is ported.
  }
}
// parseAndRun and helpers are implemented in record_field_resolver_runner.ts.
import {
  extractNestedVal,
  getCollectionField,
  parseAndRun,
  splitModifier,
  issetModifier,
  lowerModifier,
} from "./record_field_resolver_runner.ts";
export {
  extractNestedVal,
  getCollectionField,
  parseAndRun,
  splitModifier,
  issetModifier,
  lowerModifier,
};

export const FieldTypeNumber = "number";
