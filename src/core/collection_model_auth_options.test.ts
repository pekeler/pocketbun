// Ported from pocketbase/core/collection_model_auth_options_test.go

import { describe, expect, it } from "bun:test";
import { newTestApp } from "../../tests/test_app.ts";
import { testValidationErrors } from "../../tests/validation_errors.ts";
import { Providers } from "../tools/auth/index.ts";
import { NewAuthCollection } from "./collection.ts";
import {
  AuthAlertConfig,
  EmailTemplate,
  MFAConfig,
  OAuth2Config,
  OAuth2ProviderConfig,
  OTPConfig,
  PasswordAuthConfig,
  TokenConfigValue,
} from "./collection_model_auth_options.ts";
import { TextField } from "./field_text.ts";

describe("collection auth options validate", () => {
  it("scenarios", async () => {
    type TestApp = Awaited<ReturnType<typeof newTestApp>>["app"];
    type Scenario = {
      name: string;
      collection: (app?: TestApp) => ReturnType<typeof NewAuthCollection>;
      expectedErrors: string[];
    };

    const scenarios: Scenario[] = [
      {
        name: "nil authRule",
        collection: () => {
          const c = NewAuthCollection("new_auth");
          c.AuthRule = null;
          return c;
        },
        expectedErrors: [],
      },
      {
        name: "empty authRule",
        collection: () => {
          const c = NewAuthCollection("new_auth");
          c.AuthRule = "";
          return c;
        },
        expectedErrors: [],
      },
      {
        name: "invalid authRule",
        collection: () => {
          const c = NewAuthCollection("new_auth");
          c.AuthRule = "missing != ''";
          return c;
        },
        expectedErrors: ["authRule"],
      },
      {
        name: "valid authRule",
        collection: () => {
          const c = NewAuthCollection("new_auth");
          c.AuthRule = "id != ''";
          return c;
        },
        expectedErrors: [],
      },
      {
        name: "nil manageRule",
        collection: () => {
          const c = NewAuthCollection("new_auth");
          c.ManageRule = null;
          return c;
        },
        expectedErrors: [],
      },
      {
        name: "empty manageRule",
        collection: () => {
          const c = NewAuthCollection("new_auth");
          c.ManageRule = "";
          return c;
        },
        expectedErrors: ["manageRule"],
      },
      {
        name: "invalid manageRule",
        collection: () => {
          const c = NewAuthCollection("new_auth");
          c.ManageRule = "missing != ''";
          return c;
        },
        expectedErrors: ["manageRule"],
      },
      {
        name: "valid manageRule",
        collection: () => {
          const c = NewAuthCollection("new_auth");
          c.ManageRule = "id != ''";
          return c;
        },
        expectedErrors: [],
      },
      {
        name: "trigger passwordAuth validations",
        collection: () => {
          const c = NewAuthCollection("new_auth");
          const config = new PasswordAuthConfig();
          config.Enabled = true;
          c.PasswordAuth = config;
          return c;
        },
        expectedErrors: ["passwordAuth"],
      },
      {
        name: "passwordAuth with non-unique identity fields",
        collection: () => {
          const c = NewAuthCollection("new_auth");
          const field = new TextField();
          field.Name = "test";
          c.Fields.Add(field);
          const config = new PasswordAuthConfig();
          config.Enabled = true;
          config.IdentityFields = ["email", "test"];
          c.PasswordAuth = config;
          return c;
        },
        expectedErrors: ["passwordAuth"],
      },
      {
        name: "passwordAuth with non-unique identity fields (with index)",
        collection: () => {
          const c = NewAuthCollection("new_auth");
          const field = new TextField();
          field.Name = "test";
          c.Fields.Add(field);
          c.AddIndex("auth_test_idx", true, "test", "");
          const config = new PasswordAuthConfig();
          config.Enabled = true;
          config.IdentityFields = ["email", "test"];
          c.PasswordAuth = config;
          return c;
        },
        expectedErrors: [],
      },
      {
        name: "trigger oauth2 validations",
        collection: () => {
          const c = NewAuthCollection("new_auth");
          const provider = new OAuth2ProviderConfig();
          provider.Name = "missing";
          const oauth = new OAuth2Config();
          oauth.Enabled = true;
          oauth.Providers = [provider];
          c.OAuth2 = oauth;
          return c;
        },
        expectedErrors: ["oauth2"],
      },
      {
        name: "trigger otp validations",
        collection: () => {
          const c = NewAuthCollection("new_auth");
          const otp = new OTPConfig();
          otp.Enabled = true;
          otp.Duration = -10;
          c.OTP = otp;
          return c;
        },
        expectedErrors: ["otp"],
      },
      {
        name: "trigger mfa validations",
        collection: () => {
          const c = NewAuthCollection("new_auth");
          const mfa = new MFAConfig();
          mfa.Enabled = true;
          mfa.Duration = -10;
          c.MFA = mfa;
          return c;
        },
        expectedErrors: ["mfa"],
      },
      {
        name: "mfa enabled with < 2 auth methods",
        collection: () => {
          const c = NewAuthCollection("new_auth");
          c.MFA.Enabled = true;
          c.PasswordAuth.Enabled = true;
          c.OTP.Enabled = false;
          c.OAuth2.Enabled = false;
          return c;
        },
        expectedErrors: ["mfa"],
      },
      {
        name: "mfa enabled with >= 2 auth methods",
        collection: () => {
          const c = NewAuthCollection("new_auth");
          c.MFA.Enabled = true;
          c.PasswordAuth.Enabled = true;
          c.OTP.Enabled = true;
          c.OAuth2.Enabled = false;
          return c;
        },
        expectedErrors: [],
      },
      {
        name: "mfa disabled with invalid rule",
        collection: () => {
          const c = NewAuthCollection("new_auth");
          c.PasswordAuth.Enabled = true;
          c.OTP.Enabled = true;
          c.MFA.Enabled = false;
          c.MFA.Rule = "invalid";
          return c;
        },
        expectedErrors: [],
      },
      {
        name: "mfa enabled with invalid rule",
        collection: () => {
          const c = NewAuthCollection("new_auth");
          c.PasswordAuth.Enabled = true;
          c.OTP.Enabled = true;
          c.MFA.Enabled = true;
          c.MFA.Rule = "invalid";
          return c;
        },
        expectedErrors: ["mfa"],
      },
      {
        name: "mfa enabled with valid rule",
        collection: () => {
          const c = NewAuthCollection("new_auth");
          c.PasswordAuth.Enabled = true;
          c.OTP.Enabled = true;
          c.MFA.Enabled = true;
          c.MFA.Rule = "1=1";
          return c;
        },
        expectedErrors: [],
      },
      {
        name: "trigger authToken validations",
        collection: () => {
          const c = NewAuthCollection("new_auth");
          c.AuthToken.Secret = "";
          return c;
        },
        expectedErrors: ["authToken"],
      },
      {
        name: "trigger passwordResetToken validations",
        collection: () => {
          const c = NewAuthCollection("new_auth");
          c.PasswordResetToken.Secret = "";
          return c;
        },
        expectedErrors: ["passwordResetToken"],
      },
      {
        name: "trigger emailChangeToken validations",
        collection: () => {
          const c = NewAuthCollection("new_auth");
          c.EmailChangeToken.Secret = "";
          return c;
        },
        expectedErrors: ["emailChangeToken"],
      },
      {
        name: "trigger verificationToken validations",
        collection: () => {
          const c = NewAuthCollection("new_auth");
          c.VerificationToken.Secret = "";
          return c;
        },
        expectedErrors: ["verificationToken"],
      },
      {
        name: "trigger fileToken validations",
        collection: () => {
          const c = NewAuthCollection("new_auth");
          c.FileToken.Secret = "";
          return c;
        },
        expectedErrors: ["fileToken"],
      },
      {
        name: "trigger verificationTemplate validations",
        collection: () => {
          const c = NewAuthCollection("new_auth");
          c.VerificationTemplate.Body = "";
          return c;
        },
        expectedErrors: ["verificationTemplate"],
      },
      {
        name: "trigger resetPasswordTemplate validations",
        collection: () => {
          const c = NewAuthCollection("new_auth");
          c.ResetPasswordTemplate.Body = "";
          return c;
        },
        expectedErrors: ["resetPasswordTemplate"],
      },
      {
        name: "trigger confirmEmailChangeTemplate validations",
        collection: () => {
          const c = NewAuthCollection("new_auth");
          c.ConfirmEmailChangeTemplate.Body = "";
          return c;
        },
        expectedErrors: ["confirmEmailChangeTemplate"],
      },
    ];

    for (const scenario of scenarios) {
      const { app, cleanup } = await newTestApp();
      try {
        const collection = scenario.collection(app);
        const result = app.Validate(collection);
        testValidationErrors(result, scenario.expectedErrors);
      } finally {
        await cleanup();
      }
    }
  });
});

