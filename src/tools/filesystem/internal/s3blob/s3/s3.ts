// Ported from pocketbase/tools/filesystem/internal/s3blob/s3/* (merged for TS).
// Deviation: async APIs are used for HTTP I/O in Bun.
// Note: Bun provides native S3 bindings; we keep the HTTP+SigV4 path to match PocketBase behavior/tests.

import { createHmac, createHash } from "node:crypto";

const awsS3ServiceCode = "s3";
const awsSignAlgorithm = "AWS4-HMAC-SHA256";
const awsTerminationString = "aws4_request";
const metadataPrefix = "x-amz-meta-";

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

export class ResponseError extends Error {
  Code = "";
  Message = "";
  RequestId = "";
  Resource = "";
  Raw: Uint8Array = new Uint8Array();
  Status = 0;

  constructor() {
    super("S3ResponseError");
    this.name = "ResponseError";
  }

  override toString(): string {
    return this.Error();
  }

  Error(): string {
    let result = `${this.Status} `;
    result += this.Code !== "" ? this.Code : "S3ResponseError";

    if (this.Message !== "") {
      result += `: ${this.Message}`;
    }

    if (this.Raw.length > 0) {
      result += `\n(RAW: ${new TextDecoder().decode(this.Raw)})`;
    }

    return result;
  }

  toJSON(): Record<string, unknown> {
    return {
      code: this.Code,
      message: this.Message,
      requestId: this.RequestId,
      resource: this.Resource,
      status: this.Status,
    };
  }
}

export type ListParams = {
  ContinuationToken: string;
  Delimiter: string;
  Prefix: string;
  EncodingType: string;
  StartAfter: string;
  MaxKeys: number;
  FetchOwner: boolean;
};

export type ListObjectCommonPrefix = {
  Prefix: string;
};

export type ListObjectContent = {
  Key: string;
  LastModified: Date;
  Size: number;
  ETag: string;
};

export type ListObjectsResponse = {
  EncodingType: string;
  Name: string;
  Prefix: string;
  Delimiter: string;
  ContinuationToken: string;
  NextContinuationToken: string;
  StartAfter: string;
  CommonPrefixes: ListObjectCommonPrefix[];
  Contents: ListObjectContent[];
  KeyCount: number;
  MaxKeys: number;
  IsTruncated: boolean;
};

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

export type GetObjectResponse = HeadObjectResponse & {
  Body: Body;
};

