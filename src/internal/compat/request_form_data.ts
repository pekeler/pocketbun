// PocketBun-only: multipart parsing helper for Bun Request objects.
//
// Why this file exists:
// Bun's native Request.formData() currently materializes uploaded files as
// byte-backed Blobs, which causes excessive memory usage on large uploads.
// PocketBun needs a request-scoped multipart parser that can spool file parts
// to temp files and expose a lightweight FormData-like interface.

import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { File as FilesystemFile, NewFileFromBytes, NewFileFromPathWithOriginalName } from "../../tools/filesystem/file.ts";

export type MultipartParseOptions = {
  // If true, preserve reread semantics. For native Request objects this is
  // handled by request-scoped caching instead of Request.clone().
  preserveBody?: boolean;
};

type ParsedFormData = {
  get: (name: string) => unknown;
  getAll: (name: string) => unknown[];
  entries: () => IterableIterator<[string, unknown]>;
  forEach: (cb: (value: unknown, key: string) => void) => void;
  [Symbol.iterator]: () => IterableIterator<[string, unknown]>;
};

type MultipartRequestLike = {
  body?: ReadableStream<Uint8Array> | null;
  headers?: { get: (name: string) => string | null };
  formData: () => Promise<unknown>;
  clone?: () => MultipartRequestLike;
};

type MultipartPartHeaders = {
  fieldName: string;
  fileName: string | null;
  contentType: string;
};

type MultipartPartWriter = {
  write: (chunk: Uint8Array) => number | Promise<number>;
  end: (error?: Error) => number | Promise<number>;
};

type PendingMultipartPart = MultipartPartHeaders & {
  chunks: Uint8Array[];
  size: number;
  path: string | null;
  writer: MultipartPartWriter | null;
};

type MultipartBodyChunkResult = {
  finished: boolean;
  remainder: Uint8Array;
  tail: Uint8Array;
};

const multipartCache = new WeakMap<Request, StoredMultipartFormData>();
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const emptyBytes = new Uint8Array(0);
const headerSeparatorBytes = encoder.encode("\r\n\r\n");
const formDataDecodeError = "Can't decode form data from body because of incorrect MIME type/boundary";
const multipartPartWriterHighWaterMark = 64 * 1024;

export class StoredMultipartFile {
  readonly name: string;
  readonly size: number;
  readonly type: string;
  readonly path: string;

  constructor(path: string, name: string, size: number, type: string) {
    this.path = path;
    this.name = name;
    this.size = size;
    this.type = type;
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    return await Bun.file(this.path).arrayBuffer();
  }

  async bytes(): Promise<Uint8Array> {
    return new Uint8Array(await this.arrayBuffer());
  }

  stream(): ReadableStream<Uint8Array> {
    return Bun.file(this.path).stream();
  }

  async text(): Promise<string> {
    return await Bun.file(this.path).text();
  }

  async exists(): Promise<boolean> {
    return await Bun.file(this.path).exists();
  }

  async stat(): Promise<import("node:fs").Stats> {
    return await Bun.file(this.path).stat();
  }
}

class StoredMultipartFormData implements ParsedFormData {
  readonly #entriesList: Array<[string, string | StoredMultipartFile]> = [];
  #tempDir: string | null;
  #cleaned = false;

  constructor(tempDir: string | null = null) {
    this.#tempDir = tempDir;
  }

  append(key: string, value: string | StoredMultipartFile): void {
    this.#entriesList.push([key, value]);
  }

  setTempDir(tempDir: string): void {
    this.#tempDir = tempDir;
  }

  get(name: string): unknown {
    for (const [key, value] of this.#entriesList) {
      if (key === name) {
        return value;
      }
    }
    return null;
  }

  getAll(name: string): unknown[] {
    const result: unknown[] = [];
    for (const [key, value] of this.#entriesList) {
      if (key === name) {
        result.push(value);
      }
    }
    return result;
  }

  *entries(): IterableIterator<[string, unknown]> {
    for (const [key, value] of this.#entriesList) {
      yield [key, value];
    }
  }

