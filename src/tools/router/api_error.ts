// Ported from pocketbase/tools/router/error.go

import { ValidationError, ValidationErrors } from "../../internal/compat/validation.ts";
import { NotFoundError } from "../filesystem/filesystem.ts";
import { sentenize } from "../inflector/inflector.ts";

export type SafeErrorItem = {
  Code: () => string;
  Error: () => string;
};

export type SafeErrorParamsResolver = {
  Params: () => Record<string, unknown>;
};

export type SafeErrorResolver = {
  Resolve: (data: Record<string, unknown>) => unknown;
};

export class ApiError extends Error {
  rawData: unknown;
  Data: Record<string, unknown>;
  Message: string;
  Status: number;

  constructor(status = 0, message = "", rawData: unknown = null) {
    const normalized = message || statusText(status);
    const sentenized = normalized ? sentenize(normalized).trim() : "";
    super(sentenized, rawData instanceof Error ? { cause: rawData } : undefined);
    this.name = "ApiError";
    this.Status = status;
    this.Message = sentenized;
    this.rawData = rawData;
    this.Data = safeErrorsData(rawData);
  }

  Error(): string {
    return this.Message;
  }

  RawData(): unknown {
    return this.rawData;
  }

  Is(target: unknown): boolean {
    if (target == null) {
      return false;
    }
    if (this === target) {
      return true;
    }
    if (this.rawData instanceof Error && target instanceof Error) {
      return errorsIs(this.rawData, target);
    }
    return false;
  }

  toJSON(): Record<string, unknown> {
    return {
      data: this.Data ?? {},
      message: this.Message,
      status: this.Status,
    };
  }
}

export function NewNotFoundError(message = "", rawErrData: unknown = null): ApiError {
  const normalized = message || "The requested resource wasn't found.";
  return NewApiError(404, normalized, rawErrData);
}

export function NewBadRequestError(message = "", rawErrData: unknown = null): ApiError {
  const normalized = message || "Something went wrong while processing your request.";
  return NewApiError(400, normalized, rawErrData);
}

export function NewForbiddenError(message = "", rawErrData: unknown = null): ApiError {
  const normalized = message || "You are not allowed to perform this request.";
  return NewApiError(403, normalized, rawErrData);
}

export function NewUnauthorizedError(message = "", rawErrData: unknown = null): ApiError {
  const normalized = message || "Missing or invalid authentication.";
  return NewApiError(401, normalized, rawErrData);
}

export function NewInternalServerError(message = "", rawErrData: unknown = null): ApiError {
  const normalized = message || "Something went wrong while processing your request.";
  return NewApiError(500, normalized, rawErrData);
}

export function NewTooManyRequestsError(message = "", rawErrData: unknown = null): ApiError {
  const normalized = message || "Too Many Requests.";
  return NewApiError(429, normalized, rawErrData);
}

export function NewApiError(status = 0, message = "", rawErrData: unknown = null): ApiError {
  return new ApiError(status, message, rawErrData);
}

export function ToApiError(err: unknown): ApiError {
  if (err instanceof Error) {
    const nestedApiErr = unwrapApiError(err);
    if (nestedApiErr) {
      return nestedApiErr;
    }
    if (err instanceof NotFoundError || isFsNotExist(err) || isSqlNoRows(err)) {
      return NewNotFoundError("", err);
    }
    return NewBadRequestError("", err);
  }
  return err instanceof ApiError ? err : NewBadRequestError("", null);
}

export function apiErrorResponse(event: { json: (status: number, body: unknown) => Response }, apiErr: ApiError): Response {
  return event.json(apiErr.Status, {
    status: apiErr.Status,
    message: apiErr.Message,
    data: apiErr.Data ?? {},
  });
}

export function safeErrorsData(err: unknown): Record<string, unknown> {
  if (!err) {
    return {};
  }

  if (err instanceof AggregateError) {
    for (const inner of err.errors) {
      if (inner instanceof ValidationErrors || inner instanceof ValidationError) {
        return safeErrorsData(inner);
      }
    }
    for (const inner of err.errors) {
      if (inner instanceof Error) {
        return safeErrorsData(inner);
      }
    }
    return {};
  }

  if (err instanceof ValidationErrors) {
    return resolveSafeErrorsData(err.errors);
  }

  if (err instanceof ValidationError) {
    return resolveSafeErrorItem(err) as Record<string, unknown>;
  }

  if (err instanceof Error) {
    if (err instanceof ValidationErrors) {
      return resolveSafeErrorsData(err.errors);
    }
    return {};
  }

  if (typeof err === "object" && err) {
    return resolveSafeErrorsData(err as Record<string, unknown>);
  }

  return {};
}

function resolveSafeErrorsData(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (isNestedError(value)) {
      result[key] = safeErrorsData(value);
    } else {
      result[key] = resolveSafeErrorItem(value);
    }
  }

  return result;
}

function isNestedError(err: unknown): boolean {
  if (err instanceof ValidationErrors) {
    return true;
  }
  if (!err || typeof err !== "object" || Array.isArray(err)) {
    return false;
  }
  if (err instanceof Error) {
    return false;
  }
  if (isSafeErrorItem(err) || isSafeErrorParamsResolver(err) || isSafeErrorResolver(err)) {
    return false;
  }
  return true;
}

function resolveSafeErrorItem(err: unknown): unknown {
  const data: Record<string, unknown> = {
    code: "validation_invalid_value",
    message: "Invalid value.",
  };

  if (err instanceof ValidationError) {
    data.code = err.code;
    data.message = sentenize(err.message);
  } else if (isSafeErrorItem(err)) {
    data.code = err.Code();
    data.message = sentenize(err.Error());
  }

  if (isSafeErrorParamsResolver(err)) {
    const params = err.Params();
    if (Object.keys(params ?? {}).length > 0) {
      data.params = params;
    }
  }

  if (isSafeErrorResolver(err)) {
    return err.Resolve(data);
  }

  return data;
}

function isSafeErrorItem(err: unknown): err is SafeErrorItem {
  return (
    Boolean(err) && typeof (err as SafeErrorItem).Code === "function" && typeof (err as SafeErrorItem).Error === "function"
  );
}

function isSafeErrorParamsResolver(err: unknown): err is SafeErrorParamsResolver {
  return Boolean(err) && typeof (err as SafeErrorParamsResolver).Params === "function";
}

function isSafeErrorResolver(err: unknown): err is SafeErrorResolver {
  return Boolean(err) && typeof (err as SafeErrorResolver).Resolve === "function";
}

function unwrapApiError(err: Error): ApiError | null {
  if (err instanceof ApiError) {
    return err;
  }
  const cause = (err as { cause?: unknown }).cause;
  if (cause instanceof Error) {
    return unwrapApiError(cause);
  }
  return null;
}

function errorsIs(err: Error, target: Error): boolean {
  if (err === target) {
    return true;
  }
  const cause = (err as { cause?: unknown }).cause;
  if (cause instanceof Error) {
    return errorsIs(cause, target);
  }
  return false;
}

function isFsNotExist(err: Error): boolean {
  return (err as { code?: string }).code === "ENOENT";
}

function isSqlNoRows(err: Error): boolean {
  return err.message === "sql: no rows in result set";
}

function statusText(status: number): string {
  switch (status) {
    case 400:
      return "Bad Request";
    case 401:
      return "Unauthorized";
    case 403:
      return "Forbidden";
    case 404:
      return "Not Found";
    case 429:
      return "Too Many Requests";
    case 500:
      return "Internal Server Error";
    default:
      return "";
  }
}
