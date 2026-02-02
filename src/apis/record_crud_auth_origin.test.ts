// Ported from pocketbase/apis/record_crud_auth_origin_test.go.

import { describe, it } from "bun:test";
import { CollectionNameAuthOrigins } from "../core/auth_origin_model.ts";
import { runApiScenario, type ApiScenario } from "../tests/api.ts";

const superuserToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY";

const userToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.ZT3F0Z3iM-xbGgSG3LEKiEzHrPHr8t8IuHLZGGNuxLo";

const clientToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6ImdrMzkwcWVnczR5NDd3biIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoidjg1MXE0cjc5MHJoa25sIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.0ONnm_BsvPRZyDNT31GN1CKUB6uQRxvVvQ-Wc9AZfG0";

describe("record crud auth origin list", () => {
  const scenarios: ApiScenario[] = [
    {
      name: "guest",
      method: "GET",
      url: `/api/collections/${CollectionNameAuthOrigins}/records`,
      expectedStatus: 200,
      expectedContent: ['"page":1', '"perPage":30', '"totalItems":0', '"totalPages":0', '"items":[]'],
      expectedEvents: {
        "*": 0,
        OnRecordsListRequest: 1,
      },
    },
    {
      name: "regular auth with authOrigins",
      method: "GET",
      url: `/api/collections/${CollectionNameAuthOrigins}/records`,
      headers: { Authorization: clientToken },
      expectedStatus: 200,
      expectedContent: ['"page":1', '"perPage":30', '"totalItems":1', '"totalPages":1', '"id":"9r2j0m74260ur8i"'],
      expectedEvents: {
        "*": 0,
        OnRecordsListRequest: 1,
        OnRecordEnrich: 1,
      },
    },
    {
      name: "regular auth without authOrigins",
      method: "GET",
      url: `/api/collections/${CollectionNameAuthOrigins}/records`,
      headers: { Authorization: userToken },
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

describe("record crud auth origin view", () => {
  const scenarios: ApiScenario[] = [
    {
      name: "guest",
      method: "GET",
      url: `/api/collections/${CollectionNameAuthOrigins}/records/9r2j0m74260ur8i`,
      expectedStatus: 404,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "non-owner",
      method: "GET",
      url: `/api/collections/${CollectionNameAuthOrigins}/records/9r2j0m74260ur8i`,
      headers: { Authorization: userToken },
      expectedStatus: 404,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "owner",
      method: "GET",
      url: `/api/collections/${CollectionNameAuthOrigins}/records/9r2j0m74260ur8i`,
      headers: { Authorization: clientToken },
      expectedStatus: 200,
      expectedContent: ['"id":"9r2j0m74260ur8i"'],
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

describe("record crud auth origin delete", () => {
  const scenarios: ApiScenario[] = [
    {
      name: "guest",
      method: "DELETE",
      url: `/api/collections/${CollectionNameAuthOrigins}/records/9r2j0m74260ur8i`,
      expectedStatus: 404,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "non-owner",
      method: "DELETE",
      url: `/api/collections/${CollectionNameAuthOrigins}/records/9r2j0m74260ur8i`,
      headers: { Authorization: userToken },
      expectedStatus: 404,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "owner",
      method: "DELETE",
      url: `/api/collections/${CollectionNameAuthOrigins}/records/9r2j0m74260ur8i`,
      headers: { Authorization: clientToken },
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

describe("record crud auth origin create", () => {
  const body = () =>
    JSON.stringify({
      recordRef: "4q1xlclmfloku33",
      collectionRef: "_pb_users_auth_",
      fingerprint: "abc",
    });

  const scenarios: ApiScenario[] = [
    {
      name: "guest",
      method: "POST",
      url: `/api/collections/${CollectionNameAuthOrigins}/records`,
      body: body(),
      expectedStatus: 403,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "owner regular auth",
      method: "POST",
      url: `/api/collections/${CollectionNameAuthOrigins}/records`,
      headers: { Authorization: userToken },
      body: body(),
      expectedStatus: 403,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "superusers auth",
      method: "POST",
      url: `/api/collections/${CollectionNameAuthOrigins}/records`,
      headers: { Authorization: superuserToken },
      body: body(),
      expectedStatus: 200,
      expectedContent: ['"fingerprint":"abc"'],
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

describe("record crud auth origin update", () => {
  const body = () => JSON.stringify({ fingerprint: "abc" });

  const scenarios: ApiScenario[] = [
    {
      name: "guest",
      method: "PATCH",
      url: `/api/collections/${CollectionNameAuthOrigins}/records/9r2j0m74260ur8i`,
      body: body(),
      expectedStatus: 403,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "owner regular auth",
      method: "PATCH",
      url: `/api/collections/${CollectionNameAuthOrigins}/records/9r2j0m74260ur8i`,
      headers: { Authorization: clientToken },
      body: body(),
      expectedStatus: 403,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "superusers auth",
      method: "PATCH",
      url: `/api/collections/${CollectionNameAuthOrigins}/records/9r2j0m74260ur8i`,
      headers: { Authorization: superuserToken },
      body: body(),
      expectedStatus: 200,
      expectedContent: ['"id":"9r2j0m74260ur8i"', '"fingerprint":"abc"'],
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
