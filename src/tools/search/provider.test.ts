// Ported from pocketbase/tools/search/provider_test.go.

import { describe, expect, it } from "bun:test";
import type { FieldResolver, QueryUpdate, ResolverResult } from "./field_resolver.ts";
import type { FilterData } from "./filter.ts";
import { DbxDatabase } from "../dbx/database.ts";
import { Provider } from "./provider.ts";
import { SimpleFieldResolver } from "./simple_field_resolver.ts";
import { SortAsc, SortDesc, type SortField } from "./sort.ts";
import {
  DefaultFilterExprLimit,
  DefaultPerPage,
  DefaultSortExprLimit,
  ErrEmptyQuery,
  ErrFilterExprLimit,
  ErrFilterLengthLimit,
  ErrSortExprLimit,
  ErrSortFieldLengthLimit,
  MaxFilterLength,
  MaxPerPage,
  MaxSortFieldLength,
} from "./types.ts";

const baseSelect = "select * from {{test}} where NOT ([[test1]] IS NULL) order by [[test1]] ASC";

class TestMutex {
  lock(): void {}
  unlock(): void {}
}

type TestRow = {
  test1: number;
  test2: string;
  test3: string;
};

function normalizeResult(result: unknown): unknown {
  if (!result || typeof result !== "object") {
    return result;
  }
  const typed = result as { items?: Array<Record<string, unknown>> };
  if (!Array.isArray(typed.items)) {
    return result;
  }
  const items = typed.items.map((item) => ({
    test1: item.test1 ?? null,
    test2: item.test2 ?? null,
    test3: item.test3 ?? null,
  }));
  return { ...(result as Record<string, unknown>), items };
}

class TestFieldResolver implements FieldResolver {
  UpdateQueryCalls = 0;
  ResolveCalls = 0;

  resolve(field: string): ResolverResult {
    this.ResolveCalls += 1;

    if (!field || field === "unknown") {
      throw new Error("test error");
    }

    return {
      identifier: `[[${field}]]`,
      params: [],
      nullFallback: "auto",
    };
  }

  updateQuery(query: QueryUpdate): QueryUpdate {
    this.UpdateQueryCalls += 1;
    return query;
  }
}

function createTestDb() {
  const db = new DbxDatabase(":memory:");
  const mu = new TestMutex();
  const longField = "a".repeat(MaxSortFieldLength);
  const longFieldOverflow = "b".repeat(MaxSortFieldLength + 1);

  db.run(
    `CREATE TABLE test (id INTEGER DEFAULT 0, test1 INTEGER DEFAULT 0, test2 TEXT DEFAULT '', test3 TEXT DEFAULT '', "${longField}" TEXT DEFAULT '', "${longFieldOverflow}" TEXT DEFAULT '')`,
  );
  db.run("insert into test (id, test1, test2) values (1, 1, 'test2.1')");
  db.run("insert into test (id, test1, test2) values (2, 2, 'test2.2')");

  const calledQueries: string[] = [];
  db.QueryLogFunc = (sql) => {
    mu.lock();
    try {
      calledQueries.push(sql);
    } finally {
      mu.unlock();
    }
  };

  return { db, calledQueries, longField, longFieldOverflow };
}

