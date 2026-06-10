// Ported from pocketbase/cmd/superuser.go (includes CLI commands plus library helpers).

import { bootstrapIfNeededAsync, type App } from "../core/app.ts";
import { CollectionNameSuperusers } from "../core/collection_model.ts";
import { NewOTP, type OTP } from "../core/otp_model.ts";
import { NewRecord, type Record } from "../core/record_model.ts";
import { bgGreenFgBlack, green, yellow } from "../tools/cli/color.ts";
import { Command } from "../tools/cli/command.ts";
import { randomStringWithAlphabet } from "../tools/security/random.ts";

export type SuperuserOtpResult = {
  otp: OTP;
  password: string;
};

export async function superuserUpsert(app: App, email: string, password: string): Promise<Record> {
  await ensureReady(app);
  validateEmail(email, "missing or invalid email address");

  const superusers = getSuperusersCollection(app);
  let superuser: Record;
  try {
    superuser = app.FindAuthRecordByEmail(superusers, email);
  } catch {
    superuser = NewRecord(superusers);
  }

  superuser.SetEmail(email);
  await superuser.SetPasswordAsync(password);

  const err = await app.Save(superuser);
  if (err) {
    throw new Error(`failed to upsert superuser account: ${err.message}`);
  }

  return superuser;
}

export async function superuserCreate(app: App, email: string, password: string): Promise<Record> {
  await ensureReady(app);
  validateEmail(email, "missing or invalid email address");

  const superusers = getSuperusersCollection(app);
  const superuser = NewRecord(superusers);
  superuser.SetEmail(email);
  await superuser.SetPasswordAsync(password);

  const err = await app.Save(superuser);
  if (err) {
    throw new Error(`failed to create new superuser account: ${err.message}`);
  }

  return superuser;
}

export async function superuserUpdate(app: App, email: string, password: string): Promise<Record> {
  await ensureReady(app);
  validateEmail(email, "missing or invalid email address");

  let superuser: Record;
  try {
    superuser = app.FindAuthRecordByEmail(CollectionNameSuperusers, email);
  } catch {
    throw new Error(`superuser with email ${JSON.stringify(email)} doesn't exist`);
  }

  await superuser.SetPasswordAsync(password);

  const err = await app.Save(superuser);
  if (err) {
    throw new Error(`failed to change superuser ${JSON.stringify(superuser.Email())} password: ${err.message}`);
  }

  return superuser;
}

export async function superuserDelete(app: App, email: string): Promise<boolean> {
  await ensureReady(app);
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
  await ensureReady(app);
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
  await otp.ProxyRecord().SetPasswordAsync(password);

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
  ips: superuserIPs,
};

export function NewSuperuserCommand(app: App): Command {
  const command = new Command({
    Use: "superuser",
    Short: "Manage superusers",
  });

  command.AddCommand(superuserUpsertCommand(app));
  command.AddCommand(superuserCreateCommand(app));
  command.AddCommand(superuserUpdateCommand(app));
  command.AddCommand(superuserDeleteCommand(app));
  command.AddCommand(superuserOTPCommand(app));
  command.AddCommand(superuserIPsCommand(app));

  return command;
}

export async function superuserIPs(app: App, ips: string[]): Promise<string[]> {
  await ensureReady(app);

  const settings = app.settings();
  settings.superuserIPs = [...ips];

  const err = await app.Save(settings);
  if (err) {
    throw err;
  }

  return [...app.settings().superuserIPs];
}

function superuserUpsertCommand(app: App): Command {
  const command = new Command({
    Use: "upsert",
    Example: "superuser upsert test@example.com 1234567890",
    Short: "Creates, or updates if email exists, a single superuser",
    SilenceUsage: true,
  });

  command.RunE = async (_cmd, args) => {
    if (args.length !== 2) {
      return new Error("missing email and password arguments");
    }
    validateEmail(args[0] ?? "", "missing or invalid email address");

    const record = await superuserUpsert(app, args[0] ?? "", args[1] ?? "");
    green("Successfully saved superuser %q!\n", record.Email());
    return null;
  };

  return command;
}

