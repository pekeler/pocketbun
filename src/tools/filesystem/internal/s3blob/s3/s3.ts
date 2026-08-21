// Ported from pocketbase/tools/filesystem/internal/s3blob/s3/s3.go
// Deviation: async APIs are used for HTTP I/O in Bun.
// Note: Bun provides native S3 bindings; we keep the HTTP+SigV4 path to match PocketBase behavior/tests.
// A 2026-04-12 migration spike against Bun 1.3.12 showed that Bun's native S3
// still can't replace this adapter without compatibility regressions:
// - write-side user metadata support is still tracked in oven-sh/bun#17339
// - stat()/HEAD still doesn't expose response headers or x-amz-meta values
//   (tracked in oven-sh/bun#19301)
// - broader custom S3 header/query support is still tracked in oven-sh/bun#16048
// PocketBun relies on those features for richer blob attributes and for storing
// `metadataOriginalName` in `src/tools/filesystem/filesystem.ts`.
// The same spike also showed that `client.write(dst, client.file(src))` performs
// a GET+PUT copy rather than a native server-side object copy, so switching to
// Bun's S3 API would still require non-trivial compatibility glue.

import { createHmac, createHash } from "node:crypto";
import { copyObject, type CopyObjectResponse } from "./copy_object.ts";
import { deleteObject } from "./delete_object.ts";
import { parseResponseErrorXml, ResponseError } from "./error.ts";
import { getObject, type GetObjectResponse } from "./get_object.ts";
import { headObject, type HeadObjectResponse } from "./head_object.ts";
import { listObjects, type ListObjectsResponse, type ListParams } from "./list_objects.ts";

const awsS3ServiceCode = "s3";
const awsSignAlgorithm = "AWS4-HMAC-SHA256";
const awsTerminationString = "aws4_request";
export const metadataPrefix = "x-amz-meta-";

export type HttpRequest = {
  method: string;
  url: string;
  headers: Headers;
  body: Uint8Array | null;
  signal?: AbortSignal;
};

export type HttpResponse = {
  status: number;
  headers: Headers;
  body: Body;
  request?: HttpRequest;
};

export interface Body {
  read(size?: number): Uint8Array | null;
  readAll(): Uint8Array;
  close(): void;
}

export class BytesBody implements Body {
  #buffer: Uint8Array;
  #offset = 0;

  constructor(buffer: Uint8Array) {
    this.#buffer = buffer;
  }

  read(size?: number): Uint8Array | null {
    if (this.#offset >= this.#buffer.length) {
      return null;
    }
    const end = size && size > 0 ? Math.min(this.#buffer.length, this.#offset + size) : this.#buffer.length;
    const chunk = this.#buffer.slice(this.#offset, end);
    this.#offset = end;
    return chunk;
  }

  readAll(): Uint8Array {
    return this.read() ?? new Uint8Array();
  }

  close(): void {
    this.#offset = this.#buffer.length;
  }
}

export interface HTTPClient {
  Do(req: HttpRequest): Promise<HttpResponse>;
}

export class S3 {
  Client: HTTPClient | null = null;
  Bucket = "";
  Region = "";
  Endpoint = "";
  AccessKey = "";
  SecretKey = "";
  UsePathStyle = false;

  URL(path: string): string {
    let scheme = "https";
    let endpoint = this.Endpoint.replace(/\/+$/, "");
    if (endpoint.startsWith("https://")) {
      endpoint = endpoint.slice("https://".length);
    } else if (endpoint.startsWith("http://")) {
      endpoint = endpoint.slice("http://".length);
      scheme = "http";
    }

    let rawQuery = "";
    let rawFragment = "";

    let basePath = path;
    const hashIndex = basePath.indexOf("#");
    if (hashIndex >= 0) {
      rawFragment = basePath.slice(hashIndex + 1);
      basePath = basePath.slice(0, hashIndex);
    }
    const queryIndex = basePath.indexOf("?");
    if (queryIndex >= 0) {
      rawQuery = basePath.slice(queryIndex + 1);
      basePath = basePath.slice(0, queryIndex);
    }

    let parsedPath = basePath;
    if (basePath.startsWith("http://") || basePath.startsWith("https://")) {
      try {
        parsedPath = new URL(basePath).pathname;
      } catch {
        parsedPath = basePath;
      }
    }
    try {
      parsedPath = decodeURIComponent(parsedPath);
    } catch {
      // keep as is
    }

    let finalPath = escapePath(parsedPath);
    if (rawQuery !== "") {
      finalPath += `?${rawQuery}`;
    }
    if (rawFragment !== "") {
      finalPath += `#${rawFragment}`;
    }

    finalPath = finalPath.replace(/^\/+/, "");

    if (this.UsePathStyle) {
      return `${scheme}://${endpoint}/${this.Bucket}/${finalPath}`;
    }

    return `${scheme}://${this.Bucket}.${endpoint}/${finalPath}`;
  }

