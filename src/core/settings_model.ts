// Ported from pocketbase/core/settings_model.go (partial: settings structure + validation helpers).

import type { App } from "./app.ts";
import { ValidationErrors, newError, required } from "../internal/compat/validation.ts";
import { NewSchedule } from "../tools/cron/schedule.ts";
import { decrypt } from "../tools/security/encrypt.ts";
import { JSONRaw } from "../tools/types/json_raw.ts";

export const ParamsTableName = "_params";
export const ParamsKeySettings = "settings";

export type TrustedProxyConfig = {
  headers: string[];
  useLeftmostIP: boolean;
};

export type MetaConfig = {
  appName: string;
  appURL: string;
  hideControls: boolean;
  senderName: string;
  senderAddress: string;
};

export type SMTPConfig = {
  enabled: boolean;
  host: string;
  port: number;
  username: string;
  password: string;
  tls: boolean;
  authMethod: string;
  localName: string;
};

export type S3Config = {
  enabled: boolean;
  bucket: string;
  region: string;
  endpoint: string;
  accessKey: string;
  secret: string;
  forcePathStyle: boolean;
};

export type BatchConfig = {
  enabled: boolean;
  maxRequests: number;
  timeout: number;
  maxBodySize: number;
};

export type BackupsConfig = {
  cron: string;
  cronMaxKeep: number;
  s3: S3Config;
};

export type LogsConfig = {
  maxDays: number;
  minLevel: number;
  logIP: boolean;
  logAuthId: boolean;
};

export const RateLimitRuleAudienceAll = "";
export const RateLimitRuleAudienceGuest = "@guest";
export const RateLimitRuleAudienceAuth = "@auth";

export type RateLimitRule = {
  label: string;
  audience?: string;
  duration: number;
  maxRequests: number;
};

export class RateLimitsConfig {
  rules: RateLimitRule[];
  enabled: boolean;

  constructor() {
    this.enabled = false;
    this.rules = [
      { label: "*:auth", maxRequests: 2, duration: 3, audience: RateLimitRuleAudienceAll },
      { label: "*:create", maxRequests: 20, duration: 5, audience: RateLimitRuleAudienceAll },
      { label: "/api/batch", maxRequests: 3, duration: 1, audience: RateLimitRuleAudienceAll },
      { label: "/api/", maxRequests: 300, duration: 10, audience: RateLimitRuleAudienceAll },
    ];
  }

  findRateLimitRule(searchLabels: string[], ...optOnlyAudience: string[]): [RateLimitRule | null, boolean] {
    const prefixRules: number[] = [];

    for (let i = 0; i < searchLabels.length; i += 1) {
      const label = searchLabels[i];

      for (let j = 0; j < this.rules.length; j += 1) {
        const rule = this.rules[j];
        if (!rule) {
          continue;
        }
        if (
          label === rule.label &&
          (optOnlyAudience.length === 0 || optOnlyAudience.includes(rule.audience ?? RateLimitRuleAudienceAll))
        ) {
          return [rule, true];
        }

        if (i === 0 && rule.label.endsWith("/")) {
          prefixRules.push(j);
        }
      }

      if (prefixRules.length > 0) {
        for (const index of prefixRules) {
          const rule = this.rules[index];
          if (!rule) {
            continue;
          }
          if (
            (label + "/").startsWith(rule.label) &&
            (optOnlyAudience.length === 0 || optOnlyAudience.includes(rule.audience ?? RateLimitRuleAudienceAll))
          ) {
            return [rule, true];
          }
        }
      }
    }

    return [null, false];
  }
}

type SettingsSnapshot = {
  smtp: SMTPConfig;
  backups: BackupsConfig;
  s3: S3Config;
  meta: MetaConfig;
  rateLimits: { rules: RateLimitRule[]; enabled: boolean };
  trustedProxy: TrustedProxyConfig;
  batch: BatchConfig;
  logs: LogsConfig;
};

type SettingsSnapshotJSON = Omit<SettingsSnapshot, "smtp" | "s3" | "backups"> & {
  smtp: Omit<SMTPConfig, "password">;
  s3: Omit<S3Config, "secret">;
  backups: Omit<BackupsConfig, "s3"> & { s3: Omit<S3Config, "secret"> };
};

export class Settings {
  trustedProxy: TrustedProxyConfig;
  meta: MetaConfig;
  smtp: SMTPConfig;
  s3: S3Config;
  backups: BackupsConfig;
  logs: LogsConfig;
  rateLimits: RateLimitsConfig;
  batch: BatchConfig;
  #isNew: boolean;

