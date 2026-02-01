// Ported from pocketbase/apis/record_auth_with_password_test.go.

import { describe, it } from "bun:test";
import type { TestApp } from "../../tests/test_app.ts";
import { runApiScenario, type ApiScenario } from "../../tests/api.ts";
import { RequestInfoContextPasswordAuth } from "../core/event_request.ts";
import { NewMFA } from "../core/mfa_model.ts";
import { findSingleColumnUniqueIndex } from "../tools/dbutils/index.ts";

const regularUserToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.ZT3F0Z3iM-xbGgSG3LEKiEzHrPHr8t8IuHLZGGNuxLo";

type Scenario = ApiScenario;

type FieldCollateMap = Record<string, string>;

const updateIdentityIndex = (collectionIdOrName: string, fieldCollateMap: FieldCollateMap) => async (app: TestApp) => {
  const collection = app.findCollectionByNameOrId(collectionIdOrName);
  if (!collection) {
    throw new Error(`Missing collection ${collectionIdOrName}`);
  }

  for (const [column, collate] of Object.entries(fieldCollateMap)) {
    const [index, ok] = findSingleColumnUniqueIndex(collection.indexes, column);
    if (!ok) {
      throw new Error(`Missing unique identityField index for column ${column}`);
    }

    if (index.columns[0]) {
      index.columns[0].collate = collate;
    }

    collection.RemoveIndex(index.indexName);
    collection.indexes = [...collection.indexes, index.build()];
  }

  const err = app.Save(collection);
  if (err) {
    throw new Error(`Failed to update identityField index: ${err.message}`);
  }
};

