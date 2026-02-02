// Ported from pocketbase/apis/collection_import_test.go

import { describe, it } from "bun:test";
import type { ApiScenario } from "../../tests/api.ts";
import { runApiScenario } from "../../tests/api.ts";

const regularUserToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.ZT3F0Z3iM-xbGgSG3LEKiEzHrPHr8t8IuHLZGGNuxLo";

const superuserToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY";

const totalCollections = 16;

const scenarios: ApiScenario[] = [
  {
    name: "unauthorized",
    method: "PUT",
    url: "/api/collections/import",
    expectedStatus: 401,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "authorized as regular user",
    method: "PUT",
    url: "/api/collections/import",
    headers: { Authorization: regularUserToken },
    expectedStatus: 403,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "authorized as superuser + empty collections",
    method: "PUT",
    url: "/api/collections/import",
    body: '{"collections":[]}',
    headers: { Authorization: superuserToken },
    expectedStatus: 400,
    expectedContent: ['"data":{', '"collections":{"code":"validation_required"'],
    expectedEvents: { "*": 0 },
    afterTest: (app) => {
      const collections = app.FindAllCollections();
      if (collections.length !== totalCollections) {
        throw new Error(`Expected ${totalCollections} collections, got ${collections.length}`);
      }
    },
  },
  {
    name: "authorized as superuser + collections validator failure",
    method: "PUT",
    url: "/api/collections/import",
    body: `{
      "collections":[
        {"name": "import1"},
        {
          "name": "import2",
          "fields": [
            {
              "id": "koih1lqx",
              "name": "expand",
              "type": "text"
            }
          ]
        }
      ]
    }`,
    headers: { Authorization: superuserToken },
    expectedStatus: 400,
    expectedContent: ['"data":{', '"collections":{"code":"validation_collections_import_failure"', "import2", "fields"],
    notExpectedContent: ["Raw error:"],
    expectedEvents: {
      "*": 0,
      OnCollectionsImportRequest: 1,
      OnCollectionCreate: 2,
      OnCollectionCreateExecute: 2,
      OnCollectionAfterCreateError: 2,
      OnModelCreate: 2,
      OnModelCreateExecute: 2,
      OnModelAfterCreateError: 2,
    },
    afterTest: (app) => {
      const collections = app.FindAllCollections();
      if (collections.length !== totalCollections) {
        throw new Error(`Expected ${totalCollections} collections, got ${collections.length}`);
      }
    },
  },
  {
    name: "authorized as superuser + non-validator failure",
    method: "PUT",
    url: "/api/collections/import",
    body: `{
      "collections":[
        {
          "name": "import1",
          "fields": [
            {
              "id": "koih1lqx",
              "name": "test",
              "type": "text"
            }
          ]
        },
        {
          "name": "import2",
          "fields": [
            {
              "id": "koih1lqx",
              "name": "test",
              "type": "text"
            }
          ],
          "indexes": [
            "create index idx_test on import2 (test)"
          ]
        }
      ]
    }`,
    headers: { Authorization: superuserToken },
    expectedStatus: 400,
    expectedContent: [
      '"data":{',
      '"collections":{"code":"validation_collections_import_failure"',
      "Raw error:",
      "custom_error",
    ],
    expectedEvents: {
      "*": 0,
      OnCollectionsImportRequest: 1,
      OnCollectionCreate: 1,
      OnCollectionAfterCreateError: 1,
      OnModelCreate: 1,
      OnModelAfterCreateError: 1,
    },
    beforeTest: (app) => {
      app.OnCollectionCreate().BindFunc(() => new Error("custom_error"));
    },
    afterTest: (app) => {
      const collections = app.FindAllCollections();
      if (collections.length !== totalCollections) {
        throw new Error(`Expected ${totalCollections} collections, got ${collections.length}`);
      }
    },
  },
  {
    name: "authorized as superuser + successful collections create",
    method: "PUT",
    url: "/api/collections/import",
    body: `{
      "collections":[
        {
          "name": "import1",
          "fields": [
            {
              "id": "koih1lqx",
              "name": "test",
              "type": "text"
            }
          ]
        },
        {
          "name": "import2",
          "fields": [
            {
              "id": "koih1lqx",
              "name": "test",
              "type": "text"
            }
          ],
          "indexes": [
            "create index idx_test on import2 (test)"
          ]
        },
        {
          "name": "auth_without_fields",
          "type": "auth"
        }
      ]
    }`,
    headers: { Authorization: superuserToken },
    expectedStatus: 204,
    expectedEvents: {
      "*": 0,
      OnCollectionsImportRequest: 1,
      OnCollectionCreate: 3,
      OnCollectionCreateExecute: 3,
      OnCollectionAfterCreateSuccess: 3,
      OnModelCreate: 3,
      OnModelCreateExecute: 3,
      OnModelAfterCreateSuccess: 3,
    },
    afterTest: (app) => {
      const collections = app.FindAllCollections();
      const expected = totalCollections + 3;
      if (collections.length !== expected) {
        throw new Error(`Expected ${expected} collections, got ${collections.length}`);
      }

      const indexes = app.TableIndexes("import2");
      if (!indexes.idx_test) {
        throw new Error("Missing index idx_test");
      }
    },
  },
  {
    name: "authorized as superuser + create/update/delete",
    method: "PUT",
    url: "/api/collections/import",
    body: `{
      "deleteMissing": true,
      "collections":[
        {"name": "test123"},
        {
          "id":"wsmn24bux7wo113",
          "name":"demo1",
          "fields":[
            {
              "id":"_2hlxbmp",
              "name":"title",
              "type":"text",
              "required":true
            }
          ],
          "indexes": []
        }
      ]
    }`,
    headers: { Authorization: superuserToken },
    expectedStatus: 204,
    expectedEvents: {
      "*": 0,
      OnCollectionsImportRequest: 1,
      OnModelCreate: 1,
      OnModelCreateExecute: 1,
      OnModelAfterCreateSuccess: 1,
      OnCollectionCreate: 1,
      OnCollectionCreateExecute: 1,
      OnCollectionAfterCreateSuccess: 1,
      OnModelUpdate: 1,
      OnModelUpdateExecute: 1,
      OnModelAfterUpdateSuccess: 1,
      OnCollectionUpdate: 1,
      OnCollectionUpdateExecute: 1,
      OnCollectionAfterUpdateSuccess: 1,
      OnModelDelete: 14,
      OnModelAfterDeleteSuccess: 14,
      OnModelDeleteExecute: 14,
      OnCollectionDelete: 9,
      OnCollectionDeleteExecute: 9,
      OnCollectionAfterDeleteSuccess: 9,
      OnRecordAfterDeleteSuccess: 5,
      OnRecordDelete: 5,
      OnRecordDeleteExecute: 5,
    },
    afterTest: (app) => {
      const collections = app.FindAllCollections();
      let systemCollections = 0;
      for (const collection of collections) {
        if (collection.system) {
          systemCollections += 1;
        }
      }
      const expected = systemCollections + 2;
      if (collections.length !== expected) {
        throw new Error(`Expected ${expected} collections, got ${collections.length}`);
      }
    },
  },
  {
    name: "OnCollectionsImportRequest tx body write check",
    method: "PUT",
    url: "/api/collections/import",
    body: `{
      "deleteMissing": true,
      "collections":[
        {"name": "test123"},
        {
          "id":"wsmn24bux7wo113",
          "name":"demo1",
          "fields":[
            {
              "id":"_2hlxbmp",
              "name":"title",
              "type":"text",
              "required":true
            }
          ],
          "indexes": []
        }
      ]
    }`,
    headers: { Authorization: superuserToken },
    beforeTest: (app) => {
      app.OnCollectionsImportRequest().BindFunc((event: any) => {
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
    expectedEvents: { OnCollectionsImportRequest: 1 },
    expectedContent: ["TX_ERROR"],
  },
];

describe("collections import API", () => {
  for (const scenario of scenarios) {
    const name = scenario.name ?? `${scenario.method} ${scenario.url}`;
    it(name, async () => {
      await runApiScenario(scenario);
    });
  }
});
