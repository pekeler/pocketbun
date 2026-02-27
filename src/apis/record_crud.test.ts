// Ported from pocketbase/apis/record_crud_test.go

import { describe, it } from "bun:test";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { TestApp } from "../tests/app.ts";
import { NewAuthOrigin } from "../core/auth_origin_model.ts";
import { FileField } from "../core/field_file.ts";
import { JSONField } from "../core/field_json.ts";
import { NewRecord } from "../core/record_model.ts";
import { runApiScenario, type ApiScenario } from "../tests/api.ts";
import { MockMultipartData } from "../tests/request.ts";
import { Event } from "../tools/router/event.ts";
import { JSONPayloadKey } from "../tools/router/unmarshal_request_data.ts";
import { Pointer } from "../tools/types/types.ts";
import { DefaultMaxBodySize } from "./middlewares_body_limit.ts";

const regularUserToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.ZT3F0Z3iM-xbGgSG3LEKiEzHrPHr8t8IuHLZGGNuxLo";
const superuserToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY";
const clientsUserToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6ImdrMzkwcWVnczR5NDd3biIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoidjg1MXE0cjc5MHJoa25sIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.0ONnm_BsvPRZyDNT31GN1CKUB6uQRxvVvQ-Wc9AZfG0";
const nologinUserToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6ImRjNDlrNmpnZWpuNDBoMyIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoia3B2NzA5c2sybHFicWs4IiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.fdUPFLDx5b6RM_XFqnqsyiyNieyKA2HIIkRmUh9kIoY";

const queryEscape = encodeURIComponent;
const createMultipart = await MockMultipartData(
  {
    title: "title_test",
  },
  "files",
);
const createMultipartNoFiles = await MockMultipartData({
  title: "title_multipart_no_files",
});
const createMultipartRuleFail = await MockMultipartData(
  {
    [JSONPayloadKey]: `{"title": "title_test2", "testPayload": 123}`,
  },
  "files",
);
const createMultipartRulePass = await MockMultipartData(
  {
    [JSONPayloadKey]: `{"title": "title_test3", "testPayload": 123}`,
  },
  "files",
);
const updateMultipart = await MockMultipartData(
  {
    title: "title_test",
  },
  "files",
);
const updateMultipartRuleFail = await MockMultipartData(
  {
    [JSONPayloadKey]: `{"title": "title_test2", "testPayload": 123}`,
  },
  "files",
);
const updateMultipartRulePass = await MockMultipartData(
  {
    [JSONPayloadKey]: `{"title": "title_test3", "testPayload": 123, "files":"300_JdfBOieXAW.png"}`,
  },
  "files",
);

