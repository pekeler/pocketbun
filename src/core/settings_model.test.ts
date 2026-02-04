// Ported from pocketbase/core/settings_model_test.go.

import { describe, expect, it } from "bun:test";
import { newTestApp } from "../tests/app.ts";
import { testValidationErrors } from "../tests/validation_errors.ts";
import { SMTPAuthLogin } from "../tools/mailer/smtp.ts";
import {
  RateLimitRuleAudienceAuth,
  RateLimitRuleAudienceGuest,
  RateLimitsConfig,
  Settings,
  rateLimitRuleDurationTime,
  rateLimitRuleString,
  validateBackupsConfig,
  validateBatchConfig,
  validateLogsConfig,
  validateMetaConfig,
  validateRateLimitRuleConfig,
  validateRateLimitsConfig,
  validateS3Config,
  validateSMTPConfig,
  type BackupsConfig,
  type BatchConfig,
  type LogsConfig,
  type MetaConfig,
  type RateLimitRule,
  type S3Config,
  type SMTPConfig,
} from "./settings_model.ts";

function newEmptySettings(): Settings {
  const settings = new Settings();
  settings.trustedProxy = {
    headers: [],
    useLeftmostIP: false,
  };
  settings.meta = {
    appName: "",
    appURL: "",
    hideControls: false,
    senderName: "",
    senderAddress: "",
  };
  settings.smtp = {
    enabled: false,
    host: "",
    port: 0,
    username: "",
    password: "",
    tls: false,
    authMethod: "",
    localName: "",
  };
  settings.s3 = {
    enabled: false,
    bucket: "",
    region: "",
    endpoint: "",
    accessKey: "",
    secret: "",
    forcePathStyle: false,
  };
  settings.backups = {
    cron: "",
    cronMaxKeep: 0,
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
  settings.logs = {
    maxDays: 0,
    minLevel: 0,
    logIP: false,
    logAuthId: false,
  };
  settings.rateLimits = new RateLimitsConfig();
  settings.rateLimits.enabled = false;
  settings.rateLimits.rules = [];
  settings.batch = {
    enabled: false,
    maxRequests: 0,
    timeout: 0,
    maxBodySize: 0,
  };
  return settings;
}

describe("settings model", () => {
  it("SettingsDelete", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const err = await app.Delete(app.settings());
      expect(err).not.toBeNull();
    } finally {
      await cleanup();
    }
  });

  it("SettingsMerge", () => {
    const s1 = newEmptySettings();
    s1.meta.appURL = "app_url";

    const s2 = newEmptySettings();
    s2.meta.appName = "test";
    s2.logs.maxDays = 123;
    s2.smtp.host = "test";
    s2.smtp.enabled = true;
    s2.s3.enabled = true;
    s2.s3.endpoint = "test";
    s2.backups.cron = "* * * * *";
    s2.batch.timeout = 15;

    const mergeErr = s1.Merge(s2);
    expect(mergeErr).toBeNull();

    const s1Encoded = JSON.stringify(s1);
    const s2Encoded = JSON.stringify(s2);
    expect(s1Encoded).toBe(s2Encoded);
  });

  it("SettingsClone", () => {
    const s1 = newEmptySettings();
    s1.meta.appName = "test_name";

    const s2 = s1.Clone();

    const s1Encoded = JSON.stringify(s1);
    const s2Encoded = JSON.stringify(s2);
    expect(s1Encoded).toBe(s2Encoded);

    s2.meta.appName = "new_test_name";
    expect(s1.meta.appName).not.toBe(s2.meta.appName);
  });

  it("SettingsMarshalJSON", () => {
    const settings = newEmptySettings();

    settings.meta.appName = "test123";
    settings.smtp.username = "abc";

    const testSecret = "test_secret";
    settings.smtp.password = testSecret;
    settings.s3.secret = testSecret;
    settings.backups.s3.secret = testSecret;

    const rawStr = JSON.stringify(settings);

    const expected =
      '{"smtp":{"enabled":false,"port":0,"host":"","username":"abc","authMethod":"","tls":false,"localName":""},"backups":{"cron":"","cronMaxKeep":0,"s3":{"enabled":false,"bucket":"","region":"","endpoint":"","accessKey":"","forcePathStyle":false}},"s3":{"enabled":false,"bucket":"","region":"","endpoint":"","accessKey":"","forcePathStyle":false},"meta":{"appName":"test123","appURL":"","senderName":"","senderAddress":"","hideControls":false},"rateLimits":{"rules":[],"enabled":false},"trustedProxy":{"headers":[],"useLeftmostIP":false},"batch":{"enabled":false,"maxRequests":0,"timeout":0,"maxBodySize":0},"logs":{"maxDays":0,"minLevel":0,"logIP":false,"logAuthId":false}}';

    expect(rawStr).toBe(expected);
  });

  it("SettingsValidate", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const s = app.settings();

      s.meta.appName = "";
      s.logs.maxDays = -10;
      s.smtp.enabled = true;
      s.smtp.host = "";
      s.s3.enabled = true;
      s.s3.endpoint = "invalid";
      s.backups.cron = "invalid";
      s.backups.cronMaxKeep = -10;
      s.batch.enabled = true;
      s.batch.maxRequests = -1;
      s.batch.timeout = -1;
      s.rateLimits.enabled = true;
      s.rateLimits.rules = null as unknown as RateLimitRule[];

      const err = await app.Validate(s);
      expect(err).not.toBeNull();

      testValidationErrors(err, ["meta", "logs", "smtp", "s3", "backups", "batch", "rateLimits"]);
    } finally {
      await cleanup();
    }
  });

  it("MetaConfigValidate", () => {
    const scenarios: Array<{ name: string; config: MetaConfig; expectedErrors: string[] }> = [
      {
        name: "zero values",
        config: { appName: "", appURL: "", senderName: "", senderAddress: "", hideControls: false },
        expectedErrors: ["appName", "appURL", "senderName", "senderAddress"],
      },
      {
        name: "invalid data",
        config: {
          appName: "a".repeat(300),
          appURL: "test",
          senderName: "a".repeat(300),
          senderAddress: "invalid_email",
          hideControls: false,
        },
        expectedErrors: ["appName", "appURL", "senderName", "senderAddress"],
      },
      {
        name: "valid data",
        config: {
          appName: "test",
          appURL: "https://example.com",
          senderName: "test",
          senderAddress: "test@example.com",
          hideControls: false,
        },
        expectedErrors: [],
      },
    ];

    for (const scenario of scenarios) {
      const result = validateMetaConfig(scenario.config);
      testValidationErrors(result, scenario.expectedErrors);
    }
  });

  it("LogsConfigValidate", () => {
    const scenarios: Array<{ name: string; config: LogsConfig; expectedErrors: string[] }> = [
      { name: "zero values", config: { maxDays: 0, minLevel: 0, logIP: false, logAuthId: false }, expectedErrors: [] },
      {
        name: "invalid data",
        config: { maxDays: -1, minLevel: 0, logIP: false, logAuthId: false },
        expectedErrors: ["maxDays"],
      },
      { name: "valid data", config: { maxDays: 2, minLevel: 0, logIP: false, logAuthId: false }, expectedErrors: [] },
    ];

    for (const scenario of scenarios) {
      const result = validateLogsConfig(scenario.config);
      testValidationErrors(result, scenario.expectedErrors);
    }
  });

  it("SMTPConfigValidate", () => {
    const scenarios: Array<{ name: string; config: SMTPConfig; expectedErrors: string[] }> = [
      {
        name: "zero values (disabled)",
        config: {
          enabled: false,
          host: "",
          port: 0,
          username: "",
          password: "",
          tls: false,
          authMethod: "",
          localName: "",
        },
        expectedErrors: [],
      },
      {
        name: "zero values (enabled)",
        config: {
          enabled: true,
          host: "",
          port: 0,
          username: "",
          password: "",
          tls: false,
          authMethod: "",
          localName: "",
        },
        expectedErrors: ["host", "port"],
      },
      {
        name: "invalid data",
        config: {
          enabled: true,
          host: "test:test:test",
          port: -10,
          username: "",
          password: "",
          tls: false,
          authMethod: "invalid",
          localName: "invalid!",
        },
        expectedErrors: ["host", "port", "authMethod", "localName"],
      },
      {
        name: "valid data (no explicit auth method and localName)",
        config: {
          enabled: true,
          host: "example.com",
          port: 100,
          username: "",
          password: "",
          tls: true,
          authMethod: "",
          localName: "",
        },
        expectedErrors: [],
      },
      {
        name: "valid data (explicit auth method and localName)",
        config: {
          enabled: true,
          host: "example.com",
          port: 100,
          username: "",
          password: "",
          tls: false,
          authMethod: SMTPAuthLogin,
          localName: "example.com",
        },
        expectedErrors: [],
      },
    ];

    for (const scenario of scenarios) {
      const result = validateSMTPConfig(scenario.config);
      testValidationErrors(result, scenario.expectedErrors);
    }
  });

  it("S3ConfigValidate", () => {
    const scenarios: Array<{ name: string; config: S3Config; expectedErrors: string[] }> = [
      {
        name: "zero values (disabled)",
        config: {
          enabled: false,
          bucket: "",
          region: "",
          endpoint: "",
          accessKey: "",
          secret: "",
          forcePathStyle: false,
        },
        expectedErrors: [],
      },
      {
        name: "zero values (enabled)",
        config: {
          enabled: true,
          bucket: "",
          region: "",
          endpoint: "",
          accessKey: "",
          secret: "",
          forcePathStyle: false,
        },
        expectedErrors: ["bucket", "region", "endpoint", "accessKey", "secret"],
      },
      {
        name: "invalid data",
        config: {
          enabled: true,
          bucket: "",
          region: "",
          endpoint: "test:test:test",
          accessKey: "",
          secret: "",
          forcePathStyle: false,
        },
        expectedErrors: ["bucket", "region", "endpoint", "accessKey", "secret"],
      },
      {
        name: "valid data (url endpoint)",
        config: {
          enabled: true,
          bucket: "test",
          region: "test",
          endpoint: "https://localhost:8090",
          accessKey: "test",
          secret: "test",
          forcePathStyle: false,
        },
        expectedErrors: [],
      },
      {
        name: "valid data (hostname endpoint)",
        config: {
          enabled: true,
          bucket: "test",
          region: "test",
          endpoint: "example.com",
          accessKey: "test",
          secret: "test",
          forcePathStyle: false,
        },
        expectedErrors: [],
      },
    ];

    for (const scenario of scenarios) {
      const result = validateS3Config(scenario.config);
      testValidationErrors(result, scenario.expectedErrors);
    }
  });

  it("BackupsConfigValidate", () => {
    const scenarios: Array<{ name: string; config: BackupsConfig; expectedErrors: string[] }> = [
      {
        name: "zero value",
        config: {
          cron: "",
          cronMaxKeep: 0,
          s3: {
            enabled: false,
            bucket: "",
            region: "",
            endpoint: "",
            accessKey: "",
            secret: "",
            forcePathStyle: false,
          },
        },
        expectedErrors: [],
      },
      {
        name: "invalid cron",
        config: {
          cron: "invalid",
          cronMaxKeep: 0,
          s3: {
            enabled: false,
            bucket: "",
            region: "",
            endpoint: "",
            accessKey: "",
            secret: "",
            forcePathStyle: false,
          },
        },
        expectedErrors: ["cron", "cronMaxKeep"],
      },
      {
        name: "invalid enabled S3",
        config: {
          cron: "",
          cronMaxKeep: 0,
          s3: {
            enabled: true,
            bucket: "",
            region: "",
            endpoint: "",
            accessKey: "",
            secret: "",
            forcePathStyle: false,
          },
        },
        expectedErrors: ["s3"],
      },
      {
        name: "valid data",
        config: {
          cron: "*/10 * * * *",
          cronMaxKeep: 1,
          s3: {
            enabled: true,
            bucket: "test",
            region: "test",
            endpoint: "example.com",
            accessKey: "test",
            secret: "test",
            forcePathStyle: false,
          },
        },
        expectedErrors: [],
      },
    ];

    for (const scenario of scenarios) {
      const result = validateBackupsConfig(scenario.config);
      testValidationErrors(result, scenario.expectedErrors);
    }
  });

  it("BatchConfigValidate", () => {
    const scenarios: Array<{ name: string; config: BatchConfig; expectedErrors: string[] }> = [
      {
        name: "zero value",
        config: { enabled: false, maxRequests: 0, timeout: 0, maxBodySize: 0 },
        expectedErrors: [],
      },
      {
        name: "zero value (enabled)",
        config: { enabled: true, maxRequests: 0, timeout: 0, maxBodySize: 0 },
        expectedErrors: ["maxRequests", "timeout"],
      },
      {
        name: "invalid data (negative values)",
        config: { enabled: false, maxRequests: -1, timeout: -1, maxBodySize: -1 },
        expectedErrors: ["maxRequests", "timeout", "maxBodySize"],
      },
      {
        name: "min fields valid data",
        config: { enabled: true, maxRequests: 1, timeout: 1, maxBodySize: 0 },
        expectedErrors: [],
      },
      {
        name: "all fields valid data",
        config: { enabled: true, maxRequests: 10, timeout: 1, maxBodySize: 1 },
        expectedErrors: [],
      },
    ];

    for (const scenario of scenarios) {
      const result = validateBatchConfig(scenario.config);
      testValidationErrors(result, scenario.expectedErrors);
    }
  });

  it("RateLimitsConfigValidate", () => {
    const scenarios: Array<{ name: string; config: RateLimitsConfig; expectedErrors: string[] }> = [
      {
        name: "zero value (disabled)",
        config: Object.assign(new RateLimitsConfig(), { enabled: false, rules: [] }),
        expectedErrors: [],
      },
      {
        name: "zero value (enabled)",
        config: Object.assign(new RateLimitsConfig(), { enabled: true, rules: [] }),
        expectedErrors: ["rules"],
      },
      {
        name: "invalid data",
        config: Object.assign(new RateLimitsConfig(), {
          enabled: true,
          rules: [
            { label: "/123abc/", duration: 1, maxRequests: 2 },
            { label: "!abc", duration: -1, maxRequests: -1 },
          ],
        }),
        expectedErrors: ["rules"],
      },
      {
        name: "valid data",
        config: Object.assign(new RateLimitsConfig(), {
          enabled: true,
          rules: [
            { label: "123_abc", duration: 1, maxRequests: 2 },
            { label: "/456-abc", duration: 1, maxRequests: 2 },
          ],
        }),
        expectedErrors: [],
      },
      {
        name: "duplicated rules with the same audience",
        config: Object.assign(new RateLimitsConfig(), {
          enabled: true,
          rules: [
            { label: "/a", duration: 1, maxRequests: 2 },
            { label: "/a", duration: 2, maxRequests: 3 },
          ],
        }),
        expectedErrors: ["rules"],
      },
      {
        name: "duplicated rule with conflicting audience (A)",
        config: Object.assign(new RateLimitsConfig(), {
          enabled: true,
          rules: [
            { label: "/a", duration: 1, maxRequests: 2 },
            { label: "/a", duration: 1, maxRequests: 2, audience: RateLimitRuleAudienceGuest },
          ],
        }),
        expectedErrors: ["rules"],
      },
      {
        name: "duplicated rule with conflicting audience (B)",
        config: Object.assign(new RateLimitsConfig(), {
          enabled: true,
          rules: [
            { label: "/a", duration: 1, maxRequests: 2, audience: RateLimitRuleAudienceAuth },
            { label: "/a", duration: 1, maxRequests: 2 },
          ],
        }),
        expectedErrors: ["rules"],
      },
      {
        name: "duplicated rule with non-conflicting audience",
        config: Object.assign(new RateLimitsConfig(), {
          enabled: true,
          rules: [
            { label: "/a", duration: 1, maxRequests: 2, audience: RateLimitRuleAudienceAuth },
            { label: "/a", duration: 1, maxRequests: 2, audience: RateLimitRuleAudienceGuest },
          ],
        }),
        expectedErrors: [],
      },
    ];

    for (const scenario of scenarios) {
      const result = validateRateLimitsConfig(scenario.config);
      testValidationErrors(result, scenario.expectedErrors);
    }
  });

  it("RateLimitsFindRateLimitRule", () => {
    const limits = new RateLimitsConfig();
    limits.rules = [
      { label: "abc", duration: 0, maxRequests: 0 },
      { label: "def", audience: RateLimitRuleAudienceGuest, duration: 0, maxRequests: 0 },
      { label: "/test/a", audience: RateLimitRuleAudienceGuest, duration: 0, maxRequests: 0 },
      { label: "POST /test/a", duration: 0, maxRequests: 0 },
      { label: "/test/a/", audience: RateLimitRuleAudienceAuth, duration: 0, maxRequests: 0 },
      { label: "POST /test/a/", duration: 0, maxRequests: 0 },
    ];

    const scenarios: Array<{ labels: string[]; audience: string[]; expected: string }> = [
      { labels: [], audience: [], expected: "" },
      { labels: ["missing"], audience: [], expected: "" },
      { labels: ["abc"], audience: [], expected: "abc" },
      { labels: ["abc"], audience: [RateLimitRuleAudienceGuest], expected: "" },
      { labels: ["abc"], audience: [RateLimitRuleAudienceAuth], expected: "" },
      { labels: ["def"], audience: [RateLimitRuleAudienceGuest], expected: "def" },
      { labels: ["def"], audience: [RateLimitRuleAudienceAuth], expected: "" },
      { labels: ["/test"], audience: [], expected: "" },
      { labels: ["/test/a"], audience: [], expected: "/test/a" },
      { labels: ["/test/a"], audience: [RateLimitRuleAudienceAuth], expected: "/test/a/" },
      { labels: ["/test/a"], audience: [RateLimitRuleAudienceGuest], expected: "/test/a" },
      { labels: ["GET /test/a"], audience: [], expected: "" },
      { labels: ["POST /test/a"], audience: [], expected: "POST /test/a" },
      { labels: ["/test/a/b/c"], audience: [], expected: "/test/a/" },
      { labels: ["/test/a/b/c"], audience: [RateLimitRuleAudienceAuth], expected: "/test/a/" },
      { labels: ["/test/a/b/c"], audience: [RateLimitRuleAudienceGuest], expected: "" },
      { labels: ["GET /test/a/b/c"], audience: [], expected: "" },
      { labels: ["POST /test/a/b/c"], audience: [], expected: "POST /test/a/" },
      { labels: ["/test/a", "abc"], audience: [], expected: "/test/a" },
    ];

    for (const scenario of scenarios) {
      const [rule, ok] = limits.FindRateLimitRule(scenario.labels, ...scenario.audience);
      const hasLabel = Boolean(rule?.label);
      expect(hasLabel).toBe(ok);
      expect(rule?.label ?? "").toBe(scenario.expected);
    }
  });

  it("RateLimitRuleValidate", () => {
    const scenarios: Array<{ name: string; rule: RateLimitRule; expectedErrors: string[] }> = [
      {
        name: "zero value",
        rule: { label: "", duration: 0, maxRequests: 0 },
        expectedErrors: ["label", "duration", "maxRequests"],
      },
      {
        name: "invalid data",
        rule: { label: "@abc", duration: -1, maxRequests: -1, audience: "invalid" },
        expectedErrors: ["label", "duration", "maxRequests", "audience"],
      },
      { name: "valid data (name)", rule: { label: "abc:123", duration: 1, maxRequests: 1 }, expectedErrors: [] },
      { name: "valid data (name:action)", rule: { label: "abc:123", duration: 1, maxRequests: 1 }, expectedErrors: [] },
      { name: "valid data (*:action)", rule: { label: "*:123", duration: 1, maxRequests: 1 }, expectedErrors: [] },
      { name: "valid data (path /a/b)", rule: { label: "/a/b", duration: 1, maxRequests: 1 }, expectedErrors: [] },
      { name: "valid data (path POST /a/b)", rule: { label: "POST /a/b/", duration: 1, maxRequests: 1 }, expectedErrors: [] },
      {
        name: "invalid audience",
        rule: { label: "/a/b/", duration: 1, maxRequests: 1, audience: "invalid" },
        expectedErrors: ["audience"],
      },
      {
        name: "valid audience - " + RateLimitRuleAudienceGuest,
        rule: { label: "POST /a/b/", duration: 1, maxRequests: 1, audience: RateLimitRuleAudienceGuest },
        expectedErrors: [],
      },
      {
        name: "valid audience - " + RateLimitRuleAudienceAuth,
        rule: { label: "POST /a/b/", duration: 1, maxRequests: 1, audience: RateLimitRuleAudienceAuth },
        expectedErrors: [],
      },
    ];

    for (const scenario of scenarios) {
      const result = validateRateLimitRuleConfig(scenario.rule);
      testValidationErrors(result, scenario.expectedErrors);
    }
  });

  it("RateLimitRuleDurationTime", () => {
    const scenarios = [
      { rule: { label: "", duration: 0, maxRequests: 0 }, expected: 0 },
      { rule: { label: "", duration: 1234, maxRequests: 0 }, expected: 1234 },
    ];

    for (const scenario of scenarios) {
      expect(rateLimitRuleDurationTime(scenario.rule)).toBe(scenario.expected);
    }
  });

  it("RateLimitRuleString", () => {
    const scenarios = [
      {
        name: "empty",
        rule: { label: "", audience: "", duration: 0, maxRequests: 0 },
        expected: '{"label":"","audience":"","duration":0,"maxRequests":0}',
      },
      {
        name: "all fields",
        rule: { label: "POST /a/b/", duration: 1, maxRequests: 2, audience: RateLimitRuleAudienceAuth },
        expected: '{"label":"POST /a/b/","audience":"@auth","duration":1,"maxRequests":2}',
      },
    ];

    for (const scenario of scenarios) {
      expect(rateLimitRuleString(scenario.rule)).toBe(scenario.expected);
    }
  });
});
