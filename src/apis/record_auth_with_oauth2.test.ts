// Ported from pocketbase/apis/record_auth_with_oauth2_test.go

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import type { Record as RecordModel } from "../core/record_model.ts";
import type { TestApp } from "../tests/app.ts";
import { OAuth2ProviderConfig } from "../core/collection_model_auth_options.ts";
import { RequestInfoContextOAuth2 } from "../core/event_request.ts";
import { NewExternalAuth } from "../core/external_auth_model.ts";
import { runApiScenario, type ApiScenario } from "../tests/api.ts";
import { startBunServerWithRetry } from "../tests/helpers.ts";
import { AuthUser, Providers, type OAuth2Token } from "../tools/auth/auth.ts";
import { BaseProvider } from "../tools/auth/base_provider.ts";
import { NameApple } from "../tools/auth/index.ts";
import { findSingleColumnUniqueIndex } from "../tools/dbutils/index.ts";
import { safeFileFromURL } from "./record_auth_with_oauth2.ts";

const userToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.ZT3F0Z3iM-xbGgSG3LEKiEzHrPHr8t8IuHLZGGNuxLo";
const otherUserToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6Im9hcDY0MGNvdDR5cnUycyIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.GfJo6EHIobgas_AXt-M-tj5IoQendPnrkMSe9ExuSEY";

class OAuth2MockProvider extends BaseProvider {
  AuthUser: AuthUser | null;
  Token: OAuth2Token | null;

  constructor(data: { AuthUser?: AuthUser | null; Token?: OAuth2Token | null } = {}) {
    super();
    this.AuthUser = data.AuthUser ?? null;
    this.Token = data.Token ?? null;
  }

  override async FetchToken(): Promise<OAuth2Token> {
    if (!this.Token) {
      throw new Error("failed to fetch OAuth2 token");
    }
    return this.Token;
  }

  override async FetchAuthUser(): Promise<AuthUser> {
    if (!this.AuthUser) {
      throw new Error("failed to fetch OAuth2 user");
    }
    return this.AuthUser;
  }
}

type Scenario = ApiScenario & { todo?: boolean };

const setTestProvider = (authUser: Partial<AuthUser>) => {
  Providers.test = () =>
    new OAuth2MockProvider({
      AuthUser: new AuthUser(authUser),
      Token: { accessToken: "abc" },
    });
};

const setAppleProvider = (authUser: Partial<AuthUser>) => {
  Providers[NameApple] = () =>
    new OAuth2MockProvider({
      AuthUser: new AuthUser(authUser),
      Token: { accessToken: "abc" },
    });
};

const newProviderConfig = (name: string) => {
  const config = new OAuth2ProviderConfig();
  config.Name = name;
  config.ClientId = "123";
  config.ClientSecret = "456";
  return config;
};

const setOAuthProviders = (collection: { OAuth2: { Providers: OAuth2ProviderConfig[] | null } }, name: string) => {
  collection.OAuth2.Providers = [newProviderConfig(name)];
};

const expectOnlyTestExternalAuth = (app: TestApp, user: RecordModel, providerId = "test_id") => {
  const externalAuths = app.FindAllExternalAuthsByRecord(user);
  expect(externalAuths).toHaveLength(1);
  expect(externalAuths[0]?.Provider()).toBe("test");
  expect(externalAuths[0]?.ProviderId()).toBe(providerId);
  expect(externalAuths[0]?.RecordRef()).toBe(user.Id);
  expect(externalAuths[0]?.CollectionRef()).toBe(user.collection().Id);
};

const originalTestProvider = Providers.test;
const originalAppleProvider = Providers[NameApple];

let avatarServer: ReturnType<typeof Bun.serve> | null = null;
let avatarBaseUrl = "";

beforeAll(() => {
  const pngBytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAOeZzWQAAAAASUVORK5CYII=",
    "base64",
  );
  avatarServer = startBunServerWithRetry({
    fetch() {
      return new Response(pngBytes, {
        headers: { "content-type": "image/png" },
      });
    },
  });

  avatarBaseUrl = `http://127.0.0.1:${avatarServer.port}`;
});

afterAll(async () => {
  if (avatarServer) {
    await avatarServer.stop();
    avatarServer = null;
  }

  if (originalTestProvider) {
    Providers.test = originalTestProvider;
  } else {
    delete Providers.test;
  }

  if (originalAppleProvider) {
    Providers[NameApple] = originalAppleProvider;
  } else {
    delete Providers[NameApple];
  }
});

