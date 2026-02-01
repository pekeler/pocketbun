// Ported from pocketbase/tools/picker/pick_test.go

import { describe, expect, it } from "bun:test";
import type { SearchResult } from "../search/types.ts";
import { Pick } from "./pick.ts";

describe("Pick", () => {
  const nestedData = {
    a: 1,
    b: 2,
    c: "test",
    anySlice: [
      {
        A: [1, 2, 3],
        B: ["1", "2", 3],
        C: "test",
        D: {
          DA: 1,
          DB: 2,
        },
      },
      {
        A: "test",
      },
    ],
    mapSlice: [
      {
        A: [1, 2, 3],
        B: ["1", "2", 3],
        C: "test",
        D: [{ DA: 1 }],
      },
      {
        B: ["1", "2", 3],
        D: [{ DA: 2 }, { DA: 3 }, { DB: 4 }],
      },
    ],
    fullMap: [
      {
        A: [1, 2, 3],
        B: ["1", "2", 3],
        C: "test",
      },
      {
        B: ["1", "2", 3],
        D: [{ DA: 2 }, { DA: 3 }],
      },
    ],
  };

  const searchResult: SearchResult<unknown> = {
    page: 1,
    perPage: 10,
    totalItems: 20,
    totalPages: 30,
    items: [
      { a: 11, b: 11, c: "test1" },
      { a: 22, b: 22, c: "test2" },
    ],
  };

  const scenarios = [
    {
      name: "empty fields",
      data: { a: 1, b: 2, c: "test" },
      fields: "",
      expectError: false,
      result: '{"a":1,"b":2,"c":"test"}',
    },
    {
      name: "missing fields",
      data: { a: 1, b: 2, c: "test" },
      fields: "missing",
      expectError: false,
      result: "{}",
    },
    {
      name: "non map data",
      data: "test",
      fields: "a,b,test",
      expectError: false,
      result: '"test"',
    },
    {
      name: "non slice of map data",
      data: ["a", "b", "test"],
      fields: "a,test",
      expectError: false,
      result: '["a","b","test"]',
    },
    {
      name: "map with no matching field",
      data: { a: 1, b: 2, c: "test" },
      fields: "missing",
      expectError: false,
      result: "{}",
    },
    {
      name: "map with existing and missing fields",
      data: { a: 1, b: 2, c: "test" },
      fields: "a,  c  ,missing",
      expectError: false,
      result: '{"a":1,"c":"test"}',
    },
    {
      name: "slice of maps with existing and missing fields",
      data: [
        { a: 11, b: 11, c: "test1" },
        { a: 22, b: 22, c: "test2" },
      ],
      fields: "a,  c  ,missing",
      expectError: false,
      result: '[{"a":11,"c":"test1"},{"a":22,"c":"test2"}]',
    },
    {
      name: "nested fields with mixed map and any slices",
      data: nestedData,
      fields: "a, c, anySlice.A, mapSlice.C, mapSlice.D.DA, anySlice.D,fullMap",
      expectError: false,
      result:
        '{"a":1,"anySlice":[{"A":[1,2,3],"D":{"DA":1,"DB":2}},{"A":"test"}],"c":"test","fullMap":[{"A":[1,2,3],"B":["1","2",3],"C":"test"},{"B":["1","2",3],"D":[{"DA":2},{"DA":3}]}],"mapSlice":[{"C":"test","D":[{"DA":1}]},{"D":[{"DA":2},{"DA":3},{}]}]}',
    },
    {
      name: "SearchResult",
      data: searchResult,
      fields: "a,c,missing",
      expectError: false,
      result: '{"items":[{"a":11,"c":"test1"},{"a":22,"c":"test2"}],"page":1,"perPage":10,"totalItems":20,"totalPages":30}',
    },
    {
      name: "*SearchResult",
      data: { ...searchResult },
      fields: "a,c",
      expectError: false,
      result: '{"items":[{"a":11,"c":"test1"},{"a":22,"c":"test2"}],"page":1,"perPage":10,"totalItems":20,"totalPages":30}',
    },
    {
      name: "root wildcard",
      data: { ...searchResult },
      fields: "*",
      expectError: false,
      result:
        '{"items":[{"a":11,"b":11,"c":"test1"},{"a":22,"b":22,"c":"test2"}],"page":1,"perPage":10,"totalItems":20,"totalPages":30}',
    },
    {
      name: "root wildcard with nested exception",
      data: {
        id: "123",
        title: "lorem",
        rel: {
          id: "456",
          title: "rel_title",
        },
      },
      fields: "*,rel.id",
      expectError: false,
      result: '{"id":"123","rel":{"id":"456"},"title":"lorem"}',
    },
    {
      name: "sub wildcard",
      data: {
        id: "123",
        title: "lorem",
        rel: {
          id: "456",
          title: "rel_title",
          sub: {
            id: "789",
            title: "sub_title",
          },
        },
      },
      fields: "id,rel.*",
      expectError: false,
      result: '{"id":"123","rel":{"id":"456","sub":{"id":"789","title":"sub_title"},"title":"rel_title"}}',
    },
    {
      name: "sub wildcard with nested exception",
      data: {
        id: "123",
        title: "lorem",
        rel: {
          id: "456",
          title: "rel_title",
          sub: {
            id: "789",
            title: "sub_title",
          },
        },
      },
      fields: "id,rel.*,rel.sub.id",
      expectError: false,
      result: '{"id":"123","rel":{"id":"456","sub":{"id":"789"},"title":"rel_title"}}',
    },
    {
      name: "invalid excerpt modifier",
      data: { a: 1, b: 2, c: "test" },
      fields: "*:excerpt",
      expectError: true,
      result: '{"a":1,"b":2,"c":"test"}',
    },
    {
      name: "valid excerpt modifier",
      data: {
        id: "123",
        title: "lorem",
        rel: {
          id: "456",
          title: "<p>rel_title</p>",
          sub: {
            id: "789",
            title: "sub_title",
          },
        },
      },
      fields: "*:excerpt(2),rel.title:excerpt(3, true)",
      expectError: false,
      result: '{"id":"12","rel":{"title":"rel..."},"title":"lo"}',
    },
  ];

  for (const scenario of scenarios) {
    it(scenario.name, () => {
      let result: unknown = null;
      let err: Error | null = null;

      try {
        result = Pick(scenario.data, scenario.fields);
      } catch (error) {
        err = error as Error;
      }

      const hasErr = err !== null;
      expect(hasErr).toBe(scenario.expectError);

      if (hasErr) {
        return;
      }

      const expected = JSON.parse(scenario.result) as unknown;
      expect(result).toEqual(expected);
    });
  }
});
