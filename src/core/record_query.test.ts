// Ported from pocketbase/core/record_query_test.go.

import { describe, expect, it } from "bun:test";
import type { RequestInfo } from "./event_request.ts";
import type { RecordQueryFilter } from "./record_query.ts";
import { newTestApp } from "../tests/app.ts";
import { findSingleColumnUniqueIndex } from "../tools/dbutils/index.ts";
import { HashExp, Like, Not } from "../tools/dbx/expr.ts";
import { Collection, CollectionNameSuperusers } from "./collection.ts";
import { FieldNameEmail, Record as RecordModel } from "./record.ts";
import { BaseRecordProxy } from "./record_proxy.ts";
import { TokenTypeAuth, TokenTypeFile } from "./record_tokens.ts";

describe("RecordQuery", () => {
  it("handles different collection inputs", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const collection = app.findCollectionByNameOrId("demo1");
      if (!collection) {
        throw new Error("Missing demo1 collection");
      }

      const collectionClone = new Collection(collection);

      const scenarios = [
        { name: "with null value", collection: null, expectedTotal: 0, expectError: true },
        {
          name: "with invalid or missing collection id/name",
          collection: "missing",
          expectedTotal: 0,
          expectError: true,
        },
        { name: "with model", collection, expectedTotal: 3, expectError: false },
        {
          name: "with cloned model",
          collection: collectionClone,
          expectedTotal: 3,
          expectError: false,
        },
        { name: "with name", collection: "demo1", expectedTotal: 3, expectError: false },
        { name: "with id", collection: "wsmn24bux7wo113", expectedTotal: 3, expectError: false },
      ];

      for (const scenario of scenarios) {
        let records: RecordModel[] = [];
        let err: Error | null = null;

        try {
          records = app.RecordQuery(scenario.collection).All() as RecordModel[];
        } catch (caught) {
          err = caught as Error;
        }

        const hasErr = err !== null;
        if (hasErr && !scenario.expectError) {
        }
        expect(hasErr).toBe(scenario.expectError);

        if (!hasErr) {
          expect(records.length).toBe(scenario.expectedTotal);
        }
      }
    } finally {
      await cleanup();
    }
  });

  it("loads single records into targets", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      class MockProxy extends BaseRecordProxy {}

      const collection = app.findCollectionByNameOrId("demo1");
      if (!collection) {
        throw new Error("Missing demo1 collection");
      }

      const recordId = "84nmscqy84lsi1t";
      const query = app.RecordQuery(collection).Where(HashExp({ id: recordId }));

      const record = query.One() as RecordModel;
      expect(record.Id).toBe(recordId);

      const proxy = new MockProxy();
      query.One(proxy);
      expect(proxy.ProxyRecord().Id).toBe(recordId);

      const custom = { id: "" };
      query.One(custom);
      expect(custom.id).toBe(recordId);
    } finally {
      await cleanup();
    }
  });

  it("loads record slices into targets", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      class MockProxy extends BaseRecordProxy {}

      const collection = app.findCollectionByNameOrId("demo1");
      if (!collection) {
        throw new Error("Missing demo1 collection");
      }

      const recordIds = ["84nmscqy84lsi1t", "al1h9ijdeojtsjy"];
      const query = app.RecordQuery(collection).Where(HashExp({ id: recordIds }));

      const records = query.All() as RecordModel[];
      expect(records.length).toBe(recordIds.length);
      for (const id of recordIds) {
        expect(records.some((r) => r.Id === id)).toBe(true);
      }

      const proxies = [new MockProxy()];
      query.All(proxies);
      expect(proxies.length).toBe(recordIds.length);
      for (const id of recordIds) {
        expect(proxies.some((proxy) => proxy.ProxyRecord().Id === id)).toBe(true);
      }

      const customs = [{ id: "" }];
      query.All(customs);
      expect(customs.length).toBe(recordIds.length);
      for (const id of recordIds) {
        expect(customs.some((item) => item.id === id)).toBe(true);
      }
    } finally {
      await cleanup();
    }
  });
});