  forEach(cb: (value: unknown, key: string) => void): void {
    for (const [key, value] of this.#entriesList) {
      cb(value, key);
    }
  }

  [Symbol.iterator](): IterableIterator<[string, unknown]> {
    return this.entries();
  }

  async cleanup(): Promise<void> {
    if (this.#cleaned) {
      return;
    }
    this.#cleaned = true;
    if (this.#tempDir) {
      await rm(this.#tempDir, { recursive: true, force: true });
    }
  }
}

export async function parseMultipartFormData(
  request: MultipartRequestLike,
  options: MultipartParseOptions = {},
): Promise<ParsedFormData> {
  if (request instanceof Request) {
    const cached = multipartCache.get(request);
    if (cached) {
      return cached;
    }
    const parsed = await parseMultipartRequest(request);
    multipartCache.set(request, parsed);
    return parsed;
  }

  const parserRequest = options.preserveBody ? (cloneRequestIfPossible(request) ?? request) : request;
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- fallback path for non-Request test doubles.
  return (await parserRequest.formData()) as ParsedFormData;
}

export async function cleanupParsedMultipartFormData(request: Request): Promise<void> {
  const cached = multipartCache.get(request);
  if (!cached) {
    return;
  }
  multipartCache.delete(request);
  await cached.cleanup();
}

export async function multipartValueToFilesystemFile(value: unknown): Promise<FilesystemFile | null> {
  if (value instanceof StoredMultipartFile) {
    return NewFileFromPathWithOriginalName(value.path, value.name);
  }

  const fileLike = value as { arrayBuffer?: () => Promise<ArrayBuffer>; name?: string } | null;
  if (!fileLike || typeof fileLike.arrayBuffer !== "function") {
    return null;
  }

  const buffer = new Uint8Array(await fileLike.arrayBuffer());
  const name = typeof fileLike.name === "string" ? fileLike.name : "file";
  return NewFileFromBytes(buffer, name);
}

async function parseMultipartRequest(request: Request): Promise<StoredMultipartFormData> {
  const boundary = extractMultipartBoundary(request.headers.get("content-type"));
  if (!boundary) {
    throw new TypeError(formDataDecodeError);
  }

  if (!request.body) {
    return new StoredMultipartFormData(null);
  }

  const startBoundaryBytes = encoder.encode(`--${boundary}`);
  const delimiterBytes = encoder.encode(`\r\n--${boundary}`);
  const form = new StoredMultipartFormData(null);
  const reader = request.body.getReader();

  let tempDir: string | null = null;
  let buffer: Uint8Array<ArrayBufferLike> = emptyBytes;
  let bodyTail: Uint8Array<ArrayBufferLike> = emptyBytes;
  let state: "start" | "headers" | "body" | "afterBoundary" | "done" = "start";
  let part: PendingMultipartPart | null = null;

  const ensureTempDir = async (): Promise<string> => {
    if (tempDir) {
      return tempDir;
    }
    tempDir = await mkdtemp(join(tmpdir(), "pocketbun-multipart-"));
    return tempDir;
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (value && value.length > 0) {
        if (state === "body" && buffer.length === 0) {
          if (!part) {
            throw new TypeError(formDataDecodeError);
          }
          const bodyResult = await consumeMultipartBodyChunk(part, bodyTail, value, delimiterBytes);
          bodyTail = bodyResult.tail;
          if (bodyResult.finished) {
            await finishMultipartPart(part, form);
            part = null;
            buffer = bodyResult.remainder;
            state = "afterBoundary";
          }
        } else {
          buffer = concatBytes(buffer, value);
        }
      }

      processBuffer: while (true) {
        switch (state) {
          case "start": {
            const boundaryIndex = indexOfBytes(buffer, startBoundaryBytes);
            if (boundaryIndex < 0) {
              buffer = keepTrailingBytes(buffer, startBoundaryBytes.length + 4);
              break processBuffer;
            }
            if (boundaryIndex > 0) {
              buffer = buffer.subarray(boundaryIndex);
            }
            if (buffer.length < startBoundaryBytes.length + 2) {
              break processBuffer;
            }
            buffer = buffer.subarray(startBoundaryBytes.length);
            state = "afterBoundary";
            continue;
          }

          case "headers": {
            const headersEnd = indexOfBytes(buffer, headerSeparatorBytes);
            if (headersEnd < 0) {
              break processBuffer;
            }
            part = await startMultipartPart(buffer.subarray(0, headersEnd), ensureTempDir);
            buffer = buffer.subarray(headersEnd + headerSeparatorBytes.length);
            state = "body";
            continue;
          }

          case "body": {
            if (!part) {
              throw new TypeError(formDataDecodeError);
            }
            if (buffer.length === 0) {
              break processBuffer;
            }
            const bodyResult = await consumeMultipartBodyChunk(part, bodyTail, buffer, delimiterBytes);
            bodyTail = bodyResult.tail;
            buffer = bodyResult.remainder;
            if (!bodyResult.finished) {
              break processBuffer;
            }
            await finishMultipartPart(part, form);
            part = null;
            state = "afterBoundary";
            continue;
          }

          case "afterBoundary": {
            if (buffer.length < 2) {
              break processBuffer;
            }
            if (buffer[0] === 45 && buffer[1] === 45) {
              buffer = buffer.subarray(2);
              state = "done";
              continue;
            }
            if (buffer[0] === 13 && buffer[1] === 10) {
              buffer = buffer.subarray(2);
              state = "headers";
              continue;
            }
            throw new TypeError(formDataDecodeError);
          }

          case "done":
            buffer = emptyBytes;
            bodyTail = emptyBytes;
            break processBuffer;
        }
      }

      if (done) {
        break;
      }
    }

    if (state !== "done") {
      throw new TypeError(formDataDecodeError);
    }
  } catch (error) {
    if (part?.writer) {
      await closeMultipartPartWriter(part.writer).catch(() => {});
    }
    await form.cleanup();
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
    throw error;
  } finally {
    reader.releaseLock();
  }

