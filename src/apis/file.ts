// Ported from pocketbase/apis/file.go

import { cpus } from "node:os";
import type { App } from "../core/app.ts";
import type { RequestEvent, RequestInfo } from "../core/event_request.ts";
import type { System } from "../tools/filesystem/filesystem.ts";
import type { RouterGroup } from "../tools/router/group.ts";
import { RequestInfoContextProtectedFile } from "../core/event_request.ts";
import { FileDownloadRequestEvent, FileTokenRequestEvent } from "../core/events.ts";
import { TokenTypeFile } from "../core/record_tokens.ts";
import { toNumberValue } from "../internal/compat/cast.ts";
import { existInSlice } from "../tools/list/list.ts";
import { internalServerError, notFound, unauthorized } from "./api_errors.ts";
import { RequireAuth } from "./middlewares.ts";
import { collectionPathRateLimit } from "./middlewares_rate_limit.ts";
import { execAfterSuccessTx } from "./record_helpers.ts";

const imageContentTypes = ["image/png", "image/jpg", "image/jpeg", "image/gif", "image/webp"];
const defaultThumbSizes = ["100x100"];

// bindFileApi registers the file api endpoints and the corresponding handlers.
export function bindFileApi(_app: App, rg: RouterGroup<RequestEvent>): void {
  let maxWorkers = Math.trunc(toNumberValue(process.env.PB_THUMBS_MAX_WORKERS ?? ""));
  if (!Number.isFinite(maxWorkers) || maxWorkers <= 0) {
    maxWorkers = cpus().length + 2;
  }

  let maxWait = Math.trunc(toNumberValue(process.env.PB_THUMBS_MAX_WAIT ?? ""));
  if (!Number.isFinite(maxWait) || maxWait <= 0) {
    maxWait = 60;
  }

  const api = new FileApi(maxWorkers, maxWait * 1000);

  const sub = rg.group("/files");
  sub.post("/token", (event) => api.fileToken(event)).Bind(RequireAuth());
  sub.get("/{collection}/{recordId}/{filename}", (event) => api.download(event)).Bind(collectionPathRateLimit("", "file"));
}

class FileApi {
  #thumbGenSem: Semaphore;
  #thumbGenPending: SingleflightGroup;
  #thumbGenMaxWaitMs: number;

  constructor(maxWorkers: number, maxWaitMs: number) {
    this.#thumbGenSem = new Semaphore(maxWorkers);
    this.#thumbGenPending = new SingleflightGroup();
    this.#thumbGenMaxWaitMs = maxWaitMs;
  }

  async fileToken(event: RequestEvent): Promise<Response> {
    if (!event.auth) {
      return unauthorized(event, "Missing auth context.");
    }

    let token = "";
    try {
      token = event.auth.NewFileToken();
    } catch (error) {
      return internalServerError(event, "Failed to generate file token", error);
    }

    const hookEvent = new FileTokenRequestEvent(event, event.auth);
    hookEvent.Token = token;

    const response = await event.app.OnFileTokenRequest().Trigger(hookEvent, async () => {
      return execAfterSuccessTx(true, event.app, () => {
        return event.json(200, { token: hookEvent.Token });
      });
    });

    if (response instanceof Response) {
      return response;
    }

    return event.json(200, { token: hookEvent.Token });
  }