  constructor() {
    this.#isNew = true;
    this.trustedProxy = {
      headers: [],
      useLeftmostIP: false,
    };
    this.meta = {
      appName: "Acme",
      appURL: "http://localhost:8090",
      hideControls: false,
      senderName: "Support",
      senderAddress: "support@example.com",
    };
    this.smtp = {
      enabled: false,
      host: "smtp.example.com",
      port: 587,
      username: "",
      password: "",
      tls: false,
      authMethod: "",
      localName: "",
    };
    this.s3 = {
      enabled: false,
      bucket: "",
      region: "",
      endpoint: "",
      accessKey: "",
      secret: "",
      forcePathStyle: false,
    };
    this.backups = {
      cron: "",
      cronMaxKeep: 3,
      s3: {
        enabled: false,
        bucket: "",
        region: "",
        endpoint: "",
        accessKey: "",
        secret: "",
        forcePathStyle: false,
      },
    };
    this.logs = {
      maxDays: 5,
      minLevel: 0,
      logIP: true,
      logAuthId: false,
    };
    this.rateLimits = new RateLimitsConfig();
    this.batch = {
      enabled: false,
      maxRequests: 50,
      timeout: 3,
      maxBodySize: 0,
    };
  }

  TableName(): string {
    return ParamsTableName;
  }

  PK(): string {
    return ParamsKeySettings;
  }

  LastSavedPK(): string {
    return ParamsKeySettings;
  }

  isNew(): boolean {
    return this.#isNew;
  }

  IsNew(): boolean {
    return this.isNew();
  }

  MarkAsNew(): void {
    this.#isNew = true;
  }

  MarkAsNotNew(): void {
    this.#isNew = false;
  }

  PostScan(): Error | null {
    this.MarkAsNotNew();
    return null;
  }

  Clone(): Settings {
    const clone = new Settings();
    clone.loadFromJSON(this.toRaw());
    clone.#isNew = this.#isNew;
    return clone;
  }

  Merge(other: Settings): Error | null {
    this.loadFromJSON(other.toRaw());
    this.#isNew = other.#isNew;
    return null;
  }

  toRaw(): SettingsSnapshot {
    return {
      smtp: { ...this.smtp },
      backups: {
        cron: this.backups.cron,
        cronMaxKeep: this.backups.cronMaxKeep,
        s3: { ...this.backups.s3 },
      },
      s3: { ...this.s3 },
      meta: { ...this.meta },
      rateLimits: {
        enabled: this.rateLimits.enabled,
        rules: this.rateLimits.rules.map((rule) => ({ ...rule })),
      },
      trustedProxy: {
        headers: Array.isArray(this.trustedProxy.headers) ? [...this.trustedProxy.headers] : [],
        useLeftmostIP: this.trustedProxy.useLeftmostIP,
      },
      batch: { ...this.batch },
      logs: { ...this.logs },
    };
  }

  toJSON(): SettingsSnapshotJSON {
    const snapshot = this.toRaw();
    const { password: _password, ...smtp } = snapshot.smtp;
    const { secret: _secret, ...s3 } = snapshot.s3;
    const { secret: _backupSecret, ...backupsS3 } = snapshot.backups.s3;
    return {
      ...snapshot,
      smtp,
      s3,
      backups: {
        ...snapshot.backups,
        s3: backupsS3,
      },
    };
  }

