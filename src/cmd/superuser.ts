// Ported from pocketbase/cmd/superuser.go (CLI wiring removed; library-friendly helpers instead).

import type { App } from "../core/app.ts";
import { CollectionNameSuperusers } from "../core/collection_model.ts";
import { NewOTP, type OTP } from "../core/otp_model.ts";
import { NewRecord, type Record } from "../core/record_model.ts";
import { randomStringWithAlphabet } from "../tools/security/random.ts";

export type SuperuserOtpResult = {
  otp: OTP;
  password: string;
};

export async function superuserUpsert(app: App, email: string, password: string): Promise<Record> {
  ensureReady(app);
  validateEmail(email, "missing or invalid email address");

  const superusers = getSuperusersCollection(app);
  let superuser: Record;
  try {
    superuser = app.FindAuthRecordByEmail(superusers, email);
  } catch {
    superuser = NewRecord(superusers);
  }

  superuser.SetEmail(email);
  superuser.SetPassword(password);

  const err = await app.Save(superuser);
  if (err) {
    throw new Error(`failed to upsert superuser account: ${err.message}`);
  }

  return superuser;
}

export async function superuserCreate(app: App, email: string, password: string): Promise<Record> {
  ensureReady(app);
  validateEmail(email, "missing or invalid email address");

  const superusers = getSuperusersCollection(app);
  const superuser = NewRecord(superusers);
  superuser.SetEmail(email);
  superuser.SetPassword(password);

  const err = await app.Save(superuser);
  if (err) {
    throw new Error(`failed to create new superuser account: ${err.message}`);
  }

  return superuser;
}

export async function superuserUpdate(app: App, email: string, password: string): Promise<Record> {
  ensureReady(app);
  validateEmail(email, "missing or invalid email address");

  let superuser: Record;
  try {
    superuser = app.FindAuthRecordByEmail(CollectionNameSuperusers, email);
  } catch {
    throw new Error(`superuser with email ${JSON.stringify(email)} doesn't exist`);
  }

  superuser.SetPassword(password);

  const err = await app.Save(superuser);
  if (err) {
    throw new Error(`failed to change superuser ${JSON.stringify(superuser.Email())} password: ${err.message}`);
  }

  return superuser;
}

export async function superuserDelete(app: App, email: string): Promise<boolean> {
  ensureReady(app);
  validateEmail(email, "invalid or missing email address");

  let superuser: Record;
  try {
    superuser = app.FindAuthRecordByEmail(CollectionNameSuperusers, email);
  } catch {
    return false;
  }

  const err = await app.Delete(superuser);
  if (err) {
    throw new Error(`failed to delete superuser ${JSON.stringify(superuser.Email())}: ${err.message}`);
  }

  return true;
}

export async function superuserOTP(app: App, email: string): Promise<SuperuserOtpResult> {
  ensureReady(app);
  validateEmail(email, "invalid or missing email address");

  let superuser: Record;
  try {
    superuser = app.FindAuthRecordByEmail(CollectionNameSuperusers, email);
  } catch {
    throw new Error(`superuser with email ${JSON.stringify(email)} doesn't exist`);
  }

  if (!superuser.collection().OTP.Enabled) {
    throw new Error("OTP auth is not enabled for the _superusers collection");
  }

  const password = randomStringWithAlphabet(superuser.collection().OTP.Length, "1234567890");
  const otp = NewOTP(app);
  otp.SetCollectionRef(superuser.collection().id);
  otp.SetRecordRef(superuser.Id);
  otp.ProxyRecord().SetPassword(password);

  const err = await app.Save(otp);
  if (err) {
    throw new Error(`failed to create OTP: ${err.message}`);
  }

  return { otp, password };
}

export const superuser = {
  upsert: superuserUpsert,
  create: superuserCreate,
  update: superuserUpdate,
  delete: superuserDelete,
  otp: superuserOTP,
};

function ensureReady(app: App): void {
  if (!app.isBootstrapped()) {
    app.bootstrap();
  }

  app.runSystemMigrations();
}

function getSuperusersCollection(app: App) {
  let collection: ReturnType<App["FindCachedCollectionByNameOrId"]> | null = null;
  try {
    collection = app.FindCachedCollectionByNameOrId(CollectionNameSuperusers);
  } catch {
    collection = null;
  }
  if (!collection) {
    throw new Error(`failed to fetch ${JSON.stringify(CollectionNameSuperusers)} collection`);
  }

  return collection;
}

function validateEmail(email: string, message: string): void {
  if (email === "" || !isEmail(email)) {
    throw new Error(message);
  }
}

function isEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}