  async SignAndSend(req: HttpRequest): Promise<HttpResponse> {
    try {
      req.url = new URL(req.url).toString();
    } catch {
      // keep as is
    }

    this.sign(req);

    const client = this.Client ?? defaultHttpClient;
    const resp = await client.Do(req);

    if (resp.status >= 400) {
      const rawBody = resp.body.readAll();
      resp.body.close();

      const err = new ResponseError();
      err.Status = resp.status;
      err.Raw = rawBody;
      if (rawBody.length > 0) {
        let parsed: ReturnType<typeof parseResponseErrorXml>;
        try {
          parsed = parseResponseErrorXml(new TextDecoder().decode(rawBody));
        } catch (parseError) {
          // Match Go's errors.Join(parseErr, responseErr): retain both the XML
          // failure and the response status/raw body for downstream inspection.
          throw new AggregateError([parseError, err]);
        }
        err.Code = parsed.Code;
        err.Message = parsed.Message;
        err.RequestId = parsed.RequestId;
        err.Resource = parsed.Resource;
      }

      throw err;
    }

    return resp;
  }

  async ListObjects(
    ctx: AbortSignal | null,
    params: ListParams,
    ...optReqFuncs: Array<(req: HttpRequest) => void>
  ): Promise<ListObjectsResponse> {
    return listObjects(this, ctx, params, ...optReqFuncs);
  }

  async GetObject(
    ctx: AbortSignal | null,
    key: string,
    ...optReqFuncs: Array<(req: HttpRequest) => void>
  ): Promise<GetObjectResponse> {
    return getObject(this, ctx, key, ...optReqFuncs);
  }

  async HeadObject(
    ctx: AbortSignal | null,
    key: string,
    ...optReqFuncs: Array<(req: HttpRequest) => void>
  ): Promise<HeadObjectResponse> {
    return headObject(this, ctx, key, ...optReqFuncs);
  }

  async CopyObject(
    ctx: AbortSignal | null,
    srcKey: string,
    dstKey: string,
    ...optReqFuncs: Array<(req: HttpRequest) => void>
  ): Promise<CopyObjectResponse> {
    return copyObject(this, ctx, srcKey, dstKey, ...optReqFuncs);
  }

  async DeleteObject(ctx: AbortSignal | null, key: string, ...optReqFuncs: Array<(req: HttpRequest) => void>): Promise<void> {
    return deleteObject(this, ctx, key, ...optReqFuncs);
  }