describe("EmailTemplate.Validate", () => {
  it("scenarios", () => {
    const scenarios = [
      {
        name: "zero value",
        template: new EmailTemplate(),
        expectedErrors: ["subject", "body"],
      },
      {
        name: "non-empty data",
        template: new EmailTemplate("a", "b"),
        expectedErrors: [],
      },
    ];

    for (const scenario of scenarios) {
      const result = scenario.template.Validate();
      testValidationErrors(result, scenario.expectedErrors);
    }
  });
});

describe("EmailTemplate.Resolve", () => {
  it("scenarios", () => {
    const template = new EmailTemplate(
      "test_subject {PARAM3} {PARAM1}-{PARAM2} repeat-{PARAM1}",
      "test_body {PARAM3} {PARAM2}-{PARAM1} repeat-{PARAM2}",
    );

    const scenarios = [
      {
        name: "no placeholders",
        placeholders: null as Record<string, unknown> | null,
        expectedSubject: template.Subject,
        expectedBody: template.Body,
      },
      {
        name: "no matching placeholders",
        placeholders: { "{A}": "abc", "{B}": 456 },
        expectedSubject: template.Subject,
        expectedBody: template.Body,
      },
      {
        name: "at least one matching placeholder",
        placeholders: { "{PARAM1}": "abc", "{PARAM2}": 456 },
        expectedSubject: "test_subject {PARAM3} abc-456 repeat-abc",
        expectedBody: "test_body {PARAM3} 456-abc repeat-456",
      },
    ];

    for (const scenario of scenarios) {
      const result = template.Resolve(scenario.placeholders);
      expect(result.subject).toBe(scenario.expectedSubject);
      expect(result.body).toBe(scenario.expectedBody);
    }
  });
});

