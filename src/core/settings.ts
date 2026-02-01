// Ported from pocketbase/core/settings_model.go (partial: meta/smtp/logs/trustedProxy).

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

export type LogsConfig = {
  maxDays: number;
  logIP: boolean;
};

export class Settings {
  trustedProxy: TrustedProxyConfig;
  meta: MetaConfig;
  smtp: SMTPConfig;
  logs: LogsConfig;

  constructor() {
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
    this.logs = {
      maxDays: 5,
      logIP: true,
    };
  }

  loadFromJSON(value: unknown): void {
    if (!value || typeof value !== "object") {
      return;
    }

    const raw = value as Record<string, unknown>;

    const trustedProxy = raw.trustedProxy;
    if (trustedProxy && typeof trustedProxy === "object") {
      const headers = (trustedProxy as Record<string, unknown>).headers;
      if (Array.isArray(headers)) {
        this.trustedProxy.headers = headers.filter((entry) => typeof entry === "string");
      }

      const useLeftmostIP = (trustedProxy as Record<string, unknown>).useLeftmostIP;
      if (typeof useLeftmostIP === "boolean") {
        this.trustedProxy.useLeftmostIP = useLeftmostIP;
      }
    }

    const meta = raw.meta;
    if (meta && typeof meta === "object") {
      const record = meta as Record<string, unknown>;
      if (typeof record.appName === "string") {
        this.meta.appName = record.appName;
      }
      if (typeof record.appURL === "string") {
        this.meta.appURL = record.appURL;
      }
      if (typeof record.hideControls === "boolean") {
        this.meta.hideControls = record.hideControls;
      }
      if (typeof record.senderName === "string") {
        this.meta.senderName = record.senderName;
      }
      if (typeof record.senderAddress === "string") {
        this.meta.senderAddress = record.senderAddress;
      }
    }

    const smtp = raw.smtp;
    if (smtp && typeof smtp === "object") {
      const record = smtp as Record<string, unknown>;
      if (typeof record.enabled === "boolean") {
        this.smtp.enabled = record.enabled;
      }
      if (typeof record.host === "string") {
        this.smtp.host = record.host;
      }
      if (typeof record.port === "number" && Number.isFinite(record.port)) {
        this.smtp.port = record.port;
      }
      if (typeof record.username === "string") {
        this.smtp.username = record.username;
      }
      if (typeof record.password === "string") {
        this.smtp.password = record.password;
      }
      if (typeof record.tls === "boolean") {
        this.smtp.tls = record.tls;
      }
      if (typeof record.authMethod === "string") {
        this.smtp.authMethod = record.authMethod;
      }
      if (typeof record.localName === "string") {
        this.smtp.localName = record.localName;
      }
    }

    const logs = raw.logs;
    if (logs && typeof logs === "object") {
      const record = logs as Record<string, unknown>;
      if (typeof record.maxDays === "number" && Number.isFinite(record.maxDays)) {
        this.logs.maxDays = record.maxDays;
      }
      if (typeof record.logIP === "boolean") {
        this.logs.logIP = record.logIP;
      }
    }
  }
}