  async download(event: RequestEvent): Promise<Response> {
    const collectionId = event.params.collection ?? "";
    let collection: ReturnType<App["FindCachedCollectionByNameOrId"]> | null = null;
    try {
      collection = event.app.FindCachedCollectionByNameOrId(collectionId);
    } catch {
      collection = null;
    }
    if (!collection) {
      return notFound(event, "");
    }

    const recordId = event.params.recordId ?? "";
    if (!recordId) {
      return notFound(event, "");
    }

    const record = event.app.findRecordById(collection, recordId);
    if (!record) {
      return notFound(event, "");
    }

    const filename = event.params.filename ?? "";
    const fileField = record.FindFileFieldByFile(filename);
    if (!fileField) {
      return notFound(event, "");
    }

    if (fileField.Protected) {
      let originalRequestInfo: RequestInfo;
      try {
        originalRequestInfo = await event.requestInfo();
      } catch (error) {
        return internalServerError(event, "Failed to load request info", error);
      }

      const token = event.requestUrl().searchParams.get("token") ?? "";
      let authRecord = null;
      try {
        authRecord = event.app.FindAuthRecordByToken(token, TokenTypeFile);
      } catch {
        authRecord = null;
      }

      const requestInfo: RequestInfo = {
        ...originalRequestInfo,
        context: RequestInfoContextProtectedFile,
        auth: authRecord,
      };

      const [ok] = event.app.CanAccessRecord(record, requestInfo, record.collection().viewRule);
      if (!ok) {
        return notFound(event, "");
      }
    }

    let baseFilesPath = record.BaseFilesPath();

    if (collection.IsView()) {
      try {
        const fileRecord = event.app.FindRecordByViewFile(collection.id, fileField.Name, filename);
        baseFilesPath = fileRecord.BaseFilesPath();
      } catch (_error) {
        return notFound(event, "");
      }
    }

    let fsys: System;
    try {
      fsys = event.app.NewFilesystem();
    } catch (error) {
      return internalServerError(event, "Filesystem initialization failure.", error);
    }

    try {
      const originalPath = `${baseFilesPath}/${filename}`;

      const hookEvent = new FileDownloadRequestEvent(event, collection, record, fileField, originalPath, filename);

      const thumbSize = event.requestUrl().searchParams.get("thumb") ?? "";
      const fieldThumbs = Array.isArray(fileField.Thumbs) ? fileField.Thumbs : [];
      if (thumbSize && (existInSlice(thumbSize, defaultThumbSizes) || existInSlice(thumbSize, fieldThumbs))) {
        let attrs;
        try {
          attrs = await fsys.Attributes(originalPath);
        } catch {
          return notFound(event, "");
        }

        if (existInSlice(attrs.ContentType, imageContentTypes)) {
          hookEvent.ServedName = `${thumbSize}_${filename}`;
          hookEvent.ServedPath = `${baseFilesPath}/thumbs_${filename}/${hookEvent.ServedName}`;

          if (!(await fsys.Exists(hookEvent.ServedPath))) {
            const thumbErr = await this.createThumb(event, fsys, originalPath, hookEvent.ServedPath, thumbSize);
            if (thumbErr) {
              event.app
                .Logger()
                .Warn(
                  `Fallback to original - failed to create thumb ${hookEvent.ServedName}`,
                  "error",
                  thumbErr,
                  "original",
                  originalPath,
                  "thumb",
                  hookEvent.ServedPath,
                );
              hookEvent.ThumbError = thumbErr;
              hookEvent.ServedName = filename;
              hookEvent.ServedPath = originalPath;
            }
          }
        }
      }

      if (thumbSize && !hookEvent.ThumbError && hookEvent.ServedPath === originalPath) {
        hookEvent.ThumbError = new Error(
          `the thumb size ${JSON.stringify(thumbSize)} or the original file format are not supported`,
        );
      }

      event.responseHeaders.delete("X-Frame-Options");

      const response = await event.app.OnFileDownloadRequest().Trigger(hookEvent, async () => {
        return execAfterSuccessTx(true, event.app, () => {
          return serveFile(event, fsys, hookEvent.ServedPath, hookEvent.ServedName);
        });
      });

      if (response instanceof Response) {
        return response;
      }

      return await serveFile(event, fsys, hookEvent.ServedPath, hookEvent.ServedName);
    } finally {
      await fsys.Close();
    }
  }

  private async createThumb(
    event: RequestEvent,
    fsys: System,
    originalPath: string,
    thumbPath: string,
    thumbSize: string,
  ): Promise<Error | null> {
    const result = this.#thumbGenPending.do(thumbPath, async () => {
      try {
        await this.#thumbGenSem.acquire(this.#thumbGenMaxWaitMs);
      } catch (error) {
        return error as Error;
      }

      try {
        return (await fsys.CreateThumb(originalPath, thumbPath, thumbSize)) ?? null;
      } finally {
        this.#thumbGenSem.release();
      }
    });

    try {
      return await result;
    } finally {
      this.#thumbGenPending.forget(thumbPath);
    }
  }
}

