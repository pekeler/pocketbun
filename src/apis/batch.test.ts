// Ported from pocketbase/apis/batch_test.go

import { describe, it } from "bun:test";
import { setTimeout as delay } from "node:timers/promises";
import type { TestApp } from "../tests/app.ts";
import { parseMultipartFormData } from "../internal/compat/request_form_data.ts";
import { runApiScenario, type ApiScenario } from "../tests/api.ts";
import { MockMultipartData } from "../tests/request.ts";
import { JSONPayloadKey } from "../tools/router/unmarshal_request_data.ts";
import { setBatchMultipartFormDataParserForTests } from "./batch.ts";

const multipart = await MockMultipartData(
  {
    [JSONPayloadKey]: `{
      "requests":[
        {"method":"POST", "url":"/api/collections/demo3/records", "body": {"title": "batch1"}},
        {"method":"POST", "url":"/api/collections/demo3/records", "body": {"title": "batch2"}},
        {"method":"POST", "url":"/api/collections/demo3/records", "body": {"title": "batch3"}},
        {"method":"PATCH", "url":"/api/collections/demo3/records/lcl9d87w22ml6jy", "body": {"files-": "test_FLurQTgrY8.txt"}}
      ]
    }`,
  },
  "requests.0.files",
  "requests.0.files",
  "requests.0.files",
  "requests[2].files",
);

const multipartFallback = await MockMultipartData({
  [JSONPayloadKey]: `{
      "requests":[
        {"method":"POST", "url":"/api/collections/demo2/records", "body": {"title": "batch_fallback"}}
      ]
    }`,
});

const enableBatch = (scenario: ApiScenario): ApiScenario => {
  const beforeTest = scenario.beforeTest;
  return {
    ...scenario,
    beforeTest: async (app: TestApp) => {
      app.settings().batch.enabled = true;
      if (beforeTest) {
        await beforeTest(app);
      }
    },
  };
};

