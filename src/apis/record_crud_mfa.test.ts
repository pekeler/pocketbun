// Ported from pocketbase/apis/record_crud_mfa_test.go.

import { describe, it } from "bun:test";
import { CollectionNameMFAs } from "../core/mfa_model.ts";
import { runApiScenario, type ApiScenario } from "../tests/api.ts";
import { StubMFARecords } from "../tests/dynamic_stubs.ts";

const superuserToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY";

const userToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.ZT3F0Z3iM-xbGgSG3LEKiEzHrPHr8t8IuHLZGGNuxLo";

const clientToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6ImdrMzkwcWVnczR5NDd3biIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoidjg1MXE0cjc5MHJoa25sIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.0ONnm_BsvPRZyDNT31GN1CKUB6uQRxvVvQ-Wc9AZfG0";

const stubMFAs = async (app: Parameters<NonNullable<ApiScenario["beforeTest"]>>[0]) => {
  const err = await StubMFARecords(app);
  if (err) {
    throw err;
  }
};

describe("record crud mfa list", () => {
  const scenarios: ApiScenario[] = [
    {
      name: "guest",
      method: "GET",
      url: `/api/collections/${CollectionNameMFAs}/records`,
      beforeTest: stubMFAs,
      expectedStatus: 200,
      expectedContent: ['"page":1', '"perPage":30', '"totalItems":0', '"totalPages":0', '"items":[]'],
      expectedEvents: {
        "*": 0,
        OnRecordsListRequest: 1,
      },
    },
    {
      name: "regular auth with mfas",
      method: "GET",
      url: `/api/collections/${CollectionNameMFAs}/records`,
      headers: { Authorization: userToken },
      beforeTest: stubMFAs,
      expectedStatus: 200,
      expectedContent: ['"page":1', '"perPage":30', '"totalItems":1', '"totalPages":1', '"id":"user1_0"'],
      expectedEvents: {
        "*": 0,
        OnRecordsListRequest: 1,
        OnRecordEnrich: 1,
      },
    },
    {
      name: "regular auth without mfas",
      method: "GET",
      url: `/api/collections/${CollectionNameMFAs}/records`,
      headers: { Authorization: clientToken },
      beforeTest: stubMFAs,
      expectedStatus: 200,
      expectedContent: ['"page":1', '"perPage":30', '"totalItems":0', '"totalPages":0', '"items":[]'],
      expectedEvents: {
        "*": 0,
        OnRecordsListRequest: 1,
      },
    },
  ];

  for (const scenario of scenarios) {
    const name = scenario.name ?? `${scenario.method}:${scenario.url}`;
    it(name, async () => {
      await runApiScenario(scenario);
    });
  }
});

describe("record crud mfa view", () => {
  const scenarios: ApiScenario[] = [
    {
      name: "guest",
      method: "GET",
      url: `/api/collections/${CollectionNameMFAs}/records/user1_0`,
      beforeTest: stubMFAs,
      expectedStatus: 404,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "non-owner",
      method: "GET",
      url: `/api/collections/${CollectionNameMFAs}/records/user1_0`,
      headers: { Authorization: clientToken },
      beforeTest: stubMFAs,
      expectedStatus: 404,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "owner",
      method: "GET",
      url: `/api/collections/${CollectionNameMFAs}/records/user1_0`,
      headers: { Authorization: userToken },
      beforeTest: stubMFAs,
      expectedStatus: 200,
      expectedContent: ['"id":"user1_0"'],
      expectedEvents: {
        "*": 0,
        OnRecordViewRequest: 1,
        OnRecordEnrich: 1,
      },
    },
  ];

  for (const scenario of scenarios) {
    const name = scenario.name ?? `${scenario.method}:${scenario.url}`;
    it(name, async () => {
      await runApiScenario(scenario);
    });
  }
});