describe("FindRecordById", () => {
  it("finds records by id with optional filters", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const byTitle =
        (title: string): RecordQueryFilter =>
        (q) => {
          q.AndWhere({ title });
          return null;
        };

      const byActive =
        (active: boolean): RecordQueryFilter =>
        (q) => {
          q.AndWhere({ active });
          return null;
        };

      const errFilter: RecordQueryFilter = () => new Error("test error");

      const scenarios: Array<{
        collectionIdOrName: string;
        id: string;
        filters: Array<RecordQueryFilter | null | undefined>;
        expectError: boolean;
      }> = [
        { collectionIdOrName: "demo2", id: "missing", filters: [], expectError: true },
        { collectionIdOrName: "missing", id: "0yxhwia2amd8gec", filters: [], expectError: true },
        { collectionIdOrName: "demo2", id: "0yxhwia2amd8gec", filters: [], expectError: false },
        { collectionIdOrName: "demo2", id: "0yxhwia2amd8gec", filters: [], expectError: false },
        {
          collectionIdOrName: "demo2",
          id: "0yxhwia2amd8gec",
          filters: [null, null],
          expectError: false,
        },
        {
          collectionIdOrName: "demo2",
          id: "0yxhwia2amd8gec",
          filters: [null, () => null],
          expectError: false,
        },
        {
          collectionIdOrName: "demo2",
          id: "0yxhwia2amd8gec",
          filters: [byTitle("missing")],
          expectError: true,
        },
        {
          collectionIdOrName: "demo2",
          id: "0yxhwia2amd8gec",
          filters: [errFilter],
          expectError: true,
        },
        {
          collectionIdOrName: "demo2",
          id: "0yxhwia2amd8gec",
          filters: [byTitle("test3")],
          expectError: false,
        },
        {
          collectionIdOrName: "demo2",
          id: "0yxhwia2amd8gec",
          filters: [byTitle("test3"), null],
          expectError: false,
        },
        {
          collectionIdOrName: "demo2",
          id: "0yxhwia2amd8gec",
          filters: [byTitle("test3"), byActive(false)],
          expectError: true,
        },
        {
          collectionIdOrName: "sz5l5z67tg7gku0",
          id: "0yxhwia2amd8gec",
          filters: [byTitle("test3"), byActive(true)],
          expectError: false,
        },
      ];

      for (const scenario of scenarios) {
        let record = null as ReturnType<typeof app.FindRecordById> | null;
        let err: Error | null = null;

        try {
          record = app.FindRecordById(scenario.collectionIdOrName, scenario.id, ...scenario.filters);
        } catch (caught) {
          err = caught as Error;
        }

        const hasErr = err !== null;
        if (hasErr && !scenario.expectError) {
        }
        expect(hasErr).toBe(scenario.expectError);

        if (!hasErr && record) {
          expect(record.Id).toBe(scenario.id);
        }
      }
    } finally {
      await cleanup();
    }
  });
});

