// Ported from pocketbase/core/field.go
// Note: validation aggregation is simplified compared to ozzo-validation.

import { newError } from "../internal/compat/validation.ts";
import { ErrUnsupportedValueType } from "./validators/validators.ts";
import type { Collection } from "./collection.ts";

const fieldNameRegex = /^\w+$/;

export const maxSafeJSONInt = 2 ** 53 - 1;

export const FieldNameId = "id";
export const FieldNameCollectionId = "collectionId";
export const FieldNameCollectionName = "collectionName";
export const FieldNameExpand = "expand";
export const FieldNameEmail = "email";
export const FieldNameEmailVisibility = "emailVisibility";
export const FieldNameVerified = "verified";
export const FieldNameTokenKey = "tokenKey";
export const FieldNamePassword = "password";

export const SystemDynamicFieldNames = [
  FieldNameCollectionId,
  FieldNameCollectionName,
  FieldNameExpand,
];

const excludeFieldNames = new Set<string>([
  "null",
  "true",
  "false",
  "_rowid_",
  ...SystemDynamicFieldNames,
]);

export const ErrUnknownField = newError("validation_unknown_field", "Unknown or invalid field.");
export const ErrInvalidFieldValue = newError(
  "validation_invalid_field_value",
  "Invalid field value.",
);
export const ErrMustBeSystemAndHidden = newError(
  "validation_must_be_system_and_hidden",
  'The field must be marked as "System" and "Hidden".',
);
export const ErrMustBeSystem = newError(
  "validation_must_be_system",
  'The field must be marked as "System".',
);

export type FieldFactoryFunc = () => Field;

export const Fields: Record<string, FieldFactoryFunc> = {};

export interface Field {
  GetId(): string;
  SetId(id: string): void;
  GetName(): string;
  SetName(name: string): void;
  GetSystem(): boolean;
  SetSystem(system: boolean): void;
  GetHidden(): boolean;
  SetHidden(hidden: boolean): void;
  Type(): string;
  ColumnType(app: unknown): string;
  PrepareValue(record: RecordLike, raw: unknown): unknown;
  ValidateValue(ctx: unknown, app: unknown, record: RecordLike): Error | null;
  ValidateSettings(ctx: unknown, app: unknown, collection: CollectionLike): Error | null;
}

export interface MaxBodySizeCalculator {
  CalculateMaxBodySize(): number;
}

export type SetterFunc = (record: RecordLike, raw: unknown) => void;
export type GetterFunc = (record: RecordLike) => unknown;

export interface SetterFinder {
  FindSetter(key: string): SetterFunc | null;
}

export interface GetterFinder {
  FindGetter(key: string): GetterFunc | null;
}

export interface DriverValuer {
  DriverValue(record: RecordLike): [unknown, Error | null];
}

export interface MultiValuer {
  IsMultiple(): boolean;
}

export interface RecordInterceptor {
  Intercept(
    ctx: unknown,
    app: unknown,
    record: RecordLike,
    actionName: string,
    actionFunc: () => Error | null,
  ): Error | null;
}

export type RecordLike = {
  GetRaw: (field: string) => unknown;
  SetRaw: (field: string, value: unknown) => void;
  IsNew: () => boolean;
  LastSavedPK: () => string;
  TableName: () => string;
  GetDateTime?: (field: string) => { IsZero: () => boolean; Equal: (other: unknown) => boolean };
  Original?: () => RecordLike;
};

export type CollectionLike = Collection;

export function defaultFieldIdValidationRule(value: unknown): Error | null {
  if (typeof value !== "string") {
    return ErrUnsupportedValueType;
  }
  if (value.length < 1 || value.length > 100) {
    return newError("validation_invalid_field_id", "Invalid or missing field id.");
  }
  return null;
}

export function defaultFieldNameValidationRule(value: unknown): Error | null {
  if (typeof value !== "string") {
    return ErrUnsupportedValueType;
  }
  if (value.length < 1 || value.length > 100) {
    return newError("validation_invalid_field_name", "Invalid or missing field name.");
  }
  if (!fieldNameRegex.test(value)) {
    return newError("validation_invalid_field_name", "Invalid or missing field name.");
  }
  if (excludeFieldNames.has(value)) {
    return newError("validation_invalid_field_name", "Invalid or missing field name.");
  }
  if (value.toLowerCase().includes("_via_")) {
    return newError("validation_found_via", 'The value cannot contain "_via_".');
  }
  return null;
}

export function noopSetter(_record: RecordLike, _raw: unknown): void {}
