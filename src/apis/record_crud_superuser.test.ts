// Ported from pocketbase/apis/record_crud_superuser_test.go.

import { describe, it } from "bun:test";
import { CollectionNameSuperusers } from "../core/collection.ts";
import { runApiScenario, type ApiScenario } from "../tests/api.ts";
import { HashExp, Not } from "../tools/dbx/expr.ts";

const superuserToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY";

const userToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.ZT3F0Z3iM-xbGgSG3LEKiEzHrPHr8t8IuHLZGGNuxLo";

describe("record crud superuser list", () => {
  const scenarios: ApiScenario[] = [
    {
      name: "guest",
      method: "GET",
      url: `/api/collections/${CollectionNameSuperusers}/records`,
      expectedStatus: 403,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "non-superusers auth",
      method: "GET",
      url: `/api/collections/${CollectionNameSuperusers}/records`,
      headers: { Authorization: userToken },
      expectedStatus: 403,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "superusers auth",
      method: "GET",
      url: `/api/collections/${CollectionNameSuperusers}/records`,
      headers: { Authorization: superuserToken },
      expectedStatus: 200,
      expectedContent: ['"page":1', '"perPage":30', '"totalPages":1', '"totalItems":4', '"items":[{'],
      expectedEvents: {
        "*": 0,
        OnRecordsListRequest: 1,
        OnRecordEnrich: 4,
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

describe("record crud superuser view", () => {
  const scenarios: ApiScenario[] = [
    {
      name: "guest",
      method: "GET",
      url: `/api/collections/${CollectionNameSuperusers}/records/sywbhecnh46rhm0`,
      expectedStatus: 403,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "non-superusers auth",
      method: "GET",
      url: `/api/collections/${CollectionNameSuperusers}/records/sywbhecnh46rhm0`,
      headers: { Authorization: userToken },
      expectedStatus: 403,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "superusers auth",
      method: "GET",
      url: `/api/collections/${CollectionNameSuperusers}/records/sywbhecnh46rhm0`,
      headers: { Authorization: superuserToken },
      expectedStatus: 200,
      expectedContent: ['"id":"sywbhecnh46rhm0"'],
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

describe("record crud superuser delete", () => {
  const scenarios: ApiScenario[] = [
    {
      name: "guest",
      method: "DELETE",
      url: `/api/collections/${CollectionNameSuperusers}/records/sbmbsdb40jyxf7h`,
      expectedStatus: 403,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "non-superusers auth",
      method: "DELETE",
      url: `/api/collections/${CollectionNameSuperusers}/records/sbmbsdb40jyxf7h`,
      headers: { Authorization: userToken },
      expectedStatus: 403,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "superusers auth",
      method: "DELETE",
      url: `/api/collections/${CollectionNameSuperusers}/records/sbmbsdb40jyxf7h`,
      headers: { Authorization: superuserToken },
      expectedStatus: 204,
      expectedEvents: {
        "*": 0,
        OnRecordDeleteRequest: 1,
        OnModelDelete: 4,
        OnModelDeleteExecute: 4,
        OnModelAfterDeleteSuccess: 4,
        OnRecordDelete: 4,
        OnRecordDeleteExecute: 4,
        OnRecordAfterDeleteSuccess: 4,
      },
    },
    {
      name: "delete the last superuser",
      method: "DELETE",
      url: `/api/collections/${CollectionNameSuperusers}/records/sywbhecnh46rhm0`,
      headers: { Authorization: superuserToken },
      beforeTest: async (app) => {
        const superusers = app.FindAllRecords(
          CollectionNameSuperusers,
          Not(
            HashExp({
              id: "sywbhecnh46rhm0",
            }),
          ),
        );
        for (const superuser of superusers) {
          const err = await app.Delete(superuser);
          if (err) {
            throw err;
          }
        }
      },
      expectedStatus: 400,
      expectedContent: ['"data":{}'],
      expectedEvents: {
        "*": 0,
        OnRecordDeleteRequest: 1,
        OnModelDelete: 1,
        OnModelAfterDeleteError: 1,
        OnRecordDelete: 1,
        OnRecordAfterDeleteError: 1,
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

describe("record crud superuser create", () => {
  const body = () =>
    JSON.stringify({
      email: "test_new@example.com",
      password: "1234567890",
      passwordConfirm: "1234567890",
      verified: false,
    });

  const scenarios: ApiScenario[] = [
    {
      name: "guest",
      method: "POST",
      url: `/api/collections/${CollectionNameSuperusers}/records`,
      body: body(),
      expectedStatus: 403,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "non-superusers auth",
      method: "POST",
      url: `/api/collections/${CollectionNameSuperusers}/records`,
      headers: { Authorization: userToken },
      body: body(),
      expectedStatus: 403,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "superusers auth",
      method: "POST",
      url: `/api/collections/${CollectionNameSuperusers}/records`,
      headers: { Authorization: superuserToken },
      body: body(),
      expectedStatus: 200,
      expectedContent: ['"collectionName":"_superusers"', '"email":"test_new@example.com"', '"verified":true'],
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

describe("record crud superuser update", () => {
  const body = () =>
    JSON.stringify({
      email: "test_new@example.com",
      verified: true,
    });

  const scenarios: ApiScenario[] = [
    {
      name: "guest",
      method: "PATCH",
      url: `/api/collections/${CollectionNameSuperusers}/records/sywbhecnh46rhm0`,
      body: body(),
      expectedStatus: 403,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "non-superusers auth",
      method: "PATCH",
      url: `/api/collections/${CollectionNameSuperusers}/records/sywbhecnh46rhm0`,
      headers: { Authorization: userToken },
      body: body(),
      expectedStatus: 403,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "superusers auth",
      method: "PATCH",
      url: `/api/collections/${CollectionNameSuperusers}/records/sywbhecnh46rhm0`,
      headers: { Authorization: superuserToken },
      body: body(),
      expectedStatus: 200,
      expectedContent: [
        '"collectionName":"_superusers"',
        '"id":"sywbhecnh46rhm0"',
        '"email":"test_new@example.com"',
        '"verified":true',
      ],
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