describe("FindRecordsByIds", () => {
  it("returns records by ids with optional filters", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const byActive =
        (active: boolean): RecordQueryFilter =>
        (q) => {
          q.AndWhere(HashExp({ active }));
          return null;
        };

      const notEmptyTitle: RecordQueryFilter = (q) => {
        q.AndWhere(Not(HashExp({ title: "" })));
        return null;
      };

      const errFilter: RecordQueryFilter = () => new Error("test error");

      const scenarios = [
        {
          collectionIdOrName: "demo2",
          ids: [] as string[],
          filters: [],
          expectTotal: 0,
          expectError: false,
        },
        { collectionIdOrName: "demo2", ids: [""], filters: [], expectTotal: 0, expectError: false },
        {
          collectionIdOrName: "demo2",
          ids: ["missing"],
          filters: [],
          expectTotal: 0,
          expectError: false,
        },
        {
          collectionIdOrName: "missing",
          ids: ["0yxhwia2amd8gec"],
          filters: [],
          expectTotal: 0,
          expectError: true,
        },
        {
          collectionIdOrName: "demo2",
          ids: ["0yxhwia2amd8gec"],
          filters: [],
          expectTotal: 1,
          expectError: false,
        },
        {
          collectionIdOrName: "sz5l5z67tg7gku0",
          ids: ["0yxhwia2amd8gec"],
          filters: [],
          expectTotal: 1,
          expectError: false,
        },
        {
          collectionIdOrName: "demo2",
          ids: ["0yxhwia2amd8gec", "llvuca81nly1qls"],
          filters: [],
          expectTotal: 2,
          expectError: false,
        },
        {
          collectionIdOrName: "demo2",
          ids: ["0yxhwia2amd8gec", "llvuca81nly1qls"],
          filters: [],
          expectTotal: 2,
          expectError: false,
        },
        {
          collectionIdOrName: "demo2",
          ids: ["0yxhwia2amd8gec", "llvuca81nly1qls"],
          filters: [null, null],
          expectTotal: 2,
          expectError: false,
        },
        {
          collectionIdOrName: "demo2",
          ids: ["0yxhwia2amd8gec", "llvuca81nly1qls"],
          filters: [() => null],
          expectTotal: 2,
          expectError: false,
        },
        {
          collectionIdOrName: "demo2",
          ids: ["0yxhwia2amd8gec", "llvuca81nly1qls"],
          filters: [() => null, errFilter],
          expectTotal: 0,
          expectError: true,
        },
        {
          collectionIdOrName: "demo2",
          ids: ["0yxhwia2amd8gec", "llvuca81nly1qls"],
          filters: [byActive(true), null],
          expectTotal: 1,
          expectError: false,
        },
        {
          collectionIdOrName: "sz5l5z67tg7gku0",
          ids: ["0yxhwia2amd8gec", "llvuca81nly1qls"],
          filters: [byActive(true), notEmptyTitle],
          expectTotal: 1,
          expectError: false,
        },
      ];

      for (const scenario of scenarios) {
        let records: RecordModel[] = [];
        let err: Error | null = null;

        try {
          records = app.FindRecordsByIds(scenario.collectionIdOrName, scenario.ids, ...scenario.filters);
        } catch (caught) {
          err = caught as Error;
        }

        const hasErr = err !== null;
        if (hasErr && !scenario.expectError) {
        }
        expect(hasErr).toBe(scenario.expectError);

        if (!hasErr) {
          expect(records.length).toBe(scenario.expectTotal);
          for (const record of records) {
            expect(scenario.ids.includes(record.Id)).toBe(true);
          }
        }
      }
    } finally {
      await cleanup();
    }
  });
});

describe("FindAllRecords", () => {
  it("returns records matching expressions", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scenarios = [
        {
          collectionIdOrName: "missing",
          expressions: [] as any[],
          expectIds: [] as string[],
          expectError: true,
        },
        {
          collectionIdOrName: "demo2",
          expressions: [] as any[],
          expectIds: ["achvryl401bhse3", "llvuca81nly1qls", "0yxhwia2amd8gec"],
          expectError: false,
        },
        {
          collectionIdOrName: "demo2",
          expressions: [null, HashExp({ id: "123" })],
          expectIds: [],
          expectError: false,
        },
        {
          collectionIdOrName: "sz5l5z67tg7gku0",
          expressions: [Like("title", "test").Match(true, true), HashExp({ active: true })],
          expectIds: ["achvryl401bhse3", "0yxhwia2amd8gec"],
          expectError: false,
        },
      ];

      for (const scenario of scenarios) {
        let records: RecordModel[] = [];
        let err: Error | null = null;

        try {
          records = app.FindAllRecords(scenario.collectionIdOrName, ...scenario.expressions);
        } catch (caught) {
          err = caught as Error;
        }

        const hasErr = err !== null;
        if (hasErr && !scenario.expectError) {
        }
        expect(hasErr).toBe(scenario.expectError);

        if (!hasErr) {
          expect(records.length).toBe(scenario.expectIds.length);
          for (const record of records) {
            expect(scenario.expectIds.includes(record.Id)).toBe(true);
          }
        }
      }
    } finally {
      await cleanup();
    }
  });
});

