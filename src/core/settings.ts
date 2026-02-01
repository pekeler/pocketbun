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

export class Settings {
  trustedProxy: TrustedProxyConfig;
  meta: MetaConfig;
  smtp: SMTPConfig;
  logs: LogsConfig;
  rateLimits: RateLimitsConfig;

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
    this.rateLimits = new RateLimitsConfig();
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

    const rateLimits = raw.rateLimits;
    if (rateLimits && typeof rateLimits === "object") {
      const record = rateLimits as Record<string, unknown>;
      if (typeof record.enabled === "boolean") {
        this.rateLimits.enabled = record.enabled;
      }

      const rules = record.rules;
      if (Array.isArray(rules)) {
        const parsed: RateLimitRule[] = [];
        for (const rule of rules) {
          if (!rule || typeof rule !== "object") {
            continue;
          }
          const entry = rule as Record<string, unknown>;
          const label = typeof entry.label === "string" ? entry.label : "";
          const audience = typeof entry.audience === "string" ? entry.audience : RateLimitRuleAudienceAll;
          const maxRequests =
            typeof entry.maxRequests === "number" && Number.isFinite(entry.maxRequests) ? entry.maxRequests : 0;
          const duration = typeof entry.duration === "number" && Number.isFinite(entry.duration) ? entry.duration : 0;

          if (!label || maxRequests <= 0 || duration <= 0) {
            continue;
          }

          parsed.push({ label, audience, maxRequests, duration });
        }

        this.rateLimits.rules = parsed;
      }
    }
  }
}
