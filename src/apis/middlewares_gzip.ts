// Ported from pocketbase/apis/middlewares_gzip.go

import { promisify } from "node:util";
import { gzip as gzipCallback } from "node:zlib";
import type { RequestEvent } from "../core/event_request.ts";
import type { Handler } from "../tools/hook/hook.ts";

export const DefaultGzipMiddlewareId = "pbGzip";

export type GzipConfig = {
  Level?: number;
  MinLength?: number;
};

const gzipAsync = promisify(gzipCallback);

export function Gzip(): Handler<RequestEvent> {
  return GzipWithConfig({});
}

export function GzipWithConfig(config: GzipConfig): Handler<RequestEvent> {
  const resolved: GzipConfig = { ...config };

  let level = resolved.Level ?? 0;
  if (level === 0) {
    level = -1;
  }
  if (level < -1 || level > 9) {
    throw new Error("invalid gzip level");
  }

  let minLength = resolved.MinLength ?? 0;
  if (minLength < 0) {
    minLength = 0;
  }

  return {
    Id: DefaultGzipMiddlewareId,
    Func: async (event) => {
      event.responseHeaders.append("Vary", "Accept-Encoding");

      const acceptEncoding = event.request.headers.get("Accept-Encoding") ?? "";
      if (!acceptEncoding.includes("gzip")) {
        return event.Next();
      }

      const result = await event.Next();
      if (!(result instanceof Response)) {
        return result;
      }

      const body = new Uint8Array(await result.arrayBuffer());
      const headers = new Headers(result.headers);
      headers.append("Vary", "Accept-Encoding");

      if (body.length === 0 || body.length < minLength) {
        return new Response(body, { status: result.status, headers });
      }

      const compressed = await gzipAsync(body, { level: level as -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 });
      headers.set("Content-Encoding", "gzip");
      headers.delete("Content-Length");

      return new Response(compressed, { status: result.status, headers });
    },
  };
}