async function serveFile(event: RequestEvent, fsys: System, servedPath: string, servedName: string): Promise<Response> {
  const recorder = new ResponseRecorder(event.responseHeaders);
  const headers = headersToObject(event.request.headers);
  const err = await fsys.Serve(recorder, { url: event.request.url, headers }, servedPath, servedName);
  if (err) {
    return notFound(event, "");
  }
  return recorder.toResponse();
}

function headersToObject(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of headers.entries()) {
    out[key] = value;
  }
  return out;
}

class ResponseRecorder {
  statusCode = 200;
  #headers = new Map<string, string>();
  #chunks: Uint8Array[] = [];

  constructor(initial: Headers) {
    for (const [key, value] of initial.entries()) {
      this.setHeader(key, value);
    }
  }

  setHeader(name: string, value: string): void {
    this.#headers.set(name.toLowerCase(), value);
  }

  getHeader(name: string): string | undefined {
    return this.#headers.get(name.toLowerCase());
  }

  end(body?: Uint8Array): void {
    if (body) {
      this.#chunks.push(body);
    }
  }

  toResponse(): Response {
    const headers = new Headers();
    for (const [key, value] of this.#headers.entries()) {
      headers.set(key, value);
    }
    return new Response(concatChunks(this.#chunks), { status: this.statusCode, headers });
  }
}

function concatChunks(chunks: Uint8Array[]): Uint8Array {
  if (chunks.length === 0) {
    return new Uint8Array();
  }
  if (chunks.length === 1) {
    return chunks[0] ?? new Uint8Array();
  }

  let total = 0;
  for (const chunk of chunks) {
    total += chunk.length;
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }

  return out;
}

// Deviation: local semaphore + singleflight to model Go sync primitives without extra deps.
class Semaphore {
  #max: number;
  #current = 0;
  #queue: Array<{
    resolve: () => void;
    reject: (err: Error) => void;
    timeoutId?: ReturnType<typeof setTimeout>;
    cancelled: boolean;
  }> = [];

  constructor(max: number) {
    this.#max = Math.max(1, max);
  }

  acquire(timeoutMs: number): Promise<void> {
    if (this.#current < this.#max) {
      this.#current += 1;
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const entry = {
        resolve: () => {
          if (entry.timeoutId) {
            clearTimeout(entry.timeoutId);
          }
          if (entry.cancelled) {
            return;
          }
          resolve();
        },
        reject: (err: Error) => {
          if (entry.timeoutId) {
            clearTimeout(entry.timeoutId);
          }
          if (entry.cancelled) {
            return;
          }
          entry.cancelled = true;
          reject(err);
        },
        timeoutId: undefined as ReturnType<typeof setTimeout> | undefined,
        cancelled: false,
      };

      if (timeoutMs > 0) {
        entry.timeoutId = setTimeout(() => {
          entry.cancelled = true;
          this.#queue = this.#queue.filter((item) => item !== entry);
          reject(new Error("thumb generation timed out"));
        }, timeoutMs);
      }

      this.#queue.push(entry);
    });
  }

  release(): void {
    while (this.#queue.length > 0) {
      const entry = this.#queue.shift();
      if (!entry || entry.cancelled) {
        continue;
      }
      entry.resolve();
      return;
    }

    if (this.#current > 0) {
      this.#current -= 1;
    }
  }
}

class SingleflightGroup {
  #pending = new Map<string, Promise<Error | null>>();

  do(key: string, fn: () => Promise<Error | null>): Promise<Error | null> {
    const existing = this.#pending.get(key);
    if (existing) {
      return existing;
    }

    const pending = (async () => {
      try {
        return await fn();
      } catch (error) {
        return error as Error;
      }
    })();

    this.#pending.set(key, pending);
    return pending;
  }

  forget(key: string): void {
    this.#pending.delete(key);
  }
}