describe("TokenConfig.Validate", () => {
  it("scenarios", () => {
    const scenarios = [
      {
        name: "zero value",
        config: new TokenConfigValue(),
        expectedErrors: ["secret", "duration"],
      },
      {
        name: "invalid data",
        config: new TokenConfigValue("a".repeat(29), 9),
        expectedErrors: ["secret", "duration"],
      },
      {
        name: "valid data",
        config: new TokenConfigValue("a".repeat(30), 10),
        expectedErrors: [],
      },
    ];

    for (const scenario of scenarios) {
      const result = scenario.config.Validate();
      testValidationErrors(result, scenario.expectedErrors);
    }
  });
});

describe("TokenConfig.DurationTime", () => {
  it("scenarios", () => {
    const scenarios = [
      { config: new TokenConfigValue(), expected: 0 },
      { config: new TokenConfigValue("abc", 1234), expected: 1234 },
    ];

    for (const scenario of scenarios) {
      const result = scenario.config.DurationTime();
      expect(result).toBe(scenario.expected);
    }
  });
});

describe("AuthAlertConfig.Validate", () => {
  it("scenarios", () => {
    const scenarios = [
      {
        name: "zero value (disabled)",
        config: new AuthAlertConfig(),
        expectedErrors: ["emailTemplate"],
      },
      {
        name: "zero value (enabled)",
        config: Object.assign(new AuthAlertConfig(), { Enabled: true }),
        expectedErrors: ["emailTemplate"],
      },
      {
        name: "invalid template",
        config: Object.assign(new AuthAlertConfig(), {
          EmailTemplate: new EmailTemplate("b", ""),
        }),
        expectedErrors: ["emailTemplate"],
      },
      {
        name: "valid data",
        config: Object.assign(new AuthAlertConfig(), {
          EmailTemplate: new EmailTemplate("b", "a"),
        }),
        expectedErrors: [],
      },
    ];

    for (const scenario of scenarios) {
      const result = scenario.config.Validate();
      testValidationErrors(result, scenario.expectedErrors);
    }
  });
});