const scenarios: Scenario[] = [
  {
    name: "disabled password auth",
    method: "POST",
    url: "/api/collections/nologin/auth-with-password",
    body: '{"identity":"test@example.com","password":"1234567890"}',
    expectedStatus: 403,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "non-auth collection",
    method: "POST",
    url: "/api/collections/demo1/auth-with-password",
    body: '{"identity":"test@example.com","password":"1234567890"}',
    expectedStatus: 404,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "invalid body format",
    method: "POST",
    url: "/api/collections/clients/auth-with-password",
    body: '{"identity',
    expectedStatus: 400,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "empty body params",
    method: "POST",
    url: "/api/collections/clients/auth-with-password",
    body: '{"identity":"","password":""}',
    expectedStatus: 400,
    expectedContent: ['"data":{', '"identity":{', '"password":{'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "OnRecordAuthWithPasswordRequest tx body write check",
    method: "POST",
    url: "/api/collections/clients/auth-with-password",
    body: '{"identity":"test@example.com","password":"1234567890"}',
    beforeTest: (app) => {
      app.OnRecordAuthWithPasswordRequest().BindFunc((event: any) => {
        const original = event.App;
        event.App.RunInTransaction((txApp: any) => {
          event.App = txApp;
          void event.Next();
          event.App = original;
          return new Error("TX_ERROR");
        });

        return event.RequestEvent.json(400, {
          status: 400,
          message: "TX_ERROR",
          data: {},
        });
      });
    },
    expectedStatus: 400,
    expectedContent: ["TX_ERROR"],
    expectedEvents: { OnRecordAuthWithPasswordRequest: 1 },
  },
  {
    name: "valid identity field and invalid password",
    method: "POST",
    url: "/api/collections/clients/auth-with-password",
    body: '{"identity":"test@example.com","password":"invalid"}',
    expectedStatus: 400,
    expectedContent: ['"data":{}'],
    expectedEvents: {
      "*": 0,
      OnRecordAuthWithPasswordRequest: 1,
    },
  },
  {
    name: "valid identity field (email) and valid password",
    method: "POST",
    url: "/api/collections/clients/auth-with-password",
    body: '{"identity":"test@example.com","password":"1234567890"}',
    beforeTest: (app) => {
      app.OnRecordAuthRequest().BindFunc(async (event: any) => {
        const info = await event.RequestEvent.requestInfo();
        if (info.context !== RequestInfoContextPasswordAuth) {
          throw new Error(`Expected request context ${RequestInfoContextPasswordAuth}, got ${info.context}`);
        }
        return event.Next();
      });
    },
    expectedStatus: 200,
    expectedContent: ['"email":"test@example.com"', '"token":'],
    notExpectedContent: ['"tokenKey"', '"password"'],
    expectedEvents: {
      "*": 0,
      OnRecordAuthWithPasswordRequest: 1,
      OnRecordAuthRequest: 1,
      OnRecordEnrich: 1,
      OnModelCreate: 1,
      OnModelCreateExecute: 1,
      OnModelAfterCreateSuccess: 1,
      OnModelValidate: 1,
      OnRecordCreate: 1,
      OnRecordCreateExecute: 1,
      OnRecordAfterCreateSuccess: 1,
      OnRecordValidate: 1,
      OnMailerSend: 1,
      OnMailerRecordAuthAlertSend: 1,
    },
  },
  {
    name: "valid identity field (username) and valid password",
    method: "POST",
    url: "/api/collections/clients/auth-with-password",
    body: '{"identity":"clients57772","password":"1234567890"}',
    expectedStatus: 200,
    expectedContent: ['"email":"test@example.com"', '"username":"clients57772"', '"token":'],
    notExpectedContent: ['"tokenKey"', '"password"'],
    expectedEvents: {
      "*": 0,
      OnRecordAuthWithPasswordRequest: 1,
      OnRecordAuthRequest: 1,
      OnRecordEnrich: 1,
      OnModelCreate: 1,
      OnModelCreateExecute: 1,
      OnModelAfterCreateSuccess: 1,
      OnModelValidate: 1,
      OnRecordCreate: 1,
      OnRecordCreateExecute: 1,
      OnRecordAfterCreateSuccess: 1,
      OnRecordValidate: 1,
      OnMailerSend: 1,
      OnMailerRecordAuthAlertSend: 1,
    },
  },
  {
    name: "valid non-email identity field with a value that is a properly formatted email",
    method: "POST",
    url: "/api/collections/clients/auth-with-password",
    body: '{"identity":"username_as_email@example.com","password":"1234567890"}',
    beforeTest: (app) => {
      const record = app.FindAuthRecordByEmail("clients", "test@example.com");
      record.Set("username", "username_as_email@example.com");
      const err = app.SaveNoValidate(record);
      if (err) {
        throw new Error(err.message);
      }
    },
    expectedStatus: 200,
    expectedContent: ['"email":"test@example.com"', '"username":"username_as_email@example.com"', '"token":'],
    notExpectedContent: ['"tokenKey"', '"password"'],
    expectedEvents: {
      "*": 0,
      OnRecordAuthWithPasswordRequest: 1,
      OnRecordAuthRequest: 1,
      OnRecordEnrich: 1,
      OnModelCreate: 1,
      OnModelCreateExecute: 1,
      OnModelAfterCreateSuccess: 1,
      OnModelValidate: 1,
      OnRecordCreate: 1,
      OnRecordCreateExecute: 1,
      OnRecordAfterCreateSuccess: 1,
      OnRecordValidate: 1,
      OnMailerSend: 1,
      OnMailerRecordAuthAlertSend: 1,
    },
  },
  {
    name: "unknown explicit identityField",
    method: "POST",
    url: "/api/collections/clients/auth-with-password",
    body: '{"identityField":"created","identity":"test@example.com","password":"1234567890"}',
    expectedStatus: 400,
    expectedContent: ['"data":{', '"identityField":{"code":"validation_in_invalid"'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "valid identity field and valid password with mismatched explicit identityField",
    method: "POST",
    url: "/api/collections/clients/auth-with-password",
    body: '{"identityField":"username","identity":"test@example.com","password":"1234567890"}',
    expectedStatus: 400,
    expectedContent: ['"data":{}'],
    expectedEvents: {
      "*": 0,
      OnRecordAuthWithPasswordRequest: 1,
    },
  },
  {
    name: "valid identity field and valid password with matched explicit identityField",
    method: "POST",
    url: "/api/collections/clients/auth-with-password",
    body: '{"identityField":"username","identity":"clients57772","password":"1234567890"}',
    expectedStatus: 200,
    expectedContent: ['"email":"test@example.com"', '"username":"clients57772"', '"token":'],
    notExpectedContent: ['"tokenKey"', '"password"'],
    expectedEvents: {
      "*": 0,
      OnRecordAuthWithPasswordRequest: 1,
      OnRecordAuthRequest: 1,
      OnRecordEnrich: 1,
      OnModelCreate: 1,
      OnModelCreateExecute: 1,
      OnModelAfterCreateSuccess: 1,
      OnModelValidate: 1,
      OnRecordCreate: 1,
      OnRecordCreateExecute: 1,
      OnRecordAfterCreateSuccess: 1,
      OnRecordValidate: 1,
      OnMailerSend: 1,
      OnMailerRecordAuthAlertSend: 1,
    },
  },
  {
    name: "valid identity (unverified) and valid password in onlyVerified collection",
    method: "POST",
    url: "/api/collections/clients/auth-with-password",
    body: '{"identity":"test2@example.com","password":"1234567890"}',
    expectedStatus: 403,
    expectedContent: ['"data":{}'],
    expectedEvents: {
      "*": 0,
      OnRecordAuthWithPasswordRequest: 1,
    },
  },
  {
    name: "already authenticated record",
    method: "POST",
    url: "/api/collections/clients/auth-with-password",
    body: '{"identity":"test@example.com","password":"1234567890"}',
    headers: { Authorization: regularUserToken },
    expectedStatus: 200,
    expectedContent: ['"id":"gk390qegs4y47wn"', '"email":"test@example.com"', '"token":'],
    notExpectedContent: ['"tokenKey"', '"password"'],
    expectedEvents: {
      "*": 0,
      OnRecordAuthWithPasswordRequest: 1,
      OnRecordAuthRequest: 1,
      OnRecordEnrich: 1,
      OnModelCreate: 1,
      OnModelCreateExecute: 1,
      OnModelAfterCreateSuccess: 1,
      OnModelValidate: 1,
      OnRecordCreate: 1,
      OnRecordCreateExecute: 1,
      OnRecordAfterCreateSuccess: 1,
      OnRecordValidate: 1,
      OnMailerSend: 1,
      OnMailerRecordAuthAlertSend: 1,
    },
  },
  {
    name: "with mfa first auth check",
    method: "POST",
    url: "/api/collections/users/auth-with-password",
    body: '{"identity":"test@example.com","password":"1234567890"}',
    expectedStatus: 401,
    expectedContent: ['"mfaId":"'],
    expectedEvents: {
      "*": 0,
      OnRecordAuthWithPasswordRequest: 1,
      OnRecordAuthRequest: 1,
      OnModelCreate: 1,
      OnModelCreateExecute: 1,
      OnModelAfterCreateSuccess: 1,
      OnModelValidate: 1,
      OnRecordCreate: 1,
      OnRecordCreateExecute: 1,
      OnRecordAfterCreateSuccess: 1,
      OnRecordValidate: 1,
    },
    afterTest: (app) => {
      const user = app.FindAuthRecordByEmail("users", "test@example.com");
      const mfas = app.FindAllMFAsByRecord(user);
      if (mfas.length !== 1) {
        throw new Error(`Expected 1 mfa record to be created, got ${mfas.length}`);
      }
    },
  },
  {
    name: "with mfa second auth check",
    method: "POST",
    url: "/api/collections/users/auth-with-password",
    body: '{"mfaId":"aaaaaaaaaaaaaaa","identity":"test@example.com","password":"1234567890"}',
    beforeTest: (app) => {
      const user = app.FindAuthRecordByEmail("users", "test@example.com");
      const mfa = NewMFA(app);
      mfa.Id = "aaaaaaaaaaaaaaa";
      mfa.SetCollectionRef(user.collection().Id);
      mfa.SetRecordRef(user.Id);
      mfa.SetMethod("test");
      const err = app.Save(mfa);
      if (err) {
        throw new Error(err.message);
      }
    },
    expectedStatus: 200,
    expectedContent: ['"email":"test@example.com"', '"token":'],
    notExpectedContent: ['"tokenKey"', '"password"'],
    expectedEvents: {
      "*": 0,
      OnRecordAuthWithPasswordRequest: 1,
      OnRecordAuthRequest: 1,
      OnRecordEnrich: 1,
      OnModelCreate: 1,
      OnModelCreateExecute: 1,
      OnModelAfterCreateSuccess: 1,
      OnModelValidate: 1,
      OnRecordCreate: 1,
      OnRecordCreateExecute: 1,
      OnRecordAfterCreateSuccess: 1,
      OnRecordValidate: 1,
      OnMailerSend: 0,
      OnMailerRecordAuthAlertSend: 0,
      OnModelDelete: 1,
      OnModelDeleteExecute: 1,
      OnModelAfterDeleteSuccess: 1,
      OnRecordDelete: 1,
      OnRecordDeleteExecute: 1,
      OnRecordAfterDeleteSuccess: 1,
    },
  },
  {
    name: "with enabled mfa but unsatisfied mfa rule (aka. skip the mfa check)",
    method: "POST",
    url: "/api/collections/users/auth-with-password",
    body: '{"identity":"test@example.com","password":"1234567890"}',
    beforeTest: (app) => {
      const users = app.findCollectionByNameOrId("users");
      if (!users) {
        throw new Error("Missing users collection");
      }
      users.MFA.Enabled = true;
      users.MFA.Rule = "1=2";
      const err = app.Save(users);
      if (err) {
        throw new Error(err.message);
      }
    },
    expectedStatus: 200,
    expectedContent: ['"email":"test@example.com"', '"token":'],
    notExpectedContent: ['"tokenKey"', '"password"'],
    expectedEvents: {
      "*": 0,
      OnRecordAuthWithPasswordRequest: 1,
      OnRecordAuthRequest: 1,
      OnRecordEnrich: 1,
      OnModelCreate: 1,
      OnModelCreateExecute: 1,
      OnModelAfterCreateSuccess: 1,
      OnModelValidate: 1,
      OnRecordCreate: 1,
      OnRecordCreateExecute: 1,
      OnRecordAfterCreateSuccess: 1,
      OnRecordValidate: 1,
      OnMailerSend: 0,
      OnMailerRecordAuthAlertSend: 0,
    },
    afterTest: (app) => {
      const user = app.FindAuthRecordByEmail("users", "test@example.com");
      const mfas = app.FindAllMFAsByRecord(user);
      if (mfas.length !== 0) {
        throw new Error(`Expected no mfa records to be created, got ${mfas.length}`);
      }
    },
  },
  {
    name: "with explicit identityField (case-sensitive)",
    method: "POST",
    url: "/api/collections/clients/auth-with-password",
    body: '{"identityField":"username","identity":"Clients57772","password":"1234567890"}',
    beforeTest: updateIdentityIndex("clients", { username: "" }),
    expectedStatus: 400,
    expectedContent: ['"data":{}'],
    expectedEvents: {
      "*": 0,
      OnRecordAuthWithPasswordRequest: 1,
    },
  },
  {
    name: "with explicit identityField (case-insensitive)",
    method: "POST",
    url: "/api/collections/clients/auth-with-password",
    body: '{"identityField":"username","identity":"Clients57772","password":"1234567890"}',
    beforeTest: updateIdentityIndex("clients", { username: "nocase" }),
    expectedStatus: 200,
    expectedContent: ['"email":"test@example.com"', '"username":"clients57772"', '"token":'],
    notExpectedContent: ['"tokenKey"', '"password"'],
    expectedEvents: {
      "*": 0,
      OnRecordAuthWithPasswordRequest: 1,
      OnRecordAuthRequest: 1,
      OnRecordEnrich: 1,
      OnModelCreate: 1,
      OnModelCreateExecute: 1,
      OnModelAfterCreateSuccess: 1,
      OnModelValidate: 1,
      OnRecordCreate: 1,
      OnRecordCreateExecute: 1,
      OnRecordAfterCreateSuccess: 1,
      OnRecordValidate: 1,
      OnMailerSend: 1,
      OnMailerRecordAuthAlertSend: 1,
    },
  },
  {
    name: "without explicit identityField and non-email field (case-insensitive)",
    method: "POST",
    url: "/api/collections/clients/auth-with-password",
    body: '{"identity":"Clients57772","password":"1234567890"}',
    beforeTest: updateIdentityIndex("clients", { username: "nocase" }),
    expectedStatus: 200,
    expectedContent: ['"email":"test@example.com"', '"username":"clients57772"', '"token":'],
    notExpectedContent: ['"tokenKey"', '"password"'],
    expectedEvents: {
      "*": 0,
      OnRecordAuthWithPasswordRequest: 1,
      OnRecordAuthRequest: 1,
      OnRecordEnrich: 1,
      OnModelCreate: 1,
      OnModelCreateExecute: 1,
      OnModelAfterCreateSuccess: 1,
      OnModelValidate: 1,
      OnRecordCreate: 1,
      OnRecordCreateExecute: 1,
      OnRecordAfterCreateSuccess: 1,
      OnRecordValidate: 1,
      OnMailerSend: 1,
      OnMailerRecordAuthAlertSend: 1,
    },
  },
  {
    name: "without explicit identityField and email field (case-insensitive)",
    method: "POST",
    url: "/api/collections/clients/auth-with-password",
    body: '{"identity":"tESt@example.com","password":"1234567890"}',
    beforeTest: updateIdentityIndex("clients", { email: "nocase" }),
    expectedStatus: 200,
    expectedContent: ['"email":"test@example.com"', '"username":"clients57772"', '"token":'],
    notExpectedContent: ['"tokenKey"', '"password"'],
    expectedEvents: {
      "*": 0,
      OnRecordAuthWithPasswordRequest: 1,
      OnRecordAuthRequest: 1,
      OnRecordEnrich: 1,
      OnModelCreate: 1,
      OnModelCreateExecute: 1,
      OnModelAfterCreateSuccess: 1,
      OnModelValidate: 1,
      OnRecordCreate: 1,
      OnRecordCreateExecute: 1,
      OnRecordAfterCreateSuccess: 1,
      OnRecordValidate: 1,
      OnMailerSend: 1,
      OnMailerRecordAuthAlertSend: 1,
    },
  },
  {
    name: "RateLimit rule - users:authWithPassword",
    method: "POST",
    url: "/api/collections/users/auth-with-password",
    beforeTest: (app) => {
      app.settings().rateLimits.enabled = true;
      app.settings().rateLimits.rules = [
        { maxRequests: 100, label: "abc", duration: 1 },
        { maxRequests: 100, label: "*:authWithPassword", duration: 1 },
        { maxRequests: 100, label: "users:auth", duration: 1 },
        { maxRequests: 0, label: "users:authWithPassword", duration: 1 },
      ];
    },
    expectedStatus: 429,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "RateLimit rule - *:authWithPassword",
    method: "POST",
    url: "/api/collections/users/auth-with-password",
    beforeTest: (app) => {
      app.settings().rateLimits.enabled = true;
      app.settings().rateLimits.rules = [
        { maxRequests: 100, label: "abc", duration: 1 },
        { maxRequests: 100, label: "*:auth", duration: 1 },
        { maxRequests: 0, label: "*:authWithPassword", duration: 1 },
      ];
    },
    expectedStatus: 429,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "RateLimit rule - users:auth",
    method: "POST",
    url: "/api/collections/users/auth-with-password",
    beforeTest: (app) => {
      app.settings().rateLimits.enabled = true;
      app.settings().rateLimits.rules = [
        { maxRequests: 100, label: "abc", duration: 1 },
        { maxRequests: 100, label: "*:authWithPassword", duration: 1 },
        { maxRequests: 0, label: "users:auth", duration: 1 },
      ];
    },
    expectedStatus: 429,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "RateLimit rule - *:auth",
    method: "POST",
    url: "/api/collections/users/auth-with-password",
    beforeTest: (app) => {
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

describe("record auth with password", () => {
  for (const scenario of scenarios) {
    const name = scenario.name ?? `${scenario.method}:${scenario.url}`;
    it(name, async () => {
      await runApiScenario(scenario);
    });
  }
});