const scenarios: ApiScenario[] = [
  {
    name: "disabled batch requests",
    method: "POST",
    url: "/api/batch",
    beforeTest: (app) => {
      app.settings().batch.enabled = false;
    },
    expectedStatus: 403,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  enableBatch({
    name: "max request limits reached",
    method: "POST",
    url: "/api/batch",
    body: `{
      "requests": [
        {"method":"GET", "url":"/test1"},
        {"method":"GET", "url":"/test2"},
        {"method":"GET", "url":"/test3"}
      ]
    }`,
    beforeTest: (app) => {
      app.settings().batch.maxRequests = 2;
    },
    expectedStatus: 400,
    expectedContent: ['"data":{', '"requests":{"code":"validation_length_too_long"'],
    expectedEvents: { "*": 0 },
  }),
  enableBatch({
    name: "trigger requests validations",
    method: "POST",
    url: "/api/batch",
    body: `{
      "requests": [
        {},
        {"method":"GET", "url":"/valid"},
        {"method":"invalid", "url":"/valid"},
        {"method":"POST", "url":"${"a".repeat(2001)}"}
      ]
    }`,
    beforeTest: (app) => {
      app.settings().batch.maxRequests = 100;
    },
    expectedStatus: 400,
    expectedContent: [
      '"data":{',
      '"requests":{',
      '"0":{"method":{"code":"validation_required"',
      '"2":{"method":{"code":"validation_in_invalid"',
      '"3":{"url":{"code":"validation_length_too_long"',
    ],
    notExpectedContent: ['"1":'],
    expectedEvents: { "*": 0 },
  }),
  enableBatch({
    name: "unknown batch request action",
    method: "POST",
    url: "/api/batch",
    body: `{
      "requests": [
        {"method":"GET", "url":"/api/health"}
      ]
    }`,
    expectedStatus: 400,
    expectedContent: ['"data":{', '"requests":{', '0":{"code":"batch_request_failed"', '"response":{'],
    expectedEvents: { "*": 0, OnBatchRequest: 1 },
  }),
  enableBatch({
    name: "base 2 successful and 1 failed (public collection)",
    method: "POST",
    url: "/api/batch",
    body: `{
      "requests": [
        {"method":"POST", "url":"/api/collections/demo2/records", "body": {"title": "batch1"}},
        {"method":"POST", "url":"/api/collections/demo2/records", "body": {"title": "batch2"}},
        {"method":"POST", "url":"/api/collections/demo2/records", "body": {"title": ""}}
      ]
    }`,
    expectedStatus: 400,
    expectedContent: [
      '"data":{',
      '"response":{',
      '"2":{"code":"batch_request_failed"',
      '"response":{"data":{"title":{"code":"validation_required"',
    ],
    notExpectedContent: ['"0":', '"1":'],
    expectedEvents: {
      "*": 0,
      OnBatchRequest: 1,
      OnRecordCreateRequest: 3,
      OnModelCreate: 3,
      OnModelCreateExecute: 2,
      OnModelAfterCreateError: 3,
      OnModelValidate: 3,
      OnRecordCreate: 3,
      OnRecordCreateExecute: 2,
      OnRecordAfterCreateError: 3,
      OnRecordValidate: 3,
      OnRecordEnrich: 2,
    },
    afterTest: (app) => {
      const records = app.FindRecordsByFilter("demo2", `title~"batch"`, "", 0, 0);
      if (records.length !== 0) {
        throw new Error(`Expected no batch records to be persisted, got ${records.length}`);
      }
    },
  }),
  enableBatch({
    name: "base 4 successful (public collection)",
    method: "POST",
    url: "/api/batch",
    body: `{
      "requests": [
        {"method":"POST", "url":"/api/collections/demo2/records", "body": {"title": "batch1"}},
        {"method":"POST", "url":"/api/collections/demo2/records", "body": {"title": "batch2"}},
        {"method":"PUT", "url":"/api/collections/demo2/records", "body": {"title": "batch3"}},
        {"method":"PUT", "url":"/api/collections/demo2/records?fields=*,id:excerpt(4,true)", "body": {"id":"achvryl401bhse3","title": "batch4"}}
      ]
    }`,
    expectedStatus: 200,
    expectedContent: [
      '"title":"batch1"',
      '"title":"batch2"',
      '"title":"batch3"',
      '"title":"batch4"',
      '"id":"achv..."',
      '"active":false',
      '"active":true',
      '"status":200',
      '"body":{',
    ],
    expectedEvents: {
      "*": 0,
      OnBatchRequest: 1,
      OnModelValidate: 4,
      OnRecordValidate: 4,
      OnRecordEnrich: 4,
      OnRecordCreateRequest: 3,
      OnModelCreate: 3,
      OnModelCreateExecute: 3,
      OnModelAfterCreateSuccess: 3,
      OnRecordCreate: 3,
      OnRecordCreateExecute: 3,
      OnRecordAfterCreateSuccess: 3,
      OnRecordUpdateRequest: 1,
      OnModelUpdate: 1,
      OnModelUpdateExecute: 1,
      OnModelAfterUpdateSuccess: 1,
      OnRecordUpdate: 1,
      OnRecordUpdateExecute: 1,
      OnRecordAfterUpdateSuccess: 1,
    },
    afterTest: (app) => {
      const records = app.FindRecordsByFilter("demo2", `title~"batch"`, "", 0, 0);
      if (records.length !== 4) {
        throw new Error(`Expected 4 batch records to be persisted, got ${records.length}`);
      }
    },
  }),
  enableBatch({
    name: "mixed create/update/delete (rules failure)",
    method: "POST",
    url: "/api/batch",
    body: `{
      "requests": [
        {"method":"POST", "url":"/api/collections/demo2/records", "body": {"title": "batch_create"}},
        {"method":"DELETE", "url":"/api/collections/demo2/records/achvryl401bhse3"},
        {"method":"PATCH", "url":"/api/collections/demo3/records/1tmknxy2868d869", "body": {"title": "batch_update"}}
      ]
    }`,
    expectedStatus: 400,
    expectedContent: ['"data":{', '"requests":{', '"2":{"code":"batch_request_failed"', '"response":{'],
    notExpectedContent: ['"0":', '"1":'],
    expectedEvents: {
      "*": 0,
      OnBatchRequest: 1,
      OnModelCreate: 1,
      OnModelCreateExecute: 1,
      OnModelAfterCreateError: 1,
      OnModelDelete: 1,
      OnModelDeleteExecute: 1,
      OnModelAfterDeleteError: 1,
      OnModelValidate: 1,
      OnRecordCreateRequest: 1,
      OnRecordCreate: 1,
      OnRecordCreateExecute: 1,
      OnRecordAfterCreateError: 1,
      OnRecordDeleteRequest: 1,
      OnRecordDelete: 1,
      OnRecordDeleteExecute: 1,
      OnRecordAfterDeleteError: 1,
      OnRecordEnrich: 1,
      OnRecordValidate: 1,
    },
    afterTest: (app) => {
      try {
        app.FindFirstRecordByFilter("demo2", `title="batch_create"`);
        throw new Error("Expected record to not be created");
      } catch {
        // expected
      }

      try {
        app.FindFirstRecordByFilter("demo3", `title="batch_update"`);
        throw new Error("Expected record to not be updated");
      } catch {
        // expected
      }

      try {
        app.FindRecordById("demo2", "achvryl401bhse3");
      } catch {
        throw new Error("Expected record to not be deleted");
      }
    },
  }),
  enableBatch({
    name: "mixed create/update/delete (rules success)",
    method: "POST",
    url: "/api/batch",
    headers: {
      Authorization:
        "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6ImdrMzkwcWVnczR5NDd3biIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoidjg1MXE0cjc5MHJoa25sIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.0ONnm_BsvPRZyDNT31GN1CKUB6uQRxvVvQ-Wc9AZfG0",
    },
    body: `{
      "requests": [
        {"method":"POST", "url":"/api/collections/demo2/records", "body": {"title": "batch_create"}, "headers": {"Authorization": "ignored"}},
        {"method":"DELETE", "url":"/api/collections/demo2/records/achvryl401bhse3", "headers": {"Authorization": "ignored"}},
        {"method":"PATCH", "url":"/api/collections/demo3/records/1tmknxy2868d869", "body": {"title": "batch_update"}, "headers": {"Authorization": "ignored"}}
      ]
    }`,
    expectedStatus: 200,
    expectedContent: [
      '"title":"batch_create"',
      '"title":"batch_update"',
      '"status":200',
      '"status":204',
      '"body":{',
      '"body":null',
    ],
    expectedEvents: {
      "*": 0,
      OnBatchRequest: 1,
      OnModelCreate: 1,
      OnModelCreateExecute: 1,
      OnModelAfterCreateSuccess: 1,
      OnModelDelete: 1,
      OnModelDeleteExecute: 1,
      OnModelAfterDeleteSuccess: 1,
      OnModelUpdate: 1,
      OnModelUpdateExecute: 1,
      OnModelAfterUpdateSuccess: 1,
      OnModelValidate: 2,
      OnRecordCreateRequest: 1,
      OnRecordCreate: 1,
      OnRecordCreateExecute: 1,
      OnRecordAfterCreateSuccess: 1,
      OnRecordDeleteRequest: 1,
      OnRecordDelete: 1,
      OnRecordDeleteExecute: 1,
      OnRecordAfterDeleteSuccess: 1,
      OnRecordUpdateRequest: 1,
      OnRecordUpdate: 1,
      OnRecordUpdateExecute: 1,
      OnRecordAfterUpdateSuccess: 1,
      OnRecordValidate: 2,
      OnRecordEnrich: 2,
    },
    afterTest: (app) => {
      app.FindFirstRecordByFilter("demo2", `title="batch_create"`);
      app.FindFirstRecordByFilter("demo3", `title="batch_update"`);

      try {
        app.FindRecordById("demo2", "achvryl401bhse3");
        throw new Error("Expected record to be deleted");
      } catch {
        // expected
      }
    },
  }),
  enableBatch({
    name: "mixed create/update/delete (superuser auth)",
    method: "POST",
    url: "/api/batch",
    headers: {
      Authorization:
        "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY",
    },
    body: `{
      "requests": [
        {"method":"POST", "url":"/api/collections/demo2/records", "body": {"title": "batch_create"}},
        {"method":"DELETE", "url":"/api/collections/demo2/records/achvryl401bhse3"},
        {"method":"PATCH", "url":"/api/collections/demo3/records/1tmknxy2868d869", "body": {"title": "batch_update"}}
      ]
    }`,
    expectedStatus: 200,
    expectedContent: [
      '"title":"batch_create"',
      '"title":"batch_update"',
      '"status":200',
      '"status":204',
      '"body":{',
      '"body":null',
    ],
    expectedEvents: {
      "*": 0,
      OnBatchRequest: 1,
      OnModelCreate: 1,
      OnModelCreateExecute: 1,
      OnModelAfterCreateSuccess: 1,
      OnModelDelete: 1,
      OnModelDeleteExecute: 1,
      OnModelAfterDeleteSuccess: 1,
      OnModelUpdate: 1,
      OnModelUpdateExecute: 1,
      OnModelAfterUpdateSuccess: 1,
      OnModelValidate: 2,
      OnRecordCreateRequest: 1,
      OnRecordCreate: 1,
      OnRecordCreateExecute: 1,
      OnRecordAfterCreateSuccess: 1,
      OnRecordDeleteRequest: 1,
      OnRecordDelete: 1,
      OnRecordDeleteExecute: 1,
      OnRecordAfterDeleteSuccess: 1,
      OnRecordUpdateRequest: 1,
      OnRecordUpdate: 1,
      OnRecordUpdateExecute: 1,
      OnRecordAfterUpdateSuccess: 1,
      OnRecordValidate: 2,
      OnRecordEnrich: 2,
    },
    afterTest: (app) => {
      app.FindFirstRecordByFilter("demo2", `title="batch_create"`);
      app.FindFirstRecordByFilter("demo3", `title="batch_update"`);

      try {
        app.FindRecordById("demo2", "achvryl401bhse3");
        throw new Error("Expected record to be deleted");
      } catch {
        // expected
      }
    },
  }),
  enableBatch({
    name: "cascade delete/update",
    method: "POST",
    url: "/api/batch",
    headers: {
      Authorization:
        "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY",
    },
    body: `{
      "requests": [
        {"method":"DELETE", "url":"/api/collections/demo3/records/1tmknxy2868d869"},
        {"method":"DELETE", "url":"/api/collections/demo3/records/mk5fmymtx4wsprk"}
      ]
    }`,
    expectedStatus: 200,
    expectedContent: ['"status":204', '"body":null'],
    notExpectedContent: ['"status":200', '"body":{'],
    expectedEvents: {
      "*": 0,
      OnBatchRequest: 1,
      OnModelDelete: 3,
      OnModelDeleteExecute: 3,
      OnModelAfterDeleteSuccess: 3,
      OnModelUpdate: 5,
      OnModelUpdateExecute: 5,
      OnModelAfterUpdateSuccess: 5,
      OnRecordDeleteRequest: 2,
      OnRecordDelete: 3,
      OnRecordDeleteExecute: 3,
      OnRecordAfterDeleteSuccess: 3,
      OnRecordUpdate: 5,
      OnRecordUpdateExecute: 5,
      OnRecordAfterUpdateSuccess: 5,
    },
    afterTest: (app) => {
      const ids = ["1tmknxy2868d869", "mk5fmymtx4wsprk", "qzaqccwrmva4o1n"];
      for (const id of ids) {
        try {
          app.FindRecordById("demo2", id);
          throw new Error(`Expected record ${id} to be deleted`);
        } catch {
          // expected
        }
      }
    },
  }),
  enableBatch({
    name: "transaction timeout",
    method: "POST",
    url: "/api/batch",
    body: `{
      "requests": [
        {"method":"POST", "url":"/api/collections/demo2/records", "body": {"title": "batch1"}},
        {"method":"POST", "url":"/api/collections/demo2/records", "body": {"title": "batch2"}}
      ]
    }`,
    headers: {
      Authorization:
        "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY",
    },
    beforeTest: (app) => {
      app.settings().batch.timeout = 1;
      app.OnRecordCreateRequest(["demo2"]).BindFunc(async (event) => {
        await delay(600);
        return event.Next();
      });
    },
    expectedStatus: 400,
    expectedContent: ['"data":{}'],
    expectedEvents: {
      "*": 0,
      OnBatchRequest: 1,
      OnRecordCreateRequest: 2,
      OnModelCreate: 1,
      OnModelCreateExecute: 1,
      OnModelAfterCreateError: 1,
      OnModelValidate: 1,
      OnRecordCreate: 1,
      OnRecordCreateExecute: 1,
      OnRecordAfterCreateError: 1,
      OnRecordEnrich: 1,
      OnRecordValidate: 1,
    },
    afterTest: (app) => {
      const records = app.FindRecordsByFilter("demo2", `title~"batch"`, "", 0, 0);
      if (records.length !== 0) {
        throw new Error(`Expected 0 batch records to be persisted, got ${records.length}`);
      }
    },
  }),
  enableBatch({
    name: "multipart/form-data + file upload",
    method: "POST",
    url: "/api/batch",
    body: multipart.body,
    headers: {
      Authorization:
        "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6ImdrMzkwcWVnczR5NDd3biIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoidjg1MXE0cjc5MHJoa25sIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.0ONnm_BsvPRZyDNT31GN1CKUB6uQRxvVvQ-Wc9AZfG0",
      "Content-Type": multipart.contentType,
    },
    expectedStatus: 200,
    expectedContent: [
      '"title":"batch1"',
      '"title":"batch2"',
      '"title":"batch3"',
      '"id":"lcl9d87w22ml6jy"',
      '"files":["300_UhLKX91HVb.png"]',
      '"tmpfile_',
      '"status":200',
      '"body":{',
    ],
    expectedEvents: {
      "*": 0,
      OnBatchRequest: 1,
      OnModelCreate: 3,
      OnModelCreateExecute: 3,
      OnModelAfterCreateSuccess: 3,
      OnModelUpdate: 1,
      OnModelUpdateExecute: 1,
      OnModelAfterUpdateSuccess: 1,
      OnModelValidate: 4,
      OnRecordCreateRequest: 3,
      OnRecordUpdateRequest: 1,
      OnRecordCreate: 3,
      OnRecordCreateExecute: 3,
      OnRecordAfterCreateSuccess: 3,
      OnRecordUpdate: 1,
      OnRecordUpdateExecute: 1,
      OnRecordAfterUpdateSuccess: 1,
      OnRecordValidate: 4,
      OnRecordEnrich: 4,
    },
    afterTest: (app) => {
      const batch1 = app.FindFirstRecordByFilter("demo3", `title="batch1"`);
      const batch1Files = batch1.GetStringSlice("files");
      if (batch1Files.length !== 3) {
        throw new Error(`Expected 3 batch1 file(s), got ${batch1Files.length}`);
      }

      const batch2 = app.FindFirstRecordByFilter("demo3", `title="batch2"`);
      const batch2Files = batch2.GetStringSlice("files");
      if (batch2Files.length !== 0) {
        throw new Error(`Expected 0 batch2 file(s), got ${batch2Files.length}`);
      }

      const batch3 = app.FindFirstRecordByFilter("demo3", `title="batch3"`);
      const batch3Files = batch3.GetStringSlice("files");
      if (batch3Files.length !== 1) {
        throw new Error(`Expected 1 batch3 file(s), got ${batch3Files.length}`);
      }

      const batch4 = app.FindRecordById("demo3", "lcl9d87w22ml6jy");
      const batch4Files = batch4.GetStringSlice("files");
      if (batch4Files.length !== 1) {
        throw new Error(`Expected 1 batch4 file(s), got ${batch4Files.length}`);
      }
    },
  }),
  enableBatch({
    name: "create/update with expand query params",
    method: "POST",
    url: "/api/batch",
    headers: {
      Authorization:
        "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY",
    },
    body: `{
      "requests": [
        {"method":"POST", "url":"/api/collections/demo5/records?expand=rel_one", "body": {"total": 9, "rel_one":"qzaqccwrmva4o1n"}},
        {"method":"PATCH", "url":"/api/collections/demo5/records/qjeql998mtp1azp?expand=rel_many", "body": {"total": 10}}
      ]
    }`,
    expectedStatus: 200,
    expectedContent: [
      '"body":{',
      '"id":"qjeql998mtp1azp"',
      '"id":"qzaqccwrmva4o1n"',
      '"id":"i9naidtvr6qsgb4"',
      '"expand":{"rel_one"',
      '"expand":{"rel_many"',
    ],
    expectedEvents: {
      "*": 0,
      OnBatchRequest: 1,
      OnModelCreate: 1,
      OnModelCreateExecute: 1,
      OnModelAfterCreateSuccess: 1,
      OnModelUpdate: 1,
      OnModelUpdateExecute: 1,
      OnModelAfterUpdateSuccess: 1,
      OnModelValidate: 2,
      OnRecordCreateRequest: 1,
      OnRecordUpdateRequest: 1,
      OnRecordCreate: 1,
      OnRecordCreateExecute: 1,
      OnRecordAfterCreateSuccess: 1,
      OnRecordUpdate: 1,
      OnRecordUpdateExecute: 1,
      OnRecordAfterUpdateSuccess: 1,
      OnRecordValidate: 2,
      OnRecordEnrich: 5,
    },
  }),
  enableBatch({
    name: "check body limit middleware",
    method: "POST",
    url: "/api/batch",
    headers: {
      Authorization:
        "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY",
    },
    body: `{
      "requests": [
        {"method":"POST", "url":"/api/collections/demo5/records?expand=rel_one", "body": {"total": 9, "rel_one":"qzaqccwrmva4o1n"}},
        {"method":"PATCH", "url":"/api/collections/demo5/records/qjeql998mtp1azp?expand=rel_many", "body": {"total": 10}}
      ]
    }`,
    beforeTest: (app) => {
      app.settings().batch.maxBodySize = 10;
    },
    expectedStatus: 413,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  }),
];

describe("batch api", () => {
  for (const scenario of scenarios) {
    const name = scenario.name ?? `${scenario.method}:${scenario.url}`;
    it(name, async () => {
      await runApiScenario(scenario);
    });
  }

  it.serial("multipart/form-data parser fallback regression", async () => {
    let failOnce = true;
    setBatchMultipartFormDataParserForTests(async (request) => {
      const wrappedRequest = {
        headers: request.headers,
        method: request.method,
        url: request.url,
        clone: () => request.clone(),
        arrayBuffer: () => request.arrayBuffer(),
        formData: async () => {
          if (failOnce) {
            failOnce = false;
            throw new TypeError("undefined is not a function");
          }
          // eslint-disable-next-line typescript-eslint/no-deprecated -- regression test intentionally exercises native Request.formData behavior.
          return request.formData();
        },
      };
      return (await parseMultipartFormData(wrappedRequest)) as Awaited<ReturnType<Request["formData"]>>;
    });

    try {
      await runApiScenario(
        enableBatch({
          method: "POST",
          url: "/api/batch",
          body: multipartFallback.body,
          headers: {
            Authorization:
              "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6ImdrMzkwcWVnczR5NDd3biIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoidjg1MXE0cjc5MHJoa25sIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.0ONnm_BsvPRZyDNT31GN1CKUB6uQRxvVvQ-Wc9AZfG0",
            "Content-Type": multipartFallback.contentType,
          },
          expectedStatus: 200,
          expectedContent: ['"title":"batch_fallback"', '"status":200'],
          expectedEvents: {
            OnBatchRequest: 1,
          },
          afterTest: (app) => {
            app.FindFirstRecordByFilter("demo2", `title="batch_fallback"`);
          },
        }),
      );
    } finally {
      setBatchMultipartFormDataParserForTests(null);
    }
  });
});