describe("OTPConfig.Validate", () => {
  it("scenarios", () => {
    const scenarios = [
      {
        name: "zero value (disabled)",
        config: new OTPConfig(),
        expectedErrors: ["emailTemplate"],
      },
      {
        name: "zero value (enabled)",
        config: Object.assign(new OTPConfig(), { Enabled: true }),
        expectedErrors: ["duration", "length", "emailTemplate"],
      },
      {
        name: "invalid length (< 3)",
        config: Object.assign(new OTPConfig(), {
          Enabled: true,
          EmailTemplate: new EmailTemplate("b", "a"),
          Duration: 100,
          Length: 3,
        }),
        expectedErrors: ["length"],
      },
      {
        name: "invalid duration (< 10)",
        config: Object.assign(new OTPConfig(), {
          Enabled: true,
          EmailTemplate: new EmailTemplate("b", "a"),
          Duration: 9,
          Length: 100,
        }),
        expectedErrors: ["duration"],
      },
      {
        name: "invalid duration (> 86400)",
        config: Object.assign(new OTPConfig(), {
          Enabled: true,
          EmailTemplate: new EmailTemplate("b", "a"),
          Duration: 86401,
          Length: 100,
        }),
        expectedErrors: ["duration"],
      },
      {
        name: "invalid template (triggering EmailTemplate validations)",
        config: Object.assign(new OTPConfig(), {
          Enabled: true,
          EmailTemplate: new EmailTemplate("b", ""),
          Duration: 86400,
          Length: 4,
        }),
        expectedErrors: ["emailTemplate"],
      },
      {
        name: "valid data",
        config: Object.assign(new OTPConfig(), {
          Enabled: true,
          EmailTemplate: new EmailTemplate("b", "a"),
          Duration: 86400,
          Length: 4,
        }),
        expectedErrors: [],
      },
    ];

    for (const scenario of scenarios) {
      const result = scenario.config.Validate();
      testValidationErrors(result, scenario.expectedErrors);
    }
  });
});

describe("OTPConfig.DurationTime", () => {
  it("scenarios", () => {
    const scenarios = [
      { config: new OTPConfig(), expected: 0 },
      { config: Object.assign(new OTPConfig(), { Duration: 1234 }), expected: 1234 },
    ];

    for (const scenario of scenarios) {
      const result = scenario.config.DurationTime();
      expect(result).toBe(scenario.expected);
    }
  });
});

