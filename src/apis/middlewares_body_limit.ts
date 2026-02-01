// Ported from pocketbase/apis/middlewares_body_limit.go

import type { RequestEvent } from "../core/event_request.ts";
import type { Handler } from "../tools/hook/hook.ts";
import { type MaxBodySizeCalculator } from "../core/field.ts";
import { DefaultRateLimitMiddlewarePriority } from "./middlewares.ts";

export const DefaultMaxBodySize = 32 << 20;

export const DefaultBodyLimitMiddlewareId = "pbBodyLimit";
export const DefaultBodyLimitMiddlewarePriority = DefaultRateLimitMiddlewarePriority + 10;

export function BodyLimit(limitBytes: number): Handler<RequestEvent> {
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

export function dynamicCollectionBodyLimit(collectionPathParam: string): Handler<RequestEvent> {
  const param = collectionPathParam || "collection";

  return {
    Id: DefaultBodyLimitMiddlewareId,
    Priority: DefaultBodyLimitMiddlewarePriority,
    Func: async (event) => {
      const collectionId = event.params[param] ?? "";
      const collection = event.app.FindCachedCollectionByNameOrId(collectionId);
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

  const contentLength = Number(event.request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > limitBytes) {
    return requestEntityTooLarge(event);
  }

  if (!event.request.body) {
    return null;
  }

  const clone = event.request.clone();
  const buffer = await clone.arrayBuffer();
  if (buffer.byteLength > limitBytes) {
    return requestEntityTooLarge(event);
  }

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
