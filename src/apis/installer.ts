// Ported from pocketbase/apis/installer.go

import type { App } from "../core/app.ts";
import type { Record as RecordModel } from "../core/record_model.ts";
import { CollectionNameSuperusers } from "../core/collection_model.ts";
import { NewRecord } from "../core/record_model.ts";
import { DefaultInstallerEmail } from "../core/record_model_superusers.ts";
import { HashExp, Not } from "../tools/dbx/expr.ts";
import { LaunchURL } from "../tools/osutils/cmd.ts";
import { IsProbablyTransientRuntime } from "../tools/osutils/run.ts";

export type InstallerFunc = (app: App, systemSuperuser: RecordModel, baseURL: string) => Error | null;
export type InstallerFuncAsync = (
  app: App,
  systemSuperuser: RecordModel,
  baseURL: string,
) => Error | null | Promise<Error | null>;

// DefaultInstallerFunc is the default PocketBase installer function.
//
// It will attempt to open a link in the browser (with a short-lived auth
// token for the systemSuperuser) to the installer UI so that users can
// create their own custom superuser record.
export function DefaultInstallerFunc(app: App, systemSuperuser: RecordModel, baseURL: string): Error | null {
  let token: string;
  try {
    token = systemSuperuser.NewStaticAuthToken(30 * 60);
  } catch (error) {
    return error as Error;
  }

  const url = `${baseURL.replace(/\/+$/g, "")}/_/#/pbinstall/${token}`;
  void LaunchURL(url);
  console.log(
    "\n(!) Launch the URL below in the browser if it hasn't been open already to create your first superuser account:",
  );
  console.log(url);
  console.log(`(you can also create your first superuser by running: ${executablePath()} superuser upsert EMAIL PASS)\n`);
  return null;
}

export function loadInstaller(app: App, baseURL: string, installerFunc: InstallerFunc | null): Error | null {
  if (!installerFunc || !needInstallerSuperuser(app)) {
    return null;
  }

  let superuser: RecordModel;
  try {
    superuser = findOrCreateInstallerSuperuser(app);
  } catch (error) {
    return error as Error;
  }

  try {
    return installerFunc(app, superuser, baseURL);
  } catch (error) {
    return error as Error;
  }
}

// loadInstallerAsync is a PocketBun-only async alternative to loadInstaller().
export async function loadInstallerAsync(
  app: App,
  baseURL: string,
  installerFunc: InstallerFuncAsync | null,
): Promise<Error | null> {
  if (!installerFunc || !needInstallerSuperuser(app)) {
    return null;
  }

  let superuser: RecordModel;
  try {
    superuser = await findOrCreateInstallerSuperuserAsync(app);
  } catch (error) {
    return error as Error;
  }

  try {
    return (await installerFunc(app, superuser, baseURL)) as Error | null;
  } catch (error) {
    return error as Error;
  }
}

export function needInstallerSuperuser(app: App): boolean {
  try {
    const total = app.CountRecords(
      CollectionNameSuperusers,
      Not(
        HashExp({
          email: DefaultInstallerEmail,
        }),
      ),
    );
    return total === 0;
  } catch {
    return false;
  }
}

export function findOrCreateInstallerSuperuser(app: App): RecordModel {
  const collection = app.FindCachedCollectionByNameOrId(CollectionNameSuperusers);

  try {
    return app.FindAuthRecordByEmail(collection, DefaultInstallerEmail);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message && message !== "record not found") {
      throw error;
    }
  }

  const record = NewRecord(collection);
  record.SetEmail(DefaultInstallerEmail);
  record.SetRandomPassword();

  const saveErr = app.SaveSync(record);
  if (saveErr) {
    throw saveErr;
  }

  return record;
}

// findOrCreateInstallerSuperuserAsync is a PocketBun-only async alternative
// to findOrCreateInstallerSuperuser().
export async function findOrCreateInstallerSuperuserAsync(app: App): Promise<RecordModel> {
  const collection = app.FindCachedCollectionByNameOrId(CollectionNameSuperusers);

  try {
    return app.FindAuthRecordByEmail(collection, DefaultInstallerEmail);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message && message !== "record not found") {
      throw error;
    }
  }

  const record = NewRecord(collection);
  record.SetEmail(DefaultInstallerEmail);
  await record.SetRandomPasswordAsync();

  const saveErr = await app.Save(record);
  if (saveErr) {
    throw saveErr;
  }

  return record;
}

function executablePath(): string {
  if (IsProbablyTransientRuntime()) {
    return "bun run .";
  }
  return process.argv[1] ?? process.argv[0] ?? "pocketbun";
}