describe("MFAConfig.Validate", () => {
  it("scenarios", () => {
    const scenarios = [
      {
        name: "zero value (disabled)",
        config: new MFAConfig(),
        expectedErrors: [],
      },
      {
        name: "zero value (enabled)",
        config: Object.assign(new MFAConfig(), { Enabled: true }),
        expectedErrors: ["duration"],
      },
      {
        name: "invalid duration (< 10)",
        config: Object.assign(new MFAConfig(), { Enabled: true, Duration: 9 }),
        expectedErrors: ["duration"],
      },
      {
        name: "invalid duration (> 86400)",
        config: Object.assign(new MFAConfig(), { Enabled: true, Duration: 86401 }),
        expectedErrors: ["duration"],
      },
      {
        name: "valid data",
        config: Object.assign(new MFAConfig(), { Enabled: true, Duration: 86400 }),
        expectedErrors: [],
      },
    ];

    for (const scenario of scenarios) {
      const result = scenario.config.Validate();
      testValidationErrors(result, scenario.expectedErrors);
    }
  });
});

describe("MFAConfig.DurationTime", () => {
  it("scenarios", () => {
    const scenarios = [
      { config: new MFAConfig(), expected: 0 },
      { config: Object.assign(new MFAConfig(), { Duration: 1234 }), expected: 1234 },
    ];

    for (const scenario of scenarios) {
      const result = scenario.config.DurationTime();
      expect(result).toBe(scenario.expected);
    }
  });
});

describe("PasswordAuthConfig.Validate", () => {
  it("scenarios", () => {
    const scenarios = [
      {
        name: "zero value (disabled)",
        config: new PasswordAuthConfig(),
        expectedErrors: [],
      },
      {
        name: "zero value (enabled)",
        config: Object.assign(new PasswordAuthConfig(), { Enabled: true }),
        expectedErrors: ["identityFields"],
      },
      {
        name: "empty values",
        config: Object.assign(new PasswordAuthConfig(), {
          Enabled: true,
          IdentityFields: ["", ""],
        }),
        expectedErrors: ["identityFields"],
      },
      {
        name: "valid data",
        config: Object.assign(new PasswordAuthConfig(), { Enabled: true, IdentityFields: ["abc"] }),
        expectedErrors: [],
      },
    ];

    for (const scenario of scenarios) {
      const result = scenario.config.Validate();
      testValidationErrors(result, scenario.expectedErrors);
    }
  });
});

describe("OAuth2Config.GetProviderConfig", () => {
  it("scenarios", () => {
    const scenarios = [
      {
        name: "zero value",
        providerName: "gitlab",
        config: new OAuth2Config(),
        expectedExists: false,
      },
      {
        name: "empty config with valid provider",
        providerName: "gitlab",
        config: new OAuth2Config(),
        expectedExists: false,
      },
      {
        name: "non-empty config with missing provider",
        providerName: "gitlab",
        config: Object.assign(new OAuth2Config(), {
          Providers: [
            Object.assign(new OAuth2ProviderConfig(), { Name: "google" }),
            Object.assign(new OAuth2ProviderConfig(), { Name: "github" }),
          ],
        }),
        expectedExists: false,
      },
      {
        name: "config with existing provider",
        providerName: "github",
        config: Object.assign(new OAuth2Config(), {
          Providers: [
            Object.assign(new OAuth2ProviderConfig(), { Name: "google" }),
            Object.assign(new OAuth2ProviderConfig(), { Name: "github" }),
          ],
        }),
        expectedExists: true,
      },
    ];

    for (const scenario of scenarios) {
      const result = scenario.config.GetProviderConfig(scenario.providerName);
      expect(result.exists).toBe(scenario.expectedExists);
      if (scenario.expectedExists) {
        expect(result.config.Name).toBe(scenario.providerName);
      } else {
        expect(result.config.Name).toBe("");
      }
    }
  });
});

