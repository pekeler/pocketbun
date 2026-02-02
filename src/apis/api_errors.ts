// PocketBun-only: shared API error helpers to keep JSON response shapes consistent.

import type { RequestEvent } from "../core/event_request.ts";
import { safeErrorsData } from "../tools/router/api_error.ts";

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
    message: message || "Too Many Requests.",
    data: {},
  });
}

export function notFound(event: RequestEvent, message: string): Response {
  return event.json(404, {
    status: 404,
    message: message || "The requested resource wasn't found.",
    data: {},
  });
}

export function internalServerError(event: RequestEvent, message: string, err: unknown = null): Response {
  const data = safeErrorsData(err);
  return event.json(500, {
    status: 500,
    message: message || "Something went wrong while processing your request.",
    data,
  });
}