describe("FindFirstRecordByData", () => {
  it("returns the first matching record", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scenarios = [
        {
          collectionIdOrName: "missing",
          key: "id",
          value: "llvuca81nly1qls",
          expectId: "",
          expectError: true,
        },
        {
          collectionIdOrName: "demo2",
          key: "",
          value: "llvuca81nly1qls",
          expectId: "",
          expectError: true,
        },
        {
          collectionIdOrName: "demo2",
          key: "invalid_or_missing",
          value: "llvuca81nly1qls",
          expectId: "",
          expectError: true,
        },
        {
          collectionIdOrName: "demo2",
          key: "id",
          value: "invalid",
          expectId: "",
          expectError: true,
        },
        {
          collectionIdOrName: "demo2",
          key: "id",
          value: "llvuca81nly1qls",
          expectId: "llvuca81nly1qls",
          expectError: false,
        },
        {
          collectionIdOrName: "sz5l5z67tg7gku0",
          key: "title",
          value: "test3",
          expectId: "0yxhwia2amd8gec",
          expectError: false,
        },
      ];

      for (const scenario of scenarios) {
        let record: RecordModel | null = null;
        let err: Error | null = null;

        try {
          record = app.FindFirstRecordByData(scenario.collectionIdOrName, scenario.key, scenario.value);
        } catch (caught) {
          err = caught as Error;
        }

        const hasErr = err !== null;
        expect(hasErr).toBe(scenario.expectError);

        if (!hasErr && record) {
          expect(record.Id).toBe(scenario.expectId);
        }
      }
    } finally {
      await cleanup();
    }
  });
});

describe("FindRecordsByFilter", () => {
  it("returns records based on filter, sort, limit, and offset", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scenarios = [
        {
          name: "missing collection",
          collectionIdOrName: "missing",
          filter: "id != ''",
          sort: "",
          limit: 0,
          offset: 0,
          params: [] as Array<Record<string, unknown>>,
          expectError: true,
          expectRecordIds: [] as string[],
        },
        {
          name: "invalid filter",
          collectionIdOrName: "demo2",
          filter: "someMissingField > 1",
          sort: "",
          limit: 0,
          offset: 0,
          params: [],
          expectError: true,
          expectRecordIds: [] as string[],
        },
        {
          name: "empty filter",
          collectionIdOrName: "demo2",
          filter: "",
          sort: "",
          limit: 0,
          offset: 0,
          params: [],
          expectError: false,
          expectRecordIds: ["llvuca81nly1qls", "achvryl401bhse3", "0yxhwia2amd8gec"],
        },
        {
          name: "simple filter",
          collectionIdOrName: "demo2",
          filter: "id != ''",
          sort: "",
          limit: 0,
          offset: 0,
          params: [],
          expectError: false,
          expectRecordIds: ["llvuca81nly1qls", "achvryl401bhse3", "0yxhwia2amd8gec"],
        },
        {
          name: "multi-condition filter with sort",
          collectionIdOrName: "demo2",
          filter: "id != '' && active=true",
          sort: "-created,title",
          limit: -1,
          offset: 0,
          params: [],
          expectError: false,
          expectRecordIds: ["0yxhwia2amd8gec", "achvryl401bhse3"],
        },
        {
          name: "with limit and offset",
          collectionIdOrName: "sz5l5z67tg7gku0",
          filter: "id != ''",
          sort: "title",
          limit: 2,
          offset: 1,
          params: [],
          expectError: false,
          expectRecordIds: ["achvryl401bhse3", "0yxhwia2amd8gec"],
        },
        {
          name: "with placeholder params",
          collectionIdOrName: "demo2",
          filter: "active = {:active}",
          sort: "",
          limit: 10,
          offset: 0,
          params: [{ active: false }],
          expectError: false,
          expectRecordIds: ["llvuca81nly1qls"],
        },
        {
          name: "with json filter and sort",
          collectionIdOrName: "demo4",
          filter: "json_object != null && json_object.a.b = 'test'",
          sort: "-json_object.a",
          limit: 10,
          offset: 0,
          params: [{ active: false }],
          expectError: false,
          expectRecordIds: ["i9naidtvr6qsgb4"],
        },
      ];

      for (const scenario of scenarios) {
        let records: RecordModel[] = [];
        let err: Error | null = null;

        try {
          records = app.FindRecordsByFilter(
            scenario.collectionIdOrName,
            scenario.filter,
            scenario.sort,
            scenario.limit,
            scenario.offset,
            ...scenario.params,
          );
        } catch (caught) {
          err = caught as Error;
        }

        const hasErr = err !== null;
        expect(hasErr).toBe(scenario.expectError);

        if (!hasErr) {
          expect(records.length).toBe(scenario.expectRecordIds.length);
          for (const [index, id] of scenario.expectRecordIds.entries()) {
            expect(records[index]?.Id).toBe(id);
          }
        }
      }
    } finally {
      await cleanup();
    }
  });
});