describe("OAuth2Config.Validate", () => {
  it("scenarios", () => {
    const scenarios = [
      {
        name: "zero value (disabled)",
        config: new OAuth2Config(),
        expectedErrors: [],
      },
      {
        name: "zero value (enabled)",
        config: Object.assign(new OAuth2Config(), { Enabled: true }),
        expectedErrors: [],
      },
      {
        name: "unknown provider",
        config: Object.assign(new OAuth2Config(), {
          Enabled: true,
          Providers: [
            Object.assign(new OAuth2ProviderConfig(), {
              Name: "missing",
              ClientId: "abc",
              ClientSecret: "456",
            }),
          ],
        }),
        expectedErrors: ["providers"],
      },
      {
        name: "known provider with invalid data",
        config: Object.assign(new OAuth2Config(), {
          Enabled: true,
          Providers: [
            Object.assign(new OAuth2ProviderConfig(), {
              Name: "gitlab",
              ClientId: "abc",
              TokenURL: "!invalid!",
            }),
          ],
        }),
        expectedErrors: ["providers"],
      },
      {
        name: "known provider with valid data",
        config: Object.assign(new OAuth2Config(), {
          Enabled: true,
          Providers: [
            Object.assign(new OAuth2ProviderConfig(), {
              Name: "gitlab",
              ClientId: "abc",
              ClientSecret: "456",
              TokenURL: "https://example.com",
            }),
          ],
        }),
        expectedErrors: [],
      },
      {
        name: "known provider with valid data (duplicated)",
        config: Object.assign(new OAuth2Config(), {
          Enabled: true,
          Providers: [
            Object.assign(new OAuth2ProviderConfig(), {
              Name: "gitlab",
              ClientId: "abc1",
              ClientSecret: "1",
              TokenURL: "https://example1.com",
            }),
            Object.assign(new OAuth2ProviderConfig(), {
              Name: "google",
              ClientId: "abc2",
              ClientSecret: "2",
              TokenURL: "https://example2.com",
            }),
            Object.assign(new OAuth2ProviderConfig(), {
              Name: "gitlab",
              ClientId: "abc3",
              ClientSecret: "3",
              TokenURL: "https://example3.com",
            }),
          ],
        }),
        expectedErrors: ["providers"],
      },
    ];

    for (const scenario of scenarios) {
      const result = scenario.config.Validate();
      testValidationErrors(result, scenario.expectedErrors);
    }
  });
});

describe("OAuth2ProviderConfig.Validate", () => {
  it("scenarios", () => {
    const scenarios = [
      {
        name: "zero value",
        config: new OAuth2ProviderConfig(),
        expectedErrors: ["name", "clientId", "clientSecret"],
      },
      {
        name: "minimum valid data",
        config: Object.assign(new OAuth2ProviderConfig(), {
          Name: "gitlab",
          ClientId: "abc",
          ClientSecret: "456",
        }),
        expectedErrors: [],
      },
      {
        name: "non-existing provider",
        config: Object.assign(new OAuth2ProviderConfig(), {
          Name: "missing",
          ClientId: "abc",
          ClientSecret: "456",
        }),
        expectedErrors: ["name"],
      },
      {
        name: "invalid urls",
        config: Object.assign(new OAuth2ProviderConfig(), {
          Name: "gitlab",
          ClientId: "abc",
          ClientSecret: "456",
          AuthURL: "!invalid!",
          TokenURL: "!invalid!",
          UserInfoURL: "!invalid!",
        }),
        expectedErrors: ["authURL", "tokenURL", "userInfoURL"],
      },
      {
        name: "valid urls",
        config: Object.assign(new OAuth2ProviderConfig(), {
          Name: "gitlab",
          ClientId: "abc",
          ClientSecret: "456",
          AuthURL: "https://example.com/a",
          TokenURL: "https://example.com/b",
          UserInfoURL: "https://example.com/c",
        }),
        expectedErrors: [],
      },
    ];

    for (const scenario of scenarios) {
      const result = scenario.config.Validate();
      testValidationErrors(result, scenario.expectedErrors);
    }
  });
});

