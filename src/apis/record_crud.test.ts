// Ported from pocketbase/apis/record_crud_test.go
// Note: create/update coverage is still partial.

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { TestApp } from "../../tests/test_app.ts";
import { runApiScenario, type ApiScenario } from "../../tests/api.ts";
import { startTestServer } from "../../tests/helpers.ts";
import { NewRecord } from "../core/record.ts";

type StartedServer = Awaited<ReturnType<typeof startTestServer>>;

const regularUserToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.ZT3F0Z3iM-xbGgSG3LEKiEzHrPHr8t8IuHLZGGNuxLo";
const superuserToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY";
const clientsUserToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6ImdrMzkwcWVnczR5NDd3biIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoidjg1MXE0cjc5MHJoa25sIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.0ONnm_BsvPRZyDNT31GN1CKUB6uQRxvVvQ-Wc9AZfG0";
const nologinUserToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6ImRjNDlrNmpnZWpuNDBoMyIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoia3B2NzA5c2sybHFicWs4IiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.fdUPFLDx5b6RM_XFqnqsyiyNieyKA2HIIkRmUh9kIoY";

const queryEscape = encodeURIComponent;

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
      beforeTest: (app) => {
        const collection = app.findCollectionByNameOrId("demo3");
        if (!collection) {
          throw new Error("Missing demo3 collection");
        }
        collection.Fields.GetByName("title")?.SetHidden(true);
        collection.listRule = "title ~ 'test'";
        const err = app.Save(collection);
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
      beforeTest: (app) => {
        const collection = app.findCollectionByNameOrId("demo3");
        if (!collection) {
          throw new Error("Missing demo3 collection");
        }
        collection.Fields.GetByName("title")?.SetHidden(true);
        const err = app.Save(collection);
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
      beforeTest: (app) => {
        const collection = app.findCollectionByNameOrId("demo3");
        if (!collection) {
          throw new Error("Missing demo3 collection");
        }
        collection.Fields.GetByName("title")?.SetHidden(true);
        const err = app.Save(collection);
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
      beforeTest: (app) => {
        app.OnRecordsListRequest().BindFunc((event) => {
          const original = event.App;
          return event.App.RunInTransaction((txApp) => {
            event.App = txApp;
            try {
              const result = event.Next();
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
      beforeTest: (app) => {
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
      beforeTest: (app) => {
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
      beforeTest: (app) => {
        app.OnRecordViewRequest().BindFunc((event) => {
          const original = event.App;
          return event.App.RunInTransaction((txApp) => {
            event.App = txApp;
            try {
              const result = event.Next();
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
      beforeTest: (app) => {
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
      beforeTest: (app) => {
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
      beforeTest: (app) => {
        app.OnRecordDeleteRequest().BindFunc((event) => {
          const original = event.App;
          return event.App.RunInTransaction((txApp) => {
            event.App = txApp;
            try {
              const result = event.Next();
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
      beforeTest: (app) => {
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
      beforeTest: (app) => {
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

describe("record CRUD write", () => {
  let server: StartedServer["server"];
  let baseUrl = "";
  let cleanup: StartedServer["cleanup"] | null = null;

  beforeEach(async () => {
    const started = await startTestServer();
    server = started.server;
    baseUrl = started.baseUrl;
    cleanup = started.cleanup;
  });

  afterEach(async () => {
    await server?.stop();
    return cleanup?.();
  });

  it("creates records (basic cases)", async () => {
    const missing = await fetch(`${baseUrl}/api/collections/missing/records`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "new" }),
    });
    expect(missing.status).toBe(404);

    const forbidden = await fetch(`${baseUrl}/api/collections/demo1/records`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "new" }),
    });
    expect(forbidden.status).toBe(403);

    const view = await fetch(`${baseUrl}/api/collections/view1/records`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "new" }),
    });
    expect(view.status).toBe(400);

    const invalid = await fetch(`${baseUrl}/api/collections/demo2/records`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"',
    });
    expect(invalid.status).toBe(400);

    const created = await fetch(`${baseUrl}/api/collections/demo2/records`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "new" }),
    });
    expect(created.status).toBe(200);
    const createdBody = (await created.json()) as { id?: string; title?: string };
    expect(createdBody.id).toBeTruthy();
    expect(createdBody.title).toBe("new");
  });

  it("updates records (basic cases)", async () => {
    const missing = await fetch(`${baseUrl}/api/collections/missing/records/0yxhwia2amd8gec`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "new" }),
    });
    expect(missing.status).toBe(404);

    const forbidden = await fetch(`${baseUrl}/api/collections/demo1/records/imy661ixudk5izi`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "new" }),
    });
    expect(forbidden.status).toBe(403);

    const view = await fetch(`${baseUrl}/api/collections/view1/records/imy661ixudk5izi`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "new" }),
    });
    expect(view.status).toBe(400);

    const invalid = await fetch(`${baseUrl}/api/collections/demo2/records/0yxhwia2amd8gec`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: '{"',
    });
    expect(invalid.status).toBe(400);

    const updated = await fetch(`${baseUrl}/api/collections/demo2/records/0yxhwia2amd8gec`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(updated.status).toBe(200);
  });

  it("deletes records (basic cases)", async () => {
    const missing = await fetch(`${baseUrl}/api/collections/missing/records/0yxhwia2amd8gec`, {
      method: "DELETE",
    });
    expect(missing.status).toBe(404);

    const forbidden = await fetch(`${baseUrl}/api/collections/demo1/records/imy661ixudk5izi`, {
      method: "DELETE",
      headers: { Authorization: regularUserToken },
    });
    expect(forbidden.status).toBe(403);

    const view = await fetch(`${baseUrl}/api/collections/view1/records/imy661ixudk5izi`, {
      method: "DELETE",
    });
    expect(view.status).toBe(400);

    const deleted = await fetch(`${baseUrl}/api/collections/demo2/records/0yxhwia2amd8gec`, {
      method: "DELETE",
      headers: { Authorization: superuserToken },
    });
    expect(deleted.status).toBe(204);
  });
});