describe("FindFirstRecordByFilter", () => {
  it("returns the first matching record", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scenarios = [
        {
          name: "missing collection",
          collectionIdOrName: "missing",
          filter: "id != ''",
          params: [] as Array<Record<string, unknown>>,
          expectError: true,
          expectRecordId: "",
        },
        {
          name: "invalid filter",
          collectionIdOrName: "demo2",
          filter: "someMissingField > 1",
          params: [],
          expectError: true,
          expectRecordId: "",
        },
        {
          name: "empty filter",
          collectionIdOrName: "demo2",
          filter: "",
          params: [],
          expectError: false,
          expectRecordId: "llvuca81nly1qls",
        },
        {
          name: "valid filter but no matches",
          collectionIdOrName: "demo2",
          filter: "id = 'test'",
          params: [],
          expectError: true,
          expectRecordId: "",
        },
        {
          name: "valid filter and multiple matches",
          collectionIdOrName: "sz5l5z67tg7gku0",
          filter: "id != ''",
          params: [],
          expectError: false,
          expectRecordId: "llvuca81nly1qls",
        },
        {
          name: "with placeholder params",
          collectionIdOrName: "demo2",
          filter: "active = {:active}",
          params: [{ active: false }],
          expectError: false,
          expectRecordId: "llvuca81nly1qls",
        },
      ];

      for (const scenario of scenarios) {
        let record: RecordModel | null = null;
        let err: Error | null = null;

        try {
          record = app.FindFirstRecordByFilter(scenario.collectionIdOrName, scenario.filter, ...scenario.params);
        } catch (caught) {
          err = caught as Error;
        }

        const hasErr = err !== null;
        expect(hasErr).toBe(scenario.expectError);

        if (!hasErr && record) {
          expect(record.Id).toBe(scenario.expectRecordId);
        }
      }
    } finally {
      await cleanup();
    }
  });
});

describe("CountRecords", () => {
  it("counts records matching expressions", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scenarios = [
        {
          name: "missing collection",
          collectionIdOrName: "missing",
          expressions: [] as any[],
          expectTotal: 0,
          expectError: true,
        },
        {
          name: "valid collection name",
          collectionIdOrName: "demo2",
          expressions: [] as any[],
          expectTotal: 3,
          expectError: false,
        },
        {
          name: "valid collection id",
          collectionIdOrName: "sz5l5z67tg7gku0",
          expressions: [] as any[],
          expectTotal: 3,
          expectError: false,
        },
        {
          name: "nil expression",
          collectionIdOrName: "demo2",
          expressions: [null],
          expectTotal: 3,
          expectError: false,
        },
        {
          name: "no matches",
          collectionIdOrName: "demo2",
          expressions: [null, Like("title", "missing").Match(true, true), HashExp({ active: true })],
          expectTotal: 0,
          expectError: false,
        },
        {
          name: "with matches",
          collectionIdOrName: "demo2",
          expressions: [null, Like("title", "test").Match(true, true), HashExp({ active: true })],
          expectTotal: 2,
          expectError: false,
        },
      ];

      for (const scenario of scenarios) {
        let total = 0;
        let err: Error | null = null;

        try {
          total = app.CountRecords(scenario.collectionIdOrName, ...scenario.expressions);
        } catch (caught) {
          err = caught as Error;
        }

        const hasErr = err !== null;
        expect(hasErr).toBe(scenario.expectError);

        if (!hasErr) {
          expect(total).toBe(scenario.expectTotal);
        }
      }
    } finally {
      await cleanup();
    }
  });
});