describe("OAuth2ProviderConfig.InitProvider", () => {
  it("scenarios", () => {
    const scenarios = [
      {
        name: "empty config",
        config: new OAuth2ProviderConfig(),
        expectedConfig: new OAuth2ProviderConfig(),
        expectedError: true,
      },
      {
        name: "missing provider",
        config: Object.assign(new OAuth2ProviderConfig(), {
          Name: "missing",
          ClientId: "test_ClientId",
          ClientSecret: "test_ClientSecret",
          AuthURL: "test_AuthURL",
          TokenURL: "test_TokenURL",
          UserInfoURL: "test_UserInfoURL",
          DisplayName: "test_DisplayName",
          PKCE: true,
        }),
        expectedConfig: Object.assign(new OAuth2ProviderConfig(), {
          Name: "missing",
          ClientId: "test_ClientId",
          ClientSecret: "test_ClientSecret",
          AuthURL: "test_AuthURL",
          TokenURL: "test_TokenURL",
          UserInfoURL: "test_UserInfoURL",
          DisplayName: "test_DisplayName",
          PKCE: true,
        }),
        expectedError: true,
      },
      {
        name: "existing provider minimal",
        config: Object.assign(new OAuth2ProviderConfig(), {
          Name: "gitlab",
        }),
        expectedConfig: Object.assign(new OAuth2ProviderConfig(), {
          Name: "gitlab",
          ClientId: "",
          ClientSecret: "",
          AuthURL: "https://gitlab.com/oauth/authorize",
          TokenURL: "https://gitlab.com/oauth/token",
          UserInfoURL: "https://gitlab.com/api/v4/user",
          DisplayName: "GitLab",
          PKCE: true,
        }),
        expectedError: false,
      },
      {
        name: "existing provider with all fields",
        config: Object.assign(new OAuth2ProviderConfig(), {
          Name: "gitlab",
          ClientId: "test_ClientId",
          ClientSecret: "test_ClientSecret",
          AuthURL: "test_AuthURL",
          TokenURL: "test_TokenURL",
          UserInfoURL: "test_UserInfoURL",
          DisplayName: "test_DisplayName",
          PKCE: true,
          Extra: { a: 1 },
        }),
        expectedConfig: Object.assign(new OAuth2ProviderConfig(), {
          Name: "gitlab",
          ClientId: "test_ClientId",
          ClientSecret: "test_ClientSecret",
          AuthURL: "test_AuthURL",
          TokenURL: "test_TokenURL",
          UserInfoURL: "test_UserInfoURL",
          DisplayName: "test_DisplayName",
          PKCE: true,
          Extra: { a: 1 },
        }),
        expectedError: false,
      },
    ];

    for (const scenario of scenarios) {
      const result = scenario.config.InitProvider();
      const hasErr = Boolean(result.error);

      expect(hasErr).toBe(scenario.expectedError);
      if (hasErr) {
        expect(result.provider).toBeNull();
        continue;
      }

      const provider = result.provider;
      if (!provider) {
        throw new Error("Missing provider");
      }

      const factory = Providers[scenario.expectedConfig.Name];
      if (!factory) {
        throw new Error(`Missing factory for provider ${scenario.expectedConfig.Name}`);
      }

      const expectedType = factory().constructor;
      expect(provider.constructor).toBe(expectedType);

      expect(provider.ClientId()).toBe(scenario.expectedConfig.ClientId);
      expect(provider.ClientSecret()).toBe(scenario.expectedConfig.ClientSecret);
      expect(provider.AuthURL()).toBe(scenario.expectedConfig.AuthURL);
      expect(provider.UserInfoURL()).toBe(scenario.expectedConfig.UserInfoURL);
      expect(provider.TokenURL()).toBe(scenario.expectedConfig.TokenURL);
      expect(provider.DisplayName()).toBe(scenario.expectedConfig.DisplayName);
      expect(provider.PKCE()).toBe(Boolean(scenario.expectedConfig.PKCE));
      const rawMeta = JSON.stringify(provider.Extra());
      const expectedMeta = JSON.stringify(scenario.expectedConfig.Extra ?? null);
      expect(rawMeta).toBe(expectedMeta);
    }
  });
});