  if (tempDir) {
    form.setTempDir(tempDir);
  }
  return form;
}

async function startMultipartPart(rawHeaders: Uint8Array, ensureTempDir: () => Promise<string>): Promise<PendingMultipartPart> {
  const headers = parseMultipartPartHeaders(decoder.decode(rawHeaders));
  if (headers.fileName === null) {
    return {
      ...headers,
      chunks: [],
      size: 0,
      path: null,
      writer: null,
    };
  }

  const tempDir = await ensureTempDir();
  const path = join(tempDir, randomUUID());
  return {
    ...headers,
    chunks: [],
    size: 0,
    path,
    // PocketBun perf deviation: use Bun's native FileSink for multipart temp-file
    // spooling to reduce per-chunk async fs overhead and improve ingress backpressure.
    writer: Bun.file(path).writer({ highWaterMark: multipartPartWriterHighWaterMark }),
  };
}

async function appendMultipartPartChunk(part: PendingMultipartPart, chunk: Uint8Array): Promise<void> {
  if (chunk.length === 0) {
    return;
  }

  part.size += chunk.length;
  if (part.writer) {
    const result = part.writer.write(chunk);
    if (result instanceof Promise) {
      await result;
    }
    return;
  }

  part.chunks.push(chunk.slice());
}

async function finishMultipartPart(part: PendingMultipartPart, form: StoredMultipartFormData): Promise<void> {
  if (part.writer && part.path !== null && part.fileName !== null) {
    await closeMultipartPartWriter(part.writer);
    form.append(part.fieldName, new StoredMultipartFile(part.path, part.fileName, part.size, part.contentType));
    return;
  }

  form.append(part.fieldName, decodePartText(part.chunks));
}

