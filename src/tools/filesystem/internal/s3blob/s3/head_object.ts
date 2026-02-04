// Ported from pocketbase/tools/filesystem/internal/s3blob/s3/head_object.go

import type { HttpRequest, S3 } from "./s3.ts";
import { extractMetadata, newRequest } from "./s3.ts";

export type HeadObjectResponse = {
  Metadata: Record<string, string>;
  LastModified: Date;
  CacheControl: string;
  ContentDisposition: string;
  ContentEncoding: string;
  ContentLanguage: string;
  ContentType: string;
  ContentRange: string;
  ETag: string;
  ContentLength: number;
  toJSON?: () => Record<string, unknown>;
};

export async function headObject(
  s3: S3,
  ctx: AbortSignal | null,
  key: string,
  ...optReqFuncs: Array<(req: HttpRequest) => void>
): Promise<HeadObjectResponse> {
  const req = newRequest(ctx, "HEAD", s3.URL(key), null);

  for (const fn of optReqFuncs) {
    if (fn) {
      fn(req);
    }
  }

  const resp = await s3.SignAndSend(req);
  resp.body.close();

  return loadHeadResponse(resp.headers);
}

export function loadHeadResponse(headers: Headers): HeadObjectResponse {
  const lastModifiedRaw = headers.get("Last-Modified") ?? "";
  const lastModified = lastModifiedRaw ? new Date(lastModifiedRaw) : new Date(0);

  const contentLength = Number.parseInt(headers.get("Content-Length") ?? "0", 10) || 0;

  const result: HeadObjectResponse = {
    Metadata: extractMetadata(headers),
    LastModified: lastModified,
    CacheControl: headers.get("Cache-Control") ?? "",
    ContentDisposition: headers.get("Content-Disposition") ?? "",
    ContentEncoding: headers.get("Content-Encoding") ?? "",
    ContentLanguage: headers.get("Content-Language") ?? "",
    ContentType: headers.get("Content-Type") ?? "",
    ContentRange: headers.get("Content-Range") ?? "",
    ETag: headers.get("ETag") ?? "",
    ContentLength: contentLength,
    toJSON() {
      return {
        metadata: this.Metadata,
        lastModified: formatTime(this.LastModified),
        cacheControl: this.CacheControl,
        contentDisposition: this.ContentDisposition,
        contentEncoding: this.ContentEncoding,
        contentLanguage: this.ContentLanguage,
        contentType: this.ContentType,
        contentRange: this.ContentRange,
        etag: this.ETag,
        contentLength: this.ContentLength,
      };
    },
  };

  return result;
}

function formatTime(value: Date): string {
  return value.toISOString().replace(".000Z", "Z");
}