export type CopyObjectResponse = {
  ETag: string;
  LastModified: Date;
  ChecksumType: string;
  ChecksumCRC32: string;
  ChecksumCRC32C: string;
  ChecksumCRC64NVME: string;
  ChecksumSHA1: string;
  ChecksumSHA256: string;
  toJSON?: () => Record<string, unknown>;
};

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
        const parsed = parseResponseErrorXml(new TextDecoder().decode(rawBody));
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
    const query = encodeListParams(params);
    const url = this.URL(`?${query}`);
    const req = newRequest(ctx, "GET", url, null);

    for (const fn of optReqFuncs) {
      if (fn) {
        fn(req);
      }
    }

    const resp = await this.SignAndSend(req);
    const body = new TextDecoder().decode(resp.body.readAll());
    resp.body.close();

    return parseListObjectsResponse(body);
  }

  async GetObject(
    ctx: AbortSignal | null,
    key: string,
    ...optReqFuncs: Array<(req: HttpRequest) => void>
  ): Promise<GetObjectResponse> {
    const req = newRequest(ctx, "GET", this.URL(key), null);

    for (const fn of optReqFuncs) {
      if (fn) {
        fn(req);
      }
    }

    const resp = await this.SignAndSend(req);
    const result = loadHeadResponse(resp.headers);
    return { ...result, Body: resp.body };
  }

  async HeadObject(
    ctx: AbortSignal | null,
    key: string,
    ...optReqFuncs: Array<(req: HttpRequest) => void>
  ): Promise<HeadObjectResponse> {
    const req = newRequest(ctx, "HEAD", this.URL(key), null);

    for (const fn of optReqFuncs) {
      if (fn) {
        fn(req);
      }
    }

    const resp = await this.SignAndSend(req);
    resp.body.close();

    return loadHeadResponse(resp.headers);
  }

  async CopyObject(
    ctx: AbortSignal | null,
    srcKey: string,
    dstKey: string,
    ...optReqFuncs: Array<(req: HttpRequest) => void>
  ): Promise<CopyObjectResponse> {
    const req = newRequest(ctx, "PUT", this.URL(dstKey), null);
    req.headers.set("x-amz-copy-source", encodeURIComponent(`${this.Bucket}/${srcKey.replace(/^\/+/, "")}`));

    for (const fn of optReqFuncs) {
      if (fn) {
        fn(req);
      }
    }

    const resp = await this.SignAndSend(req);
    const body = new TextDecoder().decode(resp.body.readAll());
    resp.body.close();

    return parseCopyObjectResponse(body);
  }

  async DeleteObject(ctx: AbortSignal | null, key: string, ...optReqFuncs: Array<(req: HttpRequest) => void>): Promise<void> {
    const req = newRequest(ctx, "DELETE", this.URL(key), null);

    for (const fn of optReqFuncs) {
      if (fn) {
        fn(req);
      }
    }

    const resp = await this.SignAndSend(req);
    resp.body.close();
  }

  private sign(req: HttpRequest): void {
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

export class Uploader {
  S3: S3 | null = null;
  Payload: Uint8Array | string | Body | null = null;
  Key = "";
  Metadata: Record<string, string> = {};
  MaxConcurrency = 0;
  MinPartSize = 0;

  private uploadId = "";
  private uploadedParts: Array<{ ETag: string; PartNumber: number }> = [];
  private used = false;

  async Upload(ctx: AbortSignal | null, ...optReqFuncs: Array<(req: HttpRequest) => void>): Promise<void> {
    if (this.used) {
      throw new Error("the Uploader has been already used");
    }

    this.validateAndNormalize();

    const payload = readAllPayload(this.Payload);
    if (payload.length < this.MinPartSize) {
      await this.singleUpload(ctx, payload, optReqFuncs);
      return;
    }

    await this.multipartInit(ctx, optReqFuncs);

    try {
      await this.multipartUpload(ctx, payload, optReqFuncs);
    } catch (err) {
      await this.multipartAbort(ctx, optReqFuncs);
      throw err;
    }

    try {
      await this.multipartComplete(ctx, optReqFuncs);
    } catch (err) {
      await this.multipartAbort(ctx, optReqFuncs);
      throw err;
    }
  }

  private validateAndNormalize(): void {
    if (!this.S3) {
      throw new Error("Uploader.S3 must be a non-empty and properly initialized S3 client instance");
    }
    if (!this.Key) {
      throw new Error("Uploader.Key is required");
    }
    if (!this.Payload) {
      throw new Error("Uploader.Payload must be a non-nill");
    }
    if (this.MaxConcurrency <= 0) {
      this.MaxConcurrency = 5;
    }
    if (this.MinPartSize <= 0) {
      this.MinPartSize = 6 << 20;
    }
  }

  private async singleUpload(
    ctx: AbortSignal | null,
    part: Uint8Array,
    optReqFuncs: Array<(req: HttpRequest) => void>,
  ): Promise<void> {
    if (this.used) {
      throw new Error("the Uploader has been already used");
    }

    const req = newRequest(ctx, "PUT", this.S3!.URL(this.Key), part);
    req.headers.set("Content-Length", String(part.length));

    for (const [key, value] of Object.entries(this.Metadata)) {
      req.headers.set(metadataPrefix + key, value);
    }

    for (const fn of optReqFuncs) {
      if (fn) {
        fn(req);
      }
    }

    const resp = await this.S3!.SignAndSend(req);
    resp.body.close();
  }

  private async multipartInit(ctx: AbortSignal | null, optReqFuncs: Array<(req: HttpRequest) => void>): Promise<void> {
    if (this.used) {
      throw new Error("the Uploader has been already used");
    }

    const req = newRequest(ctx, "POST", this.S3!.URL(`${this.Key}?uploads`), null);
    for (const [key, value] of Object.entries(this.Metadata)) {
      req.headers.set(metadataPrefix + key, value);
    }

    for (const fn of optReqFuncs) {
      if (fn) {
        fn(req);
      }
    }

    const resp = await this.S3!.SignAndSend(req);
    const body = new TextDecoder().decode(resp.body.readAll());
    resp.body.close();

    const uploadId = extractXmlTag(body, "UploadId");
    if (!uploadId) {
      throw new Error("missing UploadId in multipart init response");
    }

    this.uploadId = uploadId;
  }

  private async multipartAbort(ctx: AbortSignal | null, optReqFuncs: Array<(req: HttpRequest) => void>): Promise<void> {
    this.used = true;

    const query = new URLSearchParams({ uploadId: this.uploadId }).toString();
    const req = newRequest(ctx, "DELETE", this.S3!.URL(`${this.Key}?${query}`), null);

    for (const fn of optReqFuncs) {
      if (fn) {
        fn(req);
      }
    }

    const resp = await this.S3!.SignAndSend(req);
    resp.body.close();
  }

  private async multipartUpload(
    ctx: AbortSignal | null,
    payload: Uint8Array,
    optReqFuncs: Array<(req: HttpRequest) => void>,
  ): Promise<void> {
    let partNumber = 1;
    for (let offset = 0; offset < payload.length; offset += this.MinPartSize) {
      const part = payload.slice(offset, offset + this.MinPartSize);
      await this.uploadPart(ctx, part, partNumber, optReqFuncs);
      partNumber += 1;
    }
  }

  private async uploadPart(
    ctx: AbortSignal | null,
    part: Uint8Array,
    partNumber: number,
    optReqFuncs: Array<(req: HttpRequest) => void>,
  ): Promise<void> {
    const query = new URLSearchParams({ partNumber: String(partNumber), uploadId: this.uploadId }).toString();
    const req = newRequest(ctx, "PUT", this.S3!.URL(`${this.Key}?${query}`), part);
    req.headers.set("Content-Length", String(part.length));

    for (const fn of optReqFuncs) {
      if (fn) {
        fn(req);
      }
    }

    const resp = await this.S3!.SignAndSend(req);
    const etag = resp.headers.get("Etag") ?? resp.headers.get("ETag") ?? "";
    resp.body.close();

    this.uploadedParts.push({ ETag: etag, PartNumber: partNumber });
  }

  private async multipartComplete(ctx: AbortSignal | null, optReqFuncs: Array<(req: HttpRequest) => void>): Promise<void> {
    this.used = true;

    this.uploadedParts.sort((a, b) => a.PartNumber - b.PartNumber);

    const partsXml = this.uploadedParts
      .map((part) => `<Part><ETag>${part.ETag}</ETag><PartNumber>${part.PartNumber}</PartNumber></Part>`)
      .join("");
    const body = `<?xml version="1.0" encoding="UTF-8"?><CompleteMultipartUpload>${partsXml}</CompleteMultipartUpload>`;

    const query = new URLSearchParams({ uploadId: this.uploadId }).toString();
    const req = newRequest(ctx, "POST", this.S3!.URL(`${this.Key}?${query}`), new TextEncoder().encode(body));

    for (const fn of optReqFuncs) {
      if (fn) {
        fn(req);
      }
    }

    const resp = await this.S3!.SignAndSend(req);
    resp.body.close();
  }
}

function readAllPayload(payload: Uint8Array | string | Body | null): Uint8Array {
  if (!payload) {
    return new Uint8Array();
  }

  if (payload instanceof Uint8Array) {
    return payload;
  }

  if (typeof payload === "string") {
    return new TextEncoder().encode(payload);
  }

  if (typeof payload.readAll === "function") {
    return payload.readAll();
  }

  return new Uint8Array();
}

function newRequest(ctx: AbortSignal | null, method: string, url: string, body: Uint8Array | null): HttpRequest {
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

function encodeListParams(params: ListParams): string {
  const entries: Array<[string, string]> = [["list-type", "2"]];

  if (params.ContinuationToken) {
    entries.push(["continuation-token", params.ContinuationToken]);
  }
  if (params.Delimiter) {
    entries.push(["delimiter", params.Delimiter]);
  }
  if (params.Prefix) {
    entries.push(["prefix", params.Prefix]);
  }
  if (params.EncodingType) {
    entries.push(["encoding-type", params.EncodingType]);
  }
  if (params.FetchOwner) {
    entries.push(["fetch-owner", "true"]);
  }
  if (params.MaxKeys > 0) {
    entries.push(["max-keys", String(params.MaxKeys)]);
  }
  if (params.StartAfter) {
    entries.push(["start-after", params.StartAfter]);
  }

  entries.sort((a, b) => a[0].localeCompare(b[0]));
  const query = new URLSearchParams();
  for (const [key, value] of entries) {
    query.append(key, value);
  }
  return query.toString();
}

function parseResponseErrorXml(raw: string): ResponseError {
  const err = new ResponseError();
  err.Code = extractXmlTag(raw, "Code");
  err.Message = extractXmlTag(raw, "Message");
  err.RequestId = extractXmlTag(raw, "RequestId");
  err.Resource = extractXmlTag(raw, "Resource");
  return err;
}

function parseListObjectsResponse(raw: string): ListObjectsResponse {
  const topLevelRaw = raw
    .replace(new RegExp("<Contents>[\\s\\S]*?</Contents>", "g"), "")
    .replace(new RegExp("<CommonPrefixes>[\\s\\S]*?</CommonPrefixes>", "g"), "");
  const response: ListObjectsResponse = {
    EncodingType: extractXmlTag(topLevelRaw, "EncodingType"),
    Name: extractXmlTag(topLevelRaw, "Name"),
    Prefix: extractXmlTag(topLevelRaw, "Prefix"),
    Delimiter: extractXmlTag(topLevelRaw, "Delimiter"),
    ContinuationToken: extractXmlTag(topLevelRaw, "ContinuationToken"),
    NextContinuationToken: extractXmlTag(topLevelRaw, "NextContinuationToken"),
    StartAfter: extractXmlTag(topLevelRaw, "StartAfter"),
    CommonPrefixes: [],
    Contents: [],
    KeyCount: Number.parseInt(extractXmlTag(topLevelRaw, "KeyCount") || "0", 10),
    MaxKeys: Number.parseInt(extractXmlTag(topLevelRaw, "MaxKeys") || "0", 10),
    IsTruncated: extractXmlTag(topLevelRaw, "IsTruncated").toLowerCase() === "true",
  };

  const contents = extractXmlTags(raw, "Contents");
  for (const block of contents) {
    const key = extractXmlTag(block, "Key");
    const lastModified = extractXmlTag(block, "LastModified");
    const sizeRaw = extractXmlTag(block, "Size");
    const etag = extractXmlTag(block, "ETag");
    response.Contents.push({
      Key: key,
      LastModified: lastModified ? new Date(lastModified) : new Date(0),
      Size: sizeRaw ? Number.parseInt(sizeRaw, 10) : 0,
      ETag: etag,
    });
  }

  const prefixes = extractXmlTags(raw, "CommonPrefixes");
  for (const block of prefixes) {
    const prefix = extractXmlTag(block, "Prefix");
    response.CommonPrefixes.push({ Prefix: prefix });
  }

  return {
    ...response,
    toJSON() {
      return {
        encodingType: response.EncodingType,
        name: response.Name,
        prefix: response.Prefix,
        delimiter: response.Delimiter,
        continuationToken: response.ContinuationToken,
        nextContinuationToken: response.NextContinuationToken,
        startAfter: response.StartAfter,
        commonPrefixes: response.CommonPrefixes.map((prefix) => ({ prefix: prefix.Prefix })),
        contents: response.Contents.map((content) => ({
          key: content.Key,
          lastModified: formatTime(content.LastModified),
          size: content.Size,
          etag: content.ETag,
        })),
        keyCount: response.KeyCount,
        maxKeys: response.MaxKeys,
        isTruncated: response.IsTruncated,
      };
    },
  } as ListObjectsResponse;
}

function parseCopyObjectResponse(raw: string): CopyObjectResponse {
  return {
    ETag: extractXmlTag(raw, "ETag"),
    LastModified: new Date(extractXmlTag(raw, "LastModified") || 0),
    ChecksumType: extractXmlTag(raw, "ChecksumType"),
    ChecksumCRC32: extractXmlTag(raw, "ChecksumCRC32"),
    ChecksumCRC32C: extractXmlTag(raw, "ChecksumCRC32C"),
    ChecksumCRC64NVME: extractXmlTag(raw, "ChecksumCRC64NVME"),
    ChecksumSHA1: extractXmlTag(raw, "ChecksumSHA1"),
    ChecksumSHA256: extractXmlTag(raw, "ChecksumSHA256"),
    toJSON() {
      return {
        etag: this.ETag,
        lastModified: formatTime(this.LastModified),
        checksumType: this.ChecksumType,
        checksumCRC32: this.ChecksumCRC32,
        checksumCRC32C: this.ChecksumCRC32C,
        checksumCRC64NVME: this.ChecksumCRC64NVME,
        checksumSHA1: this.ChecksumSHA1,
        checksumSHA256: this.ChecksumSHA256,
      };
    },
  };
}

function loadHeadResponse(headers: Headers): HeadObjectResponse {
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

function extractXmlTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`);
  const match = regex.exec(xml);
  return match?.[1]?.trim() ?? "";
}

function extractXmlTags(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g");
  const matches: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    matches.push(match[1] ?? "");
  }
  return matches;
}

function formatTime(value: Date): string {
  return value.toISOString().replace(".000Z", "Z");
}
