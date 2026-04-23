// Ported from pocketbase/apis/backup.go

import type { RouterGroup } from "../tools/router/group.ts";
import { newBackupsFilesystemAsync, type App } from "../core/app.ts";
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
  modified: DateTime;
  key: string;
  size: number;
};

async function backupsList(app: App, event: RequestEvent): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  let fsys;
  try {
    fsys = await newBackupsFilesystemAsync(app);
  } catch (error) {
    clearTimeout(timeout);
    return badRequest(event, "Failed to load backups filesystem.", error as Error);
  }

  await using managedFsys = fsys;
  try {
    managedFsys.SetContext(controller.signal);
    const backups = await managedFsys.List("");
    const result: BackupFileInfo[] = backups.map((obj) => ({
      key: obj.Key,
      size: obj.Size,
      modified: ParseDateTime(obj.ModTime),
    }));
    return event.json(200, result);
  } catch (error) {
    return badRequest(event, `Failed to retrieve backup items. Raw error: \n${(error as Error).message}`, null);
  } finally {
    clearTimeout(timeout);
  }
}

async function backupDownload(app: App, event: RequestEvent): Promise<Response> {
  const token = event.requestUrl().searchParams.get("token") ?? "";

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
    fsys = await newBackupsFilesystemAsync(app);
  } catch (error) {
    clearTimeout(timeout);
    return internalServerError(event, "Failed to load backups filesystem.", error as Error);
  }

  let releaseFilesystem = false;
  try {
    fsys.SetContext(controller.signal);
    const key = decodeURIComponent(event.params.key ?? "");

    const headers = headersToObject(event.request.headers);
    const response = await fsys.ServeResponse(
      event.responseHeaders,
      { url: event.request.url, headers },
      key,
      key.split("/").pop() ?? key, // without the path prefix (if any)
      async () => {
        clearTimeout(timeout);
        await fsys.Close();
      },
    );
    if (response instanceof Error) {
      return notFound(event, "");
    }
    releaseFilesystem = true;
    return response;
  } finally {
    if (!releaseFilesystem) {
      clearTimeout(timeout);
      await fsys.Close();
    }
  }
}

async function backupDelete(app: App, event: RequestEvent): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  let fsys;
  try {
    fsys = await newBackupsFilesystemAsync(app);
  } catch (error) {
    clearTimeout(timeout);
    return internalServerError(event, "Failed to load backups filesystem.", error as Error);
  }

  await using managedFsys = fsys;
  try {
    managedFsys.SetContext(controller.signal);
    const key = decodeURIComponent(event.params.key ?? "");

    const active = app.store().get(StoreKeyActiveBackup);
    if (key && String(active) === key) {
      return badRequest(event, "The backup is currently being used and cannot be deleted.", null);
    }

    try {
      await managedFsys.Delete(key);
    } catch (error) {
      return badRequest(event, `Invalid or already deleted backup file. Raw error: \n${(error as Error).message}`, null);
    }

    return noContent(event, 204);
  } finally {
    clearTimeout(timeout);
  }
}

async function backupRestore(app: App, event: RequestEvent): Promise<Response> {
  if (app.store().has(StoreKeyActiveBackup)) {
    return badRequest(event, "Try again later - another backup/restore process has already been started.", null);
  }

  const key = decodeURIComponent(event.params.key ?? "");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  let fsys;
  try {
    fsys = await newBackupsFilesystemAsync(app);
  } catch (error) {
    clearTimeout(timeout);
    return internalServerError(event, "Failed to load backups filesystem.", error as Error);
  }

  await using managedFsys = fsys;
  try {
    managedFsys.SetContext(controller.signal);
    if (!(await managedFsys.Exists(key))) {
      return badRequest(event, "Missing or invalid backup file.", null);
    }
  } finally {
    clearTimeout(timeout);
  }

  FireAndForget(() => {
    // give some optimistic time to write the response before restarting the app
    setTimeout(() => {
      FireAndForget(async () => {
        const restoreController = new AbortController();
        // wait max 10 minutes to fetch the backup
        const restoreTimeout = setTimeout(() => restoreController.abort(), 10 * 60_000);
        try {
          const err = await app.RestoreBackup(restoreController.signal, key);
          if (err) {
            app.Logger().Error("Failed to restore backup", "key", key, "error", err.message);
          }
        } finally {
          clearTimeout(restoreTimeout);
        }
      });
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
