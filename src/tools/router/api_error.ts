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
    const sentenized = message ? sentenize(message) : "";
    super(sentenized);
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
    if (this.rawData instanceof Error && target instanceof Error) {
      return this.rawData === target;
    }
    return target === this;
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
  if (err instanceof ApiError) {
    return err;
  }
  if (err instanceof NotFoundError) {
    return NewNotFoundError("", err);
  }
  if (err instanceof Error) {
    return NewBadRequestError("", err);
  }
  return NewBadRequestError("", null);
}

export function apiErrorResponse(event: { json: (status: number, body: unknown) => Response }, apiErr: ApiError): Response {
  return event.json(apiErr.Status, {
    status: apiErr.Status,
    message: apiErr.Message,
    data: apiErr.Data ?? {},
  });
}

function safeErrorsData(err: unknown): Record<string, unknown> {
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
    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(err.errors)) {
      if (value instanceof ValidationErrors) {
        data[key] = safeErrorsData(value);
        continue;
      }
      data[key] = resolveSafeErrorItem(value as Error);
    }
    return data;
  }

  if (err instanceof ValidationError) {
    return resolveSafeErrorItem(err);
  }

  if (err instanceof Error) {
    return { message: err.message };
  }

  return typeof err === "object" ? (err as Record<string, unknown>) : {};
}

function resolveSafeErrorItem(err: Error): Record<string, unknown> {
  const data: Record<string, unknown> = {
    code: "validation_invalid_value",
    message: "Invalid value.",
  };

  if (err instanceof ValidationError) {
    data.code = err.code;
    data.message = err.message;
    if (err.params && Object.keys(err.params).length > 0) {
      data.params = err.params;
    }
    return data;
  }

  if (err.message) {
    data.message = err.message;
  }

  return data;
}
