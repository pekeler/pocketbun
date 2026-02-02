// Ported from pocketbase/apis/record_crud_external_auth_test.go.

import { describe, it } from "bun:test";
import { CollectionNameExternalAuths } from "../core/external_auth_model.ts";
import { runApiScenario, type ApiScenario } from "../tests/api.ts";

const superuserToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY";

const userToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.ZT3F0Z3iM-xbGgSG3LEKiEzHrPHr8t8IuHLZGGNuxLo";

const user2Token =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6Im9hcDY0MGNvdDR5cnUycyIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.GfJo6EHIobgas_AXt-M-tj5IoQendPnrkMSe9ExuSEY";

const clientToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6ImdrMzkwcWVnczR5NDd3biIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoidjg1MXE0cjc5MHJoa25sIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.0ONnm_BsvPRZyDNT31GN1CKUB6uQRxvVvQ-Wc9AZfG0";

describe("record crud external auth list", () => {
  const scenarios: ApiScenario[] = [
    {
      name: "guest",
      method: "GET",
      url: `/api/collections/${CollectionNameExternalAuths}/records`,
      expectedStatus: 200,
      expectedContent: ['"page":1', '"perPage":30', '"totalItems":0', '"totalPages":0', '"items":[]'],
      expectedEvents: {
        "*": 0,
        OnRecordsListRequest: 1,
      },
    },
    {
      name: "regular auth with externalAuths",
      method: "GET",
      url: `/api/collections/${CollectionNameExternalAuths}/records`,
      headers: { Authorization: clientToken },
      expectedStatus: 200,
      expectedContent: ['"page":1', '"perPage":30', '"totalItems":1', '"totalPages":1', '"id":"f1z5b3843pzc964"'],
      expectedEvents: {
        "*": 0,
        OnRecordsListRequest: 1,
        OnRecordEnrich: 1,
      },
    },
    {
      name: "regular auth without externalAuths",
      method: "GET",
      url: `/api/collections/${CollectionNameExternalAuths}/records`,
      headers: { Authorization: user2Token },
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

describe("record crud external auth view", () => {
  const scenarios: ApiScenario[] = [
    {
      name: "guest",
      method: "GET",
      url: `/api/collections/${CollectionNameExternalAuths}/records/dlmflokuq1xl342`,
      expectedStatus: 404,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "non-owner",
      method: "GET",
      url: `/api/collections/${CollectionNameExternalAuths}/records/dlmflokuq1xl342`,
      headers: { Authorization: clientToken },
      expectedStatus: 404,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "owner",
      method: "GET",
      url: `/api/collections/${CollectionNameExternalAuths}/records/dlmflokuq1xl342`,
      headers: { Authorization: userToken },
      expectedStatus: 200,
      expectedContent: ['"id":"dlmflokuq1xl342"'],
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

describe("record crud external auth delete", () => {
  const scenarios: ApiScenario[] = [
    {
      name: "guest",
      method: "DELETE",
      url: `/api/collections/${CollectionNameExternalAuths}/records/dlmflokuq1xl342`,
      expectedStatus: 404,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "non-owner",
      method: "DELETE",
      url: `/api/collections/${CollectionNameExternalAuths}/records/dlmflokuq1xl342`,
      headers: { Authorization: clientToken },
      expectedStatus: 404,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "owner",
      method: "DELETE",
      url: `/api/collections/${CollectionNameExternalAuths}/records/dlmflokuq1xl342`,
      headers: { Authorization: userToken },
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

describe("record crud external auth create", () => {
  const body = () =>
    JSON.stringify({
      recordRef: "4q1xlclmfloku33",
      collectionRef: "_pb_users_auth_",
      provider: "github",
      providerId: "abc",
    });

  const scenarios: ApiScenario[] = [
    {
      name: "guest",
      method: "POST",
      url: `/api/collections/${CollectionNameExternalAuths}/records`,
      body: body(),
      expectedStatus: 403,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "owner regular auth",
      method: "POST",
      url: `/api/collections/${CollectionNameExternalAuths}/records`,
      headers: { Authorization: userToken },
      body: body(),
      expectedStatus: 403,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "superusers auth",
      method: "POST",
      url: `/api/collections/${CollectionNameExternalAuths}/records`,
      headers: { Authorization: superuserToken },
      body: body(),
      expectedStatus: 200,
      expectedContent: ['"recordRef":"4q1xlclmfloku33"', '"providerId":"abc"'],
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

describe("record crud external auth update", () => {
  const body = () => JSON.stringify({ providerId: "abc" });

  const scenarios: ApiScenario[] = [
    {
      name: "guest",
      method: "PATCH",
      url: `/api/collections/${CollectionNameExternalAuths}/records/dlmflokuq1xl342`,
      body: body(),
      expectedStatus: 403,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "owner regular auth",
      method: "PATCH",
      url: `/api/collections/${CollectionNameExternalAuths}/records/dlmflokuq1xl342`,
      headers: { Authorization: clientToken },
      body: body(),
      expectedStatus: 403,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "superusers auth",
      method: "PATCH",
      url: `/api/collections/${CollectionNameExternalAuths}/records/dlmflokuq1xl342`,
      headers: { Authorization: superuserToken },
      body: body(),
      expectedStatus: 200,
      expectedContent: ['"id":"dlmflokuq1xl342"', '"providerId":"abc"'],
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
