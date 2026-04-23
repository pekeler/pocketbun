// Ported from pocketbase/core/field.go
// Note: validation aggregation is simplified compared to ozzo-validation.

import type { Collection } from "./collection_model.ts";
import { ErrRequired, newError } from "../internal/compat/validation.ts";
import { ErrUnsupportedValueType } from "./validators/validators.ts";

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

// SystemFields returns special internal field names that are usually readonly.
export const SystemDynamicFieldNames = [FieldNameCollectionId, FieldNameCollectionName, FieldNameExpand];

export const InterceptorActionValidate = "validate";
export const InterceptorActionDelete = "delete";
export const InterceptorActionDeleteExecute = "deleteExecute";
export const InterceptorActionAfterDelete = "afterDelete";
export const InterceptorActionAfterDeleteError = "afterDeleteError";
export const InterceptorActionCreate = "create";
export const InterceptorActionCreateExecute = "createExecute";
export const InterceptorActionAfterCreate = "afterCreate";
export const InterceptorActionAfterCreateError = "afterCreateFailure";
export const InterceptorActionUpdate = "update";
export const InterceptorActionUpdateExecute = "updateExecute";
export const InterceptorActionAfterUpdate = "afterUpdate";
export const InterceptorActionAfterUpdateError = "afterUpdateError";

const excludeFieldNames = new Set<string>(["null", "true", "false", "_rowid_", ...SystemDynamicFieldNames]);

export const ErrUnknownField = newError("validation_unknown_field", "Unknown or invalid field.");
export const ErrInvalidFieldValue = newError("validation_invalid_field_value", "Invalid field value.");
export const ErrMustBeSystemAndHidden = newError(
  "validation_must_be_system_and_hidden",
  'The field must be marked as "System" and "Hidden".',
);
export const ErrMustBeSystem = newError("validation_must_be_system", 'The field must be marked as "System".');

// FieldFactoryFunc defines a simple function to construct a specific Field instance.
export type FieldFactoryFunc = () => Field;

// Fields holds all available collection fields.
export const Fields: Record<string, FieldFactoryFunc> = {};

// Field defines a common interface that all Collection fields should implement.
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
  ValidateSettings(ctx: unknown, app: unknown, collection: Collection): Error | null;
}

// AsyncFieldValueValidator defines an optional field interface for async
// value validation in non-blocking runtime paths.
export interface AsyncFieldValueValidator {
  ValidateValueAsync(ctx: unknown, app: unknown, record: RecordLike): Error | null | Promise<Error | null>;
}

// AsyncValidationRequirement defines an optional field interface for
// declaring that full validation can run only via async model APIs.
export interface AsyncValidationRequirement {
  // Boolean marker preferred for ergonomics in custom fields.
  // For backwards compatibility we also accept a method form.
  RequiresAsyncValidation: boolean | (() => boolean);
}

// MaxBodySizeCalculator defines an optional field interface for
// specifying the max size of a field value.
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

// DriverValuer defines a Field interface for exporting and formatting
// a field value for the database.
export interface DriverValuer {
  DriverValue(record: RecordLike): [unknown, Error | null];
}

// MultiValuer defines a field interface that every multi-valued (eg. with MaxSelect) field has.
export interface MultiValuer {
  IsMultiple(): boolean;
}

// RecordInterceptor defines a field interface for reacting to various
// Record related operations (create, delete, validate, etc.).
export interface RecordInterceptor {
  Intercept(
    ctx: unknown,
    app: unknown,
    record: RecordLike,
    actionName: string,
    actionFunc: () => Error | null | Promise<Error | null>,
  ): Error | null | Promise<Error | null>;
  // Optional performance hint used by the Bun port to skip guaranteed no-op
  // interceptor calls while preserving observable hook behavior.
  CanInterceptAction?(actionName: string): boolean;
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

export function defaultFieldHelpValidationRule(value: unknown): Error | null {
  if (typeof value !== "string") {
    return ErrUnsupportedValueType;
  }
  if (value === "") {
    return null;
  }
  if (Array.from(value).length > 300) {
    return newError("validation_length", "The length must be between 1 and 300.");
  }
  return null;
}

export function defaultFieldIdValidationRule(value: unknown): Error | null {
  if (typeof value !== "string") {
    return ErrUnsupportedValueType;
  }
  if (value.length === 0) {
    return ErrRequired;
  }
  if (value.length > 100) {
    return newError("validation_length", "The length must be between 1 and 100.");
  }
  return null;
}

export function defaultFieldNameValidationRule(value: unknown): Error | null {
  if (typeof value !== "string") {
    return ErrUnsupportedValueType;
  }
  if (value.length === 0) {
    return ErrRequired;
  }
  if (value.length > 100) {
    return newError("validation_length", "The length must be between 1 and 100.");
  }
  if (!fieldNameRegex.test(value)) {
    return newError("validation_match_invalid", "Must be in a valid format.");
  }
  if (excludeFieldNames.has(value)) {
    return newError("validation_not_in_invalid", "The value is invalid.");
  }
  if (value.toLowerCase().includes("_via_")) {
    return newError("validation_found_via", 'The value cannot contain "_via_".');
  }
  return null;
}

export function noopSetter(_record: RecordLike, _raw: unknown): void {}