function decodePartText(chunks: Uint8Array[]): string {
  if (chunks.length === 0) {
    return "";
  }
  if (chunks.length === 1) {
    return decoder.decode(chunks[0]);
  }
  let total = 0;
  for (const chunk of chunks) {
    total += chunk.length;
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return decoder.decode(merged);
}

async function closeMultipartPartWriter(writer: MultipartPartWriter): Promise<void> {
  const result = writer.end();
  if (result instanceof Promise) {
    await result;
  }
}

function parseMultipartPartHeaders(rawHeaders: string): MultipartPartHeaders {
  const headers: Record<string, string> = {};
  for (const line of rawHeaders.split("\r\n")) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex < 0) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();
    if (!key) {
      continue;
    }
    headers[key] = value;
  }

  const disposition = parseContentDisposition(headers["content-disposition"] ?? "");
  if (!disposition.fieldName) {
    throw new TypeError(formDataDecodeError);
  }

  return {
    fieldName: disposition.fieldName,
    fileName: disposition.fileName,
    contentType: headers["content-type"] ?? "application/octet-stream",
  };
}

function parseContentDisposition(value: string): { fieldName: string | null; fileName: string | null } {
  let fieldName: string | null = null;
  let fileName: string | null = null;
  const paramRegex = /;\s*([^=;]+)=("([^"]*)"|[^;]*)/g;
  for (const match of value.matchAll(paramRegex)) {
    const key = match[1]?.trim().toLowerCase();
    const raw = match[3] ?? match[2] ?? "";
    if (key === "name") {
      fieldName = raw;
    } else if (key === "filename") {
      fileName = raw;
    }
  }
  return { fieldName, fileName };
}

function extractMultipartBoundary(contentType: string | null): string | null {
  if (!contentType) {
    return null;
  }

  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  const boundary = match?.[1] ?? match?.[2] ?? "";
  return boundary.trim() || null;
}

function concatBytes(left: Uint8Array<ArrayBufferLike>, right: Uint8Array<ArrayBufferLike>): Uint8Array<ArrayBufferLike> {
  if (left.length === 0) {
    return right;
  }
  const merged = new Uint8Array(left.length + right.length);
  merged.set(left, 0);
  merged.set(right, left.length);
  return merged;
}

function keepTrailingBytes(buffer: Uint8Array<ArrayBufferLike>, count: number): Uint8Array<ArrayBufferLike> {
  if (buffer.length <= count) {
    return buffer;
  }
  return buffer.slice(buffer.length - count);
}

function indexOfBytes(source: Uint8Array<ArrayBufferLike>, needle: Uint8Array<ArrayBufferLike>): number {
  if (needle.length === 0) {
    return 0;
  }
  if (source.length < needle.length) {
    return -1;
  }
  // PocketBun perf deviation: use the runtime's native byte search to reduce
  // JS work while scanning large multipart file bodies.
  return Buffer.from(source.buffer, source.byteOffset, source.byteLength).indexOf(
    Buffer.from(needle.buffer, needle.byteOffset, needle.byteLength),
  );
}

async function consumeMultipartBodyChunk(
  part: PendingMultipartPart,
  tail: Uint8Array<ArrayBufferLike>,
  chunk: Uint8Array<ArrayBufferLike>,
  delimiterBytes: Uint8Array<ArrayBufferLike>,
): Promise<MultipartBodyChunkResult> {
  if (chunk.length === 0) {
    return {
      finished: false,
      remainder: emptyBytes,
      tail,
    };
  }

  const delimiterIndex = indexOfCombinedBytes(tail, chunk, delimiterBytes);
  if (delimiterIndex >= 0) {
    await appendCombinedBytesRange(part, tail, chunk, 0, delimiterIndex);
    return {
      finished: true,
      remainder: sliceCombinedBytes(tail, chunk, delimiterIndex + delimiterBytes.length),
      tail: emptyBytes,
    };
  }

  const keepBytes = delimiterBytes.length + 4;
  const combinedLength = tail.length + chunk.length;
  const flushLength = Math.max(0, combinedLength - keepBytes);
  if (flushLength > 0) {
    await appendCombinedBytesRange(part, tail, chunk, 0, flushLength);
  }

  return {
    finished: false,
    remainder: emptyBytes,
    tail: copyCombinedSuffix(tail, chunk, combinedLength - flushLength),
  };
}