function superuserCreateCommand(app: App): Command {
  const command = new Command({
    Use: "create",
    Example: "superuser create test@example.com 1234567890",
    Short: "Creates a new superuser",
    SilenceUsage: true,
  });

  command.RunE = async (_cmd, args) => {
    if (args.length !== 2) {
      return new Error("missing email and password arguments");
    }
    validateEmail(args[0] ?? "", "missing or invalid email address");

    const record = await superuserCreate(app, args[0] ?? "", args[1] ?? "");
    green("Successfully created new superuser %q!\n", record.Email());
    return null;
  };

  return command;
}

function superuserUpdateCommand(app: App): Command {
  const command = new Command({
    Use: "update",
    Example: "superuser update test@example.com 1234567890",
    Short: "Changes the password of a single superuser",
    SilenceUsage: true,
  });

  command.RunE = async (_cmd, args) => {
    if (args.length !== 2) {
      return new Error("missing email and password arguments");
    }
    validateEmail(args[0] ?? "", "missing or invalid email address");

    const record = await superuserUpdate(app, args[0] ?? "", args[1] ?? "");
    green("Successfully changed superuser %q password!\n", record.Email());
    return null;
  };

  return command;
}

function superuserDeleteCommand(app: App): Command {
  const command = new Command({
    Use: "delete",
    Example: "superuser delete test@example.com",
    Short: "Deletes an existing superuser",
    SilenceUsage: true,
  });

  command.RunE = async (_cmd, args) => {
    if (args.length === 0) {
      return new Error("invalid or missing email address");
    }
    validateEmail(args[0] ?? "", "invalid or missing email address");

    const deleted = await superuserDelete(app, args[0] ?? "");
    if (!deleted) {
      yellow("superuser %q is missing or already deleted\n", args[0] ?? "");
      return null;
    }

    green("Successfully deleted superuser %q!\n", args[0] ?? "");
    return null;
  };

  return command;
}

function superuserOTPCommand(app: App): Command {
  const command = new Command({
    Use: "otp",
    Example: "superuser otp test@example.com",
    Short: "Creates a new OTP for the specified superuser",
    SilenceUsage: true,
  });

  command.RunE = async (_cmd, args) => {
    if (args.length === 0) {
      return new Error("invalid or missing email address");
    }
    validateEmail(args[0] ?? "", "invalid or missing email address");

    const { otp, password } = await superuserOTP(app, args[0] ?? "");
    bgGreenFgBlack("Successfully created OTP for superuser %q:\n", args[0] ?? "");
    green("├─ Id:    %s\n", otp.Id);
    green("├─ Pass:  %s\n", password);
    green("└─ Valid: %ds\n\n", otp.Collection().OTP.Duration);
    return null;
  };

  return command;
}

function superuserIPsCommand(app: App): Command {
  const command = new Command({
    Use: "ips",
    Example: "superuser ips 127.0.0.1 10.0.0.0/24",
    Short:
      "Updates the superuser IPs whitelist setting (the IPs/subnets arguments must be space separated; leave empty to clear the whitelist restriction)",
    SilenceUsage: true,
  });

  command.RunE = async (_cmd, args) => {
    const ips = await superuserIPs(app, args);

    if (ips.length === 0) {
      green("Successfully cleared SuperuserIPs setting!\n");
      return null;
    }

    bgGreenFgBlack("Successfully updated SuperuserIPs setting:\n");
    for (let i = 0; i < ips.length; i += 1) {
      const prefix = i === ips.length - 1 ? "└─" : "├─";
      green("%s %s\n", prefix, ips[i] ?? "");
    }
    return null;
  };

  return command;
}

async function ensureReady(app: App): Promise<void> {
  await bootstrapIfNeededAsync(app);
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
