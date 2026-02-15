// Ported from pocketbase/apis/collection_test.go

import { describe, it } from "bun:test";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { ApiScenario } from "../tests/api.ts";
import type { TestApp } from "../tests/app.ts";
import { CollectionNameAuthOrigins } from "../core/auth_origin_model.ts";
import { CollectionNameSuperusers } from "../core/collection_model.ts";
import { CollectionNameExternalAuths } from "../core/external_auth_model.ts";
import { CollectionNameMFAs } from "../core/mfa_model.ts";
import { CollectionNameOTPs } from "../core/otp_model.ts";
import { runApiScenario } from "../tests/api.ts";
import { existInSlice } from "../tools/list/list.ts";

const regularUserToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.ZT3F0Z3iM-xbGgSG3LEKiEzHrPHr8t8IuHLZGGNuxLo";

const superuserToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY";

const listScenarios: ApiScenario[] = [
  {
    name: "unauthorized",
    method: "GET",
    url: "/api/collections",
    expectedStatus: 401,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "authorized as regular user",
    method: "GET",
    url: "/api/collections",
    headers: { Authorization: regularUserToken },
    expectedStatus: 403,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "authorized as superuser",
    method: "GET",
    url: "/api/collections",
    headers: { Authorization: superuserToken },
    expectedStatus: 200,
    expectedContent: [
      '"page":1',
      '"perPage":30',
      '"totalItems":16',
      '"items":[{',
      `"name":"${CollectionNameSuperusers}"`,
      `"name":"${CollectionNameAuthOrigins}"`,
      `"name":"${CollectionNameExternalAuths}"`,
      `"name":"${CollectionNameMFAs}"`,
      `"name":"${CollectionNameOTPs}"`,
      '"name":"users"',
      '"name":"nologin"',
      '"name":"clients"',
      '"name":"demo1"',
      '"name":"demo2"',
      '"name":"demo3"',
      '"name":"demo4"',
      '"name":"demo5"',
      '"name":"numeric_id_view"',
      '"name":"view1"',
      '"name":"view2"',
      '"type":"auth"',
      '"type":"base"',
      '"type":"view"',
    ],
    expectedEvents: {
      "*": 0,
      OnCollectionsListRequest: 1,
    },
  },
  {
    name: "authorized as superuser + paging and sorting",
    method: "GET",
    url: "/api/collections?page=2&perPage=2&sort=-created",
    headers: { Authorization: superuserToken },
    expectedStatus: 200,
    expectedContent: ['"page":2', '"perPage":2', '"totalItems":16', '"items":[{', `"name":"${CollectionNameMFAs}"`],
    expectedEvents: {
      "*": 0,
      OnCollectionsListRequest: 1,
    },
  },
  {
    name: "authorized as superuser + invalid filter",
    method: "GET",
    url: "/api/collections?filter=invalidfield~'demo2'",
    headers: { Authorization: superuserToken },
    expectedStatus: 400,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "authorized as superuser + valid filter",
    method: "GET",
    url: "/api/collections?filter=name~'demo'",
    headers: { Authorization: superuserToken },
    expectedStatus: 200,
    expectedContent: [
      '"page":1',
      '"perPage":30',
      '"totalItems":5',
      '"items":[{',
      '"name":"demo1"',
      '"name":"demo2"',
      '"name":"demo3"',
      '"name":"demo4"',
      '"name":"demo5"',
    ],
    expectedEvents: {
      "*": 0,
      OnCollectionsListRequest: 1,
    },
  },
  {
    name: "OnCollectionsListRequest tx body write check",
    method: "GET",
    url: "/api/collections",
    headers: { Authorization: superuserToken },
    beforeTest: async (app) => {
      app.OnCollectionsListRequest().BindFunc(async (event: any) => {
        const original = event.App;
        await event.App.RunInTransaction(async (txApp: any) => {
          event.App = txApp;
          await event.Next();
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
    expectedEvents: { OnCollectionsListRequest: 1 },
    expectedContent: ["TX_ERROR"],
  },
];

describe("collections list API", () => {
  for (const scenario of listScenarios) {
    const name = scenario.name ?? `${scenario.method} ${scenario.url}`;
    it(name, async () => {
      await runApiScenario(scenario);
    });
  }
});

const viewScenarios: ApiScenario[] = [
  {
    name: "unauthorized",
    method: "GET",
    url: "/api/collections/demo1",
    expectedStatus: 401,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "authorized as regular user",
    method: "GET",
    url: "/api/collections/demo1",
    headers: { Authorization: regularUserToken },
    expectedStatus: 403,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "authorized as superuser + nonexisting collection identifier",
    method: "GET",
    url: "/api/collections/missing",
    headers: { Authorization: superuserToken },
    expectedStatus: 404,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "authorized as superuser + using the collection name",
    method: "GET",
    url: "/api/collections/demo1",
    headers: { Authorization: superuserToken },
    expectedStatus: 200,
    expectedContent: ['"id":"wsmn24bux7wo113"', '"name":"demo1"'],
    expectedEvents: {
      "*": 0,
      OnCollectionViewRequest: 1,
    },
  },
  {
    name: "authorized as superuser + using the collection id",
    method: "GET",
    url: "/api/collections/wsmn24bux7wo113",
    headers: { Authorization: superuserToken },
    expectedStatus: 200,
    expectedContent: ['"id":"wsmn24bux7wo113"', '"name":"demo1"'],
    expectedEvents: {
      "*": 0,
      OnCollectionViewRequest: 1,
    },
  },
  {
    name: "authorized as superuser + auth collection uses flattened auth options",
    method: "GET",
    url: "/api/collections/users",
    headers: { Authorization: superuserToken },
    expectedStatus: 200,
    expectedContent: ['"name":"users"', '"passwordAuth":{"enabled":', '"mfa":{"enabled":'],
    notExpectedContent: ['"options":{'],
    expectedEvents: {
      "*": 0,
      OnCollectionViewRequest: 1,
    },
  },
  {
    name: "OnCollectionViewRequest tx body write check",
    method: "GET",
    url: "/api/collections/wsmn24bux7wo113",
    headers: { Authorization: superuserToken },
    beforeTest: async (app) => {
      app.OnCollectionViewRequest().BindFunc(async (event: any) => {
        const original = event.App;
        await event.App.RunInTransaction(async (txApp: any) => {
          event.App = txApp;
          await event.Next();
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
    expectedEvents: { OnCollectionViewRequest: 1 },
    expectedContent: ["TX_ERROR"],
  },
];

describe("collection view API", () => {
  for (const scenario of viewScenarios) {
    const name = scenario.name ?? `${scenario.method} ${scenario.url}`;
    it(name, async () => {
      await runApiScenario(scenario);
    });
  }
});

const deleteScenarios: ApiScenario[] = [
  {
    name: "unauthorized",
    method: "DELETE",
    url: "/api/collections/demo1",
    expectedStatus: 401,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "authorized as regular user",
    method: "DELETE",
    url: "/api/collections/demo1",
    headers: { Authorization: regularUserToken },
    expectedStatus: 403,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "authorized as superuser + nonexisting collection identifier",
    method: "DELETE",
    url: "/api/collections/missing",
    headers: { Authorization: superuserToken },
    expectedStatus: 404,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "authorized as superuser + using the collection name",
    method: "DELETE",
    url: "/api/collections/demo5",
    headers: { Authorization: superuserToken },
    delayMs: 100,
    expectedStatus: 204,
    expectedEvents: {
      "*": 0,
      OnCollectionDeleteRequest: 1,
      OnCollectionDelete: 1,
      OnCollectionDeleteExecute: 1,
      OnCollectionAfterDeleteSuccess: 1,
      OnModelDelete: 1,
      OnModelDeleteExecute: 1,
      OnModelAfterDeleteSuccess: 1,
    },
    afterTest: async (app) => {
      await ensureDeletedFiles(app, "9n89pl5vkct6330");
    },
  },
  {
    name: "authorized as superuser + using the collection id",
    method: "DELETE",
    url: "/api/collections/9n89pl5vkct6330",
    headers: { Authorization: superuserToken },
    delayMs: 100,
    expectedStatus: 204,
    expectedEvents: {
      "*": 0,
      OnCollectionDeleteRequest: 1,
      OnCollectionDelete: 1,
      OnCollectionDeleteExecute: 1,
      OnCollectionAfterDeleteSuccess: 1,
      OnModelDelete: 1,
      OnModelDeleteExecute: 1,
      OnModelAfterDeleteSuccess: 1,
    },
    afterTest: async (app) => {
      await ensureDeletedFiles(app, "9n89pl5vkct6330");
    },
  },
  {
    name: "authorized as superuser + trying to delete a system collection",
    method: "DELETE",
    url: `/api/collections/${CollectionNameMFAs}`,
    headers: { Authorization: superuserToken },
    expectedStatus: 400,
    expectedContent: ['"data":{}'],
    expectedEvents: {
      "*": 0,
      OnCollectionDeleteRequest: 1,
      OnCollectionDelete: 1,
      OnCollectionDeleteExecute: 1,
      OnCollectionAfterDeleteError: 1,
      OnModelDelete: 1,
      OnModelDeleteExecute: 1,
      OnModelAfterDeleteError: 1,
    },
  },
  {
    name: "authorized as superuser + trying to delete a referenced collection",
    method: "DELETE",
    url: "/api/collections/demo2",
    headers: { Authorization: superuserToken },
    expectedStatus: 400,
    expectedContent: ['"data":{}'],
    expectedEvents: {
      "*": 0,
      OnCollectionDeleteRequest: 1,
      OnCollectionDelete: 1,
      OnCollectionDeleteExecute: 1,
      OnCollectionAfterDeleteError: 1,
      OnModelDelete: 1,
      OnModelDeleteExecute: 1,
      OnModelAfterDeleteError: 1,
    },
  },
  {
    name: "authorized as superuser + deleting a view",
    method: "DELETE",
    url: "/api/collections/view2",
    headers: { Authorization: superuserToken },
    expectedStatus: 204,
    expectedEvents: {
      "*": 0,
      OnCollectionDeleteRequest: 1,
      OnCollectionDelete: 1,
      OnCollectionDeleteExecute: 1,
      OnCollectionAfterDeleteSuccess: 1,
      OnModelDelete: 1,
      OnModelDeleteExecute: 1,
      OnModelAfterDeleteSuccess: 1,
    },
  },
  {
    name: "OnCollectionDeleteRequest tx body write check",
    method: "DELETE",
    url: "/api/collections/view2",
    headers: { Authorization: superuserToken },
    beforeTest: async (app) => {
      app.OnCollectionDeleteRequest().BindFunc(async (event: any) => {
        const original = event.App;
        await event.App.RunInTransaction(async (txApp: any) => {
          event.App = txApp;
          await event.Next();
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
    expectedEvents: { OnCollectionDeleteRequest: 1 },
    expectedContent: ["TX_ERROR"],
  },
];

describe("collection delete API", () => {
  for (const scenario of deleteScenarios) {
    const name = scenario.name ?? `${scenario.method} ${scenario.url}`;
    it(name, async () => {
      await runApiScenario(scenario);
    });
  }
});

const createScenarios: ApiScenario[] = [
  {
    name: "unauthorized",
    method: "POST",
    url: "/api/collections",
    expectedStatus: 401,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "authorized as regular user",
    method: "POST",
    url: "/api/collections",
    body: '{"name":"new","type":"base","fields":[{"type":"text","name":"test"}]}',
    headers: { Authorization: regularUserToken },
    expectedStatus: 403,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "authorized as superuser + empty data",
    method: "POST",
    url: "/api/collections",
    body: "",
    headers: { Authorization: superuserToken },
    expectedStatus: 400,
    expectedContent: ['"data":{', '"name":{"code":"validation_required"'],
    notExpectedContent: ['"fields":{'],
    expectedEvents: {
      "*": 0,
      OnCollectionCreateRequest: 1,
      OnCollectionCreate: 1,
      OnCollectionAfterCreateError: 1,
      OnCollectionValidate: 1,
      OnModelCreate: 1,
      OnModelAfterCreateError: 1,
      OnModelValidate: 1,
    },
  },
  {
    name: "authorized as superuser + invalid data (eg. existing name)",
    method: "POST",
    url: "/api/collections",
    body: '{"name":"demo1","type":"base","fields":[{"type":"text","name":""}]}',
    headers: { Authorization: superuserToken },
    expectedStatus: 400,
    expectedContent: [
      '"data":{',
      '"fields":{',
      '"name":{"code":"validation_collection_name_exists"',
      '"name":{"code":"validation_required"',
    ],
    expectedEvents: {
      "*": 0,
      OnCollectionCreateRequest: 1,
      OnCollectionCreate: 1,
      OnCollectionAfterCreateError: 1,
      OnCollectionValidate: 1,
      OnModelCreate: 1,
      OnModelAfterCreateError: 1,
      OnModelValidate: 1,
    },
  },
  {
    name: "authorized as superuser + valid data",
    method: "POST",
    url: "/api/collections",
    body: '{"name":"new","type":"base","fields":[{"type":"text","id":"12345789","name":"test"}]}',
    headers: { Authorization: superuserToken },
    expectedStatus: 200,
    expectedContent: [
      '"id":',
      '"name":"new"',
      '"type":"base"',
      '"system":false',
      '"fields":[{"autogeneratePattern":"[a-z0-9]{15}","hidden":false,"id":"text3208210256","max":15,"min":15,"name":"id","pattern":"^[a-z0-9]+$","presentable":false,"primaryKey":true,"required":true,"system":true,"type":"text"},{"autogeneratePattern":"","hidden":false,"id":"12345789","max":0,"min":0,"name":"test","pattern":"","presentable":false,"primaryKey":false,"required":false,"system":false,"type":"text"}]',
    ],
    expectedEvents: {
      "*": 0,
      OnCollectionCreateRequest: 1,
      OnCollectionCreate: 1,
      OnCollectionCreateExecute: 1,
      OnCollectionAfterCreateSuccess: 1,
      OnCollectionValidate: 1,
      OnModelCreate: 1,
      OnModelCreateExecute: 1,
      OnModelAfterCreateSuccess: 1,
      OnModelValidate: 1,
    },
  },
  {
    name: "creating auth collection (default settings merge test)",
    method: "POST",
    url: "/api/collections",
    body: `{
      "name":"new",
      "type":"auth",
      "emailChangeToken":{"duration":123},
      "fields":[
        {"type":"text","id":"12345789","name":"test"},
        {"type":"text","name":"tokenKey","system":true,"required":false,"min":10}
      ]
    }`,
    headers: { Authorization: superuserToken },
    expectedStatus: 200,
    expectedContent: [
      '"id":',
      '"name":"new"',
      '"type":"auth"',
      '"system":false',
      '"passwordAuth":{"enabled":true,"identityFields":["email"]}',
      '"authRule":""',
      '"manageRule":null',
      '"name":"test"',
      '"name":"id"',
      '"name":"tokenKey"',
      '"name":"password"',
      '"name":"email"',
      '"name":"emailVisibility"',
      '"name":"verified"',
      '"duration":123',
      '{"autogeneratePattern":"","hidden":true,"id":"text2504183744","max":0,"min":10,"name":"tokenKey","pattern":"","presentable":false,"primaryKey":false,"required":true,"system":true,"type":"text"}',
    ],
    notExpectedContent: ['"secret":"'],
    expectedEvents: {
      "*": 0,
      OnCollectionCreateRequest: 1,
      OnCollectionCreate: 1,
      OnCollectionCreateExecute: 1,
      OnCollectionAfterCreateSuccess: 1,
      OnCollectionValidate: 1,
      OnModelCreate: 1,
      OnModelCreateExecute: 1,
      OnModelAfterCreateSuccess: 1,
      OnModelValidate: 1,
    },
  },
  {
    name: "creating base collection with reserved auth fields",
    method: "POST",
    url: "/api/collections",
    body: `{
      "name":"new",
      "type":"base",
      "fields":[
        {"type":"text","name":"email"},
        {"type":"text","name":"username"},
        {"type":"text","name":"verified"},
        {"type":"text","name":"emailVisibility"},
        {"type":"text","name":"lastResetSentAt"},
        {"type":"text","name":"lastVerificationSentAt"},
        {"type":"text","name":"tokenKey"},
        {"type":"text","name":"passwordHash"},
        {"type":"text","name":"password"},
        {"type":"text","name":"passwordConfirm"},
        {"type":"text","name":"oldPassword"}
      ]
    }`,
    headers: { Authorization: superuserToken },
    expectedStatus: 200,
    expectedContent: ['"name":"new"', '"type":"base"', '"fields":[{'],
    expectedEvents: {
      "*": 0,
      OnCollectionCreateRequest: 1,
      OnCollectionCreate: 1,
      OnCollectionCreateExecute: 1,
      OnCollectionAfterCreateSuccess: 1,
      OnCollectionValidate: 1,
      OnModelCreate: 1,
      OnModelCreateExecute: 1,
      OnModelAfterCreateSuccess: 1,
      OnModelValidate: 1,
    },
  },
  {
    name: "trying to create base collection with reserved system fields",
    method: "POST",
    url: "/api/collections",
    body: `{
      "name":"new",
      "type":"base",
      "fields":[
        {"type":"text","name":"id"},
        {"type":"text","name":"expand"},
        {"type":"text","name":"collectionId"},
        {"type":"text","name":"collectionName"}
      ]
    }`,
    headers: { Authorization: superuserToken },
    expectedStatus: 400,
    expectedContent: [
      '"data":{"fields":{',
      '"1":{"name":{"code":"validation_not_in_invalid"',
      '"2":{"name":{"code":"validation_not_in_invalid"',
      '"3":{"name":{"code":"validation_not_in_invalid"',
    ],
    expectedEvents: {
      "*": 0,
      OnCollectionCreateRequest: 1,
      OnCollectionCreate: 1,
      OnCollectionAfterCreateError: 1,
      OnCollectionValidate: 1,
      OnModelCreate: 1,
      OnModelAfterCreateError: 1,
      OnModelValidate: 1,
    },
  },
  {
    name: "trying to create auth collection with reserved auth fields",
    method: "POST",
    url: "/api/collections",
    body: `{
      "name":"new",
      "type":"auth",
      "fields":[
        {"type":"text","name":"oldPassword"},
        {"type":"text","name":"passwordConfirm"}
      ]
    }`,
    headers: { Authorization: superuserToken },
    expectedStatus: 400,
    expectedContent: [
      '"data":{"fields":{',
      '"1":{"name":{"code":"validation_reserved_field_name"',
      '"2":{"name":{"code":"validation_reserved_field_name"',
    ],
    expectedEvents: {
      "*": 0,
      OnCollectionCreateRequest: 1,
      OnCollectionCreate: 1,
      OnCollectionAfterCreateError: 1,
      OnCollectionValidate: 1,
      OnModelCreate: 1,
      OnModelAfterCreateError: 1,
      OnModelValidate: 1,
    },
  },
  {
    name: "OnCollectionCreateRequest tx body write check",
    method: "POST",
    url: "/api/collections",
    body: '{"name":"new","type":"base"}',
    headers: { Authorization: superuserToken },
    beforeTest: async (app) => {
      app.OnCollectionCreateRequest().BindFunc(async (event: any) => {
        const original = event.App;
        await event.App.RunInTransaction(async (txApp: any) => {
          event.App = txApp;
          await event.Next();
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
    expectedEvents: { OnCollectionCreateRequest: 1 },
    expectedContent: ["TX_ERROR"],
  },

  // view
  // -----------------------------------------------------------
  {
    name: "trying to create view collection with invalid options",
    method: "POST",
    url: "/api/collections",
    body: `{
      "name":"new",
      "type":"view",
      "fields":[{"type":"text","id":"12345789","name":"ignored!@#$"}],
      "viewQuery":"invalid"
    }`,
    headers: { Authorization: superuserToken },
    expectedStatus: 400,
    expectedContent: ['"data":{', '"viewQuery":{"code":"validation_invalid_view_query"'],
    expectedEvents: {
      "*": 0,
      OnCollectionCreateRequest: 1,
      OnCollectionCreate: 1,
      OnCollectionAfterCreateError: 1,
      OnCollectionValidate: 1,
      OnModelCreate: 1,
      OnModelAfterCreateError: 1,
      OnModelValidate: 1,
    },
  },
  {
    name: "creating view collection",
    method: "POST",
    url: "/api/collections",
    body: `{
      "name":"new",
      "type":"view",
      "fields":[{"type":"text","id":"12345789","name":"ignored!@#$"}],
      "viewQuery": "select 1 as id from \`${CollectionNameSuperusers}\`"
    }`,
    headers: { Authorization: superuserToken },
    expectedStatus: 200,
    expectedContent: [
      '"name":"new"',
      '"type":"view"',
      '"fields":[{"autogeneratePattern":"","hidden":false,"id":"text3208210256","max":0,"min":0,"name":"id","pattern":"^[a-z0-9]+$","presentable":false,"primaryKey":true,"required":true,"system":true,"type":"text"}]',
    ],
    expectedEvents: {
      "*": 0,
      OnCollectionCreateRequest: 1,
      OnCollectionCreate: 1,
      OnCollectionCreateExecute: 1,
      OnCollectionAfterCreateSuccess: 1,
      OnCollectionValidate: 1,
      OnModelCreate: 1,
      OnModelCreateExecute: 1,
      OnModelAfterCreateSuccess: 1,
      OnModelValidate: 1,
    },
  },

  // indexes
  // -----------------------------------------------------------
  {
    name: "creating base collection with invalid indexes",
    method: "POST",
    url: "/api/collections",
    body: `{
      "name":"new",
      "type":"base",
      "fields":[
        {"type":"text","name":"test"}
      ],
      "indexes": [
        "create index idx_test1 on new (test)",
        "create index idx_test2 on new (missing)"
      ]
    }`,
    headers: { Authorization: superuserToken },
    expectedStatus: 400,
    expectedContent: ['"data":{', '"indexes":{"1":{"code":"'],
    expectedEvents: {
      "*": 0,
      OnCollectionCreateRequest: 1,
      OnCollectionCreate: 1,
      OnCollectionCreateExecute: 1,
      OnCollectionAfterCreateError: 1,
      OnCollectionValidate: 1,
      OnModelCreate: 1,
      OnModelCreateExecute: 1,
      OnModelAfterCreateError: 1,
      OnModelValidate: 1,
    },
  },
  {
    name: "creating base collection with index name from another collection",
    method: "POST",
    url: "/api/collections",
    body: `{
      "name":"new",
      "type":"base",
      "fields":[
        {"type":"text","name":"test"}
      ],
      "indexes": [
        "create index exist_test on new (test)"
      ]
    }`,
    headers: { Authorization: superuserToken },
    beforeTest: async (app) => {
      const demo1 = app.findCollectionByNameOrId("demo1");
      if (!demo1) {
        throw new Error("missing demo1 collection");
      }
      demo1.AddIndex("exist_test", false, "updated", "");
      const err = await app.Save(demo1);
      if (err) {
        throw err;
      }
    },
    expectedStatus: 400,
    expectedContent: ['"data":{', '"indexes":{', '"0":{"code":"validation_existing_index_name"'],
    expectedEvents: {
      "*": 0,
      OnCollectionCreateRequest: 1,
      OnCollectionCreate: 1,
      OnCollectionAfterCreateError: 1,
      OnCollectionValidate: 1,
      OnModelCreate: 1,
      OnModelAfterCreateError: 1,
      OnModelValidate: 1,
    },
  },
  {
    name: "creating base collection with 2 indexes using the same name",
    method: "POST",
    url: "/api/collections",
    body: `{
      "name":"new",
      "type":"base",
      "indexes": [
        "create index duplicate_idx on new (created)",
        "create index duplicate_idx on new (updated)"
      ]
    }`,
    headers: { Authorization: superuserToken },
    expectedStatus: 400,
    expectedContent: ['"data":{', '"indexes":{', '"1":{"code":"validation_duplicated_index_name"'],
    expectedEvents: {
      "*": 0,
      OnCollectionCreateRequest: 1,
      OnCollectionCreate: 1,
      OnCollectionAfterCreateError: 1,
      OnCollectionValidate: 1,
      OnModelCreate: 1,
      OnModelAfterCreateError: 1,
      OnModelValidate: 1,
    },
  },
  {
    name: "creating base collection with valid indexes (+ random table name)",
    method: "POST",
    url: "/api/collections",
    body: `{
      "name":"new",
      "type":"base",
      "fields":[
        {"type":"text","name":"test"}
      ],
      "indexes": [
        "create index idx_test1 on new (test)",
        "create index idx_test2 on anything (id, test)"
      ]
    }`,
    headers: { Authorization: superuserToken },
    expectedStatus: 200,
    expectedContent: ['"name":"new"', '"type":"base"', '"indexes":[', "idx_test1", "idx_test2"],
    expectedEvents: {
      "*": 0,
      OnCollectionCreateRequest: 1,
      OnCollectionCreate: 1,
      OnCollectionCreateExecute: 1,
      OnCollectionAfterCreateSuccess: 1,
      OnCollectionValidate: 1,
      OnModelCreate: 1,
      OnModelCreateExecute: 1,
      OnModelAfterCreateSuccess: 1,
      OnModelValidate: 1,
    },
    afterTest: (app) => {
      const indexes = app.TableIndexes("new");
      const expected = ["idx_test1", "idx_test2"];
      if (Object.keys(indexes).length !== expected.length) {
        throw new Error(`Expected ${expected.length} indexes, got ${Object.keys(indexes).length}`);
      }
      for (const name of Object.keys(indexes)) {
        if (!existInSlice(name, expected)) {
          throw new Error(`Missing index ${name}`);
        }
      }
    },
  },
];

describe("collection create API", () => {
  for (const scenario of createScenarios) {
    const name = scenario.name ?? `${scenario.method} ${scenario.url}`;
    it(name, async () => {
      await runApiScenario(scenario);
    });
  }
});

const updateScenarios: ApiScenario[] = [
  {
    name: "unauthorized",
    method: "PATCH",
    url: "/api/collections/demo1",
    expectedStatus: 401,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "authorized as regular user",
    method: "PATCH",
    url: "/api/collections/demo1",
    headers: { Authorization: regularUserToken },
    expectedStatus: 403,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "authorized as superuser + missing collection",
    method: "PATCH",
    url: "/api/collections/missing",
    body: "{}",
    headers: { Authorization: superuserToken },
    expectedStatus: 404,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "authorized as superuser + empty body",
    method: "PATCH",
    url: "/api/collections/demo1",
    body: "{}",
    headers: { Authorization: superuserToken },
    expectedStatus: 200,
    expectedContent: ['"id":"wsmn24bux7wo113"', '"name":"demo1"'],
    expectedEvents: {
      "*": 0,
      OnCollectionUpdateRequest: 1,
      OnCollectionUpdate: 1,
      OnCollectionUpdateExecute: 1,
      OnCollectionAfterUpdateSuccess: 1,
      OnCollectionValidate: 1,
      OnModelUpdate: 1,
      OnModelUpdateExecute: 1,
      OnModelAfterUpdateSuccess: 1,
      OnModelValidate: 1,
    },
  },
  {
    name: "OnCollectionUpdateRequest tx body write check",
    method: "PATCH",
    url: "/api/collections/demo1",
    body: "{}",
    headers: { Authorization: superuserToken },
    beforeTest: async (app) => {
      app.OnCollectionUpdateRequest().BindFunc(async (event: any) => {
        const original = event.App;
        await event.App.RunInTransaction(async (txApp: any) => {
          event.App = txApp;
          await event.Next();
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
    expectedEvents: { OnCollectionUpdateRequest: 1 },
    expectedContent: ["TX_ERROR"],
  },
  {
    name: "authorized as superuser + invalid data (eg. existing name)",
    method: "PATCH",
    url: "/api/collections/demo1",
    body: `{
      "name":"demo2",
      "type":"auth"
    }`,
    headers: { Authorization: superuserToken },
    expectedStatus: 400,
    expectedContent: [
      '"data":{',
      '"name":{"code":"validation_collection_name_exists"',
      '"type":{"code":"validation_collection_type_change"',
    ],
    expectedEvents: {
      "*": 0,
      OnCollectionUpdateRequest: 1,
      OnCollectionUpdate: 1,
      OnCollectionAfterUpdateError: 1,
      OnCollectionValidate: 1,
      OnModelUpdate: 1,
      OnModelAfterUpdateError: 1,
      OnModelValidate: 1,
    },
  },
  {
    name: "authorized as superuser + valid data",
    method: "PATCH",
    url: "/api/collections/demo1",
    body: '{"name":"new"}',
    headers: { Authorization: superuserToken },
    expectedStatus: 200,
    expectedContent: ['"id":', '"name":"new"'],
    expectedEvents: {
      "*": 0,
      OnCollectionUpdateRequest: 1,
      OnCollectionUpdate: 1,
      OnCollectionUpdateExecute: 1,
      OnCollectionAfterUpdateSuccess: 1,
      OnCollectionValidate: 1,
      OnModelUpdate: 1,
      OnModelUpdateExecute: 1,
      OnModelAfterUpdateSuccess: 1,
      OnModelValidate: 1,
    },
    afterTest: (app) => {
      if (!app.HasTable("new")) {
        throw new Error("Couldn't find record table 'new'.");
      }
    },
  },
  {
    name: "trying to update collection with reserved fields",
    method: "PATCH",
    url: "/api/collections/demo1",
    body: `{
      "name":"new",
      "fields":[
        {"type":"text","name":"id","id":"_pbf_text_id_"},
        {"type":"text","name":"created"},
        {"type":"text","name":"updated"},
        {"type":"text","name":"expand"},
        {"type":"text","name":"collectionId"},
        {"type":"text","name":"collectionName"}
      ]
    }`,
    headers: { Authorization: superuserToken },
    expectedStatus: 400,
    expectedContent: [
      '"data":{"fields":{',
      '"3":{"name":{"code":"validation_not_in_invalid"',
      '"4":{"name":{"code":"validation_not_in_invalid"',
      '"5":{"name":{"code":"validation_not_in_invalid"',
    ],
    notExpectedContent: ['"0":', '"1":', '"2":'],
    expectedEvents: {
      "*": 0,
      OnCollectionUpdateRequest: 1,
      OnCollectionUpdate: 1,
      OnCollectionAfterUpdateError: 1,
      OnCollectionValidate: 1,
      OnModelUpdate: 1,
      OnModelAfterUpdateError: 1,
      OnModelValidate: 1,
    },
  },
  {
    name: "trying to update collection with changed/removed system fields",
    method: "PATCH",
    url: "/api/collections/demo1",
    body: `{
      "name":"new",
      "fields":[
        {"type":"text","name":"created"}
      ]
    }`,
    headers: { Authorization: superuserToken },
    expectedStatus: 400,
    expectedContent: ['"data":{"fields":{', '"code":"validation_system_field_change"'],
    expectedEvents: {
      "*": 0,
      OnCollectionUpdateRequest: 1,
      OnCollectionUpdate: 1,
      OnCollectionAfterUpdateError: 1,
      OnCollectionValidate: 1,
      OnModelUpdate: 1,
      OnModelAfterUpdateError: 1,
      OnModelValidate: 1,
    },
  },
  {
    name: "trying to update auth collection with invalid options",
    method: "PATCH",
    url: "/api/collections/users",
    body: `{
      "passwordAuth":{"identityFields": ["missing"]}
    }`,
    headers: { Authorization: superuserToken },
    expectedStatus: 400,
    expectedContent: ['"data":{', '"passwordAuth":{"identityFields":{"code":"validation_missing_field"'],
    expectedEvents: {
      "*": 0,
      OnCollectionUpdateRequest: 1,
      OnCollectionUpdate: 1,
      OnCollectionAfterUpdateError: 1,
      OnCollectionValidate: 1,
      OnModelUpdate: 1,
      OnModelAfterUpdateError: 1,
      OnModelValidate: 1,
    },
  },

  // view
  // -----------------------------------------------------------
  {
    name: "trying to update view collection with invalid options",
    method: "PATCH",
    url: "/api/collections/view1",
    body: `{
      "fields":[{"type":"text","id":"12345789","name":"ignored!@#$"}],
      "viewQuery":"invalid"
    }`,
    headers: { Authorization: superuserToken },
    expectedStatus: 400,
    expectedContent: ['"data":{', '"viewQuery":{"code":"validation_invalid_view_query"'],
    expectedEvents: {
      "*": 0,
      OnCollectionUpdateRequest: 1,
      OnCollectionUpdate: 1,
      OnCollectionAfterUpdateError: 1,
      OnCollectionValidate: 1,
      OnModelUpdate: 1,
      OnModelAfterUpdateError: 1,
      OnModelValidate: 1,
    },
  },
  {
    name: "updating view collection",
    method: "PATCH",
    url: "/api/collections/view2",
    body: `{
      "name":"view2_update",
      "fields":[{"type":"text","id":"12345789","name":"ignored!@#$"}],
      "viewQuery": "select 2 as id, created, updated, email from \`${CollectionNameSuperusers}\`"
    }`,
    headers: { Authorization: superuserToken },
    expectedStatus: 200,
    expectedContent: [
      '"name":"view2_update"',
      '"type":"view"',
      '"fields":[{',
      '"name":"email"',
      '"name":"id"',
      '"name":"created"',
      '"name":"updated"',
    ],
    expectedEvents: {
      "*": 0,
      OnCollectionUpdateRequest: 1,
      OnCollectionUpdate: 1,
      OnCollectionUpdateExecute: 1,
      OnCollectionAfterUpdateSuccess: 1,
      OnCollectionValidate: 1,
      OnModelUpdate: 1,
      OnModelUpdateExecute: 1,
      OnModelAfterUpdateSuccess: 1,
      OnModelValidate: 1,
    },
  },

  // indexes
  // -----------------------------------------------------------
  {
    name: "updating base collection with invalid indexes",
    method: "PATCH",
    url: "/api/collections/demo2",
    body: `{
      "indexes": [
        "create unique idx_test1 on demo1 (text)",
        "create index idx_test2 on demo2 (id, title)"
      ]
    }`,
    headers: { Authorization: superuserToken },
    expectedStatus: 400,
    expectedContent: ['"data":{', '"indexes":{"0":{"code":"'],
    expectedEvents: {
      "*": 0,
      OnCollectionUpdateRequest: 1,
      OnCollectionUpdate: 1,
      OnCollectionAfterUpdateError: 1,
      OnCollectionValidate: 1,
      OnModelUpdate: 1,
      OnModelAfterUpdateError: 1,
      OnModelValidate: 1,
    },
  },
  {
    name: "updating base collection with index name from another collection",
    method: "PATCH",
    url: "/api/collections/demo2",
    body: `{
      "indexes": [
        "create index exist_test on new (test)"
      ]
    }`,
    headers: { Authorization: superuserToken },
    beforeTest: async (app) => {
      const demo1 = app.findCollectionByNameOrId("demo1");
      if (!demo1) {
        throw new Error("missing demo1 collection");
      }
      demo1.AddIndex("exist_test", false, "updated", "");
      const err = await app.Save(demo1);
      if (err) {
        throw err;
      }
    },
    expectedStatus: 400,
    expectedContent: ['"data":{', '"indexes":{', '"0":{"code":"validation_existing_index_name"'],
    expectedEvents: {
      "*": 0,
      OnCollectionUpdateRequest: 1,
      OnCollectionUpdate: 1,
      OnCollectionAfterUpdateError: 1,
      OnCollectionValidate: 1,
      OnModelUpdate: 1,
      OnModelAfterUpdateError: 1,
      OnModelValidate: 1,
    },
  },
  {
    name: "updating base collection with 2 indexes using the same name",
    method: "PATCH",
    url: "/api/collections/demo2",
    body: `{
      "indexes": [
        "create index duplicate_idx on new (created)",
        "create index duplicate_idx on new (updated)"
      ]
    }`,
    headers: { Authorization: superuserToken },
    expectedStatus: 400,
    expectedContent: ['"data":{', '"indexes":{', '"1":{"code":"validation_duplicated_index_name"'],
    expectedEvents: {
      "*": 0,
      OnCollectionUpdateRequest: 1,
      OnCollectionUpdate: 1,
      OnCollectionAfterUpdateError: 1,
      OnCollectionValidate: 1,
      OnModelUpdate: 1,
      OnModelAfterUpdateError: 1,
      OnModelValidate: 1,
    },
  },
  {
    name: "updating base collection with valid indexes (+ random table name)",
    method: "PATCH",
    url: "/api/collections/demo2",
    body: `{
      "indexes": [
        "create unique index idx_test1 on demo2 (title)",
        "create index idx_test2 on anything (active)"
      ]
    }`,
    headers: { Authorization: superuserToken },
    expectedStatus: 200,
    expectedContent: ['"name":"demo2"', '"indexes":[', "idx_test1", "idx_test2"],
    expectedEvents: {
      "*": 0,
      OnCollectionUpdateRequest: 1,
      OnCollectionUpdate: 1,
      OnCollectionUpdateExecute: 1,
      OnCollectionAfterUpdateSuccess: 1,
      OnCollectionValidate: 1,
      OnModelUpdate: 1,
      OnModelUpdateExecute: 1,
      OnModelAfterUpdateSuccess: 1,
      OnModelValidate: 1,
    },
    afterTest: (app) => {
      const indexes = app.TableIndexes("demo2");
      const expected = ["idx_test1", "idx_test2"];
      if (Object.keys(indexes).length !== expected.length) {
        throw new Error(`Expected ${expected.length} indexes, got ${Object.keys(indexes).length}`);
      }
      for (const name of Object.keys(indexes)) {
        if (!existInSlice(name, expected)) {
          throw new Error(`Missing index ${name}`);
        }
      }
    },
  },
];

describe("collection update API", () => {
  for (const scenario of updateScenarios) {
    const name = scenario.name ?? `${scenario.method} ${scenario.url}`;
    it(name, async () => {
      await runApiScenario(scenario);
    });
  }
});

const scaffoldsScenarios: ApiScenario[] = [
  {
    name: "unauthorized",
    method: "GET",
    url: "/api/collections/meta/scaffolds",
    expectedStatus: 401,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "authorized as regular user",
    method: "GET",
    url: "/api/collections/meta/scaffolds",
    headers: { Authorization: regularUserToken },
    expectedStatus: 403,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "authorized as superuser",
    method: "GET",
    url: "/api/collections/meta/scaffolds",
    headers: { Authorization: superuserToken },
    expectedStatus: 200,
    expectedContent: [
      '"id":""',
      '"name":""',
      '"auth":{',
      '"base":{',
      '"view":{',
      '"type":"auth"',
      '"type":"base"',
      '"type":"view"',
      '"passwordAuth":{"enabled":true',
      '"mfa":{"enabled":false',
      '"fields":[{',
      '"fields":[{',
      '"id":"text3208210256"',
    ],
    notExpectedContent: ['"options":{'],
  },
];

describe("collection scaffolds API", () => {
  for (const scenario of scaffoldsScenarios) {
    const name = scenario.name ?? `${scenario.method} ${scenario.url}`;
    it(name, async () => {
      await runApiScenario(scenario);
    });
  }
});

const truncateScenarios: ApiScenario[] = [
  {
    name: "unauthorized",
    method: "DELETE",
    url: "/api/collections/demo5/truncate",
    expectedStatus: 401,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "authorized as regular user",
    method: "DELETE",
    url: "/api/collections/demo5/truncate",
    headers: { Authorization: regularUserToken },
    expectedStatus: 403,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "authorized as superuser",
    method: "DELETE",
    url: "/api/collections/demo5/truncate",
    headers: { Authorization: superuserToken },
    expectedStatus: 204,
    expectedEvents: {
      "*": 0,
      OnModelDelete: 2,
      OnModelDeleteExecute: 2,
      OnModelAfterDeleteSuccess: 2,
      OnRecordDelete: 2,
      OnRecordDeleteExecute: 2,
      OnRecordAfterDeleteSuccess: 2,
    },
  },
  {
    name: "authorized as superuser but collection with required cascade delete references",
    method: "DELETE",
    url: "/api/collections/demo3/truncate",
    headers: { Authorization: superuserToken },
    expectedStatus: 400,
    expectedContent: ['"data":{}'],
    expectedEvents: {
      "*": 0,
      OnModelDelete: 2,
      OnModelDeleteExecute: 2,
      OnModelAfterDeleteError: 2,
      OnModelUpdate: 2,
      OnModelUpdateExecute: 2,
      OnModelAfterUpdateError: 2,
      OnRecordDelete: 2,
      OnRecordDeleteExecute: 2,
      OnRecordAfterDeleteError: 2,
      OnRecordUpdate: 2,
      OnRecordUpdateExecute: 2,
      OnRecordAfterUpdateError: 2,
    },
  },
  {
    name: "authorized as superuser trying to truncate view collection",
    method: "DELETE",
    url: "/api/collections/view2/truncate",
    headers: { Authorization: superuserToken },
    expectedStatus: 400,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
];

describe("collection truncate API", () => {
  for (const scenario of truncateScenarios) {
    const name = scenario.name ?? `${scenario.method} ${scenario.url}`;
    it(name, async () => {
      await runApiScenario(scenario);
    });
  }
});

async function ensureDeletedFiles(app: TestApp, collectionId: string): Promise<void> {
  const storageDir = join(app.DataDir(), "storage", collectionId);

  try {
    const entries = await readdir(storageDir);
    if (entries.length !== 0) {
      throw new Error(`Expected empty/deleted dir, found ${entries.length}`);
    }
  } catch {
    // ignore missing directory errors
  }
}
