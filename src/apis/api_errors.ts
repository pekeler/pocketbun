// PocketBun-only: shared API error helpers to keep JSON response shapes consistent.

import type { RequestEvent } from "../core/event_request.ts";
import { ValidationError, ValidationErrors } from "../internal/compat/validation.ts";

export function noContent(event: RequestEvent, status = 204): Response {
  return new Response(null, {
    status,
    headers: event.responseHeaders,
  });
}

export function badRequest(event: RequestEvent, message: string, errData: unknown = null): Response {
  return event.json(400, {
    status: 400,
    message: message || "Something went wrong while processing your request.",
    data: safeErrorsData(errData),
  });
}

export function unauthorized(event: RequestEvent, message: string): Response {
  return event.json(401, {
    status: 401,
    message,
    data: {},
  });
}

export function forbidden(event: RequestEvent, message: string): Response {
  return event.json(403, {
    status: 403,
    message,
    data: {},
  });
}

export function tooManyRequests(event: RequestEvent, message: string): Response {
  return event.json(429, {
    status: 429,
    message: message || "Too many requests.",
    data: {},
  });
}

export function internalServerError(event: RequestEvent, message: string, err: unknown = null): Response {
  const data = err && err instanceof Error ? { message: err.message } : {};
  return event.json(500, {
    status: 500,
    message: message || "Something went wrong while processing your request.",
    data,
  });
}

export function safeErrorsData(err: unknown): Record<string, unknown> {
  if (!err) {
    return {};
  }

  if (err instanceof ValidationErrors) {
    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(err.errors)) {
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