const scenarios: Scenario[] = [
  {
    name: "disabled OAuth2 auth",
    method: "POST",
    url: "/api/collections/nologin/auth-with-oauth2",
    body: JSON.stringify({
      provider: "test",
      code: "123",
      codeVerifier: "456",
      redirectURL: "https://example.com",
    }),
    expectedStatus: 403,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "invalid body",
    method: "POST",
    url: "/api/collections/users/auth-with-oauth2",
    body: '{"provider"',
    expectedStatus: 400,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "trigger form validations (missing provider)",
    method: "POST",
    url: "/api/collections/users/auth-with-oauth2",
    body: JSON.stringify({
      provider: "missing",
    }),
    expectedStatus: 400,
    expectedContent: ['"data":{', '"provider":', '"code":', '"redirectURL":'],
    notExpectedContent: ['"codeVerifier":'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "trigger form validations (existing but disabled provider)",
    method: "POST",
    url: "/api/collections/users/auth-with-oauth2",
    body: JSON.stringify({
      provider: "apple",
    }),
    expectedStatus: 400,
    expectedContent: ['"data":{', '"provider":', '"code":', '"redirectURL":'],
    notExpectedContent: ['"codeVerifier":'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "existing linked OAuth2 (unverified user)",
    method: "POST",
    url: "/api/collections/users/auth-with-oauth2",
    body: JSON.stringify({
      provider: "test",
      code: "123",
      redirectURL: "https://example.com",
      createData: { name: "test_new" },
    }),
    headers: {
      Authorization: otherUserToken,
    },
    beforeTest: async (app) => {
      const user = app.FindAuthRecordByEmail("users", "test@example.com");
      if (user.Verified()) {
        throw new Error(`Expected user ${user.Email()} to be unverified`);
      }
      if (!user.ValidatePassword("1234567890")) {
        throw new Error("Expected password 1234567890 to be valid");
      }

      setTestProvider({ Id: "test_id" });

      const collection = user.collection();
      collection.MFA.Enabled = false;
      collection.OAuth2.Enabled = true;
      setOAuthProviders(collection, "test");
      const saveErr = await app.Save(collection);
      if (saveErr) {
        throw new Error(saveErr.message);
      }

      const externalAuth = NewExternalAuth(app);
      externalAuth.SetCollectionRef(collection.Id);
      externalAuth.SetRecordRef(user.Id);
      externalAuth.SetProvider("test");
      externalAuth.SetProviderId("test_id");
      const relErr = await app.Save(externalAuth);
      if (relErr) {
        throw new Error(relErr.message);
      }

      app.OnRecordAuthRequest().BindFunc(async (authEvent: any) => {
        const info = await authEvent.RequestEvent.requestInfo();
        if (info.context !== RequestInfoContextOAuth2) {
          throw new Error(`Expected request context ${RequestInfoContextOAuth2}, got ${info.context}`);
        }

        return authEvent.Next();
      });
    },
    expectedStatus: 200,
    expectedContent: [
      '"record":{',
      '"token":"',
      '"meta":{',
      '"email":"test@example.com"',
      '"id":"4q1xlclmfloku33"',
      '"id":"test_id"',
      '"verified":false',
    ],
    notExpectedContent: ['"tokenKey"', '"password"'],
    expectedEvents: {
      "*": 0,
      OnRecordAuthWithOAuth2Request: 1,
      OnRecordAuthRequest: 1,
      OnRecordEnrich: 1,
      OnModelCreate: 2,
      OnModelCreateExecute: 2,
      OnModelAfterCreateSuccess: 2,
      OnRecordCreate: 2,
      OnRecordCreateExecute: 2,
      OnRecordAfterCreateSuccess: 2,
      OnModelUpdate: 1,
      OnModelUpdateExecute: 1,
      OnModelAfterUpdateSuccess: 1,
      OnRecordUpdate: 1,
      OnRecordUpdateExecute: 1,
      OnRecordAfterUpdateSuccess: 1,
      OnModelDelete: 3,
      OnModelDeleteExecute: 3,
      OnModelAfterDeleteSuccess: 3,
      OnRecordDelete: 3,
      OnRecordDeleteExecute: 3,
      OnRecordAfterDeleteSuccess: 3,
      OnModelValidate: 3,
      OnRecordValidate: 3,
    },
    afterTest: (app) => {
      const user = app.FindAuthRecordByEmail("users", "test@example.com");
      if (user.GetString("name") !== "test1") {
        throw new Error(`Expected name to not change, got ${user.GetString("name")}`);
      }
      if (user.ValidatePassword("1234567890")) {
        throw new Error("Expected password 1234567890 to be changed");
      }
      const devices = app.FindAllAuthOriginsByRecord(user);
      if (devices.length !== 1) {
        throw new Error(`Expected only 1 auth origin to be created, got ${devices.length}`);
      }
      expectOnlyTestExternalAuth(app, user);
    },
  },
  {
    name: "existing linked OAuth2 (verified user)",
    method: "POST",
    url: "/api/collections/users/auth-with-oauth2",
    body: JSON.stringify({
      provider: "test",
      code: "123",
      redirectURL: "https://example.com",
    }),
    beforeTest: async (app) => {
      const user = app.FindAuthRecordByEmail("users", "test2@example.com");
      if (!user.Verified()) {
        throw new Error(`Expected user ${user.Email()} to be verified`);
      }
      if (!user.ValidatePassword("1234567890")) {
        throw new Error("Expected password 1234567890 to be valid");
      }

      setTestProvider({ Id: "test_id" });

      const collection = user.collection();
      collection.MFA.Enabled = false;
      collection.OAuth2.Enabled = true;
      setOAuthProviders(collection, "test");
      const saveErr = await app.Save(collection);
      if (saveErr) {
        throw new Error(saveErr.message);
      }

      const externalAuth = NewExternalAuth(app);
      externalAuth.SetCollectionRef(collection.Id);
      externalAuth.SetRecordRef(user.Id);
      externalAuth.SetProvider("test");
      externalAuth.SetProviderId("test_id");
      const relErr = await app.Save(externalAuth);
      if (relErr) {
        throw new Error(relErr.message);
      }
    },
    expectedStatus: 200,
    expectedContent: [
      '"record":{',
      '"token":"',
      '"meta":{',
      '"isNew":false',
      '"email":"test2@example.com"',
      '"id":"oap640cot4yru2s"',
      '"id":"test_id"',
      '"verified":true',
    ],
    notExpectedContent: ['"tokenKey"', '"password"'],
    expectedEvents: {
      "*": 0,
      OnRecordAuthWithOAuth2Request: 1,
      OnRecordAuthRequest: 1,
      OnRecordEnrich: 1,
      OnModelCreate: 1,
      OnModelCreateExecute: 1,
      OnModelAfterCreateSuccess: 1,
      OnRecordCreate: 1,
      OnRecordCreateExecute: 1,
      OnRecordAfterCreateSuccess: 1,
      OnModelValidate: 1,
      OnRecordValidate: 1,
    },
    afterTest: (app) => {
      const user = app.FindAuthRecordByEmail("users", "test2@example.com");
      if (!user.ValidatePassword("1234567890")) {
        throw new Error("Expected old password 1234567890 to be valid");
      }
      const devices = app.FindAllAuthOriginsByRecord(user);
      if (devices.length !== 1) {
        throw new Error(`Expected only 1 auth origin to be created, got ${devices.length}`);
      }
    },
  },
  {
    name: "link by email",
    method: "POST",
    url: "/api/collections/users/auth-with-oauth2",
    body: JSON.stringify({
      provider: "test",
      code: "123",
      redirectURL: "https://example.com",
    }),
    beforeTest: async (app) => {
      const user = app.FindAuthRecordByEmail("users", "test@example.com");
      if (user.Verified()) {
        throw new Error(`Expected user ${user.Email()} to be unverified`);
      }
      if (!user.ValidatePassword("1234567890")) {
        throw new Error("Expected password 1234567890 to be valid");
      }

      setTestProvider({ Id: "test_id", Email: "test@example.com" });

      const collection = user.collection();
      collection.MFA.Enabled = false;
      collection.OAuth2.Enabled = true;
      setOAuthProviders(collection, "test");
      const saveErr = await app.Save(collection);
      if (saveErr) {
        throw new Error(saveErr.message);
      }
    },
    expectedStatus: 200,
    expectedContent: [
      '"record":{',
      '"token":"',
      '"meta":{',
      '"isNew":false',
      '"email":"test@example.com"',
      '"id":"4q1xlclmfloku33"',
      '"id":"test_id"',
      '"verified":true',
    ],
    notExpectedContent: ['"tokenKey"', '"password"'],
    expectedEvents: {
      "*": 0,
      OnRecordAuthWithOAuth2Request: 1,
      OnRecordAuthRequest: 1,
      OnRecordEnrich: 1,
      OnModelCreate: 2,
      OnModelCreateExecute: 2,
      OnModelAfterCreateSuccess: 2,
      OnRecordCreate: 2,
      OnRecordCreateExecute: 2,
      OnRecordAfterCreateSuccess: 2,
      OnModelUpdate: 1,
      OnModelUpdateExecute: 1,
      OnModelAfterUpdateSuccess: 1,
      OnRecordUpdate: 1,
      OnRecordUpdateExecute: 1,
      OnRecordAfterUpdateSuccess: 1,
      OnModelDelete: 2,
      OnModelDeleteExecute: 2,
      OnModelAfterDeleteSuccess: 2,
      OnRecordDelete: 2,
      OnRecordDeleteExecute: 2,
      OnRecordAfterDeleteSuccess: 2,
      OnModelValidate: 3,
      OnRecordValidate: 3,
    },
    afterTest: (app) => {
      const user = app.FindAuthRecordByEmail("users", "test@example.com");
      if (user.ValidatePassword("1234567890")) {
        throw new Error("Expected password 1234567890 to be changed");
      }
      const devices = app.FindAllAuthOriginsByRecord(user);
      if (devices.length !== 1) {
        throw new Error(`Expected only 1 auth origin to be created, got ${devices.length}`);
      }
      expectOnlyTestExternalAuth(app, user);
    },
  },
  {
    name: "link by fallback user (OAuth2 user with different email)",
    method: "POST",
    url: "/api/collections/users/auth-with-oauth2",
    body: JSON.stringify({
      provider: "test",
      code: "123",
      redirectURL: "https://example.com",
    }),
    headers: {
      Authorization: userToken,
    },
    beforeTest: async (app) => {
      const user = app.FindAuthRecordByEmail("users", "test@example.com");
      if (user.Verified()) {
        throw new Error(`Expected user ${user.Email()} to be unverified`);
      }
      if (!user.ValidatePassword("1234567890")) {
        throw new Error("Expected password 1234567890 to be valid");
      }

      setTestProvider({ Id: "test_id", Email: "test2@example.com" });

      const collection = user.collection();
      collection.MFA.Enabled = false;
      collection.OAuth2.Enabled = true;
      setOAuthProviders(collection, "test");
      const saveErr = await app.Save(collection);
      if (saveErr) {
        throw new Error(saveErr.message);
      }
    },
    expectedStatus: 200,
    expectedContent: [
      '"record":{',
      '"token":"',
      '"meta":{',
      '"isNew":false',
      '"email":"test@example.com"',
      '"id":"4q1xlclmfloku33"',
      '"id":"test_id"',
      '"verified":false',
    ],
    notExpectedContent: ['"tokenKey"', '"password"'],
    expectedEvents: {
      "*": 0,
      OnRecordAuthWithOAuth2Request: 1,
      OnRecordAuthRequest: 1,
      OnRecordEnrich: 1,
      OnModelCreate: 2,
      OnModelCreateExecute: 2,
      OnModelAfterCreateSuccess: 2,
      OnRecordCreate: 2,
      OnRecordCreateExecute: 2,
      OnRecordAfterCreateSuccess: 2,
      OnModelDelete: 2,
      OnModelDeleteExecute: 2,
      OnModelAfterDeleteSuccess: 2,
      OnRecordDelete: 2,
      OnRecordDeleteExecute: 2,
      OnRecordAfterDeleteSuccess: 2,
      OnModelValidate: 2,
      OnRecordValidate: 2,
    },
    afterTest: (app) => {
      const user = app.FindAuthRecordByEmail("users", "test@example.com");
      if (!user.ValidatePassword("1234567890")) {
        throw new Error("Expected password 1234567890 not to be changed");
      }
      const devices = app.FindAllAuthOriginsByRecord(user);
      if (devices.length !== 1) {
        throw new Error(`Expected only 1 auth origin to be created, got ${devices.length}`);
      }
      expectOnlyTestExternalAuth(app, user);
    },
  },
  {
    name: "link by fallback user (user without email)",
    method: "POST",
    url: "/api/collections/users/auth-with-oauth2",
    body: JSON.stringify({
      provider: "test",
      code: "123",
      redirectURL: "https://example.com",
    }),
    headers: {
      Authorization: userToken,
    },
    beforeTest: async (app) => {
      const user = app.FindAuthRecordByEmail("users", "test@example.com");
      if (user.Verified()) {
        throw new Error(`Expected user ${user.Email()} to be unverified`);
      }
      if (!user.ValidatePassword("1234567890")) {
        throw new Error("Expected password 1234567890 to be valid");
      }

      const oldTokenKey = user.TokenKey();

      user.SetEmail("");
      let saveErr = await app.Save(user);
      if (saveErr) {
        throw new Error(saveErr.message);
      }

      user.SetTokenKey(oldTokenKey);
      saveErr = await app.Save(user);
      if (saveErr) {
        throw new Error(`Failed to restore original user tokenKey: ${saveErr.message}`);
      }

      setTestProvider({ Id: "test_id", Email: "test_oauth2@example.com" });

      const collection = user.collection();
      collection.MFA.Enabled = false;
      collection.OAuth2.Enabled = true;
      setOAuthProviders(collection, "test");
      saveErr = await app.Save(collection);
      if (saveErr) {
        throw new Error(saveErr.message);
      }
    },
    expectedStatus: 200,
    expectedContent: [
      '"record":{',
      '"token":"',
      '"meta":{',
      '"isNew":false',
      '"email":"test_oauth2@example.com"',
      '"id":"4q1xlclmfloku33"',
      '"id":"test_id"',
      '"verified":true',
    ],
    notExpectedContent: ['"tokenKey"', '"password"'],
    expectedEvents: {
      "*": 0,
      OnRecordAuthWithOAuth2Request: 1,
      OnRecordAuthRequest: 1,
      OnRecordEnrich: 1,
      OnModelCreate: 2,
      OnModelCreateExecute: 2,
      OnModelAfterCreateSuccess: 2,
      OnRecordCreate: 2,
      OnRecordCreateExecute: 2,
      OnRecordAfterCreateSuccess: 2,
      OnModelUpdate: 1,
      OnModelUpdateExecute: 1,
      OnModelAfterUpdateSuccess: 1,
      OnRecordUpdate: 1,
      OnRecordUpdateExecute: 1,
      OnRecordAfterUpdateSuccess: 1,
      OnModelDelete: 2,
      OnModelDeleteExecute: 2,
      OnModelAfterDeleteSuccess: 2,
      OnRecordDelete: 2,
      OnRecordDeleteExecute: 2,
      OnRecordAfterDeleteSuccess: 2,
      OnModelValidate: 3,
      OnRecordValidate: 3,
    },
    afterTest: (app) => {
      const user = app.FindAuthRecordByEmail("users", "test_oauth2@example.com");
      if (!user.ValidatePassword("1234567890")) {
        throw new Error("Expected password 1234567890 not to be changed");
      }
      const devices = app.FindAllAuthOriginsByRecord(user);
      if (devices.length !== 1) {
        throw new Error(`Expected only 1 auth origin to be created, got ${devices.length}`);
      }
      expectOnlyTestExternalAuth(app, user);
    },
  },
  {
    name: "link by fallback user (unverified user with matching email)",
    method: "POST",
    url: "/api/collections/users/auth-with-oauth2",
    body: JSON.stringify({
      provider: "test",
      code: "123",
      redirectURL: "https://example.com",
    }),
    headers: {
      Authorization: userToken,
    },
    beforeTest: async (app) => {
      const user = app.FindAuthRecordByEmail("users", "test@example.com");
      if (user.Verified()) {
        throw new Error(`Expected user ${user.Email()} to be unverified`);
      }
      if (!user.ValidatePassword("1234567890")) {
        throw new Error("Expected password 1234567890 to be valid");
      }

      setTestProvider({ Id: "test_id", Email: "test@example.com" });

      const collection = user.collection();
      collection.MFA.Enabled = false;
      collection.OAuth2.Enabled = true;
      setOAuthProviders(collection, "test");
      const saveErr = await app.Save(collection);
      if (saveErr) {
        throw new Error(saveErr.message);
      }
    },
    expectedStatus: 200,
    expectedContent: [
      '"record":{',
      '"token":"',
      '"meta":{',
      '"isNew":false',
      '"email":"test@example.com"',
      '"id":"4q1xlclmfloku33"',
      '"id":"test_id"',
      '"verified":true',
    ],
    notExpectedContent: ['"tokenKey"', '"password"'],
    expectedEvents: {
      "*": 0,
      OnRecordAuthWithOAuth2Request: 1,
      OnRecordAuthRequest: 1,
      OnRecordEnrich: 1,
      OnModelCreate: 2,
      OnModelCreateExecute: 2,
      OnModelAfterCreateSuccess: 2,
      OnRecordCreate: 2,
      OnRecordCreateExecute: 2,
      OnRecordAfterCreateSuccess: 2,
      OnModelUpdate: 1,
      OnModelUpdateExecute: 1,
      OnModelAfterUpdateSuccess: 1,
      OnRecordUpdate: 1,
      OnRecordUpdateExecute: 1,
      OnRecordAfterUpdateSuccess: 1,
      OnModelDelete: 2,
      OnModelDeleteExecute: 2,
      OnModelAfterDeleteSuccess: 2,
      OnRecordDelete: 2,
      OnRecordDeleteExecute: 2,
      OnRecordAfterDeleteSuccess: 2,
      OnModelValidate: 3,
      OnRecordValidate: 3,
    },
    afterTest: (app) => {
      const user = app.FindAuthRecordByEmail("users", "test@example.com");
      if (!user.ValidatePassword("1234567890")) {
        throw new Error("Expected password 1234567890 not to be changed");
      }
      const devices = app.FindAllAuthOriginsByRecord(user);
      if (devices.length !== 1) {
        throw new Error(`Expected only 1 auth origin to be created, got ${devices.length}`);
      }
      expectOnlyTestExternalAuth(app, user);
    },
  },
  {
    name: "creating user (no extra create data or custom fields mapping)",
    method: "POST",
    url: "/api/collections/users/auth-with-oauth2",
    body: JSON.stringify({
      provider: "test",
      code: "123",
      redirectURL: "https://example.com",
    }),
    beforeTest: async (app) => {
      const collection = app.findCollectionByNameOrIdOrNull("users");
      if (!collection) {
        throw new Error("Missing users collection");
      }

      setTestProvider({ Id: "test_id" });

      collection.MFA.Enabled = false;
      collection.OAuth2.Enabled = true;
      setOAuthProviders(collection, "test");
      const saveErr = await app.Save(collection);
      if (saveErr) {
        throw new Error(saveErr.message);
      }
    },
    expectedStatus: 200,
    expectedContent: ['"record":{', '"token":"', '"meta":{', '"isNew":true', '"email":""', '"id":"test_id"', '"verified":true'],
    notExpectedContent: ['"tokenKey"', '"password"'],
    expectedEvents: {
      "*": 0,
      OnRecordAuthWithOAuth2Request: 1,
      OnRecordAuthRequest: 1,
      OnRecordCreateRequest: 1,
      OnRecordEnrich: 2,
      OnModelCreate: 3,
      OnModelCreateExecute: 3,
      OnModelAfterCreateSuccess: 3,
      OnRecordCreate: 3,
      OnRecordCreateExecute: 3,
      OnRecordAfterCreateSuccess: 3,
      OnModelUpdate: 1,
      OnModelUpdateExecute: 1,
      OnModelAfterUpdateSuccess: 1,
      OnRecordUpdate: 1,
      OnRecordUpdateExecute: 1,
      OnRecordAfterUpdateSuccess: 1,
      OnModelValidate: 4,
      OnRecordValidate: 4,
    },
  },
  {
    name: "creating user (submit failure - form auth fields validator)",
    method: "POST",
    url: "/api/collections/users/auth-with-oauth2",
    body: JSON.stringify({
      provider: "test",
      code: "123",
      redirectURL: "https://example.com",
      createData: {
        verified: true,
        email: "invalid",
        rel: "invalid",
        file: "invalid",
      },
    }),
    beforeTest: async (app) => {
      const collection = app.findCollectionByNameOrIdOrNull("users");
      if (!collection) {
        throw new Error("Missing users collection");
      }

      setTestProvider({ Id: "test_id" });

      collection.MFA.Enabled = false;
      collection.OAuth2.Enabled = true;
      setOAuthProviders(collection, "test");
      const saveErr = await app.Save(collection);
      if (saveErr) {
        throw new Error(saveErr.message);
      }
    },
    expectedStatus: 400,
    expectedContent: ['"data":{', '"verified":{'],
    notExpectedContent: ['"email":', '"rel":', '"file":'],
    expectedEvents: {
      "*": 0,
      OnRecordAuthWithOAuth2Request: 1,
      OnRecordCreateRequest: 1,
    },
  },
  {
    name: "creating user (submit failure - record fields validator)",
    method: "POST",
    url: "/api/collections/users/auth-with-oauth2",
    body: JSON.stringify({
      provider: "test",
      code: "123",
      redirectURL: "https://example.com",
      createData: {
        email: "invalid",
        rel: "invalid",
        file: "invalid",
      },
    }),
    beforeTest: async (app) => {
      const collection = app.findCollectionByNameOrIdOrNull("users");
      if (!collection) {
        throw new Error("Missing users collection");
      }

      setTestProvider({ Id: "test_id" });

      collection.MFA.Enabled = false;
      collection.OAuth2.Enabled = true;
      setOAuthProviders(collection, "test");
      const saveErr = await app.Save(collection);
      if (saveErr) {
        throw new Error(saveErr.message);
      }
    },
    expectedStatus: 400,
    expectedContent: ['"data":{', '"email":{', '"rel":{', '"file":{'],
    expectedEvents: {
      "*": 0,
      OnRecordAuthWithOAuth2Request: 1,
      OnRecordCreateRequest: 1,
      OnModelValidate: 1,
      OnRecordValidate: 1,
      OnModelCreate: 1,
      OnModelAfterCreateError: 1,
      OnRecordCreate: 1,
      OnRecordAfterCreateError: 1,
    },
  },
  {
    name: "creating user (valid create data with empty submitted email)",
    method: "POST",
    url: "/api/collections/users/auth-with-oauth2",
    body: JSON.stringify({
      provider: "test",
      code: "123",
      redirectURL: "https://example.com",
      createData: {
        email: "",
        emailVisibility: true,
        password: "1234567890",
        passwordConfirm: "1234567890",
        name: "test_name",
        username: "test_username",
        rel: "0yxhwia2amd8gec",
      },
    }),
    beforeTest: async (app) => {
      const collection = app.findCollectionByNameOrIdOrNull("users");
      if (!collection) {
        throw new Error("Missing users collection");
      }

      setTestProvider({ Id: "test_id" });

      collection.MFA.Enabled = false;
      collection.OAuth2.Enabled = true;
      setOAuthProviders(collection, "test");
      const saveErr = await app.Save(collection);
      if (saveErr) {
        throw new Error(saveErr.message);
      }
    },
    expectedStatus: 200,
    expectedContent: [
      '"isNew":true',
      '"email":""',
      '"emailVisibility":true',
      '"name":"test_name"',
      '"username":"test_username"',
      '"verified":true',
      '"rel":"0yxhwia2amd8gec"',
    ],
    notExpectedContent: ['"tokenKey"', '"password"'],
    expectedEvents: {
      "*": 0,
      OnRecordAuthWithOAuth2Request: 1,
      OnRecordAuthRequest: 1,
      OnRecordCreateRequest: 1,
      OnRecordEnrich: 2,
      OnModelCreate: 3,
      OnModelCreateExecute: 3,
      OnModelAfterCreateSuccess: 3,
      OnRecordCreate: 3,
      OnRecordCreateExecute: 3,
      OnRecordAfterCreateSuccess: 3,
      OnModelUpdate: 1,
      OnModelUpdateExecute: 1,
      OnModelAfterUpdateSuccess: 1,
      OnRecordUpdate: 1,
      OnRecordUpdateExecute: 1,
      OnRecordAfterUpdateSuccess: 1,
      OnModelValidate: 4,
      OnRecordValidate: 4,
    },
    afterTest: (app) => {
      const user = app.FindFirstRecordByData("users", "username", "test_username");
      if (!user.ValidatePassword("1234567890")) {
        throw new Error("Expected password 1234567890 to be valid");
      }
    },
  },
  {
    name: "creating user (valid create data with non-empty valid submitted email)",
    method: "POST",
    url: "/api/collections/users/auth-with-oauth2",
    body: JSON.stringify({
      provider: "test",
      code: "123",
      redirectURL: "https://example.com",
      createData: {
        email: "test_create@example.com",
        emailVisibility: true,
        password: "1234567890",
        passwordConfirm: "1234567890",
        name: "test_name",
        username: "test_username",
        rel: "0yxhwia2amd8gec",
      },
    }),
    beforeTest: async (app) => {
      const collection = app.findCollectionByNameOrIdOrNull("users");
      if (!collection) {
        throw new Error("Missing users collection");
      }

      setTestProvider({ Id: "test_id", Email: "oauth2@example.com" });

      collection.MFA.Enabled = false;
      collection.OAuth2.Enabled = true;
      setOAuthProviders(collection, "test");
      const saveErr = await app.Save(collection);
      if (saveErr) {
        throw new Error(saveErr.message);
      }
    },
    expectedStatus: 200,
    expectedContent: [
      '"email":"test_create@example.com"',
      '"emailVisibility":true',
      '"name":"test_name"',
      '"username":"test_username"',
      '"verified":false',
      '"rel":"0yxhwia2amd8gec"',
    ],
    notExpectedContent: ['"tokenKey"', '"password"'],
    expectedEvents: {
      "*": 0,
      OnRecordAuthWithOAuth2Request: 1,
      OnRecordAuthRequest: 1,
      OnRecordCreateRequest: 1,
      OnRecordEnrich: 2,
      OnModelCreate: 3,
      OnModelCreateExecute: 3,
      OnModelAfterCreateSuccess: 3,
      OnRecordCreate: 3,
      OnRecordCreateExecute: 3,
      OnRecordAfterCreateSuccess: 3,
      OnModelValidate: 3,
      OnRecordValidate: 3,
    },
    afterTest: (app) => {
      const user = app.FindFirstRecordByData("users", "username", "test_username");
      if (!user.ValidatePassword("1234567890")) {
        throw new Error("Expected password 1234567890 to be valid");
      }
    },
  },
  {
    name: "creating user (with mapped OAuth2 fields and local avatarURL->file field; blocked for safety)",
    method: "POST",
    url: "/api/collections/users/auth-with-oauth2",
    body: JSON.stringify({
      provider: "test",
      code: "123",
      redirectURL: "https://example.com",
      createData: {
        name: "test_name",
        emailVisibility: true,
        rel: "0yxhwia2amd8gec",
      },
    }),
    beforeTest: async (app) => {
      if (!avatarBaseUrl) {
        throw new Error("Missing avatar server");
      }

      const collection = app.findCollectionByNameOrIdOrNull("users");
      if (!collection) {
        throw new Error("Missing users collection");
      }

      setTestProvider({
        Id: "oauth2_id",
        Email: "oauth2@example.com",
        Username: "oauth2_username",
        AvatarURL: `${avatarBaseUrl}/oauth2_avatar.png`,
      });

      collection.MFA.Enabled = false;
      collection.OAuth2.Enabled = true;
      setOAuthProviders(collection, "test");
      collection.OAuth2.MappedFields = {
        Id: "username",
        Name: "",
        Username: "name",
        AvatarURL: "avatar",
      };
      const saveErr = await app.Save(collection);
      if (saveErr) {
        throw new Error(saveErr.message);
      }
    },
    expectedStatus: 200,
    expectedContent: [
      '"isNew":true',
      '"email":"oauth2@example.com"',
      '"emailVisibility":true',
      '"name":"test_name"',
      '"username":"oauth2_username"',
      '"verified":true',
      '"rel":"0yxhwia2amd8gec"',
      '"avatar":""',
    ],
    notExpectedContent: ['"tokenKey"', '"password"'],
    expectedEvents: {
      "*": 0,
      OnRecordAuthWithOAuth2Request: 1,
      OnRecordAuthRequest: 1,
      OnRecordCreateRequest: 1,
      OnRecordEnrich: 2,
      OnModelCreate: 3,
      OnModelCreateExecute: 3,
      OnModelAfterCreateSuccess: 3,
      OnRecordCreate: 3,
      OnRecordCreateExecute: 3,
      OnRecordAfterCreateSuccess: 3,
      OnModelUpdate: 1,
      OnModelUpdateExecute: 1,
      OnModelAfterUpdateSuccess: 1,
      OnRecordUpdate: 1,
      OnRecordUpdateExecute: 1,
      OnRecordAfterUpdateSuccess: 1,
      OnModelValidate: 4,
      OnRecordValidate: 4,
    },
  },
  {
    name: "creating user (with mapped OAuth2 avatarURL field but empty OAuth2User.avatarURL value)",
    method: "POST",
    url: "/api/collections/users/auth-with-oauth2",
    body: JSON.stringify({
      provider: "test",
      code: "123",
      redirectURL: "https://example.com",
    }),
    beforeTest: async (app) => {
      const collection = app.findCollectionByNameOrIdOrNull("users");
      if (!collection) {
        throw new Error("Missing users collection");
      }

      setTestProvider({
        Id: "oauth2_id",
        Email: "oauth2@example.com",
        AvatarURL: "",
      });

      collection.MFA.Enabled = false;
      collection.OAuth2.Enabled = true;
      setOAuthProviders(collection, "test");
      collection.OAuth2.MappedFields = {
        Id: "",
        Name: "",
        Username: "",
        AvatarURL: "avatar",
      };
      const saveErr = await app.Save(collection);
      if (saveErr) {
        throw new Error(saveErr.message);
      }
    },
    expectedStatus: 200,
    expectedContent: [
      '"isNew":true',
      '"email":"oauth2@example.com"',
      '"emailVisibility":false',
      '"verified":true',
      '"avatar":""',
    ],
    notExpectedContent: ['"tokenKey"', '"password"'],
    expectedEvents: {
      "*": 0,
      OnRecordAuthWithOAuth2Request: 1,
      OnRecordAuthRequest: 1,
      OnRecordCreateRequest: 1,
      OnRecordEnrich: 2,
      OnModelCreate: 3,
      OnModelCreateExecute: 3,
      OnModelAfterCreateSuccess: 3,
      OnRecordCreate: 3,
      OnRecordCreateExecute: 3,
      OnRecordAfterCreateSuccess: 3,
      OnModelUpdate: 1,
      OnModelUpdateExecute: 1,
      OnModelAfterUpdateSuccess: 1,
      OnRecordUpdate: 1,
      OnRecordUpdateExecute: 1,
      OnRecordAfterUpdateSuccess: 1,
      OnModelValidate: 4,
      OnRecordValidate: 4,
    },
  },
  {
    name: "creating user (with mapped OAuth2 fields, case-sensitive username and avatarURL->non-file field)",
    method: "POST",
    url: "/api/collections/users/auth-with-oauth2",
    body: JSON.stringify({
      provider: "test",
      code: "123",
      redirectURL: "https://example.com",
    }),
    beforeTest: async (app) => {
      if (!avatarBaseUrl) {
        throw new Error("Missing avatar server");
      }

      const collection = app.findCollectionByNameOrIdOrNull("users");
      if (!collection) {
        throw new Error("Missing users collection");
      }

      setTestProvider({
        Id: "oauth2_id",
        Email: "oauth2@example.com",
        Username: "tESt2_username",
        Name: "oauth2_name",
        AvatarURL: `${avatarBaseUrl}/oauth2_avatar.png`,
      });

      collection.MFA.Enabled = false;
      collection.OAuth2.Enabled = true;
      setOAuthProviders(collection, "test");
      collection.OAuth2.MappedFields = {
        Id: "",
        Name: "",
        Username: "username",
        AvatarURL: "name",
      };
      const saveErr = await app.Save(collection);
      if (saveErr) {
        throw new Error(saveErr.message);
      }
    },
    expectedStatus: 200,
    expectedContent: [
      '"isNew":true',
      '"email":"oauth2@example.com"',
      '"emailVisibility":false',
      '"username":"tESt2_username"',
      '"name":"http://127.',
      '"verified":true',
      '"avatar":""',
    ],
    notExpectedContent: ['"tokenKey"', '"password"'],
    expectedEvents: {
      "*": 0,
      OnRecordAuthWithOAuth2Request: 1,
      OnRecordAuthRequest: 1,
      OnRecordCreateRequest: 1,
      OnRecordEnrich: 2,
      OnModelCreate: 3,
      OnModelCreateExecute: 3,
      OnModelAfterCreateSuccess: 3,
      OnRecordCreate: 3,
      OnRecordCreateExecute: 3,
      OnRecordAfterCreateSuccess: 3,
      OnModelUpdate: 1,
      OnModelUpdateExecute: 1,
      OnModelAfterUpdateSuccess: 1,
      OnRecordUpdate: 1,
      OnRecordUpdateExecute: 1,
      OnRecordAfterUpdateSuccess: 1,
      OnModelValidate: 4,
      OnRecordValidate: 4,
    },
  },
  {
    name: "creating user (with mapped OAuth2 fields and duplicated case-insensitive username)",
    method: "POST",
    url: "/api/collections/users/auth-with-oauth2",
    body: JSON.stringify({
      provider: "test",
      code: "123",
      redirectURL: "https://example.com",
    }),
    beforeTest: async (app) => {
      const collection = app.findCollectionByNameOrIdOrNull("users");
      if (!collection) {
        throw new Error("Missing users collection");
      }

      setTestProvider({
        Id: "oauth2_id",
        Email: "oauth2@example.com",
        Username: "tESt2_username",
        Name: "oauth2_name",
      });

      const [index, ok] = findSingleColumnUniqueIndex(collection.indexes, "username");
      if (ok) {
        if (index.columns[0]) {
          index.columns[0].collate = "nocase";
        }
        collection.RemoveIndex(index.indexName);
        collection.indexes = [...collection.indexes, index.build()];
      }

      collection.MFA.Enabled = false;
      collection.OAuth2.Enabled = true;
      setOAuthProviders(collection, "test");
      collection.OAuth2.MappedFields = {
        Id: "",
        Name: "",
        Username: "username",
        AvatarURL: "",
      };
      const saveErr = await app.Save(collection);
      if (saveErr) {
        throw new Error(saveErr.message);
      }
    },
    expectedStatus: 200,
    expectedContent: [
      '"isNew":true',
      '"email":"oauth2@example.com"',
      '"emailVisibility":false',
      '"verified":true',
      '"avatar":""',
      '"username":"users',
    ],
    notExpectedContent: ['"tokenKey"', '"password"'],
    expectedEvents: {
      "*": 0,
      OnRecordAuthWithOAuth2Request: 1,
      OnRecordAuthRequest: 1,
      OnRecordCreateRequest: 1,
      OnRecordEnrich: 2,
      OnModelCreate: 3,
      OnModelCreateExecute: 3,
      OnModelAfterCreateSuccess: 3,
      OnRecordCreate: 3,
      OnRecordCreateExecute: 3,
      OnRecordAfterCreateSuccess: 3,
      OnModelUpdate: 1,
      OnModelUpdateExecute: 1,
      OnModelAfterUpdateSuccess: 1,
      OnRecordUpdate: 1,
      OnRecordUpdateExecute: 1,
      OnRecordAfterUpdateSuccess: 1,
      OnModelValidate: 4,
      OnRecordValidate: 4,
    },
  },
  {
    name: "creating user (with mapped OAuth2 fields and username that doesn't match the field validations)",
    method: "POST",
    url: "/api/collections/users/auth-with-oauth2",
    body: JSON.stringify({
      provider: "test",
      code: "123",
      redirectURL: "https://example.com",
    }),
    beforeTest: async (app) => {
      const collection = app.findCollectionByNameOrIdOrNull("users");
      if (!collection) {
        throw new Error("Missing users collection");
      }

      setTestProvider({
        Id: "oauth2_id",
        Email: "oauth2@example.com",
        Username: "!@invalid",
        Name: "oauth2_name",
      });

      collection.MFA.Enabled = false;
      collection.OAuth2.Enabled = true;
      setOAuthProviders(collection, "test");
      collection.OAuth2.MappedFields = {
        Id: "",
        Name: "",
        Username: "username",
        AvatarURL: "",
      };
      const saveErr = await app.Save(collection);
      if (saveErr) {
        throw new Error(saveErr.message);
      }
    },
    expectedStatus: 200,
    expectedContent: [
      '"isNew":true',
      '"email":"oauth2@example.com"',
      '"emailVisibility":false',
      '"verified":true',
      '"avatar":""',
      '"username":"users',
    ],
    notExpectedContent: ['"tokenKey"', '"password"'],
    expectedEvents: {
      "*": 0,
      OnRecordAuthWithOAuth2Request: 1,
      OnRecordAuthRequest: 1,
      OnRecordCreateRequest: 1,
      OnRecordEnrich: 2,
      OnModelCreate: 3,
      OnModelCreateExecute: 3,
      OnModelAfterCreateSuccess: 3,
      OnRecordCreate: 3,
      OnRecordCreateExecute: 3,
      OnRecordAfterCreateSuccess: 3,
      OnModelUpdate: 1,
      OnModelUpdateExecute: 1,
      OnModelAfterUpdateSuccess: 1,
      OnRecordUpdate: 1,
      OnRecordUpdateExecute: 1,
      OnRecordAfterUpdateSuccess: 1,
      OnModelValidate: 4,
      OnRecordValidate: 4,
    },
  },
  {
    name: "OnRecordAuthWithOAuth2Request tx body write check",
    method: "POST",
    url: "/api/collections/users/auth-with-oauth2",
    body: JSON.stringify({
      provider: "test",
      code: "123",
      redirectURL: "https://example.com",
    }),
    beforeTest: async (app) => {
      const user = app.FindAuthRecordByEmail("users", "test@example.com");

      setTestProvider({ Id: "test_id" });

      const collection = user.collection();
      collection.MFA.Enabled = false;
      collection.OAuth2.Enabled = true;
      setOAuthProviders(collection, "test");
      const saveErr = await app.Save(collection);
      if (saveErr) {
        throw new Error(saveErr.message);
      }

      const externalAuth = NewExternalAuth(app);
      externalAuth.SetCollectionRef(collection.Id);
      externalAuth.SetRecordRef(user.Id);
      externalAuth.SetProvider("test");
      externalAuth.SetProviderId("test_id");
      const relErr = await app.Save(externalAuth);
      if (relErr) {
        throw new Error(relErr.message);
      }

      app.OnRecordAuthWithOAuth2Request().BindFunc(async (authEvent: any) => {
        const original = authEvent.App;
        await authEvent.App.RunInTransaction(async (txApp: any) => {
          authEvent.App = txApp;
          await authEvent.Next();
          authEvent.App = original;
          return new Error("TX_ERROR");
        });

        return authEvent.RequestEvent.json(400, {
          status: 400,
          message: "TX_ERROR",
          data: {},
        });
      });
    },
    expectedStatus: 400,
    expectedContent: ["TX_ERROR"],
    expectedEvents: { OnRecordAuthWithOAuth2Request: 1 },
  },
  {
    name: "OnRecordAuthWithOAuth2Request metadata serialization failure",
    method: "POST",
    url: "/api/collections/users/auth-with-oauth2",
    body: JSON.stringify({
      provider: "test",
      code: "123",
      redirectURL: "https://example.com",
    }),
    beforeTest: async (app) => {
      const user = app.FindAuthRecordByEmail("users", "test@example.com");

      setTestProvider({ Id: "test_id" });

      const collection = user.collection();
      collection.MFA.Enabled = false;
      collection.OAuth2.Enabled = true;
      setOAuthProviders(collection, "test");
      const saveErr = await app.Save(collection);
      if (saveErr) {
        throw new Error(saveErr.message);
      }

      const externalAuth = NewExternalAuth(app);
      externalAuth.SetCollectionRef(collection.Id);
      externalAuth.SetRecordRef(user.Id);
      externalAuth.SetProvider("test");
      externalAuth.SetProviderId("test_id");
      const relErr = await app.Save(externalAuth);
      if (relErr) {
        throw new Error(relErr.message);
      }

      app.OnRecordAuthWithOAuth2Request().BindFunc(async (authEvent: any) => {
        if (authEvent.OAuth2User) {
          authEvent.OAuth2User.RawUser.self = authEvent.OAuth2User.RawUser;
        }
        return authEvent.Next();
      });
    },
    expectedStatus: 400,
    expectedContent: ['"message":"Failed to authenticate."', '"data":{}'],
  },
  {
    name: "store name with Apple provider",
    method: "POST",
    url: "/api/collections/users/auth-with-oauth2",
    body: JSON.stringify({
      provider: "apple",
      code: "test_code",
      redirectURL: "https://example.com",
    }),
    beforeTest: async (app) => {
      const collection = app.findCollectionByNameOrIdOrNull("users");
      if (!collection) {
        throw new Error("Missing users collection");
      }

      setAppleProvider({ Id: "test_id" });
      app.store().set("@redirect_name_test_code", "test_store_name");

      collection.MFA.Enabled = false;
      collection.OAuth2.Enabled = true;
      setOAuthProviders(collection, NameApple);
      const saveErr = await app.Save(collection);
      if (saveErr) {
        throw new Error(saveErr.message);
      }
    },
    expectedStatus: 200,
    expectedContent: ['"meta":{', '"name":"test_store_name"'],
    afterTest: (app) => {
      if (app.store().has("@redirect_name_test_code")) {
        throw new Error("Expected @redirect_name_test_code store key to be removed");
      }
    },
  },
  {
    name: "store name with non-Apple provider",
    method: "POST",
    url: "/api/collections/users/auth-with-oauth2",
    body: JSON.stringify({
      provider: "test",
      code: "test_code",
      redirectURL: "https://example.com",
    }),
    beforeTest: async (app) => {
      const collection = app.findCollectionByNameOrIdOrNull("users");
      if (!collection) {
        throw new Error("Missing users collection");
      }

      setTestProvider({ Id: "test_id" });
      app.store().set("@redirect_name_test_code", "test_store_name");

      collection.MFA.Enabled = false;
      collection.OAuth2.Enabled = true;
      setOAuthProviders(collection, "test");
      const saveErr = await app.Save(collection);
      if (saveErr) {
        throw new Error(saveErr.message);
      }
    },
    expectedStatus: 200,
    notExpectedContent: ['"name":"test_store_name"'],
    afterTest: (app) => {
      if (!app.store().has("@redirect_name_test_code")) {
        throw new Error("Expected @redirect_name_test_code store key to NOT be deleted");
      }
    },
  },
  {
    name: "RateLimit rule - users:authWithOAuth2",
    method: "POST",
    url: "/api/collections/users/auth-with-oauth2",
    beforeTest: async (app) => {
      app.settings().rateLimits.enabled = true;
      app.settings().rateLimits.rules = [
        { maxRequests: 100, label: "abc", duration: 1 },
        { maxRequests: 100, label: "*:authWithOAuth2", duration: 1 },
        { maxRequests: 100, label: "users:auth", duration: 1 },
        { maxRequests: 0, label: "users:authWithOAuth2", duration: 1 },
      ];
    },
    expectedStatus: 429,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "RateLimit rule - *:authWithOAuth2",
    method: "POST",
    url: "/api/collections/users/auth-with-oauth2",
    beforeTest: async (app) => {
      app.settings().rateLimits.enabled = true;
      app.settings().rateLimits.rules = [
        { maxRequests: 100, label: "abc", duration: 1 },
        { maxRequests: 100, label: "*:auth", duration: 1 },
        { maxRequests: 0, label: "*:authWithOAuth2", duration: 1 },
      ];
    },
    expectedStatus: 429,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "RateLimit tag - users:auth",
    method: "POST",
    url: "/api/collections/users/auth-with-oauth2",
    beforeTest: async (app) => {
      app.settings().rateLimits.enabled = true;
      app.settings().rateLimits.rules = [
        { maxRequests: 100, label: "abc", duration: 1 },
        { maxRequests: 100, label: "*:authWithOAuth2", duration: 1 },
        { maxRequests: 0, label: "users:auth", duration: 1 },
      ];
    },
    expectedStatus: 429,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "RateLimit tag - *:auth",
    method: "POST",
    url: "/api/collections/users/auth-with-oauth2",
    beforeTest: async (app) => {
      app.settings().rateLimits.enabled = true;
      app.settings().rateLimits.rules = [
        { maxRequests: 100, label: "abc", duration: 1 },
        { maxRequests: 0, label: "*:auth", duration: 1 },
      ];
    },
    expectedStatus: 429,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
];

describe("record auth with oauth2", () => {
  for (const scenario of scenarios) {
    const name = scenario.name ?? "scenario";
    it.serial(name, async () => {
      await runApiScenario(scenario);
    });
  }
});

describe("safeFileFromURL", () => {
  it("downloads files from public IPs", async () => {
    const file = await safeFileFromURL(null, "https://example.com/test%20avatar.png", {
      lookup: async () => [{ address: "93.184.216.34", family: 4 }],
      fetch: async () =>
        new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { "content-type": "image/png" },
        }),
    });

    expect(file.OriginalName).toBe("test avatar.png");
    expect(file.Size).toBe(3);
  });

  it("rejects loopback targets before issuing the fetch", async () => {
    let fetchCalls = 0;

    try {
      await safeFileFromURL(null, "http://127.0.0.1:8090/avatar.png", {
        lookup: async () => [{ address: "127.0.0.1", family: 4 }],
        fetch: async () => {
          fetchCalls += 1;
          return new Response(new Uint8Array([1]), { status: 200 });
        },
      });
      throw new Error("Expected safeFileFromURL to reject loopback targets");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('address "127.0.0.1" is invalid or resolve to disallowed IP');
    }

    expect(fetchCalls).toBe(0);
  });
});