describe("FindAuthRecordByToken", () => {
  it("validates auth tokens and types", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scenarios = [
        { name: "empty token", token: "", types: null, expectedId: "" },
        { name: "invalid token", token: "invalid", types: null, expectedId: "" },
        {
          name: "expired token",
          token:
            "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoxNjQwOTkxNjYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.2D3tmqPn3vc5LoqqCz8V-iCDVXo9soYiH0d32G7FQT4",
          types: null,
          expectedId: "",
        },
        {
          name: "valid auth token",
          token:
            "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.ZT3F0Z3iM-xbGgSG3LEKiEzHrPHr8t8IuHLZGGNuxLo",
          types: null,
          expectedId: "4q1xlclmfloku33",
        },
        {
          name: "valid verification token",
          token:
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImRjNDlrNmpnZWpuNDBoMyIsImV4cCI6MjUyNDYwNDQ2MSwidHlwZSI6InZlcmlmaWNhdGlvbiIsImNvbGxlY3Rpb25JZCI6ImtwdjcwOXNrMmxxYnFrOCIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSJ9.5GmuZr4vmwk3Cb_3ZZWNxwbE75KZC-j71xxIPR9AsVw",
          types: null,
          expectedId: "dc49k6jgejn40h3",
        },
        {
          name: "auth token with file type only check",
          token:
            "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.ZT3F0Z3iM-xbGgSG3LEKiEzHrPHr8t8IuHLZGGNuxLo",
          types: [TokenTypeFile],
          expectedId: "",
        },
        {
          name: "auth token with file and auth type check",
          token:
            "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.ZT3F0Z3iM-xbGgSG3LEKiEzHrPHr8t8IuHLZGGNuxLo",
          types: [TokenTypeFile, TokenTypeAuth],
          expectedId: "4q1xlclmfloku33",
        },
      ];

      for (const scenario of scenarios) {
        let record = null as ReturnType<typeof app.FindAuthRecordByToken> | null;
        let err: Error | null = null;

        try {
          record = app.FindAuthRecordByToken(scenario.token, ...(scenario.types ?? []));
        } catch (caught) {
          err = caught as Error;
        }

        const hasErr = err !== null;
        const expectErr = scenario.expectedId === "";
        expect(hasErr).toBe(expectErr);

        if (!hasErr && record) {
          expect(record.Id).toBe(scenario.expectedId);
        }
      }
    } finally {
      await cleanup();
    }
  });
});

describe("FindAuthRecordByEmail", () => {
  it("respects collection auth and nocase indexes", async () => {
    const scenarios = [
      {
        collectionIdOrName: "missing",
        email: "test@example.com",
        nocaseIndex: false,
        expectError: true,
      },
      {
        collectionIdOrName: "demo2",
        email: "test@example.com",
        nocaseIndex: false,
        expectError: true,
      },
      {
        collectionIdOrName: "users",
        email: "missing@example.com",
        nocaseIndex: false,
        expectError: true,
      },
      {
        collectionIdOrName: "users",
        email: "test@example.com",
        nocaseIndex: false,
        expectError: false,
      },
      {
        collectionIdOrName: "clients",
        email: "test2@example.com",
        nocaseIndex: false,
        expectError: false,
      },
      {
        collectionIdOrName: "clients",
        email: "TeSt2@example.com",
        nocaseIndex: false,
        expectError: true,
      },
      {
        collectionIdOrName: "clients",
        email: "TeSt2@example.com",
        nocaseIndex: true,
        expectError: false,
      },
    ];

    for (const scenario of scenarios) {
      const { app, cleanup } = await newTestApp();
      try {
        const collection = app.findCollectionByNameOrId(scenario.collectionIdOrName);
        if (collection) {
          const [emailIndex, ok] = findSingleColumnUniqueIndex(collection.indexes, FieldNameEmail);
          if (ok && emailIndex.columns[0]) {
            emailIndex.columns[0].collate = scenario.nocaseIndex ? "nocase" : "";
            collection.RemoveIndex(emailIndex.indexName);
            collection.indexes = [...collection.indexes, emailIndex.build()];

            const err = await app.Save(collection);
            if (err) {
              throw err;
            }
          }
        }

        let record = null as ReturnType<typeof app.FindAuthRecordByEmail> | null;
        let err: Error | null = null;

        try {
          record = app.FindAuthRecordByEmail(scenario.collectionIdOrName, scenario.email);
        } catch (caught) {
          err = caught as Error;
        }

        const hasErr = err !== null;
        expect(hasErr).toBe(scenario.expectError);

        if (!hasErr && record) {
          expect(record.Email().toLowerCase()).toBe(scenario.email.toLowerCase());
        }
      } finally {
        await cleanup();
      }
    }
  });
});