  loadFromJSON(value: unknown): void {
    if (!value || typeof value !== "object") {
      return;
    }

    const raw = value as Record<string, unknown>;

    const trustedProxy = raw.trustedProxy;
    if (trustedProxy && typeof trustedProxy === "object") {
      const record = trustedProxy as Record<string, unknown>;
      if (Array.isArray(record.headers)) {
        this.trustedProxy.headers = record.headers.filter((entry) => typeof entry === "string");
      }
      if (typeof record.useLeftmostIP === "boolean") {
        this.trustedProxy.useLeftmostIP = record.useLeftmostIP;
      }
    }

    const meta = raw.meta;
    if (meta && typeof meta === "object") {
      const record = meta as Record<string, unknown>;
      if (hasOwn(record, "appName") && typeof record.appName === "string") {
        this.meta.appName = record.appName;
      }
      if (hasOwn(record, "appURL") && typeof record.appURL === "string") {
        this.meta.appURL = record.appURL;
      }
      if (hasOwn(record, "hideControls") && typeof record.hideControls === "boolean") {
        this.meta.hideControls = record.hideControls;
      }
      if (hasOwn(record, "senderName") && typeof record.senderName === "string") {
        this.meta.senderName = record.senderName;
      }
      if (hasOwn(record, "senderAddress") && typeof record.senderAddress === "string") {
        this.meta.senderAddress = record.senderAddress;
      }
    }

    const smtp = raw.smtp;
    if (smtp && typeof smtp === "object") {
      const record = smtp as Record<string, unknown>;
      if (hasOwn(record, "enabled") && typeof record.enabled === "boolean") {
        this.smtp.enabled = record.enabled;
      }
      if (hasOwn(record, "host") && typeof record.host === "string") {
        this.smtp.host = record.host;
      }
      if (hasOwn(record, "port") && typeof record.port === "number") {
        this.smtp.port = record.port;
      }
      if (hasOwn(record, "username") && typeof record.username === "string") {
        this.smtp.username = record.username;
      }
      if (hasOwn(record, "password") && typeof record.password === "string") {
        this.smtp.password = record.password;
      }
      if (hasOwn(record, "tls") && typeof record.tls === "boolean") {
        this.smtp.tls = record.tls;
      }
      if (hasOwn(record, "authMethod") && typeof record.authMethod === "string") {
        this.smtp.authMethod = record.authMethod;
      }
      if (hasOwn(record, "localName") && typeof record.localName === "string") {
        this.smtp.localName = record.localName;
      }
    }

    const s3 = raw.s3;
    if (s3 && typeof s3 === "object") {
      applyS3Config(this.s3, s3 as Record<string, unknown>);
    }

    const backups = raw.backups;
    if (backups && typeof backups === "object") {
      const record = backups as Record<string, unknown>;
      if (hasOwn(record, "cron") && typeof record.cron === "string") {
        this.backups.cron = record.cron;
      }
      if (hasOwn(record, "cronMaxKeep") && typeof record.cronMaxKeep === "number") {
        this.backups.cronMaxKeep = record.cronMaxKeep;
      }
      if (record.s3 && typeof record.s3 === "object") {
        applyS3Config(this.backups.s3, record.s3 as Record<string, unknown>);
      }
    }

    const logs = raw.logs;
    if (logs && typeof logs === "object") {
      const record = logs as Record<string, unknown>;
      if (hasOwn(record, "maxDays") && typeof record.maxDays === "number") {
        this.logs.maxDays = record.maxDays;
      }
      if (hasOwn(record, "minLevel") && typeof record.minLevel === "number") {
        this.logs.minLevel = record.minLevel;
      }
      if (hasOwn(record, "logIP") && typeof record.logIP === "boolean") {
        this.logs.logIP = record.logIP;
      }
      if (hasOwn(record, "logAuthId") && typeof record.logAuthId === "boolean") {
        this.logs.logAuthId = record.logAuthId;
      }
    }

    const rateLimits = raw.rateLimits;
    if (rateLimits && typeof rateLimits === "object") {
      const record = rateLimits as Record<string, unknown>;
      if (hasOwn(record, "enabled") && typeof record.enabled === "boolean") {
        this.rateLimits.enabled = record.enabled;
      }
      if (Array.isArray(record.rules)) {
        this.rateLimits.rules = record.rules
          .filter((rule) => rule && typeof rule === "object" && !Array.isArray(rule))
          .map((rule) => {
            const rawRule = rule as Record<string, unknown>;
            return {
              label: typeof rawRule.label === "string" ? rawRule.label : "",
              audience: typeof rawRule.audience === "string" ? rawRule.audience : undefined,
              duration: typeof rawRule.duration === "number" ? rawRule.duration : 0,
              maxRequests: typeof rawRule.maxRequests === "number" ? rawRule.maxRequests : 0,
            };
          });
      }
    }

    const batch = raw.batch;
    if (batch && typeof batch === "object") {
      const record = batch as Record<string, unknown>;
      if (hasOwn(record, "enabled") && typeof record.enabled === "boolean") {
        this.batch.enabled = record.enabled;
      }
      if (hasOwn(record, "maxRequests") && typeof record.maxRequests === "number") {
        this.batch.maxRequests = record.maxRequests;
      }
      if (hasOwn(record, "timeout") && typeof record.timeout === "number") {
        this.batch.timeout = record.timeout;
      }
      if (hasOwn(record, "maxBodySize") && typeof record.maxBodySize === "number") {
        this.batch.maxBodySize = record.maxBodySize;
      }
    }
  }

