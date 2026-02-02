// Ported from pocketbase/apis/backup.go

import type { App } from "../core/app.ts";
import type { RouterGroup } from "../tools/router/group.ts";
import { RequestEvent } from "../core/event_request.ts";
import { TokenTypeFile } from "../core/record_tokens.ts";
import { StoreKeyActiveBackup } from "../core/store.ts";
import { FireAndForget } from "../tools/routine/routine.ts";
import { ParseDateTime, type DateTime } from "../tools/types/index.ts";
import { badRequest, forbidden, internalServerError, noContent, notFound } from "./api_errors.ts";
import { backupCreate } from "./backup_create.ts";
import { backupUpload } from "./backup_upload.ts";
import { RequireSuperuserAuth } from "./middlewares.ts";
import { BodyLimit } from "./middlewares_body_limit.ts";

// bindBackupApi registers the file api endpoints and the corresponding handlers.
export function bindBackupApi(app: App, rg: RouterGroup<RequestEvent>): void {
  const sub = rg.group("/backups");
  sub.get("", (event) => backupsList(app, event)).Bind(RequireSuperuserAuth());
  sub.post("", (event) => backupCreate(app, event)).Bind(RequireSuperuserAuth());
  sub.post("/upload", (event) => backupUpload(app, event)).Bind(BodyLimit(0), RequireSuperuserAuth());
  sub.get("/{key}", (event) => backupDownload(app, event)); // relies on superuser file token
  sub.delete("/{key}", (event) => backupDelete(app, event)).Bind(RequireSuperuserAuth());
  sub.post("/{key}/restore", (event) => backupRestore(app, event)).Bind(RequireSuperuserAuth());
}

type BackupFileInfo = {
  Modified: DateTime;
  Key: string;
  Size: number;
};

function backupsList(app: App, event: RequestEvent): Response {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  let fsys;
  try {
    fsys = app.NewBackupsFilesystem();
  } catch (error) {
    clearTimeout(timeout);
    return badRequest(event, "Failed to load backups filesystem.", error as Error);
  }

  try {
    fsys.SetContext(controller.signal);
    const backups = fsys.List("");
    const result: BackupFileInfo[] = backups.map((obj) => ({
      Key: obj.Key,
      Size: obj.Size,
      Modified: ParseDateTime(obj.ModTime),
    }));
    return event.json(200, result);
  } catch (error) {
    return badRequest(event, `Failed to retrieve backup items. Raw error: \n${(error as Error).message}`, null);
  } finally {
    clearTimeout(timeout);
    fsys.Close();
  }
}

function backupDownload(app: App, event: RequestEvent): Response {
  const token = new URL(event.request.url).searchParams.get("token") ?? "";

  try {
    const authRecord = app.FindAuthRecordByToken(token, TokenTypeFile);
    if (!authRecord.isSuperuser()) {
      throw new Error("insufficient permissions");
    }
  } catch (_error) {
    return forbidden(event, "Insufficient permissions to access the resource.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10 * 60_000);

  let fsys;
  try {
    fsys = app.NewBackupsFilesystem();
  } catch (error) {
    clearTimeout(timeout);
    return internalServerError(event, "Failed to load backups filesystem.", error as Error);
  }

  try {
    fsys.SetContext(controller.signal);
    const key = decodeURIComponent(event.params.key ?? "");

    const recorder = new ResponseRecorder(event.responseHeaders);
    const headers = headersToObject(event.request.headers);
    const err = fsys.Serve(
      recorder,
      { url: event.request.url, headers },
      key,
      key.split("/").pop() ?? key, // without the path prefix (if any)
    );
    if (err) {
      return notFound(event, "");
    }
    return recorder.toResponse();
  } finally {
    clearTimeout(timeout);
    fsys.Close();
  }
}

function backupDelete(app: App, event: RequestEvent): Response {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  let fsys;
  try {
    fsys = app.NewBackupsFilesystem();
  } catch (error) {
    clearTimeout(timeout);
    return internalServerError(event, "Failed to load backups filesystem.", error as Error);
  }

  try {
    fsys.SetContext(controller.signal);
    const key = decodeURIComponent(event.params.key ?? "");

    const active = app.store().get(StoreKeyActiveBackup);
    if (key && String(active) === key) {
      return badRequest(event, "The backup is currently being used and cannot be deleted.", null);
    }

    try {
      fsys.Delete(key);
    } catch (error) {
      return badRequest(event, `Invalid or already deleted backup file. Raw error: \n${(error as Error).message}`, null);
    }

    return noContent(event, 204);
  } finally {
    clearTimeout(timeout);
    fsys.Close();
  }
}

function backupRestore(app: App, event: RequestEvent): Response {
  if (app.store().has(StoreKeyActiveBackup)) {
    return badRequest(event, "Try again later - another backup/restore process has already been started.", null);
  }

  const key = decodeURIComponent(event.params.key ?? "");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  let fsys;
  try {
    fsys = app.NewBackupsFilesystem();
  } catch (error) {
    clearTimeout(timeout);
    return internalServerError(event, "Failed to load backups filesystem.", error as Error);
  }

  try {
    fsys.SetContext(controller.signal);
    if (!fsys.Exists(key)) {
      return badRequest(event, "Missing or invalid backup file.", null);
    }
  } finally {
    clearTimeout(timeout);
    fsys.Close();
  }

  FireAndForget(() => {
    // give some optimistic time to write the response before restarting the app
    setTimeout(() => {
      const restoreController = new AbortController();
      // wait max 10 minutes to fetch the backup
      const restoreTimeout = setTimeout(() => restoreController.abort(), 10 * 60_000);
      try {
        const err = app.RestoreBackup(restoreController.signal, key);
        if (err) {
          app.Logger().Error("Failed to restore backup", "key", key, "error", err.message);
        }
      } finally {
        clearTimeout(restoreTimeout);
      }
    }, 1000);
  });

  return noContent(event, 204);
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

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return merged;
}