describe("search provider", () => {
  it("defaults", () => {
    const { db } = createTestDb();
    try {
      const provider = new Provider(new TestFieldResolver()).query({ select: "select * from {{test}}" });
      const result = provider.exec<TestRow>(db);

      expect(result.page).toBe(1);
      expect(result.perPage).toBe(DefaultPerPage);
      expect(result.totalItems).toBe(2);
      expect(result.totalPages).toBe(1);
    } finally {
      db.close();
    }
  });

  it("max filter expr limit", () => {
    const { db } = createTestDb();
    try {
      const provider = new Provider(new TestFieldResolver())
        .query({ select: baseSelect })
        .maxFilterExprLimit(0)
        .filter(["1=1"]);

      expect(() => provider.exec<TestRow>(db)).toThrow(ErrFilterExprLimit);
    } finally {
      db.close();
    }
  });

  it("max sort expr limit", () => {
    const { db } = createTestDb();
    try {
      const provider = new Provider(new TestFieldResolver())
        .query({ select: baseSelect })
        .maxSortExprLimit(0)
        .sort([{ name: "test1", direction: SortAsc }]);

      expect(() => provider.exec<TestRow>(db)).toThrow(ErrSortExprLimit);
    } finally {
      db.close();
    }
  });

  it("exec with empty query", () => {
    const { db } = createTestDb();
    try {
      const provider = new Provider(new TestFieldResolver());
      expect(() => provider.exec<TestRow>(db)).toThrow(ErrEmptyQuery);
    } finally {
      db.close();
    }
  });

  it("exec scenarios", () => {
    const { db, calledQueries } = createTestDb();
    try {
      const scenarios: Array<{
        name: string;
        page: number;
        perPage: number;
        sort: SortField[];
        filter: FilterData[];
        skipTotal: boolean;
        expectError: boolean;
        expectResult: string;
      }> = [
        {
          name: "page normalization",
          page: -1,
          perPage: 10,
          sort: [],
          filter: [],
          skipTotal: false,
          expectError: false,
          expectResult:
            '{"items":[{"test1":1,"test2":"test2.1","test3":""},{"test1":2,"test2":"test2.2","test3":""}],"page":1,"perPage":10,"totalItems":2,"totalPages":1}',
        },
        {
          name: "perPage normalization",
          page: 10,
          perPage: 0,
          sort: [],
          filter: [],
          skipTotal: false,
          expectError: false,
          expectResult: '{"items":[],"page":10,"perPage":30,"totalItems":2,"totalPages":1}',
        },
        {
          name: "invalid sort field",
          page: 1,
          perPage: 10,
          sort: [{ name: "unknown", direction: SortAsc }],
          filter: [],
          skipTotal: false,
          expectError: true,
          expectResult: "",
        },
        {
          name: "invalid filter",
          page: 1,
          perPage: 10,
          sort: [],
          filter: ["test2 = 'test2.1'", "invalid"],
          skipTotal: false,
          expectError: true,
          expectResult: "",
        },
        {
          name: "valid sort and filter fields",
          page: 1,
          perPage: 5555,
          sort: [{ name: "test2", direction: SortDesc }],
          filter: ["test2 != null", "test1 >= 2"],
          skipTotal: false,
          expectError: false,
          expectResult: `{"items":[{"test1":2,"test2":"test2.2","test3":""}],"page":1,"perPage":${MaxPerPage},"totalItems":1,"totalPages":1}`,
        },
        {
          name: "valid sort and filter fields (skipTotal=1)",
          page: 1,
          perPage: 5555,
          sort: [{ name: "test2", direction: SortDesc }],
          filter: ["test2 != null", "test1 >= 2"],
          skipTotal: true,
          expectError: false,
          expectResult: `{"items":[{"test1":2,"test2":"test2.2","test3":""}],"page":1,"perPage":${MaxPerPage},"totalItems":-1,"totalPages":-1}`,
        },
        {
          name: "valid sort and filter fields (zero results)",
          page: 1,
          perPage: 10,
          sort: [{ name: "test3", direction: SortAsc }],
          filter: ["test3 != ''"],
          skipTotal: false,
          expectError: false,
          expectResult: '{"items":[],"page":1,"perPage":10,"totalItems":0,"totalPages":0}',
        },
        {
          name: "valid sort and filter fields (zero results; skipTotal=1)",
          page: 1,
          perPage: 10,
          sort: [{ name: "test3", direction: SortAsc }],
          filter: ["test3 != ''"],
          skipTotal: true,
          expectError: false,
          expectResult: '{"items":[],"page":1,"perPage":10,"totalItems":-1,"totalPages":-1}',
        },
        {
          name: "pagination test",
          page: 2,
          perPage: 1,
          sort: [],
          filter: [],
          skipTotal: false,
          expectError: false,
          expectResult:
            '{"items":[{"test1":2,"test2":"test2.2","test3":""}],"page":2,"perPage":1,"totalItems":2,"totalPages":2}',
        },
        {
          name: "pagination test (skipTotal=1)",
          page: 2,
          perPage: 1,
          sort: [],
          filter: [],
          skipTotal: true,
          expectError: false,
          expectResult:
            '{"items":[{"test1":2,"test2":"test2.2","test3":""}],"page":2,"perPage":1,"totalItems":-1,"totalPages":-1}',
        },
      ];

      for (const scenario of scenarios) {
        calledQueries.length = 0;
        const resolver = new TestFieldResolver();

        const provider = new Provider(resolver)
          .query({ select: baseSelect })
          .page(scenario.page)
          .perPage(scenario.perPage)
          .sort(scenario.sort)
          .skipTotal(scenario.skipTotal)
          .filter(scenario.filter);

        let result: unknown = null;
        let err: unknown = null;
        try {
          result = provider.exec<TestRow>(db);
        } catch (error) {
          err = error;
        }

        const hasErr = err != null;
        if (hasErr !== scenario.expectError) {
          throw new Error(`Scenario ${scenario.name} expected error=${scenario.expectError} got ${hasErr}: ${String(err)}`);
        }

        if (hasErr) {
          continue;
        }

        expect(resolver.UpdateQueryCalls).toBe(1);

        const encoded = JSON.stringify(normalizeResult(result));
        expect(encoded).toBe(scenario.expectResult);

        const expectedQueries = scenario.skipTotal ? 1 : 2;
        expect(calledQueries.length).toBe(expectedQueries);
      }
    } finally {
      db.close();
    }
  });

  it("filter and sort limits", () => {
    const { db, longField, longFieldOverflow } = createTestDb();
    try {
      const scenarios = [
        {
          name: "<= max filter length",
          filter: ["1=2", `1='${"a".repeat(MaxFilterLength - 4)}'`],
          sort: [] as SortField[],
          maxFilterExprLimit: 1,
          maxSortExprLimit: 0,
          expectError: false,
        },
        {
          name: "> max filter length",
          filter: ["1=2", `1='${"a".repeat(MaxFilterLength - 3)}'`],
          sort: [] as SortField[],
          maxFilterExprLimit: 1,
          maxSortExprLimit: 0,
          expectError: true,
          expectErrType: ErrFilterLengthLimit,
        },
        {
          name: "<= max filter exprs",
          filter: ["1=2", "(1=1 || 1=1) && (1=1 || (1=1 || 1=1)) && (1=1)"],
          sort: [] as SortField[],
          maxFilterExprLimit: 6,
          maxSortExprLimit: 0,
          expectError: false,
        },
        {
          name: "> max filter exprs",
          filter: ["1=2", "(1=1 || 1=1) && (1=1 || (1=1 || 1=1)) && (1=1)"],
          sort: [] as SortField[],
          maxFilterExprLimit: 5,
          maxSortExprLimit: 0,
          expectError: true,
          expectErrType: ErrFilterExprLimit,
        },
        {
          name: "<= max sort field length",
          filter: [] as FilterData[],
          sort: [
            { name: "id", direction: SortAsc },
            { name: "test1", direction: SortDesc },
            { name: longField, direction: SortDesc },
          ],
          maxFilterExprLimit: 0,
          maxSortExprLimit: 10,
          expectError: false,
        },
        {
          name: "> max sort field length",
          filter: [] as FilterData[],
          sort: [
            { name: "id", direction: SortAsc },
            { name: "test1", direction: SortDesc },
            { name: longFieldOverflow, direction: SortDesc },
          ],
          maxFilterExprLimit: 0,
          maxSortExprLimit: 10,
          expectError: true,
          expectErrType: ErrSortFieldLengthLimit,
        },
        {
          name: "<= max sort exprs",
          filter: [] as FilterData[],
          sort: [
            { name: "id", direction: SortAsc },
            { name: "test1", direction: SortDesc },
          ],
          maxFilterExprLimit: 0,
          maxSortExprLimit: 2,
          expectError: false,
        },
        {
          name: "> max sort exprs",
          filter: [] as FilterData[],
          sort: [
            { name: "id", direction: SortAsc },
            { name: "test1", direction: SortDesc },
          ],
          maxFilterExprLimit: 0,
          maxSortExprLimit: 1,
          expectError: true,
          expectErrType: ErrSortExprLimit,
        },
      ];

      for (const scenario of scenarios) {
        const resolver = new TestFieldResolver();
        const provider = new Provider(resolver)
          .query({ select: baseSelect })
          .sort(scenario.sort)
          .filter(scenario.filter)
          .maxFilterExprLimit(scenario.maxFilterExprLimit)
          .maxSortExprLimit(scenario.maxSortExprLimit);

        let err: unknown = null;
        try {
          provider.exec<TestRow>(db);
        } catch (error) {
          err = error;
        }

        const hasErr = err != null;
        if (hasErr !== scenario.expectError) {
          throw new Error(`Scenario ${scenario.name} expected error=${scenario.expectError} got ${hasErr}: ${String(err)}`);
        }

        if (scenario.expectErrType && err) {
          expect(err).toBe(scenario.expectErrType);
        }
      }
    } finally {
      db.close();
    }
  });

  it("parse and exec", () => {
    const { db, calledQueries } = createTestDb();
    try {
      const scenarios = [
        {
          name: "no extra query params (use presets)",
          queryString: "",
          expectError: false,
          expectResult: '{"items":[],"page":2,"perPage":123,"totalItems":2,"totalPages":1}',
        },
        {
          name: "invalid query",
          queryString: "invalid;",
          expectError: true,
          expectResult: "",
        },
        {
          name: "invalid page",
          queryString: "page=a",
          expectError: true,
          expectResult: "",
        },
        {
          name: "invalid perPage",
          queryString: "perPage=a",
          expectError: true,
          expectResult: "",
        },
        {
          name: "invalid skipTotal",
          queryString: "skipTotal=a",
          expectError: true,
          expectResult: "",
        },
        {
          name: "invalid sorting field",
          queryString: "sort=-unknown",
          expectError: true,
          expectResult: "",
        },
        {
          name: "invalid filter field",
          queryString: "filter=unknown>1",
          expectError: true,
          expectResult: "",
        },
        {
          name: "page > existing",
          queryString: "page=3&perPage=9999",
          expectError: false,
          expectResult: '{"items":[],"page":3,"perPage":1000,"totalItems":2,"totalPages":1}',
        },
        {
          name: "valid query params",
          queryString: "page=1&perPage=9999&filter=test1>1&sort=-test2,test3",
          expectError: false,
          expectResult:
            '{"items":[{"test1":2,"test2":"test2.2","test3":""}],"page":1,"perPage":1000,"totalItems":1,"totalPages":1}',
        },
        {
          name: "valid query params with skipTotal=1",
          queryString: "page=1&perPage=9999&filter=test1>1&sort=-test2,test3&skipTotal=1",
          expectError: false,
          expectResult:
            '{"items":[{"test1":2,"test2":"test2.2","test3":""}],"page":1,"perPage":1000,"totalItems":-1,"totalPages":-1}',
        },
      ];

      for (const scenario of scenarios) {
        calledQueries.length = 0;
        const resolver = new SimpleFieldResolver("test1", "test2", "test3");
        const provider = new Provider(resolver)
          .query({ select: baseSelect })
          .page(2)
          .perPage(123)
          .sort([{ name: "test2", direction: SortAsc }])
          .filter(["test1 > 0"]);

        let result: unknown = null;
        let err: unknown = null;
        try {
          result = provider.parseAndExec<TestRow>(scenario.queryString, db);
        } catch (error) {
          err = error;
        }

        const hasErr = err != null;
        if (hasErr !== scenario.expectError) {
          throw new Error(`Scenario ${scenario.name} expected error=${scenario.expectError} got ${hasErr}: ${String(err)}`);
        }

        if (hasErr) {
          continue;
        }

        const expectedQueries = scenario.queryString.includes("skipTotal=1") ? 1 : 2;
        expect(calledQueries.length).toBe(expectedQueries);

        const encoded = JSON.stringify(normalizeResult(result));
        expect(encoded).toBe(scenario.expectResult);
      }
    } finally {
      db.close();
    }
  });

  it("simple resolver defaults", () => {
    const { db } = createTestDb();
    try {
      const provider = new Provider(new SimpleFieldResolver())
        .query({ select: baseSelect })
        .maxFilterExprLimit(DefaultFilterExprLimit)
        .maxSortExprLimit(DefaultSortExprLimit);

      const result = provider.exec<TestRow>(db);
      expect(result.page).toBe(1);
      expect(result.perPage).toBe(DefaultPerPage);
    } finally {
      db.close();
    }
  });
});
