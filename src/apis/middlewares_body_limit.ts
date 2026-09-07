// Ported from pocketbase/apis/middlewares_body_limit.go

import type { App } from "../core/app.ts";
import type { RequestEvent } from "../core/event_request.ts";
import type { BoundHandler } from "../tools/hook/hook.ts";
import { type MaxBodySizeCalculator } from "../core/field.ts";
import { DefaultRateLimitMiddlewarePriority } from "./middlewares.ts";

export const DefaultMaxBodySize = 32 << 20;

export const DefaultBodyLimitMiddlewareId = "pbBodyLimit";
export const DefaultBodyLimitMiddlewarePriority = DefaultRateLimitMiddlewarePriority + 10;

// BodyLimit returns a middleware handler that changes the default request body size limit.
//
// If limitBytes <= 0, no limit is applied.
//
// Otherwise, if the request body size exceeds the configured limitBytes,
// it sends 413 error response.
export function BodyLimit(limitBytes: number): BoundHandler<RequestEvent> {
  return {
    Id: DefaultBodyLimitMiddlewareId,
    Priority: DefaultBodyLimitMiddlewarePriority,
    Func: async (event) => {
      const response = await applyBodyLimit(event, limitBytes);
      if (response) {
        return response;
      }
      return event.Next();
    },
  };
}

export function dynamicCollectionBodyLimit(collectionPathParam: string): BoundHandler<RequestEvent> {
  const param = collectionPathParam || "collection";

  return {
    Id: DefaultBodyLimitMiddlewareId,
    Priority: DefaultBodyLimitMiddlewarePriority,
    Func: async (event) => {
      const collectionId = event.params[param] ?? "";
      let collection: ReturnType<App["FindCachedCollectionByNameOrId"]> | null = null;
      try {
        collection = event.app.FindCachedCollectionByNameOrId(collectionId);
      } catch {
        collection = null;
      }
      if (!collection) {
        return event.json(404, {
          status: 404,
          message: "Missing or invalid collection context.",
          data: {},
        });
      }

      let limitBytes = DefaultMaxBodySize;
      if (!collection.isView()) {
        for (const field of collection.Fields) {
          if (isMaxBodySizeCalculator(field)) {
            limitBytes += field.CalculateMaxBodySize();
          }
        }
      }

      const response = await applyBodyLimit(event, limitBytes);
      if (response) {
        return response;
      }

      return event.Next();
    },
  };
}

export async function applyBodyLimit(event: RequestEvent, limitBytes: number): Promise<Response | null> {
  if (limitBytes <= 0) {
    return null;
  }

  const rawContentLength = event.request.headers.get("content-length");
  if (rawContentLength && rawContentLength !== "") {
    const contentLength = Number(rawContentLength);
    if (Number.isFinite(contentLength)) {
      if (contentLength > limitBytes) {
        return requestEntityTooLarge(event);
      }
    }
  }

  // Fallback for bodies without a reliable Content-Length header.
  if (!event.request.body) {
    return null;
  }

  // Bun streams provide whole chunks rather than Go's caller-sized read buffer.
  // Stop as soon as a chunk exceeds the limit; never consume the rest of the body.
  const reader = event.request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limitBytes) {
        await reader.cancel();
        return requestEntityTooLarge(event);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  // Preserve rereads by rebinding the successfully checked body.
  // eslint-disable-next-line unicorn/no-invalid-fetch-options -- an existing request body excludes GET/HEAD.
  event.request = new Request(event.request, { body: new Blob(chunks) });

  return null;
}

function requestEntityTooLarge(event: RequestEvent): Response {
  return event.json(413, {
    status: 413,
    message: "Request entity too large",
    data: {},
  });
}

function isMaxBodySizeCalculator(field: unknown): field is MaxBodySizeCalculator {
  return Boolean(field && typeof (field as MaxBodySizeCalculator).CalculateMaxBodySize === "function");
}