describe("record CRUD list", () => {
  const scenarios: ApiScenario[] = [
    {
      name: "missing collection",
      method: "GET",
      url: "/api/collections/missing/records",
      expectedStatus: 404,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "unauthenticated trying to access nil rule collection (aka. need superuser auth)",
      method: "GET",
      url: "/api/collections/demo1/records",
      expectedStatus: 403,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "authenticated record trying to access nil rule collection (aka. need superuser auth)",
      method: "GET",
      url: "/api/collections/demo1/records",
      headers: { Authorization: regularUserToken },
      expectedStatus: 403,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "public collection but with superuser only filter param (aka. @collection, @request, etc.)",
      method: "GET",
      url: "/api/collections/demo2/records?filter=%40collection.demo2.title='test1'",
      expectedStatus: 403,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "public collection but with superuser only sort param (aka. @collection, @request, etc.)",
      method: "GET",
      url: "/api/collections/demo2/records?sort=@request.auth.title",
      expectedStatus: 403,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "public collection but with ENCODED superuser only filter/sort (aka. @collection)",
      method: "GET",
      url: "/api/collections/demo2/records?filter=%40collection.demo2.title%3D%27test1%27",
      expectedStatus: 403,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "public collection",
      method: "GET",
      url: "/api/collections/demo2/records",
      expectedStatus: 200,
      expectedContent: [
        `"page":1`,
        `"perPage":30`,
        `"totalPages":1`,
        `"totalItems":3`,
        `"items":[{`,
        `"id":"0yxhwia2amd8gec"`,
        `"id":"achvryl401bhse3"`,
        `"id":"llvuca81nly1qls"`,
      ],
      expectedEvents: {
        "*": 0,
        OnRecordsListRequest: 1,
        OnRecordEnrich: 3,
      },
    },
    {
      name: "public collection (using the collection id)",
      method: "GET",
      url: "/api/collections/sz5l5z67tg7gku0/records",
      expectedStatus: 200,
      expectedContent: [
        `"page":1`,
        `"perPage":30`,
        `"totalPages":1`,
        `"totalItems":3`,
        `"items":[{`,
        `"id":"0yxhwia2amd8gec"`,
        `"id":"achvryl401bhse3"`,
        `"id":"llvuca81nly1qls"`,
      ],
      expectedEvents: {
        "*": 0,
        OnRecordsListRequest: 1,
        OnRecordEnrich: 3,
      },
    },
    {
      name: "authorized as superuser trying to access nil rule collection (aka. need superuser auth)",
      method: "GET",
      url: "/api/collections/demo1/records",
      headers: { Authorization: superuserToken },
      expectedStatus: 200,
      expectedContent: [
        `"page":1`,
        `"perPage":30`,
        `"totalPages":1`,
        `"totalItems":3`,
        `"items":[{`,
        `"id":"al1h9ijdeojtsjy"`,
        `"id":"84nmscqy84lsi1t"`,
        `"id":"imy661ixudk5izi"`,
      ],
      expectedEvents: {
        "*": 0,
        OnRecordsListRequest: 1,
        OnRecordEnrich: 3,
      },
    },
    {
      name: "valid query params",
      method: "GET",
      url: "/api/collections/demo1/records?filter=text~'test'&sort=-bool",
      headers: { Authorization: superuserToken },
      expectedStatus: 200,
      expectedContent: [
        `"page":1`,
        `"perPage":30`,
        `"totalItems":2`,
        `"items":[{`,
        `"id":"al1h9ijdeojtsjy"`,
        `"id":"84nmscqy84lsi1t"`,
      ],
      expectedEvents: {
        "*": 0,
        OnRecordsListRequest: 1,
        OnRecordEnrich: 2,
      },
    },
    {
      name: "invalid filter",
      method: "GET",
      url: "/api/collections/demo1/records?filter=invalid~'test'",
      headers: { Authorization: superuserToken },
      expectedStatus: 400,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "expand relations",
      method: "GET",
      url: "/api/collections/demo1/records?expand=rel_one,rel_many.rel,missing&perPage=2&sort=created",
      headers: { Authorization: superuserToken },
      expectedStatus: 200,
      expectedContent: [
        `"page":1`,
        `"perPage":2`,
        `"totalPages":2`,
        `"totalItems":3`,
        `"items":[{`,
        `"collectionName":"demo1"`,
        `"id":"84nmscqy84lsi1t"`,
        `"id":"al1h9ijdeojtsjy"`,
        `"expand":{`,
        `"rel_one":""`,
        `"rel_one":{"`,
        `"rel_many":[{`,
        `"rel":{`,
        `"rel":""`,
        `"json":[1,2,3]`,
        `"select_many":["optionB","optionC"]`,
        `"select_many":["optionB"]`,
        `"id":"0yxhwia2amd8gec"`,
        `"id":"llvuca81nly1qls"`,
        `"email":"test@example.com"`,
        `"email":"test2@example.com"`,
        `"email":"test3@example.com"`,
      ],
      expectedEvents: {
        "*": 0,
        OnRecordsListRequest: 1,
        OnRecordEnrich: 8,
      },
    },
    {
      name: "authenticated record model that DOESN'T match the collection list rule",
      method: "GET",
      url: "/api/collections/demo3/records",
      headers: { Authorization: regularUserToken },
      expectedStatus: 200,
      expectedContent: [`"page":1`, `"perPage":30`, `"totalItems":0`, `"items":[]`],
      expectedEvents: {
        "*": 0,
        OnRecordsListRequest: 1,
      },
    },
    {
      name: "authenticated record that matches the collection list rule",
      method: "GET",
      url: "/api/collections/demo3/records",
      headers: { Authorization: clientsUserToken },
      expectedStatus: 200,
      expectedContent: [
        `"page":1`,
        `"perPage":30`,
        `"totalPages":1`,
        `"totalItems":4`,
        `"items":[{`,
        `"id":"1tmknxy2868d869"`,
        `"id":"lcl9d87w22ml6jy"`,
        `"id":"7nwo8tuiatetxdm"`,
        `"id":"mk5fmymtx4wsprk"`,
      ],
      expectedEvents: {
        "*": 0,
        OnRecordsListRequest: 1,
        OnRecordEnrich: 4,
      },
    },
    {
      name: "authenticated regular record that matches the collection list rule with hidden field",
      method: "GET",
      url: "/api/collections/demo3/records",
      headers: { Authorization: clientsUserToken },
      beforeTest: async (app) => {
        const collection = app.findCollectionByNameOrId("demo3");
        if (!collection) {
          throw new Error("Missing demo3 collection");
        }
        collection.Fields.GetByName("title")?.SetHidden(true);
        collection.listRule = "title ~ 'test'";
        const err = await app.Save(collection);
        if (err) {
          throw err;
        }
      },
      expectedStatus: 200,
      expectedContent: [
        `"page":1`,
        `"perPage":30`,
        `"totalPages":1`,
        `"totalItems":4`,
        `"items":[{`,
        `"id":"1tmknxy2868d869"`,
        `"id":"lcl9d87w22ml6jy"`,
        `"id":"7nwo8tuiatetxdm"`,
        `"id":"mk5fmymtx4wsprk"`,
      ],
      expectedEvents: {
        "*": 0,
        OnRecordsListRequest: 1,
        OnRecordEnrich: 4,
      },
    },
    {
      name: "authenticated regular record filtering with a hidden field",
      method: "GET",
      url: "/api/collections/demo3/records?filter=title~'test'",
      headers: { Authorization: clientsUserToken },
      beforeTest: async (app) => {
        const collection = app.findCollectionByNameOrId("demo3");
        if (!collection) {
          throw new Error("Missing demo3 collection");
        }
        collection.Fields.GetByName("title")?.SetHidden(true);
        const err = await app.Save(collection);
        if (err) {
          throw err;
        }
      },
      expectedStatus: 400,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "superuser filtering with a hidden field",
      method: "GET",
      url: "/api/collections/demo3/records?filter=title~'test'",
      headers: { Authorization: superuserToken },
      beforeTest: async (app) => {
        const collection = app.findCollectionByNameOrId("demo3");
        if (!collection) {
          throw new Error("Missing demo3 collection");
        }
        collection.Fields.GetByName("title")?.SetHidden(true);
        const err = await app.Save(collection);
        if (err) {
          throw err;
        }
      },
      expectedStatus: 200,
      expectedContent: [
        `"page":1`,
        `"perPage":30`,
        `"totalPages":1`,
        `"totalItems":4`,
        `"items":[{`,
        `"id":"1tmknxy2868d869"`,
        `"id":"lcl9d87w22ml6jy"`,
        `"id":"7nwo8tuiatetxdm"`,
        `"id":"mk5fmymtx4wsprk"`,
      ],
      expectedEvents: {
        "*": 0,
        OnRecordsListRequest: 1,
        OnRecordEnrich: 4,
      },
    },
    {
      name: ":rule modifer",
      method: "GET",
      url: "/api/collections/demo5/records",
      expectedStatus: 200,
      expectedContent: [`"page":1`, `"perPage":30`, `"totalPages":1`, `"totalItems":1`, `"items":[{`, `"id":"qjeql998mtp1azp"`],
      expectedEvents: {
        "*": 0,
        OnRecordsListRequest: 1,
        OnRecordEnrich: 1,
      },
    },
    {
      name: "multi-match - at least one of (guest - non-satisfied relation filter API rule)",
      method: "GET",
      url: `/api/collections/demo4/records?filter=${queryEscape("rel_many_no_cascade_required.files:length?=2")}`,
      expectedStatus: 200,
      expectedContent: [`"page":1`, `"perPage":30`, `"totalPages":0`, `"totalItems":0`, `"items":[]`],
      expectedEvents: {
        "*": 0,
        OnRecordsListRequest: 1,
        OnRecordEnrich: 0,
      },
    },
    {
      name: "multi-match - at least one of (clients)",
      method: "GET",
      url: `/api/collections/demo4/records?filter=${queryEscape("rel_many_no_cascade_required.files:length?=2")}`,
      headers: { Authorization: clientsUserToken },
      expectedStatus: 200,
      expectedContent: [`"page":1`, `"perPage":30`, `"totalPages":1`, `"totalItems":1`, `"items":[{`, `"id":"qzaqccwrmva4o1n"`],
      expectedEvents: {
        "*": 0,
        OnRecordsListRequest: 1,
        OnRecordEnrich: 1,
      },
    },
    {
      name: "multi-match - all (clients)",
      method: "GET",
      url: `/api/collections/demo4/records?filter=${queryEscape("rel_many_no_cascade_required.files:length=2")}`,
      headers: { Authorization: clientsUserToken },
      expectedStatus: 200,
      expectedContent: [`"page":1`, `"perPage":30`, `"totalPages":0`, `"totalItems":0`, `"items":[]`],
      expectedEvents: {
        "*": 0,
        OnRecordsListRequest: 1,
      },
    },
    {
      name: "OnRecordsListRequest tx body write check",
      method: "GET",
      url: "/api/collections/demo4/records",
      headers: { Authorization: superuserToken },
      beforeTest: async (app) => {
        app.OnRecordsListRequest().BindFunc(async (event) => {
          const original = event.App;
          return await event.App.RunInTransaction(async (txApp) => {
            event.App = txApp;
            try {
              const result = await event.Next();
              if (result instanceof Error) {
                return result;
              }
              return event.BadRequestError("TX_ERROR", null) as unknown as Error;
            } finally {
              event.App = original;
            }
          });
        });
      },
      expectedStatus: 400,
      expectedContent: ["TX_ERROR"],
      expectedEvents: { OnRecordsListRequest: 1 },
    },
    // auth collection
    {
      name: "check email visibility as guest",
      method: "GET",
      url: "/api/collections/nologin/records",
      expectedStatus: 200,
      expectedContent: [
        `"page":1`,
        `"perPage":30`,
        `"totalPages":1`,
        `"totalItems":3`,
        `"items":[{`,
        `"id":"phhq3wr65cap535"`,
        `"id":"dc49k6jgejn40h3"`,
        `"id":"oos036e9xvqeexy"`,
        `"email":"test2@example.com"`,
        `"emailVisibility":true`,
        `"emailVisibility":false`,
      ],
      notExpectedContent: [`"tokenKey"`, `"password"`, `"email":"test@example.com"`, `"email":"test3@example.com"`],
      expectedEvents: {
        "*": 0,
        OnRecordsListRequest: 1,
        OnRecordEnrich: 3,
      },
    },
    {
      name: "check email visibility as any authenticated record",
      method: "GET",
      url: "/api/collections/nologin/records",
      headers: { Authorization: clientsUserToken },
      expectedStatus: 200,
      expectedContent: [
        `"page":1`,
        `"perPage":30`,
        `"totalPages":1`,
        `"totalItems":3`,
        `"items":[{`,
        `"id":"phhq3wr65cap535"`,
        `"id":"dc49k6jgejn40h3"`,
        `"id":"oos036e9xvqeexy"`,
        `"email":"test2@example.com"`,
        `"emailVisibility":true`,
        `"emailVisibility":false`,
      ],
      notExpectedContent: [`"tokenKey":"`, `"password":""`, `"email":"test@example.com"`, `"email":"test3@example.com"`],
      expectedEvents: {
        "*": 0,
        OnRecordsListRequest: 1,
        OnRecordEnrich: 3,
      },
    },
    {
      name: "check email visibility as manage auth record",
      method: "GET",
      url: "/api/collections/nologin/records",
      headers: { Authorization: regularUserToken },
      expectedStatus: 200,
      expectedContent: [
        `"page":1`,
        `"perPage":30`,
        `"totalPages":1`,
        `"totalItems":3`,
        `"items":[{`,
        `"id":"phhq3wr65cap535"`,
        `"id":"dc49k6jgejn40h3"`,
        `"id":"oos036e9xvqeexy"`,
        `"email":"test@example.com"`,
        `"email":"test2@example.com"`,
        `"email":"test3@example.com"`,
        `"emailVisibility":true`,
        `"emailVisibility":false`,
      ],
      notExpectedContent: [`"tokenKey"`, `"password"`],
      expectedEvents: {
        "*": 0,
        OnRecordsListRequest: 1,
        OnRecordEnrich: 3,
      },
    },
    {
      name: "check email visibility as superuser",
      method: "GET",
      url: "/api/collections/nologin/records",
      headers: { Authorization: superuserToken },
      expectedStatus: 200,
      expectedContent: [
        `"page":1`,
        `"perPage":30`,
        `"totalPages":1`,
        `"totalItems":3`,
        `"items":[{`,
        `"id":"phhq3wr65cap535"`,
        `"id":"dc49k6jgejn40h3"`,
        `"id":"oos036e9xvqeexy"`,
        `"email":"test@example.com"`,
        `"email":"test2@example.com"`,
        `"email":"test3@example.com"`,
        `"emailVisibility":true`,
        `"emailVisibility":false`,
      ],
      notExpectedContent: [`"tokenKey"`, `"password"`],
      expectedEvents: {
        "*": 0,
        OnRecordsListRequest: 1,
        OnRecordEnrich: 3,
      },
    },
    {
      name: "check self email visibility resolver",
      method: "GET",
      url: "/api/collections/nologin/records",
      headers: { Authorization: nologinUserToken },
      expectedStatus: 200,
      expectedContent: [
        `"page":1`,
        `"perPage":30`,
        `"totalPages":1`,
        `"totalItems":3`,
        `"items":[{`,
        `"id":"phhq3wr65cap535"`,
        `"id":"dc49k6jgejn40h3"`,
        `"id":"oos036e9xvqeexy"`,
        `"email":"test2@example.com"`,
        `"email":"test@example.com"`,
        `"emailVisibility":true`,
        `"emailVisibility":false`,
      ],
      notExpectedContent: [`"tokenKey"`, `"password"`, `"email":"test3@example.com"`],
      expectedEvents: {
        "*": 0,
        OnRecordsListRequest: 1,
        OnRecordEnrich: 3,
      },
    },
    // view collection
    {
      name: "public view records",
      method: "GET",
      url: "/api/collections/view2/records?filter=state=false",
      expectedStatus: 200,
      expectedContent: [
        `"page":1`,
        `"perPage":30`,
        `"totalPages":1`,
        `"totalItems":2`,
        `"items":[{`,
        `"id":"al1h9ijdeojtsjy"`,
        `"id":"imy661ixudk5izi"`,
      ],
      notExpectedContent: [`"created"`, `"updated"`],
      expectedEvents: {
        "*": 0,
        OnRecordsListRequest: 1,
        OnRecordEnrich: 2,
      },
    },
    {
      name: "guest that doesn't match the view collection list rule",
      method: "GET",
      url: "/api/collections/view1/records",
      expectedStatus: 200,
      expectedContent: [`"page":1`, `"perPage":30`, `"totalPages":0`, `"totalItems":0`, `"items":[]`],
      expectedEvents: {
        "*": 0,
        OnRecordsListRequest: 1,
      },
    },
    {
      name: "authenticated record that matches the view collection list rule",
      method: "GET",
      url: "/api/collections/view1/records",
      headers: { Authorization: regularUserToken },
      expectedStatus: 200,
      expectedContent: [
        `"page":1`,
        `"perPage":30`,
        `"totalPages":1`,
        `"totalItems":1`,
        `"items":[{`,
        `"id":"84nmscqy84lsi1t"`,
        `"bool":true`,
      ],
      expectedEvents: {
        "*": 0,
        OnRecordsListRequest: 1,
        OnRecordEnrich: 1,
      },
    },
    {
      name: "view collection with numeric ids",
      method: "GET",
      url: "/api/collections/numeric_id_view/records",
      expectedStatus: 200,
      expectedContent: [`"page":1`, `"perPage":30`, `"totalPages":1`, `"totalItems":2`, `"items":[{`, `"id":"1"`, `"id":"2"`],
      expectedEvents: {
        "*": 0,
        OnRecordsListRequest: 1,
        OnRecordEnrich: 2,
      },
    },
    // rate limit checks
    {
      name: "RateLimit rule - view2:list",
      method: "GET",
      url: "/api/collections/view2/records",
      beforeTest: async (app) => {
        app.settings().rateLimits.enabled = true;
        app.settings().rateLimits.rules = [
          { maxRequests: 100, label: "abc", duration: 1 },
          { maxRequests: 100, label: "*:list", duration: 1 },
          { maxRequests: 0, label: "view2:list", duration: 1 },
        ];
      },
      expectedStatus: 429,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "RateLimit rule - *:list",
      method: "GET",
      url: "/api/collections/view2/records",
      beforeTest: async (app) => {
        app.settings().rateLimits.enabled = true;
        app.settings().rateLimits.rules = [
          { maxRequests: 100, label: "abc", duration: 1 },
          { maxRequests: 0, label: "*:list", duration: 1 },
        ];
      },
      expectedStatus: 429,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
  ];

  for (const scenario of scenarios) {
    const name = scenario.name ?? `${scenario.method}:${scenario.url}`;
    it(name, async () => {
      await runApiScenario(scenario);
    });
  }
});

describe("record CRUD multipart regression coverage", () => {
  it.serial("create succeeds when multipart RequestInfo bindBody fails once", async () => {
    let restoreBindBody: () => void = () => {};
    try {
      await runApiScenario({
        name: "multipart RequestInfo recovery remains usable for enrich",
        method: "POST",
        url: "/api/collections/demo2/records",
        body: createMultipartNoFiles.body,
        headers: {
          "Content-Type": createMultipartNoFiles.contentType,
        },
        beforeTest: async () => {
          // eslint-disable-next-line @typescript-eslint/unbound-method -- capture original prototype method for temporary patching.
          const originalBindBody = Event.prototype.bindBody;
          Event.prototype.bindBody = async function patchedBindBody(this: Event, target: object): Promise<void> {
            const contentType = (this.request.headers.get("content-type") ?? "").toLowerCase();
            if (contentType.startsWith("multipart/form-data")) {
              throw new TypeError("undefined is not a function");
            }
            return originalBindBody.call(this, target);
          };
          restoreBindBody = () => {
            Event.prototype.bindBody = originalBindBody;
          };
        },
        expectedStatus: 200,
        expectedContent: ['"id":"', '"title":"title_multipart_no_files"', '"active":false'],
        expectedEvents: {
          "*": 0,
          OnRecordCreateRequest: 1,
          OnModelCreate: 1,
          OnModelCreateExecute: 1,
          OnModelAfterCreateSuccess: 1,
          OnRecordCreate: 1,
          OnRecordCreateExecute: 1,
          OnRecordAfterCreateSuccess: 1,
          OnModelValidate: 1,
          OnRecordValidate: 1,
          OnRecordEnrich: 1,
        },
      });
    } finally {
      restoreBindBody();
    }
  });

  it.serial("create succeeds when multipart file parsing uses request clone path", async () => {
    let restorePatchedFormData: () => void = () => {};
    let restoreBindBody: () => void = () => {};
    try {
      const failingRequests = new WeakSet<Request>();
      const patchedRequests = new Map<Request, (this: Request) => Promise<unknown>>();
      restorePatchedFormData = () => {
        for (const [request, originalFormData] of patchedRequests.entries()) {
          Object.defineProperty(request, "formData", {
            configurable: true,
            writable: true,
            value: originalFormData,
          });
        }
        patchedRequests.clear();
      };

      // eslint-disable-next-line @typescript-eslint/unbound-method -- capture original prototype method for temporary patching.
      const originalBindBody = Event.prototype.bindBody;
      Event.prototype.bindBody = async function patchedBindBody(this: Event, target: object): Promise<void> {
        const contentType = (this.request.headers.get("content-type") ?? "").toLowerCase();
        if (contentType.startsWith("multipart/form-data")) {
          const request = this.request as Request;
          if (!patchedRequests.has(request)) {
            // eslint-disable-next-line @typescript-eslint/no-deprecated -- test patching the native multipart parser path.
            const originalFormData = request.formData.bind(request) as (this: Request) => Promise<unknown>;
            patchedRequests.set(request, originalFormData);
            Object.defineProperty(request, "formData", {
              configurable: true,
              writable: true,
              value: async function patchedRequestFormData(this: Request): Promise<unknown> {
                if (failingRequests.has(this)) {
                  throw new TypeError("undefined is not a function");
                }
                return originalFormData.call(this);
              },
            });
          }
          failingRequests.add(request);
        }
        return originalBindBody.call(this, target);
      };
      restoreBindBody = () => {
        Event.prototype.bindBody = originalBindBody;
      };

      await runApiScenario({
        name: "multipart file parse clone path remains usable for create",
        method: "POST",
        url: "/api/collections/demo3/records",
        body: createMultipart.body,
        headers: {
          "Content-Type": createMultipart.contentType,
          Authorization: superuserToken,
        },
        expectedStatus: 200,
        expectedContent: ['"id":"', '"title":"title_test"', '"files":["'],
        expectedEvents: {
          "*": 0,
          OnRecordCreateRequest: 1,
          OnModelCreate: 1,
          OnModelCreateExecute: 1,
          OnModelAfterCreateSuccess: 1,
          OnRecordCreate: 1,
          OnRecordCreateExecute: 1,
          OnRecordAfterCreateSuccess: 1,
          OnModelValidate: 1,
          OnRecordValidate: 1,
          OnRecordEnrich: 1,
        },
      });
    } finally {
      restoreBindBody();
      restorePatchedFormData();
    }
  });
});

describe("record CRUD view", () => {
  const scenarios: ApiScenario[] = [
    {
      name: "missing collection",
      method: "GET",
      url: "/api/collections/missing/records/0yxhwia2amd8gec",
      expectedStatus: 404,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "missing record",
      method: "GET",
      url: "/api/collections/demo2/records/missing",
      expectedStatus: 404,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "unauthenticated trying to access nil rule collection (aka. need superuser auth)",
      method: "GET",
      url: "/api/collections/demo1/records/imy661ixudk5izi",
      expectedStatus: 403,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "authenticated record trying to access nil rule collection (aka. need superuser auth)",
      method: "GET",
      url: "/api/collections/demo1/records/imy661ixudk5izi",
      headers: { Authorization: regularUserToken },
      expectedStatus: 403,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "authenticated record that doesn't match the collection view rule",
      method: "GET",
      url: "/api/collections/users/records/bgs820n361vj1qd",
      headers: { Authorization: regularUserToken },
      expectedStatus: 404,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "public collection view",
      method: "GET",
      url: "/api/collections/demo2/records/0yxhwia2amd8gec",
      expectedStatus: 200,
      expectedContent: ['"id":"0yxhwia2amd8gec"', '"collectionName":"demo2"'],
      expectedEvents: {
        "*": 0,
        OnRecordViewRequest: 1,
        OnRecordEnrich: 1,
      },
    },
    {
      name: "public collection view (using the collection id)",
      method: "GET",
      url: "/api/collections/sz5l5z67tg7gku0/records/0yxhwia2amd8gec",
      expectedStatus: 200,
      expectedContent: ['"id":"0yxhwia2amd8gec"', '"collectionName":"demo2"'],
      expectedEvents: {
        "*": 0,
        OnRecordViewRequest: 1,
        OnRecordEnrich: 1,
      },
    },
    {
      name: "authorized as superuser trying to access nil rule collection view (aka. need superuser auth)",
      method: "GET",
      url: "/api/collections/demo1/records/imy661ixudk5izi",
      headers: { Authorization: superuserToken },
      expectedStatus: 200,
      expectedContent: ['"id":"imy661ixudk5izi"', '"collectionName":"demo1"'],
      expectedEvents: {
        "*": 0,
        OnRecordViewRequest: 1,
        OnRecordEnrich: 1,
      },
    },
    {
      name: "authenticated record that does match the collection view rule",
      method: "GET",
      url: "/api/collections/users/records/4q1xlclmfloku33",
      headers: { Authorization: regularUserToken },
      expectedStatus: 200,
      expectedContent: [
        '"id":"4q1xlclmfloku33"',
        '"collectionName":"users"',
        '"emailVisibility":false',
        '"email":"test@example.com"',
      ],
      expectedEvents: {
        "*": 0,
        OnRecordViewRequest: 1,
        OnRecordEnrich: 1,
      },
    },
    {
      name: "expand relations",
      method: "GET",
      url: "/api/collections/demo1/records/al1h9ijdeojtsjy?expand=rel_one,rel_many.rel,missing&perPage=2&sort=created",
      headers: { Authorization: superuserToken },
      expectedStatus: 200,
      expectedContent: [
        '"id":"al1h9ijdeojtsjy"',
        '"collectionName":"demo1"',
        '"rel_many":[{',
        '"rel_one":{',
        '"collectionName":"users"',
        '"id":"bgs820n361vj1qd"',
        '"expand":{"rel":{',
        '"id":"0yxhwia2amd8gec"',
        '"collectionName":"demo2"',
      ],
      expectedEvents: {
        "*": 0,
        OnRecordViewRequest: 1,
        OnRecordEnrich: 7,
      },
    },
    {
      name: "OnRecordViewRequest tx body write check",
      method: "GET",
      url: "/api/collections/demo1/records/al1h9ijdeojtsjy",
      headers: { Authorization: superuserToken },
      beforeTest: async (app) => {
        app.OnRecordViewRequest().BindFunc(async (event) => {
          const original = event.App;
          return await event.App.RunInTransaction(async (txApp) => {
            event.App = txApp;
            try {
              const result = await event.Next();
              if (result instanceof Error) {
                return result;
              }
              return event.BadRequestError("TX_ERROR", null) as unknown as Error;
            } finally {
              event.App = original;
            }
          });
        });
      },
      expectedStatus: 400,
      expectedContent: ["TX_ERROR"],
      expectedEvents: { OnRecordViewRequest: 1 },
    },
    // auth collection
    {
      name: "check email visibility as guest",
      method: "GET",
      url: "/api/collections/nologin/records/oos036e9xvqeexy",
      expectedStatus: 200,
      expectedContent: ['"id":"oos036e9xvqeexy"', '"emailVisibility":false', '"verified":true'],
      notExpectedContent: ['"tokenKey"', '"password"', '"email":"test3@example.com"'],
      expectedEvents: {
        "*": 0,
        OnRecordViewRequest: 1,
        OnRecordEnrich: 1,
      },
    },
    {
      name: "check email visibility as any authenticated record",
      method: "GET",
      url: "/api/collections/nologin/records/oos036e9xvqeexy",
      headers: { Authorization: clientsUserToken },
      expectedStatus: 200,
      expectedContent: ['"id":"oos036e9xvqeexy"', '"emailVisibility":false', '"verified":true'],
      notExpectedContent: ['"tokenKey"', '"password"', '"email":"test3@example.com"'],
      expectedEvents: {
        "*": 0,
        OnRecordViewRequest: 1,
        OnRecordEnrich: 1,
      },
    },
    {
      name: "check email visibility as manage auth record",
      method: "GET",
      url: "/api/collections/nologin/records/oos036e9xvqeexy",
      headers: { Authorization: regularUserToken },
      expectedStatus: 200,
      expectedContent: ['"id":"oos036e9xvqeexy"', '"emailVisibility":false', '"email":"test3@example.com"', '"verified":true'],
      expectedEvents: {
        "*": 0,
        OnRecordViewRequest: 1,
        OnRecordEnrich: 1,
      },
    },
    {
      name: "check email visibility as superuser",
      method: "GET",
      url: "/api/collections/nologin/records/oos036e9xvqeexy",
      headers: { Authorization: superuserToken },
      expectedStatus: 200,
      expectedContent: ['"id":"oos036e9xvqeexy"', '"emailVisibility":false', '"email":"test3@example.com"', '"verified":true'],
      notExpectedContent: ['"tokenKey"', '"password"'],
      expectedEvents: {
        "*": 0,
        OnRecordViewRequest: 1,
        OnRecordEnrich: 1,
      },
    },
    {
      name: "check self email visibility resolver",
      method: "GET",
      url: "/api/collections/nologin/records/dc49k6jgejn40h3",
      headers: { Authorization: nologinUserToken },
      expectedStatus: 200,
      expectedContent: ['"id":"dc49k6jgejn40h3"', '"email":"test@example.com"', '"emailVisibility":false', '"verified":false'],
      notExpectedContent: ['"tokenKey"', '"password"'],
      expectedEvents: {
        "*": 0,
        OnRecordViewRequest: 1,
        OnRecordEnrich: 1,
      },
    },
    // view collection
    {
      name: "public view record",
      method: "GET",
      url: "/api/collections/view2/records/84nmscqy84lsi1t",
      expectedStatus: 200,
      expectedContent: ['"id":"84nmscqy84lsi1t"', '"state":true', '"file_many":["', '"rel_many":["'],
      notExpectedContent: ['"created"', '"updated"'],
      expectedEvents: {
        "*": 0,
        OnRecordViewRequest: 1,
        OnRecordEnrich: 1,
      },
    },
    {
      name: "guest that doesn't match the view collection view rule",
      method: "GET",
      url: "/api/collections/view1/records/84nmscqy84lsi1t",
      expectedStatus: 404,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "authenticated record that matches the view collection view rule",
      method: "GET",
      url: "/api/collections/view1/records/84nmscqy84lsi1t",
      headers: { Authorization: regularUserToken },
      expectedStatus: 200,
      expectedContent: ['"id":"84nmscqy84lsi1t"', '"bool":true', '"text":"'],
      expectedEvents: {
        "*": 0,
        OnRecordViewRequest: 1,
        OnRecordEnrich: 1,
      },
    },
    {
      name: "view record with numeric id",
      method: "GET",
      url: "/api/collections/numeric_id_view/records/1",
      expectedStatus: 200,
      expectedContent: ['"id":"1"'],
      expectedEvents: {
        "*": 0,
        OnRecordViewRequest: 1,
        OnRecordEnrich: 1,
      },
    },
    // rate limit checks
    {
      name: "RateLimit rule - numeric_id_view:view",
      method: "GET",
      url: "/api/collections/numeric_id_view/records/1",
      beforeTest: async (app) => {
        app.settings().rateLimits.enabled = true;
        app.settings().rateLimits.rules = [
          { maxRequests: 100, label: "abc", duration: 1 },
          { maxRequests: 100, label: "*:view", duration: 1 },
          { maxRequests: 0, label: "numeric_id_view:view", duration: 1 },
        ];
      },
      expectedStatus: 429,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "RateLimit rule - *:view",
      method: "GET",
      url: "/api/collections/numeric_id_view/records/1",
      beforeTest: async (app) => {
        app.settings().rateLimits.enabled = true;
        app.settings().rateLimits.rules = [
          { maxRequests: 100, label: "abc", duration: 1 },
          { maxRequests: 0, label: "*:view", duration: 1 },
        ];
      },
      expectedStatus: 429,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
  ];

  for (const scenario of scenarios) {
    const name = scenario.name ?? `${scenario.method}:${scenario.url}`;
    it(name, async () => {
      await runApiScenario(scenario);
    });
  }
});

describe("record CRUD delete", () => {
  const ensureDeletedFiles = async (app: TestApp, collectionId: string, recordId: string) => {
    const storageDir = join(app.dataDir(), "storage", collectionId, recordId);
    try {
      const entries = await readdir(storageDir);
      if (entries.length !== 0) {
        throw new Error(`Expected empty/deleted dir, found: ${entries.length}`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  };

  const scenarios: ApiScenario[] = [
    {
      name: "missing collection",
      method: "DELETE",
      url: "/api/collections/missing/records/0yxhwia2amd8gec",
      expectedStatus: 404,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "missing record",
      method: "DELETE",
      url: "/api/collections/demo2/records/missing",
      expectedStatus: 404,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "unauthenticated trying to delete nil rule collection (aka. need superuser auth)",
      method: "DELETE",
      url: "/api/collections/demo1/records/imy661ixudk5izi",
      expectedStatus: 403,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "authenticated record trying to delete nil rule collection (aka. need superuser auth)",
      method: "DELETE",
      url: "/api/collections/demo1/records/imy661ixudk5izi",
      headers: { Authorization: regularUserToken },
      expectedStatus: 403,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "authenticated record that doesn't match the collection delete rule",
      method: "DELETE",
      url: "/api/collections/users/records/bgs820n361vj1qd",
      headers: { Authorization: regularUserToken },
      expectedStatus: 404,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "trying to delete a view collection record",
      method: "DELETE",
      url: "/api/collections/view1/records/imy661ixudk5izi",
      expectedStatus: 400,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "public collection record delete",
      method: "DELETE",
      url: "/api/collections/nologin/records/dc49k6jgejn40h3",
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
    {
      name: "public collection record delete (using the collection id as identifier)",
      method: "DELETE",
      url: "/api/collections/kpv709sk2lqbqk8/records/dc49k6jgejn40h3",
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
    {
      name: "authorized as superuser trying to delete nil rule collection view (aka. need superuser auth)",
      method: "DELETE",
      url: "/api/collections/clients/records/o1y0dd0spd786md",
      headers: { Authorization: superuserToken },
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
    {
      name: "OnRecordDeleteRequest tx body write check",
      method: "DELETE",
      url: "/api/collections/clients/records/o1y0dd0spd786md",
      headers: { Authorization: superuserToken },
      beforeTest: async (app) => {
        app.OnRecordDeleteRequest().BindFunc(async (event) => {
          const original = event.App;
          return await event.App.RunInTransaction(async (txApp) => {
            event.App = txApp;
            try {
              const result = await event.Next();
              if (result instanceof Error) {
                return result;
              }
              return event.BadRequestError("TX_ERROR", null) as unknown as Error;
            } finally {
              event.App = original;
            }
          });
        });
      },
      expectedStatus: 400,
      expectedEvents: { OnRecordDeleteRequest: 1 },
      expectedContent: ["TX_ERROR"],
    },
    {
      name: "authenticated record that match the collection delete rule",
      method: "DELETE",
      url: "/api/collections/users/records/4q1xlclmfloku33",
      headers: { Authorization: regularUserToken },
      delayMs: 100,
      expectedStatus: 204,
      expectedEvents: {
        "*": 0,
        OnRecordDeleteRequest: 1,
        OnModelDelete: 3,
        OnModelDeleteExecute: 3,
        OnModelAfterDeleteSuccess: 3,
        OnRecordDelete: 3,
        OnRecordDeleteExecute: 3,
        OnRecordAfterDeleteSuccess: 3,
        OnModelUpdate: 1,
        OnModelUpdateExecute: 1,
        OnModelAfterUpdateSuccess: 1,
        OnRecordUpdate: 1,
        OnRecordAfterUpdateSuccess: 1,
        OnRecordUpdateExecute: 1,
      },
      afterTest: async (app) => {
        await ensureDeletedFiles(app, "_pb_users_auth_", "4q1xlclmfloku33");

        const collection = app.findCollectionByNameOrId("users");
        if (!collection) {
          throw new Error("Failed to load users collection");
        }
        const record = NewRecord(collection);
        record.Set("id", "4q1xlclmfloku33");
        const externalAuths = app.FindAllExternalAuthsByRecord(record);
        if (externalAuths.length > 0) {
          throw new Error(`Expected linked external auths to be deleted, got ${externalAuths.length}`);
        }
      },
    },
    {
      name: "@request :isset (rule failure check)",
      method: "DELETE",
      url: "/api/collections/demo5/records/la4y2w4o98acwuj",
      expectedStatus: 404,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "@request :isset (rule pass check)",
      method: "DELETE",
      url: "/api/collections/demo5/records/la4y2w4o98acwuj?test=1",
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
    // cascade delete checks
    {
      name: "trying to delete a record while being part of a non-cascade required relation",
      method: "DELETE",
      url: "/api/collections/demo3/records/7nwo8tuiatetxdm",
      headers: { Authorization: superuserToken },
      expectedStatus: 400,
      expectedContent: ['"data":{}'],
      expectedEvents: {
        "*": 0,
        OnRecordDeleteRequest: 1,
        OnModelDelete: 2,
        OnModelDeleteExecute: 2,
        OnModelAfterDeleteError: 2,
        OnRecordDelete: 2,
        OnRecordDeleteExecute: 2,
        OnRecordAfterDeleteError: 2,
        OnModelUpdate: 2,
        OnModelUpdateExecute: 2,
        OnModelAfterUpdateError: 2,
        OnRecordUpdate: 2,
        OnRecordUpdateExecute: 2,
        OnRecordAfterUpdateError: 2,
      },
    },
    {
      name: "delete a record with non-cascade references",
      method: "DELETE",
      url: "/api/collections/demo3/records/1tmknxy2868d869",
      headers: { Authorization: superuserToken },
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
        OnModelUpdate: 2,
        OnModelUpdateExecute: 2,
        OnModelAfterUpdateSuccess: 2,
        OnRecordUpdate: 2,
        OnRecordUpdateExecute: 2,
        OnRecordAfterUpdateSuccess: 2,
      },
    },
    {
      name: "delete a record with cascade references",
      method: "DELETE",
      url: "/api/collections/users/records/oap640cot4yru2s",
      headers: { Authorization: superuserToken },
      delayMs: 100,
      expectedStatus: 204,
      expectedEvents: {
        "*": 0,
        OnRecordDeleteRequest: 1,
        OnModelDelete: 2,
        OnModelDeleteExecute: 2,
        OnModelAfterDeleteSuccess: 2,
        OnRecordDelete: 2,
        OnRecordDeleteExecute: 2,
        OnRecordAfterDeleteSuccess: 2,
        OnModelUpdate: 2,
        OnModelUpdateExecute: 2,
        OnModelAfterUpdateSuccess: 2,
        OnRecordUpdate: 2,
        OnRecordUpdateExecute: 2,
        OnRecordAfterUpdateSuccess: 2,
      },
      afterTest: async (app) => {
        const recId = "84nmscqy84lsi1t";
        const demo1 = app.findCollectionByNameOrId("demo1");
        if (!demo1) {
          throw new Error("Failed to load demo1 collection");
        }
        const rec = app.findRecordById(demo1, recId);
        if (rec) {
          throw new Error(`Expected record ${recId} to be cascade deleted`);
        }
        await ensureDeletedFiles(app, "wsmn24bux7wo113", recId);
        await ensureDeletedFiles(app, "_pb_users_auth_", "oap640cot4yru2s");
      },
    },
    // rate limit checks
    {
      name: "RateLimit rule - demo5:delete",
      method: "DELETE",
      url: "/api/collections/demo5/records/la4y2w4o98acwuj?test=1",
      beforeTest: async (app) => {
        app.settings().rateLimits.enabled = true;
        app.settings().rateLimits.rules = [
          { maxRequests: 100, label: "abc", duration: 1 },
          { maxRequests: 100, label: "*:delete", duration: 1 },
          { maxRequests: 0, label: "demo5:delete", duration: 1 },
        ];
      },
      expectedStatus: 429,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "RateLimit rule - *:delete",
      method: "DELETE",
      url: "/api/collections/demo5/records/la4y2w4o98acwuj?test=1",
      beforeTest: async (app) => {
        app.settings().rateLimits.enabled = true;
        app.settings().rateLimits.rules = [
          { maxRequests: 100, label: "abc", duration: 1 },
          { maxRequests: 0, label: "*:delete", duration: 1 },
        ];
      },
      expectedStatus: 429,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
  ];

  for (const scenario of scenarios) {
    const name = scenario.name ?? `${scenario.method}:${scenario.url}`;
    it(name, async () => {
      await runApiScenario(scenario);
    });
  }
});

describe("record CRUD create", () => {
  const scenarios: ApiScenario[] = [
    {
      name: "missing collection",
      method: "POST",
      url: "/api/collections/missing/records",
      expectedStatus: 404,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "guest trying to access nil-rule collection",
      method: "POST",
      url: "/api/collections/demo1/records",
      expectedStatus: 403,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "auth record trying to access nil-rule collection",
      method: "POST",
      url: "/api/collections/demo1/records",
      headers: { Authorization: regularUserToken },
      expectedStatus: 403,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "trying to create a new view collection record",
      method: "POST",
      url: "/api/collections/view1/records",
      body: `{"text":"new"}`,
      expectedStatus: 400,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "submit invalid body",
      method: "POST",
      url: "/api/collections/demo2/records",
      body: '{"',
      expectedStatus: 400,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "submit nil body",
      method: "POST",
      url: "/api/collections/demo2/records",
      body: null,
      expectedStatus: 400,
      expectedContent: ['"data":{', '"title":{"code":"validation_required"'],
      expectedEvents: {
        "*": 0,
        OnRecordCreateRequest: 1,
        OnModelCreate: 1,
        OnModelValidate: 1,
        OnModelAfterCreateError: 1,
        OnRecordCreate: 1,
        OnRecordValidate: 1,
        OnRecordAfterCreateError: 1,
      },
    },
    {
      name: "submit empty json body",
      method: "POST",
      url: "/api/collections/nologin/records",
      body: `{}`,
      expectedStatus: 400,
      expectedContent: [
        '"data":{',
        '"password":{"code":"validation_required"',
        '"passwordConfirm":{"code":"validation_required"',
      ],
      expectedEvents: {
        "*": 0,
        OnRecordCreateRequest: 1,
      },
    },
    {
      name: "guest submit in public collection",
      method: "POST",
      url: "/api/collections/demo2/records",
      body: `{"title":"new"}`,
      expectedStatus: 200,
      expectedContent: ['"id":', '"title":"new"', '"active":false'],
      expectedEvents: {
        "*": 0,
        OnRecordCreateRequest: 1,
        OnModelCreate: 1,
        OnModelCreateExecute: 1,
        OnModelAfterCreateSuccess: 1,
        OnRecordCreate: 1,
        OnRecordCreateExecute: 1,
        OnRecordAfterCreateSuccess: 1,
        OnModelValidate: 1,
        OnRecordValidate: 1,
        OnRecordEnrich: 1,
      },
    },
    {
      // PocketBun-only regression test:
      // avoid reparsing multipart request bodies for collections without file fields.
      name: "submit multipart body in no-file collection",
      method: "POST",
      url: "/api/collections/demo2/records",
      body: createMultipartNoFiles.body,
      headers: {
        "Content-Type": createMultipartNoFiles.contentType,
      },
      expectedStatus: 200,
      expectedContent: ['"id":"', '"title":"title_multipart_no_files"', '"active":false'],
      expectedEvents: {
        "*": 0,
        OnRecordCreateRequest: 1,
        OnModelCreate: 1,
        OnModelCreateExecute: 1,
        OnModelAfterCreateSuccess: 1,
        OnRecordCreate: 1,
        OnRecordCreateExecute: 1,
        OnRecordAfterCreateSuccess: 1,
        OnModelValidate: 1,
        OnRecordValidate: 1,
        OnRecordEnrich: 1,
      },
    },
    {
      name: "guest trying to submit in restricted collection",
      method: "POST",
      url: "/api/collections/demo3/records",
      body: `{"title":"test123"}`,
      expectedStatus: 400,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "auth record submit in restricted collection (rule failure check)",
      method: "POST",
      url: "/api/collections/demo3/records",
      body: `{"title":"test123"}`,
      headers: { Authorization: regularUserToken },
      expectedStatus: 400,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "auth record submit in restricted collection (rule pass check) + expand relations",
      method: "POST",
      url: "/api/collections/demo4/records?expand=missing,rel_one_no_cascade,rel_many_no_cascade_required",
      body: `{
        "title":"test123",
        "rel_one_no_cascade":"mk5fmymtx4wsprk",
        "rel_one_no_cascade_required":"7nwo8tuiatetxdm",
        "rel_one_cascade":"mk5fmymtx4wsprk",
        "rel_many_no_cascade":"mk5fmymtx4wsprk",
        "rel_many_no_cascade_required":["7nwo8tuiatetxdm","lcl9d87w22ml6jy"],
        "rel_many_cascade":"lcl9d87w22ml6jy"
      }`,
      headers: { Authorization: regularUserToken },
      expectedStatus: 200,
      expectedContent: [
        '"id":',
        '"title":"test123"',
        '"expand":{}',
        '"rel_one_no_cascade":"mk5fmymtx4wsprk"',
        '"rel_one_no_cascade_required":"7nwo8tuiatetxdm"',
        '"rel_one_cascade":"mk5fmymtx4wsprk"',
        '"rel_many_no_cascade":["mk5fmymtx4wsprk"]',
        '"rel_many_no_cascade_required":["7nwo8tuiatetxdm","lcl9d87w22ml6jy"]',
        '"rel_many_cascade":["lcl9d87w22ml6jy"]',
      ],
      notExpectedContent: ['"missing"', '"id":"mk5fmymtx4wsprk"', '"id":"7nwo8tuiatetxdm"', '"id":"lcl9d87w22ml6jy"'],
      expectedEvents: {
        "*": 0,
        OnRecordCreateRequest: 1,
        OnModelCreate: 1,
        OnModelCreateExecute: 1,
        OnModelAfterCreateSuccess: 1,
        OnRecordCreate: 1,
        OnRecordCreateExecute: 1,
        OnRecordAfterCreateSuccess: 1,
        OnModelValidate: 1,
        OnRecordValidate: 1,
        OnRecordEnrich: 1,
      },
    },
    {
      name: "superuser submit in restricted collection (rule skip check) + expand relations",
      method: "POST",
      url: "/api/collections/demo4/records?expand=missing,rel_one_no_cascade,rel_many_no_cascade_required",
      body: `{
        "title":"test123",
        "rel_one_no_cascade":"mk5fmymtx4wsprk",
        "rel_one_no_cascade_required":"7nwo8tuiatetxdm",
        "rel_one_cascade":"mk5fmymtx4wsprk",
        "rel_many_no_cascade":"mk5fmymtx4wsprk",
        "rel_many_no_cascade_required":["7nwo8tuiatetxdm","lcl9d87w22ml6jy"],
        "rel_many_cascade":"lcl9d87w22ml6jy"
      }`,
      headers: { Authorization: superuserToken },
      expectedStatus: 200,
      expectedContent: [
        '"id":',
        '"title":"test123"',
        '"rel_one_no_cascade":"mk5fmymtx4wsprk"',
        '"rel_one_no_cascade_required":"7nwo8tuiatetxdm"',
        '"rel_one_cascade":"mk5fmymtx4wsprk"',
        '"rel_many_no_cascade":["mk5fmymtx4wsprk"]',
        '"rel_many_no_cascade_required":["7nwo8tuiatetxdm","lcl9d87w22ml6jy"]',
        '"rel_many_cascade":["lcl9d87w22ml6jy"]',
        '"expand":{',
        '"id":"mk5fmymtx4wsprk"',
        '"id":"7nwo8tuiatetxdm"',
        '"id":"lcl9d87w22ml6jy"',
      ],
      notExpectedContent: ['"missing"'],
      expectedEvents: {
        "*": 0,
        OnRecordCreateRequest: 1,
        OnModelCreate: 1,
        OnModelCreateExecute: 1,
        OnModelAfterCreateSuccess: 1,
        OnRecordCreate: 1,
        OnRecordCreateExecute: 1,
        OnRecordAfterCreateSuccess: 1,
        OnModelValidate: 1,
        OnRecordValidate: 1,
        OnRecordEnrich: 4,
      },
    },
    {
      name: "superuser submit via multipart form data",
      method: "POST",
      url: "/api/collections/demo3/records",
      body: createMultipart.body,
      headers: {
        "Content-Type": createMultipart.contentType,
        Authorization: superuserToken,
      },
      expectedStatus: 200,
      expectedContent: ['"id":"', '"title":"title_test"', '"files":["'],
      expectedEvents: {
        "*": 0,
        OnRecordCreateRequest: 1,
        OnModelCreate: 1,
        OnModelCreateExecute: 1,
        OnModelAfterCreateSuccess: 1,
        OnRecordCreate: 1,
        OnRecordCreateExecute: 1,
        OnRecordAfterCreateSuccess: 1,
        OnModelValidate: 1,
        OnRecordValidate: 1,
        OnRecordEnrich: 1,
      },
    },
    {
      name: "submit via multipart form data with @jsonPayload key and unsatisfied @request.body rule",
      method: "POST",
      url: "/api/collections/demo3/records",
      body: createMultipartRuleFail.body,
      headers: {
        "Content-Type": createMultipartRuleFail.contentType,
      },
      beforeTest: async (app) => {
        const collection = app.findCollectionByNameOrId("demo3");
        if (!collection) {
          throw new Error("failed to find demo3 collection");
        }
        collection.createRule = Pointer("@request.body.testPayload != 123");
        const err = await app.Save(collection);
        if (err) {
          throw err;
        }
      },
      expectedStatus: 400,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "submit via multipart form data with @jsonPayload key and satisfied @request.body rule",
      method: "POST",
      url: "/api/collections/demo3/records",
      body: createMultipartRulePass.body,
      headers: {
        "Content-Type": createMultipartRulePass.contentType,
      },
      beforeTest: async (app) => {
        const collection = app.findCollectionByNameOrId("demo3");
        if (!collection) {
          throw new Error("failed to find demo3 collection");
        }
        collection.createRule = Pointer("@request.body.testPayload = 123");
        const err = await app.Save(collection);
        if (err) {
          throw err;
        }
      },
      expectedStatus: 200,
      expectedContent: ['"id":"', '"title":"title_test3"', '"files":["'],
      expectedEvents: {
        "*": 0,
        OnRecordCreateRequest: 1,
        OnModelCreate: 1,
        OnModelCreateExecute: 1,
        OnModelAfterCreateSuccess: 1,
        OnRecordCreate: 1,
        OnRecordCreateExecute: 1,
        OnRecordAfterCreateSuccess: 1,
        OnModelValidate: 1,
        OnRecordValidate: 1,
        OnRecordEnrich: 1,
      },
    },
    {
      name: "unique field error check",
      method: "POST",
      url: "/api/collections/demo2/records",
      body: `{
        "title":"test2"
      }`,
      expectedStatus: 400,
      expectedContent: ['"data":{', '"title":{', '"code":"validation_not_unique"'],
      expectedEvents: {
        "*": 0,
        OnRecordCreateRequest: 1,
        OnModelCreate: 1,
        OnModelCreateExecute: 1,
        OnModelAfterCreateError: 1,
        OnModelValidate: 1,
        OnRecordCreate: 1,
        OnRecordCreateExecute: 1,
        OnRecordAfterCreateError: 1,
        OnRecordValidate: 1,
      },
    },
    {
      name: "OnRecordCreateRequest tx body write check",
      method: "POST",
      url: "/api/collections/demo2/records",
      body: `{"title":"new"}`,
      headers: { Authorization: superuserToken },
      beforeTest: async (app) => {
        app.OnRecordCreateRequest().BindFunc(async (event) => {
          const original = event.App;
          return await event.App.RunInTransaction(async (txApp) => {
            event.App = txApp;
            try {
              const result = await event.Next();
              if (result instanceof Error) {
                return result;
              }
              return event.BadRequestError("TX_ERROR", null) as unknown as Error;
            } finally {
              event.App = original;
            }
          });
        });
      },
      expectedStatus: 400,
      expectedEvents: { OnRecordCreateRequest: 1 },
      expectedContent: ["TX_ERROR"],
    },

    // ID checks
    // -----------------------------------------------------------
    {
      name: "invalid custom insertion id (less than 15 chars)",
      method: "POST",
      url: "/api/collections/demo3/records",
      body: `{
        "id": "12345678901234",
        "title": "test"
      }`,
      headers: { Authorization: superuserToken },
      expectedStatus: 400,
      expectedContent: ['"id":{"code":"validation_min_text_constraint"'],
      expectedEvents: {
        "*": 0,
        OnRecordCreateRequest: 1,
        OnModelCreate: 1,
        OnModelValidate: 1,
        OnModelAfterCreateError: 1,
        OnRecordCreate: 1,
        OnRecordValidate: 1,
        OnRecordAfterCreateError: 1,
      },
    },
    {
      name: "invalid custom insertion id (more than 15 chars)",
      method: "POST",
      url: "/api/collections/demo3/records",
      body: `{
        "id": "1234567890123456",
        "title": "test"
      }`,
      headers: { Authorization: superuserToken },
      expectedStatus: 400,
      expectedContent: ['"id":{"code":"validation_max_text_constraint"'],
      expectedEvents: {
        "*": 0,
        OnRecordCreateRequest: 1,
        OnModelCreate: 1,
        OnModelValidate: 1,
        OnModelAfterCreateError: 1,
        OnRecordCreate: 1,
        OnRecordValidate: 1,
        OnRecordAfterCreateError: 1,
      },
    },
    {
      name: "valid custom insertion id (exactly 15 chars)",
      method: "POST",
      url: "/api/collections/demo3/records",
      body: `{
        "id": "123456789012345",
        "title": "test"
      }`,
      headers: { Authorization: superuserToken },
      expectedStatus: 200,
      expectedContent: ['"id":"123456789012345"', '"title":"test"'],
      expectedEvents: {
        "*": 0,
        OnRecordCreateRequest: 1,
        OnModelCreate: 1,
        OnModelCreateExecute: 1,
        OnModelAfterCreateSuccess: 1,
        OnRecordCreate: 1,
        OnRecordCreateExecute: 1,
        OnRecordAfterCreateSuccess: 1,
        OnModelValidate: 1,
        OnRecordValidate: 1,
        OnRecordEnrich: 1,
      },
    },
    {
      name: "valid custom insertion id existing in another non-auth collection",
      method: "POST",
      url: "/api/collections/demo3/records",
      body: `{
        "id": "0yxhwia2amd8gec",
        "title": "test"
      }`,
      headers: { Authorization: superuserToken },
      expectedStatus: 200,
      expectedContent: ['"id":"0yxhwia2amd8gec"', '"title":"test"'],
      expectedEvents: {
        "*": 0,
        OnRecordCreateRequest: 1,
        OnModelCreate: 1,
        OnModelCreateExecute: 1,
        OnModelAfterCreateSuccess: 1,
        OnRecordCreate: 1,
        OnRecordCreateExecute: 1,
        OnRecordAfterCreateSuccess: 1,
        OnModelValidate: 1,
        OnRecordValidate: 1,
        OnRecordEnrich: 1,
      },
    },
    {
      name: "valid custom insertion auth id duplicating in another auth collection",
      method: "POST",
      url: "/api/collections/users/records",
      body: `{
        "id":"o1y0dd0spd786md",
        "title":"test",
        "password":"1234567890",
        "passwordConfirm":"1234567890"
      }`,
      headers: { Authorization: superuserToken },
      expectedStatus: 400,
      expectedContent: ['"data":{', '"id":{"code":"validation_invalid_auth_id"'],
      expectedEvents: {
        "*": 0,
        OnRecordCreateRequest: 1,
        OnModelCreate: 1,
        OnModelCreateExecute: 1,
        OnModelAfterCreateError: 1,
        OnRecordCreate: 1,
        OnRecordCreateExecute: 1,
        OnRecordAfterCreateError: 1,
        OnModelValidate: 1,
        OnRecordValidate: 1,
      },
    },

    // check whether if @request.body modifer fields are properly resolved
    // -----------------------------------------------------------
    {
      name: "@request.body.field with compute modifers (rule failure check)",
      method: "POST",
      url: "/api/collections/demo5/records",
      body: `{
        "total+":4,
        "total-":2
      }`,
      expectedStatus: 400,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "@request.body.field with compute modifers (rule pass check)",
      method: "POST",
      url: "/api/collections/demo5/records",
      body: `{
        "total+":4,
        "total-":1
      }`,
      expectedStatus: 200,
      expectedContent: ['"id":"', '"collectionName":"demo5"', '"total":3'],
      expectedEvents: {
        "*": 0,
        OnRecordCreateRequest: 1,
        OnModelCreate: 1,
        OnModelCreateExecute: 1,
        OnModelAfterCreateSuccess: 1,
        OnRecordCreate: 1,
        OnRecordCreateExecute: 1,
        OnRecordAfterCreateSuccess: 1,
        OnModelValidate: 1,
        OnRecordValidate: 1,
        OnRecordEnrich: 1,
      },
    },

    // auth records
    // -----------------------------------------------------------
    {
      name: "auth record with invalid form data",
      method: "POST",
      url: "/api/collections/users/records",
      body: `{
        "password":"1234567",
        "passwordConfirm":"1234560",
        "email":"invalid",
        "username":"Users75657"
      }`,
      headers: { Authorization: superuserToken },
      expectedStatus: 400,
      expectedContent: ['"data":{', '"passwordConfirm":{"code":"validation_values_mismatch"'],
      notExpectedContent: ['"rel":', '"email":'],
      expectedEvents: {
        "*": 0,
        OnRecordCreateRequest: 1,
      },
    },
    {
      name: "auth record with valid form data but invalid record fields",
      method: "POST",
      url: "/api/collections/users/records",
      body: `{
        "password":"1234567",
        "passwordConfirm":"1234567",
        "rel":"invalid"
      }`,
      headers: { Authorization: superuserToken },
      expectedStatus: 400,
      expectedContent: ['"data":{', '"rel":{"code":', '"password":{"code":'],
      expectedEvents: {
        "*": 0,
        OnRecordCreateRequest: 1,
        OnModelCreate: 1,
        OnModelValidate: 1,
        OnModelAfterCreateError: 1,
        OnRecordCreate: 1,
        OnRecordValidate: 1,
        OnRecordAfterCreateError: 1,
      },
    },
    {
      name: "auth record with valid data and explicitly verified state by guest",
      method: "POST",
      url: "/api/collections/users/records",
      body: `{
        "password":"12345678",
        "passwordConfirm":"12345678",
        "verified":true
      }`,
      expectedStatus: 400,
      expectedContent: ['"data":{', '"verified":{"code":'],
      expectedEvents: {
        "*": 0,
        OnRecordCreateRequest: 1,
      },
    },
    {
      name: "auth record with valid data and explicitly verified state by random user",
      method: "POST",
      url: "/api/collections/users/records",
      headers: { Authorization: regularUserToken },
      body: `{
        "password":"12345678",
        "passwordConfirm":"12345678",
        "emailVisibility":true,
        "verified":true
      }`,
      expectedStatus: 400,
      expectedContent: ['"data":{', '"verified":{"code":'],
      notExpectedContent: ['"emailVisibility":{"code":'],
      expectedEvents: {
        "*": 0,
        OnRecordCreateRequest: 1,
      },
    },
    {
      name: "auth record with valid data by superuser",
      method: "POST",
      url: "/api/collections/users/records",
      body: `{
        "id":"o1o1y0pd78686mq",
        "username":"test.valid",
        "email":"new@example.com",
        "password":"12345678",
        "passwordConfirm":"12345678",
        "rel":"achvryl401bhse3",
        "emailVisibility":true,
        "verified":true
      }`,
      headers: { Authorization: superuserToken },
      expectedStatus: 200,
      expectedContent: [
        '"id":"o1o1y0pd78686mq"',
        '"username":"test.valid"',
        '"email":"new@example.com"',
        '"rel":"achvryl401bhse3"',
        '"emailVisibility":true',
        '"verified":true',
      ],
      notExpectedContent: ['"tokenKey"', '"password"', '"passwordConfirm"'],
      expectedEvents: {
        "*": 0,
        OnRecordCreateRequest: 1,
        OnModelCreate: 1,
        OnModelCreateExecute: 1,
        OnModelAfterCreateSuccess: 1,
        OnRecordCreate: 1,
        OnRecordCreateExecute: 1,
        OnRecordAfterCreateSuccess: 1,
        OnModelValidate: 1,
        OnRecordValidate: 1,
        OnRecordEnrich: 1,
      },
    },
    {
      name: "auth record with valid data by auth record with manage access",
      method: "POST",
      url: "/api/collections/nologin/records",
      body: `{
        "email":"new@example.com",
        "password":"12345678",
        "passwordConfirm":"12345678",
        "name":"test_name",
        "emailVisibility":true,
        "verified":true
      }`,
      headers: { Authorization: regularUserToken },
      expectedStatus: 200,
      expectedContent: [
        '"id":"',
        '"username":"',
        '"email":"new@example.com"',
        '"name":"test_name"',
        '"emailVisibility":true',
        '"verified":true',
      ],
      notExpectedContent: ['"tokenKey"', '"password"', '"passwordConfirm"'],
      expectedEvents: {
        "*": 0,
        OnRecordCreateRequest: 1,
        OnModelCreate: 1,
        OnModelCreateExecute: 1,
        OnModelAfterCreateSuccess: 1,
        OnRecordCreate: 1,
        OnRecordCreateExecute: 1,
        OnRecordAfterCreateSuccess: 1,
        OnModelValidate: 1,
        OnRecordValidate: 1,
        OnRecordEnrich: 1,
      },
    },

    // ensure that hidden fields cannot be set by non-superusers
    // -----------------------------------------------------------
    {
      name: "create with hidden field as regular user",
      method: "POST",
      url: "/api/collections/demo3/records",
      body: `{
        "id": "abcde1234567890",
        "title": "test_create"
      }`,
      headers: { Authorization: clientsUserToken },
      beforeTest: async (app) => {
        const collection = app.findCollectionByNameOrId("demo3");
        if (!collection) {
          throw new Error("failed to find demo3 collection");
        }
        const titleField = collection.Fields.GetByName("title");
        if (!titleField) {
          throw new Error("failed to find demo3 title field");
        }
        titleField.SetHidden(true);
        const err = await app.Save(collection);
        if (err) {
          throw err;
        }
      },
      afterTest: (app) => {
        const record = app.FindRecordById("demo3", "abcde1234567890");
        if (!record) {
          throw new Error("missing demo3 record");
        }
        if (record.GetString("title") !== "") {
          throw new Error(`Expected empty title, got ${record.GetString("title")}`);
        }
      },
      expectedStatus: 200,
      expectedContent: ['"id":"abcde1234567890"'],
      notExpectedContent: ['"title"'],
      expectedEvents: {
        "*": 0,
        OnRecordCreateRequest: 1,
        OnModelCreate: 1,
        OnModelCreateExecute: 1,
        OnModelAfterCreateSuccess: 1,
        OnRecordCreate: 1,
        OnRecordCreateExecute: 1,
        OnRecordAfterCreateSuccess: 1,
        OnModelValidate: 1,
        OnRecordValidate: 1,
        OnRecordEnrich: 1,
      },
    },
    {
      name: "create with hidden field as superuser",
      method: "POST",
      url: "/api/collections/demo3/records",
      body: `{
        "id": "abcde1234567890",
        "title": "test_create"
      }`,
      headers: { Authorization: superuserToken },
      beforeTest: async (app) => {
        const collection = app.findCollectionByNameOrId("demo3");
        if (!collection) {
          throw new Error("failed to find demo3 collection");
        }
        const titleField = collection.Fields.GetByName("title");
        if (!titleField) {
          throw new Error("failed to find demo3 title field");
        }
        titleField.SetHidden(true);
        const err = await app.Save(collection);
        if (err) {
          throw err;
        }
      },
      afterTest: (app) => {
        const record = app.FindRecordById("demo3", "abcde1234567890");
        if (!record) {
          throw new Error("missing demo3 record");
        }
        if (record.GetString("title") !== "test_create") {
          throw new Error(`Expected title "test_create", got ${record.GetString("title")}`);
        }
      },
      expectedStatus: 200,
      expectedContent: ['"id":"abcde1234567890"', '"title":"test_create"'],
      expectedEvents: {
        "*": 0,
        OnRecordCreateRequest: 1,
        OnModelCreate: 1,
        OnModelCreateExecute: 1,
        OnModelAfterCreateSuccess: 1,
        OnRecordCreate: 1,
        OnRecordCreateExecute: 1,
        OnRecordAfterCreateSuccess: 1,
        OnModelValidate: 1,
        OnRecordValidate: 1,
        OnRecordEnrich: 1,
      },
    },

    // rate limit checks
    // -----------------------------------------------------------
    {
      name: "RateLimit rule - demo2:create",
      method: "POST",
      url: "/api/collections/demo2/records",
      body: `{"title":"new"}`,
      beforeTest: async (app) => {
        app.settings().rateLimits.enabled = true;
        app.settings().rateLimits.rules = [
          { maxRequests: 100, label: "abc", duration: 1 },
          { maxRequests: 100, label: "*:create", duration: 1 },
          { maxRequests: 0, label: "demo2:create", duration: 1 },
        ];
      },
      expectedStatus: 429,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "RateLimit rule - *:create",
      method: "POST",
      url: "/api/collections/demo2/records",
      body: `{"title":"new"}`,
      beforeTest: async (app) => {
        app.settings().rateLimits.enabled = true;
        app.settings().rateLimits.rules = [
          { maxRequests: 100, label: "abc", duration: 1 },
          { maxRequests: 0, label: "*:create", duration: 1 },
        ];
      },
      expectedStatus: 429,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },

    // dynamic body limit checks
    // -----------------------------------------------------------
    {
      name: "body > collection BodyLimit",
      method: "POST",
      url: "/api/collections/demo1/records",
      body: new Uint8Array(DefaultMaxBodySize + 5 + 20 + 2 + 1),
      beforeTest: async (app) => {
        const collection = app.findCollectionByNameOrId("demo1");
        if (!collection) {
          throw new Error("failed to find demo1 collection");
        }
        const fileOneField = collection.Fields.GetByName("file_one") as FileField;
        const fileManyField = collection.Fields.GetByName("file_many") as FileField;
        const jsonField = collection.Fields.GetByName("json") as JSONField;
        fileOneField.MaxSize = 5;
        fileManyField.MaxSize = 10;
        fileManyField.MaxSelect = 2;
        jsonField.MaxSize = 2;
        const err = await app.Save(collection);
        if (err) {
          throw err;
        }
      },
      expectedStatus: 413,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "body <= collection BodyLimit",
      method: "POST",
      url: "/api/collections/demo1/records",
      body: new Uint8Array(DefaultMaxBodySize + 5 + 20 + 2),
      beforeTest: async (app) => {
        const collection = app.findCollectionByNameOrId("demo1");
        if (!collection) {
          throw new Error("failed to find demo1 collection");
        }
        const fileOneField = collection.Fields.GetByName("file_one") as FileField;
        const fileManyField = collection.Fields.GetByName("file_many") as FileField;
        const jsonField = collection.Fields.GetByName("json") as JSONField;
        fileOneField.MaxSize = 5;
        fileManyField.MaxSize = 10;
        fileManyField.MaxSelect = 2;
        jsonField.MaxSize = 2;
        const err = await app.Save(collection);
        if (err) {
          throw err;
        }
      },
      expectedStatus: 400,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
  ];

  for (const scenario of scenarios) {
    const name = scenario.name ?? `${scenario.method}:${scenario.url}`;
    it(name, async () => {
      await runApiScenario(scenario);
    });
  }
});

describe("record CRUD update", () => {
  const scenarios: ApiScenario[] = [
    {
      name: "missing collection",
      method: "PATCH",
      url: "/api/collections/missing/records/0yxhwia2amd8gec",
      expectedStatus: 404,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "guest trying to access nil-rule collection record",
      method: "PATCH",
      url: "/api/collections/demo1/records/imy661ixudk5izi",
      expectedStatus: 403,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "auth record trying to access nil-rule collection",
      method: "PATCH",
      url: "/api/collections/demo1/records/imy661ixudk5izi",
      headers: { Authorization: regularUserToken },
      expectedStatus: 403,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "trying to update a view collection record",
      method: "PATCH",
      url: "/api/collections/view1/records/imy661ixudk5izi",
      body: `{"text":"new"}`,
      expectedStatus: 400,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "submit invalid body",
      method: "PATCH",
      url: "/api/collections/demo2/records/0yxhwia2amd8gec",
      body: '{"',
      expectedStatus: 400,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "submit nil body (aka. no fields change)",
      method: "PATCH",
      url: "/api/collections/demo2/records/0yxhwia2amd8gec",
      body: null,
      expectedStatus: 200,
      expectedContent: ['"collectionName":"demo2"', '"id":"0yxhwia2amd8gec"'],
      expectedEvents: {
        "*": 0,
        OnRecordUpdateRequest: 1,
        OnModelUpdate: 1,
        OnModelUpdateExecute: 1,
        OnModelAfterUpdateSuccess: 1,
        OnRecordUpdate: 1,
        OnRecordUpdateExecute: 1,
        OnRecordAfterUpdateSuccess: 1,
        OnModelValidate: 1,
        OnRecordValidate: 1,
        OnRecordEnrich: 1,
      },
    },
    {
      name: "submit empty body (aka. no fields change)",
      method: "PATCH",
      url: "/api/collections/demo2/records/0yxhwia2amd8gec",
      body: `{}`,
      expectedStatus: 200,
      expectedContent: ['"collectionName":"demo2"', '"id":"0yxhwia2amd8gec"'],
      expectedEvents: {
        "*": 0,
        OnRecordUpdateRequest: 1,
        OnModelUpdate: 1,
        OnModelUpdateExecute: 1,
        OnModelAfterUpdateSuccess: 1,
        OnRecordUpdate: 1,
        OnRecordUpdateExecute: 1,
        OnRecordAfterUpdateSuccess: 1,
        OnModelValidate: 1,
        OnRecordValidate: 1,
        OnRecordEnrich: 1,
      },
    },
    {
      name: "trigger field validation",
      method: "PATCH",
      url: "/api/collections/demo2/records/0yxhwia2amd8gec",
      body: `{"title":"a"}`,
      expectedStatus: 400,
      expectedContent: ['data":{', '"title":{"code":"validation_min_text_constraint"'],
      expectedEvents: {
        "*": 0,
        OnRecordUpdateRequest: 1,
        OnModelUpdate: 1,
        OnModelValidate: 1,
        OnModelAfterUpdateError: 1,
        OnRecordUpdate: 1,
        OnRecordValidate: 1,
        OnRecordAfterUpdateError: 1,
      },
    },
    {
      name: "guest submit in public collection",
      method: "PATCH",
      url: "/api/collections/demo2/records/0yxhwia2amd8gec",
      body: `{"title":"new"}`,
      expectedStatus: 200,
      expectedContent: ['"id":"0yxhwia2amd8gec"', '"title":"new"', '"active":true'],
      expectedEvents: {
        "*": 0,
        OnRecordUpdateRequest: 1,
        OnModelUpdate: 1,
        OnModelUpdateExecute: 1,
        OnModelAfterUpdateSuccess: 1,
        OnRecordUpdate: 1,
        OnRecordUpdateExecute: 1,
        OnRecordAfterUpdateSuccess: 1,
        OnModelValidate: 1,
        OnRecordValidate: 1,
        OnRecordEnrich: 1,
      },
    },
    {
      name: "guest trying to submit in restricted collection",
      method: "PATCH",
      url: "/api/collections/demo3/records/mk5fmymtx4wsprk",
      body: `{"title":"new"}`,
      expectedStatus: 404,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "auth record submit in restricted collection (rule failure check)",
      method: "PATCH",
      url: "/api/collections/demo3/records/mk5fmymtx4wsprk",
      body: `{"title":"new"}`,
      headers: { Authorization: regularUserToken },
      expectedStatus: 404,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "auth record submit in restricted collection (rule pass check) + expand relations",
      method: "PATCH",
      url: "/api/collections/demo4/records/i9naidtvr6qsgb4?expand=missing,rel_one_no_cascade,rel_many_no_cascade_required",
      body: `{
        "title":"test123",
        "rel_one_no_cascade":"mk5fmymtx4wsprk",
        "rel_one_no_cascade_required":"7nwo8tuiatetxdm",
        "rel_one_cascade":"mk5fmymtx4wsprk",
        "rel_many_no_cascade":"mk5fmymtx4wsprk",
        "rel_many_no_cascade_required":["7nwo8tuiatetxdm","lcl9d87w22ml6jy"],
        "rel_many_cascade":"lcl9d87w22ml6jy"
      }`,
      headers: { Authorization: regularUserToken },
      expectedStatus: 200,
      expectedContent: [
        '"id":"i9naidtvr6qsgb4"',
        '"title":"test123"',
        '"expand":{}',
        '"rel_one_no_cascade":"mk5fmymtx4wsprk"',
        '"rel_one_no_cascade_required":"7nwo8tuiatetxdm"',
        '"rel_one_cascade":"mk5fmymtx4wsprk"',
        '"rel_many_no_cascade":["mk5fmymtx4wsprk"]',
        '"rel_many_no_cascade_required":["7nwo8tuiatetxdm","lcl9d87w22ml6jy"]',
        '"rel_many_cascade":["lcl9d87w22ml6jy"]',
      ],
      notExpectedContent: ['"missing"', '"id":"mk5fmymtx4wsprk"', '"id":"7nwo8tuiatetxdm"', '"id":"lcl9d87w22ml6jy"'],
      expectedEvents: {
        "*": 0,
        OnRecordUpdateRequest: 1,
        OnModelUpdate: 1,
        OnModelUpdateExecute: 1,
        OnModelAfterUpdateSuccess: 1,
        OnRecordUpdate: 1,
        OnRecordUpdateExecute: 1,
        OnRecordAfterUpdateSuccess: 1,
        OnModelValidate: 1,
        OnRecordValidate: 1,
        OnRecordEnrich: 1,
      },
    },
    {
      name: "superuser submit in restricted collection (rule skip check) + expand relations",
      method: "PATCH",
      url: "/api/collections/demo4/records/i9naidtvr6qsgb4?expand=missing,rel_one_no_cascade,rel_many_no_cascade_required",
      body: `{
        "title":"test123",
        "rel_one_no_cascade":"mk5fmymtx4wsprk",
        "rel_one_no_cascade_required":"7nwo8tuiatetxdm",
        "rel_one_cascade":"mk5fmymtx4wsprk",
        "rel_many_no_cascade":"mk5fmymtx4wsprk",
        "rel_many_no_cascade_required":["7nwo8tuiatetxdm","lcl9d87w22ml6jy"],
        "rel_many_cascade":"lcl9d87w22ml6jy"
      }`,
      headers: { Authorization: superuserToken },
      expectedStatus: 200,
      expectedContent: [
        '"id":"i9naidtvr6qsgb4"',
        '"title":"test123"',
        '"rel_one_no_cascade":"mk5fmymtx4wsprk"',
        '"rel_one_no_cascade_required":"7nwo8tuiatetxdm"',
        '"rel_one_cascade":"mk5fmymtx4wsprk"',
        '"rel_many_no_cascade":["mk5fmymtx4wsprk"]',
        '"rel_many_no_cascade_required":["7nwo8tuiatetxdm","lcl9d87w22ml6jy"]',
        '"rel_many_cascade":["lcl9d87w22ml6jy"]',
        '"expand":{',
        '"id":"mk5fmymtx4wsprk"',
        '"id":"7nwo8tuiatetxdm"',
        '"id":"lcl9d87w22ml6jy"',
      ],
      notExpectedContent: ['"missing"'],
      expectedEvents: {
        "*": 0,
        OnRecordUpdateRequest: 1,
        OnModelUpdate: 1,
        OnModelUpdateExecute: 1,
        OnModelAfterUpdateSuccess: 1,
        OnRecordUpdate: 1,
        OnRecordUpdateExecute: 1,
        OnRecordAfterUpdateSuccess: 1,
        OnModelValidate: 1,
        OnRecordValidate: 1,
        OnRecordEnrich: 4,
      },
    },
    {
      name: "superuser submit via multipart form data",
      method: "PATCH",
      url: "/api/collections/demo3/records/mk5fmymtx4wsprk",
      body: updateMultipart.body,
      headers: {
        "Content-Type": updateMultipart.contentType,
        Authorization: superuserToken,
      },
      expectedStatus: 200,
      expectedContent: ['"id":"mk5fmymtx4wsprk"', '"title":"title_test"', '"files":["'],
      expectedEvents: {
        "*": 0,
        OnRecordUpdateRequest: 1,
        OnModelUpdate: 1,
        OnModelUpdateExecute: 1,
        OnModelAfterUpdateSuccess: 1,
        OnRecordUpdate: 1,
        OnRecordUpdateExecute: 1,
        OnRecordAfterUpdateSuccess: 1,
        OnModelValidate: 1,
        OnRecordValidate: 1,
        OnRecordEnrich: 1,
      },
    },
    {
      name: "submit via multipart form data with @jsonPayload key and unsatisfied @request.body rule",
      method: "PATCH",
      url: "/api/collections/demo3/records/mk5fmymtx4wsprk",
      body: updateMultipartRuleFail.body,
      headers: {
        "Content-Type": updateMultipartRuleFail.contentType,
      },
      beforeTest: async (app) => {
        const collection = app.findCollectionByNameOrId("demo3");
        if (!collection) {
          throw new Error("failed to find demo3 collection");
        }
        collection.updateRule = Pointer("@request.body.testPayload != 123");
        const err = await app.Save(collection);
        if (err) {
          throw err;
        }
      },
      expectedStatus: 404,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "submit via multipart form data with @jsonPayload key and satisfied @request.body rule",
      method: "PATCH",
      url: "/api/collections/demo3/records/mk5fmymtx4wsprk",
      body: updateMultipartRulePass.body,
      headers: {
        "Content-Type": updateMultipartRulePass.contentType,
      },
      beforeTest: async (app) => {
        const collection = app.findCollectionByNameOrId("demo3");
        if (!collection) {
          throw new Error("failed to find demo3 collection");
        }
        collection.updateRule = Pointer("@request.body.testPayload = 123");
        const err = await app.Save(collection);
        if (err) {
          throw err;
        }
      },
      expectedStatus: 200,
      expectedContent: ['"id":"mk5fmymtx4wsprk"', '"title":"title_test3"', '"files":["', '"300_JdfBOieXAW.png"', '"tmpfile_'],
      expectedEvents: {
        "*": 0,
        OnRecordUpdateRequest: 1,
        OnModelUpdate: 1,
        OnModelUpdateExecute: 1,
        OnModelAfterUpdateSuccess: 1,
        OnRecordUpdate: 1,
        OnRecordUpdateExecute: 1,
        OnRecordAfterUpdateSuccess: 1,
        OnModelValidate: 1,
        OnRecordValidate: 1,
        OnRecordEnrich: 1,
      },
    },
    {
      name: "OnRecordUpdateRequest tx body write check",
      method: "PATCH",
      url: "/api/collections/demo2/records/0yxhwia2amd8gec",
      body: `{"title":"new"}`,
      headers: { Authorization: superuserToken },
      beforeTest: async (app) => {
        app.OnRecordUpdateRequest().BindFunc(async (event) => {
          const original = event.App;
          return await event.App.RunInTransaction(async (txApp) => {
            event.App = txApp;
            try {
              const result = await event.Next();
              if (result instanceof Error) {
                return result;
              }
              return event.BadRequestError("TX_ERROR", null) as unknown as Error;
            } finally {
              event.App = original;
            }
          });
        });
      },
      expectedStatus: 400,
      expectedEvents: { OnRecordUpdateRequest: 1 },
      expectedContent: ["TX_ERROR"],
    },
    {
      name: "try to change the id of an existing record",
      method: "PATCH",
      url: "/api/collections/demo3/records/mk5fmymtx4wsprk",
      body: `{
        "id": "mk5fmymtx4wspra"
      }`,
      headers: { Authorization: superuserToken },
      expectedStatus: 400,
      expectedContent: ['"data":{', '"id":{"code":"validation_pk_change"'],
      expectedEvents: {
        "*": 0,
        OnRecordUpdateRequest: 1,
        OnModelUpdate: 1,
        OnModelValidate: 1,
        OnModelAfterUpdateError: 1,
        OnRecordUpdate: 1,
        OnRecordValidate: 1,
        OnRecordAfterUpdateError: 1,
      },
    },
    {
      name: "unique field error check",
      method: "PATCH",
      url: "/api/collections/demo2/records/llvuca81nly1qls",
      body: `{
        "title":"test2"
      }`,
      expectedStatus: 400,
      expectedContent: ['"data":{', '"title":{', '"code":"validation_not_unique"'],
      expectedEvents: {
        "*": 0,
        OnRecordUpdateRequest: 1,
        OnModelUpdate: 1,
        OnModelUpdateExecute: 1,
        OnModelAfterUpdateError: 1,
        OnRecordUpdate: 1,
        OnRecordUpdateExecute: 1,
        OnRecordAfterUpdateError: 1,
        OnModelValidate: 1,
        OnRecordValidate: 1,
      },
    },

    // check whether if @request.body modifer fields are properly resolved
    // -----------------------------------------------------------
    {
      name: "@request.body.field with compute modifers (rule failure check)",
      method: "PATCH",
      url: "/api/collections/demo5/records/la4y2w4o98acwuj",
      body: `{
        "total+":3,
        "total-":1
      }`,
      expectedStatus: 404,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "@request.body.field with compute modifers (rule pass check)",
      method: "PATCH",
      url: "/api/collections/demo5/records/la4y2w4o98acwuj",
      body: `{
        "total+":2,
        "total-":1
      }`,
      expectedStatus: 200,
      expectedContent: ['"id":"la4y2w4o98acwuj"', '"collectionName":"demo5"', '"total":3'],
      expectedEvents: {
        "*": 0,
        OnRecordUpdateRequest: 1,
        OnModelUpdate: 1,
        OnModelUpdateExecute: 1,
        OnModelAfterUpdateSuccess: 1,
        OnRecordUpdate: 1,
        OnRecordUpdateExecute: 1,
        OnRecordAfterUpdateSuccess: 1,
        OnModelValidate: 1,
        OnRecordValidate: 1,
        OnRecordEnrich: 1,
      },
    },

    // auth records
    // -----------------------------------------------------------
    {
      name: "auth record with invalid form data",
      method: "PATCH",
      url: "/api/collections/users/records/bgs820n361vj1qd",
      body: `{
        "password":"",
        "passwordConfirm":"1234560",
        "email":"invalid",
        "verified":false
      }`,
      headers: { Authorization: superuserToken },
      expectedStatus: 400,
      expectedContent: ['"data":{', '"passwordConfirm":{', '"password":{'],
      notExpectedContent: ['"email":', "verified"],
      expectedEvents: {
        "*": 0,
        OnRecordUpdateRequest: 1,
      },
    },
    {
      name: "auth record with valid form data but invalid record fields",
      method: "PATCH",
      url: "/api/collections/users/records/bgs820n361vj1qd",
      body: `{
        "password":"1234567",
        "passwordConfirm":"1234567",
        "rel":"invalid"
      }`,
      headers: { Authorization: superuserToken },
      expectedStatus: 400,
      expectedContent: ['"data":{', '"rel":{"code":', '"password":{"code":'],
      expectedEvents: {
        "*": 0,
        OnRecordUpdateRequest: 1,
        OnModelUpdate: 1,
        OnModelValidate: 1,
        OnModelAfterUpdateError: 1,
        OnRecordUpdate: 1,
        OnRecordValidate: 1,
        OnRecordAfterUpdateError: 1,
      },
    },
    {
      name: "try to change account managing fields by guest",
      method: "PATCH",
      url: "/api/collections/nologin/records/phhq3wr65cap535",
      body: `{
        "password":"12345678",
        "passwordConfirm":"12345678",
        "emailVisibility":true,
        "verified":true
      }`,
      expectedStatus: 400,
      expectedContent: ['"data":{', '"verified":{"code":', '"oldPassword":{"code":'],
      notExpectedContent: ['"emailVisibility":{"code":'],
      expectedEvents: {
        "*": 0,
        OnRecordUpdateRequest: 1,
      },
    },
    {
      name: "try to change account managing fields by auth record (owner)",
      method: "PATCH",
      url: "/api/collections/users/records/4q1xlclmfloku33",
      headers: { Authorization: regularUserToken },
      body: `{
        "password":"12345678",
        "passwordConfirm":"12345678",
        "emailVisibility":true,
        "verified":true
      }`,
      expectedStatus: 400,
      expectedContent: ['"data":{', '"verified":{"code":', '"oldPassword":{"code":'],
      notExpectedContent: ['"emailVisibility":{"code":'],
      expectedEvents: {
        "*": 0,
        OnRecordUpdateRequest: 1,
      },
    },
    {
      name: "try to unset/downgrade email and verified fields (owner)",
      method: "PATCH",
      url: "/api/collections/users/records/oap640cot4yru2s",
      headers: {
        Authorization:
          "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6Im9hcDY0MGNvdDR5cnUycyIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.GfJo6EHIobgas_AXt-M-tj5IoQendPnrkMSe9ExuSEY",
      },
      body: `{
        "email":"",
        "verified":false
      }`,
      expectedStatus: 400,
      expectedContent: ['"data":{', '"email":{"code":', '"verified":{"code":'],
      expectedEvents: {
        "*": 0,
        OnRecordUpdateRequest: 1,
      },
    },
    {
      name: "try to change account managing fields by auth record with managing rights",
      method: "PATCH",
      url: "/api/collections/nologin/records/phhq3wr65cap535",
      body: `{
        "email":"new@example.com",
        "password":"12345678",
        "passwordConfirm":"12345678",
        "name":"test_name",
        "emailVisibility":true,
        "verified":true
      }`,
      headers: { Authorization: regularUserToken },
      expectedStatus: 200,
      expectedContent: ['"email":"new@example.com"', '"name":"test_name"', '"emailVisibility":true', '"verified":true'],
      notExpectedContent: ['"tokenKey"', '"password"', '"passwordConfirm"'],
      expectedEvents: {
        "*": 0,
        OnRecordUpdateRequest: 1,
        OnModelUpdate: 1,
        OnModelUpdateExecute: 1,
        OnModelAfterUpdateSuccess: 1,
        OnRecordUpdate: 1,
        OnRecordUpdateExecute: 1,
        OnRecordAfterUpdateSuccess: 1,
        OnModelValidate: 1,
        OnRecordValidate: 1,
        OnRecordEnrich: 1,
      },
      afterTest: (app) => {
        const record = app.FindRecordById("nologin", "phhq3wr65cap535");
        if (!record || !record.ValidatePassword("12345678")) {
          throw new Error("Password update failed.");
        }
      },
    },
    {
      name: "update auth record with valid data by superuser",
      method: "PATCH",
      url: "/api/collections/users/records/oap640cot4yru2s",
      body: `{
        "username":"test.valid",
        "email":"new@example.com",
        "password":"12345678",
        "passwordConfirm":"12345678",
        "rel":"achvryl401bhse3",
        "emailVisibility":true,
        "verified":false
      }`,
      headers: { Authorization: superuserToken },
      expectedStatus: 200,
      expectedContent: [
        '"username":"test.valid"',
        '"email":"new@example.com"',
        '"rel":"achvryl401bhse3"',
        '"emailVisibility":true',
        '"verified":false',
      ],
      notExpectedContent: ['"tokenKey"', '"password"'],
      expectedEvents: {
        "*": 0,
        OnRecordUpdateRequest: 1,
        OnModelUpdate: 1,
        OnModelUpdateExecute: 1,
        OnModelAfterUpdateSuccess: 1,
        OnRecordUpdate: 1,
        OnRecordUpdateExecute: 1,
        OnRecordAfterUpdateSuccess: 1,
        OnModelValidate: 1,
        OnRecordValidate: 1,
        OnRecordEnrich: 1,
      },
      afterTest: (app) => {
        const record = app.FindRecordById("users", "oap640cot4yru2s");
        if (!record || !record.ValidatePassword("12345678")) {
          throw new Error("Password update failed.");
        }
      },
    },
    {
      name: "update auth record with valid data by guest (empty update filter + auth origins check)",
      method: "PATCH",
      url: "/api/collections/nologin/records/dc49k6jgejn40h3",
      body: `{
        "username":"test_new",
        "emailVisibility":true,
        "name":"test"
      }`,
      beforeTest: async (app) => {
        const nologin = app.findCollectionByNameOrId("nologin");
        if (!nologin) {
          throw new Error("missing nologin collection");
        }
        for (let i = 0; i < 3; i += 1) {
          const origin = NewAuthOrigin(app);
          origin.SetCollectionRef(nologin.Id);
          origin.SetRecordRef("dc49k6jgejn40h3");
          origin.SetFingerprint(`abc_${i}`);
          const err = await app.Save(origin);
          if (err) {
            throw err;
          }
        }
      },
      expectedStatus: 200,
      expectedContent: [
        '"username":"test_new"',
        '"email":"test@example.com"',
        '"emailVisibility":true',
        '"verified":false',
        '"name":"test"',
      ],
      notExpectedContent: ['"tokenKey"', '"password"', '"passwordConfirm"'],
      expectedEvents: {
        "*": 0,
        OnRecordUpdateRequest: 1,
        OnModelUpdate: 1,
        OnModelUpdateExecute: 1,
        OnModelAfterUpdateSuccess: 1,
        OnRecordUpdate: 1,
        OnRecordUpdateExecute: 1,
        OnRecordAfterUpdateSuccess: 1,
        OnModelValidate: 1,
        OnRecordValidate: 1,
        OnRecordEnrich: 1,
      },
      afterTest: (app) => {
        const record = app.FindRecordById("nologin", "dc49k6jgejn40h3");
        if (!record) {
          throw new Error("missing nologin record");
        }
        const devices = app.FindAllAuthOriginsByRecord(record);
        if (devices.length !== 3) {
          throw new Error(`Expected 3 auth origins, got ${devices.length}`);
        }
      },
    },
    {
      name: "success password change with oldPassword (+authOrigins reset check)",
      method: "PATCH",
      url: "/api/collections/nologin/records/dc49k6jgejn40h3",
      body: `{
        "password":"123456789",
        "passwordConfirm":"123456789",
        "oldPassword":"1234567890"
      }`,
      beforeTest: async (app) => {
        const nologin = app.findCollectionByNameOrId("nologin");
        if (!nologin) {
          throw new Error("missing nologin collection");
        }
        for (let i = 0; i < 3; i += 1) {
          const origin = NewAuthOrigin(app);
          origin.SetCollectionRef(nologin.Id);
          origin.SetRecordRef("dc49k6jgejn40h3");
          origin.SetFingerprint(`abc_${i}`);
          const err = await app.Save(origin);
          if (err) {
            throw err;
          }
        }
      },
      expectedStatus: 200,
      expectedContent: ['"id":"dc49k6jgejn40h3"'],
      notExpectedContent: ['"tokenKey"', '"password"', '"passwordConfirm"'],
      expectedEvents: {
        "*": 0,
        OnRecordUpdateRequest: 1,
        OnModelUpdate: 1,
        OnModelUpdateExecute: 1,
        OnModelAfterUpdateSuccess: 1,
        OnRecordUpdate: 1,
        OnRecordUpdateExecute: 1,
        OnRecordAfterUpdateSuccess: 1,
        OnModelValidate: 1,
        OnRecordValidate: 1,
        OnRecordEnrich: 1,
        OnModelDelete: 3,
        OnModelDeleteExecute: 3,
        OnModelAfterDeleteSuccess: 3,
        OnRecordDelete: 3,
        OnRecordDeleteExecute: 3,
        OnRecordAfterDeleteSuccess: 3,
      },
      afterTest: (app) => {
        const record = app.FindRecordById("nologin", "dc49k6jgejn40h3");
        if (!record || !record.ValidatePassword("123456789")) {
          throw new Error("Password update failed.");
        }
        const devices = app.FindAllAuthOriginsByRecord(record);
        if (devices.length > 0) {
          throw new Error(`Expected auth origins to be removed, got ${devices.length}`);
        }
      },
    },

    // ensure that hidden fields cannot be set by non-superusers
    // -----------------------------------------------------------
    {
      name: "update with hidden field as regular user",
      method: "PATCH",
      url: "/api/collections/demo3/records/1tmknxy2868d869",
      body: `{
        "title": "test_update"
      }`,
      headers: { Authorization: clientsUserToken },
      beforeTest: async (app) => {
        const collection = app.findCollectionByNameOrId("demo3");
        if (!collection) {
          throw new Error("failed to find demo3 collection");
        }
        const titleField = collection.Fields.GetByName("title");
        if (!titleField) {
          throw new Error("failed to find demo3 title field");
        }
        titleField.SetHidden(true);
        const err = await app.Save(collection);
        if (err) {
          throw err;
        }
      },
      afterTest: (app) => {
        const record = app.FindRecordById("demo3", "1tmknxy2868d869");
        if (!record) {
          throw new Error("missing demo3 record");
        }
        if (record.GetString("title") !== "test1") {
          throw new Error(`Expected no title change, got ${record.GetString("title")}`);
        }
      },
      expectedStatus: 200,
      expectedContent: ['"id":"1tmknxy2868d869"'],
      notExpectedContent: ['"title"'],
      expectedEvents: {
        "*": 0,
        OnRecordUpdateRequest: 1,
        OnModelUpdate: 1,
        OnModelUpdateExecute: 1,
        OnModelAfterUpdateSuccess: 1,
        OnRecordUpdate: 1,
        OnRecordUpdateExecute: 1,
        OnRecordAfterUpdateSuccess: 1,
        OnModelValidate: 1,
        OnRecordValidate: 1,
        OnRecordEnrich: 1,
      },
    },
    {
      name: "update with hidden field as superuser",
      method: "PATCH",
      url: "/api/collections/demo3/records/1tmknxy2868d869",
      body: `{
        "title": "test_update"
      }`,
      headers: { Authorization: superuserToken },
      beforeTest: async (app) => {
        const collection = app.findCollectionByNameOrId("demo3");
        if (!collection) {
          throw new Error("failed to find demo3 collection");
        }
        const titleField = collection.Fields.GetByName("title");
        if (!titleField) {
          throw new Error("failed to find demo3 title field");
        }
        titleField.SetHidden(true);
        const err = await app.Save(collection);
        if (err) {
          throw err;
        }
      },
      afterTest: (app) => {
        const record = app.FindRecordById("demo3", "1tmknxy2868d869");
        if (!record) {
          throw new Error("missing demo3 record");
        }
        if (record.GetString("title") !== "test_update") {
          throw new Error(`Expected title "test_update", got ${record.GetString("title")}`);
        }
      },
      expectedStatus: 200,
      expectedContent: ['"id":"1tmknxy2868d869"', '"title":"test_update"'],
      expectedEvents: {
        "*": 0,
        OnRecordUpdateRequest: 1,
        OnModelUpdate: 1,
        OnModelUpdateExecute: 1,
        OnModelAfterUpdateSuccess: 1,
        OnRecordUpdate: 1,
        OnRecordUpdateExecute: 1,
        OnRecordAfterUpdateSuccess: 1,
        OnModelValidate: 1,
        OnRecordValidate: 1,
        OnRecordEnrich: 1,
      },
    },

    // rate limit checks
    // -----------------------------------------------------------
    {
      name: "RateLimit rule - demo2:update",
      method: "PATCH",
      url: "/api/collections/demo2/records/0yxhwia2amd8gec",
      body: `{"title":"new"}`,
      beforeTest: async (app) => {
        app.settings().rateLimits.enabled = true;
        app.settings().rateLimits.rules = [
          { maxRequests: 100, label: "abc", duration: 1 },
          { maxRequests: 100, label: "*:update", duration: 1 },
          { maxRequests: 0, label: "demo2:update", duration: 1 },
        ];
      },
      expectedStatus: 429,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "RateLimit rule - *:update",
      method: "PATCH",
      url: "/api/collections/demo2/records/0yxhwia2amd8gec",
      body: `{"title":"new"}`,
      beforeTest: async (app) => {
        app.settings().rateLimits.enabled = true;
        app.settings().rateLimits.rules = [
          { maxRequests: 100, label: "abc", duration: 1 },
          { maxRequests: 0, label: "*:update", duration: 1 },
        ];
      },
      expectedStatus: 429,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },

    // dynamic body limit checks
    // -----------------------------------------------------------
    {
      name: "body > collection BodyLimit",
      method: "PATCH",
      url: "/api/collections/demo1/records/imy661ixudk5izi",
      body: new Uint8Array(DefaultMaxBodySize + 5 + 20 + 2 + 1),
      beforeTest: async (app) => {
        const collection = app.findCollectionByNameOrId("demo1");
        if (!collection) {
          throw new Error("failed to find demo1 collection");
        }
        const fileOneField = collection.Fields.GetByName("file_one") as FileField;
        const fileManyField = collection.Fields.GetByName("file_many") as FileField;
        const jsonField = collection.Fields.GetByName("json") as JSONField;
        fileOneField.MaxSize = 5;
        fileManyField.MaxSize = 10;
        fileManyField.MaxSelect = 2;
        jsonField.MaxSize = 2;
        const err = await app.Save(collection);
        if (err) {
          throw err;
        }
      },
      expectedStatus: 413,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "body <= collection BodyLimit",
      method: "PATCH",
      url: "/api/collections/demo1/records/imy661ixudk5izi",
      body: new Uint8Array(DefaultMaxBodySize + 5 + 20 + 2),
      beforeTest: async (app) => {
        const collection = app.findCollectionByNameOrId("demo1");
        if (!collection) {
          throw new Error("failed to find demo1 collection");
        }
        const fileOneField = collection.Fields.GetByName("file_one") as FileField;
        const fileManyField = collection.Fields.GetByName("file_many") as FileField;
        const jsonField = collection.Fields.GetByName("json") as JSONField;
        fileOneField.MaxSize = 5;
        fileManyField.MaxSize = 10;
        fileManyField.MaxSelect = 2;
        jsonField.MaxSize = 2;
        const err = await app.Save(collection);
        if (err) {
          throw err;
        }
      },
      expectedStatus: 400,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
  ];

  for (const scenario of scenarios) {
    const name = scenario.name ?? `${scenario.method}:${scenario.url}`;
    it(name, async () => {
      await runApiScenario(scenario);
    });
  }
});