async function appendCombinedBytesRange(
  part: PendingMultipartPart,
  tail: Uint8Array<ArrayBufferLike>,
  chunk: Uint8Array<ArrayBufferLike>,
  start: number,
  end: number,
): Promise<void> {
  if (end <= start) {
    return;
  }

  const tailLength = tail.length;
  if (start < tailLength) {
    const tailEnd = Math.min(end, tailLength);
    await appendMultipartPartChunk(part, tail.subarray(start, tailEnd));
  }

  if (end > tailLength) {
    const chunkStart = Math.max(0, start - tailLength);
    const chunkEnd = end - tailLength;
    await appendMultipartPartChunk(part, chunk.subarray(chunkStart, chunkEnd));
  }
}

function sliceCombinedBytes(
  tail: Uint8Array<ArrayBufferLike>,
  chunk: Uint8Array<ArrayBufferLike>,
  start: number,
): Uint8Array<ArrayBufferLike> {
  const combinedLength = tail.length + chunk.length;
  if (start <= 0) {
    return concatBytes(tail, chunk);
  }
  if (start >= combinedLength) {
    return emptyBytes;
  }
  if (start >= tail.length) {
    return chunk.subarray(start - tail.length);
  }

  const length = combinedLength - start;
  const result = new Uint8Array(length);
  let offset = 0;
  const tailSlice = tail.subarray(start);
  result.set(tailSlice, offset);
  offset += tailSlice.length;
  result.set(chunk, offset);
  return result;
}

function copyCombinedSuffix(
  tail: Uint8Array<ArrayBufferLike>,
  chunk: Uint8Array<ArrayBufferLike>,
  suffixLength: number,
): Uint8Array<ArrayBufferLike> {
  if (suffixLength <= 0) {
    return emptyBytes;
  }

  const combinedLength = tail.length + chunk.length;
  if (suffixLength >= combinedLength) {
    return concatBytes(tail, chunk);
  }

  const start = combinedLength - suffixLength;
  return sliceCombinedBytes(tail, chunk, start);
}

function indexOfCombinedBytes(
  tail: Uint8Array<ArrayBufferLike>,
  chunk: Uint8Array<ArrayBufferLike>,
  needle: Uint8Array<ArrayBufferLike>,
): number {
  if (needle.length === 0) {
    return 0;
  }

  const chunkIndex = indexOfBytes(chunk, needle);
  let combinedIndex = chunkIndex >= 0 ? tail.length + chunkIndex : -1;

  const overlapStart = Math.max(0, tail.length - needle.length + 1);
  const overlapEnd = tail.length;
  for (let i = overlapStart; i < overlapEnd; i += 1) {
    if (matchesCombinedBytesAt(tail, chunk, needle, i)) {
      combinedIndex = combinedIndex >= 0 ? Math.min(combinedIndex, i) : i;
      break;
    }
  }

  return combinedIndex;
}

function matchesCombinedBytesAt(
  tail: Uint8Array<ArrayBufferLike>,
  chunk: Uint8Array<ArrayBufferLike>,
  needle: Uint8Array<ArrayBufferLike>,
  start: number,
): boolean {
  const combinedLength = tail.length + chunk.length;
  if (start < 0 || start + needle.length > combinedLength) {
    return false;
  }

  for (let i = 0; i < needle.length; i += 1) {
    const index = start + i;
    const value = index < tail.length ? tail[index] : chunk[index - tail.length];
    if (value !== needle[i]) {
      return false;
    }
  }

  return true;
}

function cloneRequestIfPossible(request: MultipartRequestLike): MultipartRequestLike | null {
  if (typeof request.clone !== "function") {
    return null;
  }

  try {
    return request.clone();
  } catch {
    return null;
  }
}