  PostValidate(_ctx: unknown, _app: unknown): Error | null {
    const errors: Record<string, Error> = {};

    const metaErr = validateMeta(this.meta);
    if (metaErr) {
      errors.meta = metaErr;
    }

    const logsErr = validateLogs(this.logs);
    if (logsErr) {
      errors.logs = logsErr;
    }

    const smtpErr = validateSMTP(this.smtp);
    if (smtpErr) {
      errors.smtp = smtpErr;
    }

    const s3Err = validateS3(this.s3);
    if (s3Err) {
      errors.s3 = s3Err;
    }

    const backupsErr = validateBackups(this.backups);
    if (backupsErr) {
      errors.backups = backupsErr;
    }

    const batchErr = validateBatch(this.batch);
    if (batchErr) {
      errors.batch = batchErr;
    }

    const rateErr = validateRateLimits(this.rateLimits);
    if (rateErr) {
      errors.rateLimits = rateErr;
    }

    return Object.keys(errors).length > 0 ? new ValidationErrors(errors) : null;
  }

  // loadParam loads the settings from the stored param into the app ones.
  //
  // @todo note that the encryption may get removed in the future since it doesn't
  // really accomplish much and it might be better to find a way to encrypt the backups
  // or implement support for resolving env variables.
  loadParam(app: App, param: { Value: JSONRaw }): Error | null {
    let rawValue = param.Value.String();
    let parsed: unknown;

    try {
      parsed = JSON.parse(rawValue);
    } catch (_plainDecodeErr) {
      const envName = app.encryptionEnv();
      const encryptionKey = process.env[envName] ?? "";
      if (!encryptionKey) {
        return new Error(`invalid settings db data or missing encryption key ${JSON.stringify(envName)}`);
      }

      let decrypted: Uint8Array;
      try {
        decrypted = decrypt(rawValue, encryptionKey);
      } catch (error) {
        return error as Error;
      }

      try {
        rawValue = new TextDecoder().decode(decrypted);
        parsed = JSON.parse(rawValue);
      } catch (error) {
        return error as Error;
      }
    }

    this.loadFromJSON(parsed);
    return this.PostScan();
  }
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function applyS3Config(target: S3Config, raw: Record<string, unknown>): void {
  if (hasOwn(raw, "enabled") && typeof raw.enabled === "boolean") {
    target.enabled = raw.enabled;
  }
  if (hasOwn(raw, "bucket") && typeof raw.bucket === "string") {
    target.bucket = raw.bucket;
  }
  if (hasOwn(raw, "region") && typeof raw.region === "string") {
    target.region = raw.region;
  }
  if (hasOwn(raw, "endpoint") && typeof raw.endpoint === "string") {
    target.endpoint = raw.endpoint;
  }
  if (hasOwn(raw, "accessKey") && typeof raw.accessKey === "string") {
    target.accessKey = raw.accessKey;
  }
  if (hasOwn(raw, "secret") && typeof raw.secret === "string") {
    target.secret = raw.secret;
  }
  if (hasOwn(raw, "forcePathStyle") && typeof raw.forcePathStyle === "boolean") {
    target.forcePathStyle = raw.forcePathStyle;
  }
}

function validateMeta(meta: MetaConfig): Error | null {
  const errors: Record<string, Error> = {};

  const appNameErr = required(meta.appName);
  if (appNameErr) {
    errors.appName = appNameErr;
  } else if (meta.appName.length < 1 || meta.appName.length > 255) {
    errors.appName = newError("validation_length_out_of_range", "The length must be between 1 and 255.");
  }

  const appUrlErr = required(meta.appURL);
  if (appUrlErr) {
    errors.appURL = appUrlErr;
  } else if (!isURL(meta.appURL)) {
    errors.appURL = newError("validation_is_url", "Must be a valid URL.");
  }

  const senderNameErr = required(meta.senderName);
  if (senderNameErr) {
    errors.senderName = senderNameErr;
  } else if (meta.senderName.length < 1 || meta.senderName.length > 255) {
    errors.senderName = newError("validation_length_out_of_range", "The length must be between 1 and 255.");
  }

  const senderAddressErr = required(meta.senderAddress);
  if (senderAddressErr) {
    errors.senderAddress = senderAddressErr;
  } else if (!isEmail(meta.senderAddress)) {
    errors.senderAddress = newError("validation_is_email", "Must be a valid email address.");
  }

  return Object.keys(errors).length > 0 ? new ValidationErrors(errors) : null;
}

function validateLogs(logs: LogsConfig): Error | null {
  if (logs.maxDays < 0) {
    return new ValidationErrors({
      maxDays: newError("validation_min_greater_equal_than_required", "Must be greater or equal to 0."),
    });
  }
  return null;
}

function validateSMTP(smtp: SMTPConfig): Error | null {
  if (!smtp.enabled) {
    return null;
  }

  const errors: Record<string, Error> = {};

  const hostErr = required(smtp.host);
  if (hostErr) {
    errors.host = hostErr;
  }

  const portErr = required(smtp.port);
  if (portErr) {
    errors.port = portErr;
  } else if (smtp.port < 0) {
    errors.port = newError("validation_min_greater_equal_than_required", "Must be greater or equal to 0.");
  }

  if (smtp.authMethod && smtp.authMethod !== "LOGIN" && smtp.authMethod !== "PLAIN") {
    errors.authMethod = newError("validation_in", "Invalid auth method.");
  }

  if (smtp.localName && !isHost(smtp.localName)) {
    errors.localName = newError("validation_invalid_host", "Must be a valid host.");
  }

  return Object.keys(errors).length > 0 ? new ValidationErrors(errors) : null;
}

function validateS3(s3: S3Config): Error | null {
  if (!s3.enabled) {
    return null;
  }

  const errors: Record<string, Error> = {};

  const endpointErr = required(s3.endpoint);
  if (endpointErr) {
    errors.endpoint = endpointErr;
  } else if (!isURL(s3.endpoint)) {
    errors.endpoint = newError("validation_is_url", "Must be a valid URL.");
  }

  const bucketErr = required(s3.bucket);
  if (bucketErr) {
    errors.bucket = bucketErr;
  }

  const regionErr = required(s3.region);
  if (regionErr) {
    errors.region = regionErr;
  }

  const accessKeyErr = required(s3.accessKey);
  if (accessKeyErr) {
    errors.accessKey = accessKeyErr;
  }

  const secretErr = required(s3.secret);
  if (secretErr) {
    errors.secret = secretErr;
  }

  return Object.keys(errors).length > 0 ? new ValidationErrors(errors) : null;
}

function validateBatch(batch: BatchConfig): Error | null {
  const errors: Record<string, Error> = {};

  if (batch.enabled) {
    const requestsErr = required(batch.maxRequests);
    if (requestsErr) {
      errors.maxRequests = requestsErr;
    } else if (batch.maxRequests < 0) {
      errors.maxRequests = newError("validation_min_greater_equal_than_required", "Must be greater or equal to 0.");
    }

    const timeoutErr = required(batch.timeout);
    if (timeoutErr) {
      errors.timeout = timeoutErr;
    } else if (batch.timeout < 0) {
      errors.timeout = newError("validation_min_greater_equal_than_required", "Must be greater or equal to 0.");
    }
  }

  if (batch.maxBodySize < 0) {
    errors.maxBodySize = newError("validation_min_greater_equal_than_required", "Must be greater or equal to 0.");
  }

  return Object.keys(errors).length > 0 ? new ValidationErrors(errors) : null;
}

function validateBackups(backups: BackupsConfig): Error | null {
  const errors: Record<string, Error> = {};

  const s3Err = validateS3(backups.s3);
  if (s3Err) {
    errors.s3 = s3Err;
  }

  if (backups.cron !== "") {
    try {
      NewSchedule(backups.cron);
    } catch (error) {
      errors.cron = newError("validation_invalid_cron", (error as Error).message);
    }

    const maxKeepErr = required(backups.cronMaxKeep);
    if (maxKeepErr) {
      errors.cronMaxKeep = maxKeepErr;
    } else if (backups.cronMaxKeep < 1) {
      errors.cronMaxKeep = newError("validation_min_greater_equal_than_required", "Must be greater or equal to 1.");
    }
  }

  return Object.keys(errors).length > 0 ? new ValidationErrors(errors) : null;
}

function validateRateLimits(rateLimits: RateLimitsConfig): Error | null {
  if (!rateLimits.enabled) {
    return null;
  }

  if (!Array.isArray(rateLimits.rules) || rateLimits.rules.length === 0) {
    return new ValidationErrors({
      rules: newError("validation_required", "Cannot be blank."),
    });
  }

  return null;
}

function isURL(value: string): boolean {
  try {
    const parsed = new URL(value);
    return Boolean(parsed.protocol && parsed.hostname);
  } catch {
    return false;
  }
}

function isEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

function isHost(value: string): boolean {
  return /^[a-zA-Z0-9.-]+$/.test(value);
}