describe("CanAccessRecord", () => {
  it("checks access rules against request info", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const superuser = app.FindAuthRecordByEmail(CollectionNameSuperusers, "test@example.com");
      const user = app.FindAuthRecordByEmail("users", "test@example.com");
      const record = app.FindRecordById("demo1", "imy661ixudk5izi");

      const baseInfo: RequestInfo = {
        query: {},
        headers: {},
        body: {},
        auth: null,
        method: "GET",
        context: "default",
      };

      const scenarios = [
        {
          name: "as superuser with nil rule",
          record,
          requestInfo: { ...baseInfo, auth: superuser },
          rule: null,
          expected: true,
          expectError: false,
        },
        {
          name: "as superuser with non-empty rule",
          record,
          requestInfo: { ...baseInfo, auth: superuser },
          rule: "id = ''",
          expected: true,
          expectError: false,
        },
        {
          name: "as superuser with invalid rule",
          record,
          requestInfo: { ...baseInfo, auth: superuser },
          rule: "id ?!@ 1",
          expected: true,
          expectError: false,
        },
        {
          name: "as guest with nil rule",
          record,
          requestInfo: { ...baseInfo },
          rule: null,
          expected: false,
          expectError: false,
        },
        {
          name: "as guest with empty rule",
          record,
          requestInfo: { ...baseInfo },
          rule: "",
          expected: true,
          expectError: false,
        },
        {
          name: "as guest with invalid rule",
          record,
          requestInfo: { ...baseInfo },
          rule: "id ?!@ 1",
          expected: false,
          expectError: true,
        },
        {
          name: "as guest with mismatched rule",
          record,
          requestInfo: { ...baseInfo },
          rule: "@request.auth.id != ''",
          expected: false,
          expectError: false,
        },
        {
          name: "as guest with matched rule",
          record,
          requestInfo: { ...baseInfo, body: { test: 1 } },
          rule: "@request.auth.id != '' || @request.body.test = 1",
          expected: true,
          expectError: false,
        },
        {
          name: "as auth record with nil rule",
          record,
          requestInfo: { ...baseInfo, auth: user },
          rule: null,
          expected: false,
          expectError: false,
        },
        {
          name: "as auth record with empty rule",
          record,
          requestInfo: { ...baseInfo, auth: user },
          rule: "",
          expected: true,
          expectError: false,
        },
        {
          name: "as auth record with invalid rule",
          record,
          requestInfo: { ...baseInfo, auth: user },
          rule: "id ?!@ 1",
          expected: false,
          expectError: true,
        },
        {
          name: "as auth record with mismatched rule",
          record,
          requestInfo: { ...baseInfo, auth: user, body: { test: 1 } },
          rule: "@request.auth.id != '' && @request.body.test > 1",
          expected: false,
          expectError: false,
        },
        {
          name: "as auth record with matched rule",
          record,
          requestInfo: { ...baseInfo, auth: user, body: { test: 2 } },
          rule: "@request.auth.id != '' && @request.body.test > 1",
          expected: true,
          expectError: false,
        },
      ];

      for (const scenario of scenarios) {
        const [result, err] = app.CanAccessRecord(scenario.record, scenario.requestInfo, scenario.rule);
        expect(result).toBe(scenario.expected);
        expect(err !== null).toBe(scenario.expectError);
      }
    } finally {
      await cleanup();
    }
  });
});