  private sign(req: HttpRequest): void {
    // Explicitly set Accept-Encoding to avoid transparent decompression
    // and Content-Length zeroing (https://github.com/pocketbase/pocketbase/issues/7523).
    if (!req.headers.get("Accept-Encoding")) {
      req.headers.set("Accept-Encoding", "identity");
    }

    if (!req.headers.get("x-amz-content-sha256")) {
      req.headers.set("x-amz-content-sha256", "UNSIGNED-PAYLOAD");
    }

    let reqDateTime = req.headers.get("x-amz-date") ?? "";
    if (!reqDateTime) {
      reqDateTime = formatDateTime(new Date());
      req.headers.set("x-amz-date", reqDateTime);
    }

    const url = new URL(req.url);
    req.headers.set("host", url.host);

    const date = reqDateTime.slice(0, 8);

    const { canonicalHeaders, signedHeaders } = canonicalAndSignedHeaders(req.headers);

    let canonicalPath = url.pathname;
    try {
      canonicalPath = decodeURIComponent(canonicalPath);
    } catch {
      // keep as-is
    }

    const canonicalParts = [
      req.method,
      escapePath(canonicalPath),
      escapeQuery(url.searchParams),
      canonicalHeaders,
      signedHeaders,
      req.headers.get("x-amz-content-sha256") ?? "",
    ];

    const hashedCanonicalRequest = sha256Hex(canonicalParts.join("\n"));

    const scope = [date, this.Region, awsS3ServiceCode, awsTerminationString].join("/");

    const stringToSign = [awsSignAlgorithm, reqDateTime, scope, hashedCanonicalRequest].join("\n");

    const signingKey = getSignatureKey(this.SecretKey, date, this.Region, awsS3ServiceCode);
    const signature = hmacHex(signingKey, stringToSign);

    const authorization = `${awsSignAlgorithm} Credential=${this.AccessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    req.headers.set("Authorization", authorization);
  }
}

export function newRequest(ctx: AbortSignal | null, method: string, url: string, body: Uint8Array | null): HttpRequest {
  return {
    method,
    url,
    headers: new Headers(),
    body,
    signal: ctx ?? undefined,
  };
}

const defaultHttpClient: HTTPClient = {
  async Do(req: HttpRequest): Promise<HttpResponse> {
    const res = await fetch(req.url, {
      method: req.method,
      headers: req.headers,
      body: req.body ?? undefined,
      signal: req.signal,
    });
    const body = new Uint8Array(await res.arrayBuffer());
    return {
      status: res.status,
      headers: new Headers(res.headers),
      body: new BytesBody(body),
      request: req,
    };
  },
};

function canonicalAndSignedHeaders(headers: Headers): { canonicalHeaders: string; signedHeaders: string } {
  const canonical: Record<string, string> = {};
  const signed: string[] = [];

  for (const [key, value] of headers.entries()) {
    const normalizedKey = key.toLowerCase();
    if (normalizedKey !== "host" && normalizedKey !== "content-type" && !normalizedKey.startsWith("x-amz-")) {
      continue;
    }
    signed.push(normalizedKey);

    const normalizedValue = value
      .split(",")
      .map((part) => part.trim().replace(/  /g, " "))
      .join(",");

    canonical[normalizedKey] = normalizedValue;
  }

  signed.sort();

  let sortedCanonical = "";
  for (const key of signed) {
    sortedCanonical += `${key}:${canonical[key] ?? ""}\n`;
  }

  return { canonicalHeaders: sortedCanonical, signedHeaders: signed.join(";") };
}

export function extractMetadata(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of headers.entries()) {
    const lower = key.toLowerCase();
    if (!lower.startsWith(metadataPrefix)) {
      continue;
    }
    const metaKey = lower.slice(metadataPrefix.length);
    result[metaKey] = value;
  }
  return result;
}

export function escapeQuery(values: URLSearchParams): string {
  const keys = Array.from(new Set(Array.from(values.keys()))).sort();
  const parts: string[] = [];

  for (const key of keys) {
    const escapedKey = escape(key);
    const vals = values.getAll(key);
    for (const value of vals) {
      parts.push(`${escapedKey}=${escape(value)}`);
    }
  }

  return parts.join("&");
}

export function escapePath(path: string): string {
  const parts = path.split("/");
  for (let i = 0; i < parts.length; i += 1) {
    parts[i] = escape(parts[i] ?? "");
  }
  return parts.join("/");
}

const upperhex = "0123456789ABCDEF";

function escape(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let hexCount = 0;
  for (const byte of bytes) {
    if (shouldEscape(byte)) {
      hexCount += 1;
    }
  }

  if (hexCount === 0) {
    return input;
  }

  let result = "";
  for (const byte of bytes) {
    if (shouldEscape(byte)) {
      result += "%" + upperhex[byte >> 4] + upperhex[byte & 15];
    } else {
      result += String.fromCharCode(byte);
    }
  }

  return result;
}

function shouldEscape(byte: number): boolean {
  const isUnreserved =
    (byte >= 0x41 && byte <= 0x5a) ||
    (byte >= 0x61 && byte <= 0x7a) ||
    (byte >= 0x30 && byte <= 0x39) ||
    byte === 0x2d ||
    byte === 0x2e ||
    byte === 0x5f ||
    byte === 0x7e;

  return !isUnreserved;
}

function formatDateTime(value: Date): string {
  const year = value.getUTCFullYear().toString().padStart(4, "0");
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  const hours = String(value.getUTCHours()).padStart(2, "0");
  const minutes = String(value.getUTCMinutes()).padStart(2, "0");
  const seconds = String(value.getUTCSeconds()).padStart(2, "0");
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: Uint8Array, value: string): Uint8Array {
  return createHmac("sha256", key).update(value).digest();
}

function hmacHex(key: Uint8Array, value: string): string {
  return createHmac("sha256", key).update(value).digest("hex");
}

function getSignatureKey(secret: string, date: string, region: string, service: string): Uint8Array {
  const kDate = hmac(new TextEncoder().encode(`AWS4${secret}`), date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, awsTerminationString);
}

export type { CopyObjectResponse } from "./copy_object.ts";
export { ResponseError } from "./error.ts";
export type { GetObjectResponse } from "./get_object.ts";
export type { HeadObjectResponse } from "./head_object.ts";
export type { ListObjectCommonPrefix, ListObjectContent, ListObjectsResponse, ListParams } from "./list_objects.ts";
export { Uploader } from "./uploader.ts";