describe("record crud mfa delete", () => {
  const scenarios: ApiScenario[] = [
    {
      name: "guest",
      method: "DELETE",
      url: `/api/collections/${CollectionNameMFAs}/records/user1_0`,
      beforeTest: stubMFAs,
      expectedStatus: 403,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "non-owner",
      method: "DELETE",
      url: `/api/collections/${CollectionNameMFAs}/records/user1_0`,
      headers: { Authorization: clientToken },
      beforeTest: stubMFAs,
      expectedStatus: 403,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "owner",
      method: "DELETE",
      url: `/api/collections/${CollectionNameMFAs}/records/user1_0`,
      headers: { Authorization: userToken },
      beforeTest: stubMFAs,
      expectedStatus: 403,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "superusers auth",
      method: "DELETE",
      url: `/api/collections/${CollectionNameMFAs}/records/user1_0`,
      headers: { Authorization: superuserToken },
      beforeTest: stubMFAs,
      expectedStatus: 204,
      expectedEvents: {
        "*": 0,
        OnRecordDeleteRequest: 1,
        OnModelDelete: 1,
        OnModelDeleteExecute: 1,
        OnModelAfterDeleteSuccess: 1,
        OnRecordDelete: 1,
        OnRecordDeleteExecute: 1,
        OnRecordAfterDeleteSuccess: 1,
      },
    },
  ];

  for (const scenario of scenarios) {
    const name = scenario.name ?? `${scenario.method}:${scenario.url}`;
    it(name, async () => {
      await runApiScenario(scenario);
    });
  }
});

describe("record crud mfa create", () => {
  const body = () =>
    JSON.stringify({
      recordRef: "4q1xlclmfloku33",
      collectionRef: "_pb_users_auth_",
      method: "abc",
    });

  const scenarios: ApiScenario[] = [
    {
      name: "guest",
      method: "POST",
      url: `/api/collections/${CollectionNameMFAs}/records`,
      body: body(),
      beforeTest: stubMFAs,
      expectedStatus: 403,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "owner regular auth",
      method: "POST",
      url: `/api/collections/${CollectionNameMFAs}/records`,
      headers: { Authorization: userToken },
      body: body(),
      beforeTest: stubMFAs,
      expectedStatus: 403,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "superusers auth",
      method: "POST",
      url: `/api/collections/${CollectionNameMFAs}/records`,
      headers: { Authorization: superuserToken },
      body: body(),
      beforeTest: stubMFAs,
      expectedStatus: 200,
      expectedContent: ['"recordRef":"4q1xlclmfloku33"'],
      expectedEvents: {
        "*": 0,
        OnRecordCreateRequest: 1,
        OnRecordEnrich: 1,
        OnModelCreate: 1,
        OnModelCreateExecute: 1,
        OnModelAfterCreateSuccess: 1,
        OnModelValidate: 1,
        OnRecordCreate: 1,
        OnRecordCreateExecute: 1,
        OnRecordAfterCreateSuccess: 1,
        OnRecordValidate: 1,
      },
    },
  ];

  for (const scenario of scenarios) {
    const name = scenario.name ?? `${scenario.method}:${scenario.url}`;
    it(name, async () => {
      await runApiScenario(scenario);
    });
  }
});

describe("record crud mfa update", () => {
  const body = () => JSON.stringify({ method: "abc" });

  const scenarios: ApiScenario[] = [
    {
      name: "guest",
      method: "PATCH",
      url: `/api/collections/${CollectionNameMFAs}/records/user1_0`,
      body: body(),
      beforeTest: stubMFAs,
      expectedStatus: 403,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "owner regular auth",
      method: "PATCH",
      url: `/api/collections/${CollectionNameMFAs}/records/user1_0`,
      headers: { Authorization: userToken },
      body: body(),
      beforeTest: stubMFAs,
      expectedStatus: 403,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "superusers auth",
      method: "PATCH",
      url: `/api/collections/${CollectionNameMFAs}/records/user1_0`,
      headers: { Authorization: superuserToken },
      body: body(),
      beforeTest: stubMFAs,
      expectedStatus: 200,
      expectedContent: ['"id":"user1_0"'],
      expectedEvents: {
        "*": 0,
        OnRecordUpdateRequest: 1,
        OnRecordEnrich: 1,
        OnModelUpdate: 1,
        OnModelUpdateExecute: 1,
        OnModelAfterUpdateSuccess: 1,
        OnModelValidate: 1,
        OnRecordUpdate: 1,
        OnRecordUpdateExecute: 1,
        OnRecordAfterUpdateSuccess: 1,
        OnRecordValidate: 1,
      },
    },
  ];

  for (const scenario of scenarios) {
    const name = scenario.name ?? `${scenario.method}:${scenario.url}`;
    it(name, async () => {
      await runApiScenario(scenario);
    });
  }
});
