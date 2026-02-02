// Ported from pocketbase/tools/dbutils/index_test.go

import { describe, expect, it } from "bun:test";
import { Index, findSingleColumnUniqueIndex, hasSingleColumnUniqueIndex, parseIndex } from "./index.ts";

describe("dbutils index", () => {
  it("parseIndex", () => {
    const scenarios = [
      {
        index: "invalid",
        expected: new Index(),
      },
      {
        index: "create index indexname on tablename   (col1)",
        expected: (() => {
          const idx = new Index();
          idx.indexName = "indexname";
          idx.tableName = "tablename";
          idx.columns = [{ name: "col1", collate: "", sort: "" }];
          return idx;
        })(),
      },
      {
        index: "create index indexname on tablename(col1)",
        expected: (() => {
          const idx = new Index();
          idx.indexName = "indexname";
          idx.tableName = "tablename";
          idx.columns = [{ name: "col1", collate: "", sort: "" }];
          return idx;
        })(),
      },
      {
        index:
          "CREATE UNIQUE INDEX IF NOT EXISTS \"schemaname\".[indexname] on 'tablename' (\n" +
          "\t\t\tcol0,\n" +
          "\t\t\t`col1`,\n" +
          '\t\t\tjson_extract("col2", "$.a") asc,\n' +
          '\t\t\t"col3" collate NOCASE,\n' +
          '\t\t\t"col4" collate RTRIM desc\n' +
          "\t\t) where test = 1",
        expected: (() => {
          const idx = new Index();
          idx.unique = true;
          idx.optional = true;
          idx.schemaName = "schemaname";
          idx.indexName = "indexname";
          idx.tableName = "tablename";
          idx.columns = [
            { name: "col0", collate: "", sort: "" },
            { name: "col1", collate: "", sort: "" },
            { name: 'json_extract("col2", "$.a")', collate: "", sort: "ASC" },
            { name: "col3", collate: "NOCASE", sort: "" },
            { name: "col4", collate: "RTRIM", sort: "DESC" },
          ];
          idx.where = "test = 1";
          return idx;
        })(),
      },
    ];

    for (const scenario of scenarios) {
      const result = parseIndex(scenario.index);
      const resultRaw = JSON.stringify(result);
      const expectedRaw = JSON.stringify(scenario.expected);
      expect(resultRaw).toBe(expectedRaw);
    }
  });

  it("Index.isValid", () => {
    const scenarios = [
      { name: "empty", index: new Index(), expected: false },
      {
        name: "no index name",
        index: (() => {
          const idx = new Index();
          idx.tableName = "table";
          idx.columns = [{ name: "col", collate: "", sort: "" }];
          return idx;
        })(),
        expected: false,
      },
      {
        name: "no table name",
        index: (() => {
          const idx = new Index();
          idx.indexName = "index";
          idx.columns = [{ name: "col", collate: "", sort: "" }];
          return idx;
        })(),
        expected: false,
      },
      {
        name: "no columns",
        index: (() => {
          const idx = new Index();
          idx.indexName = "index";
          idx.tableName = "table";
          return idx;
        })(),
        expected: false,
      },
      {
        name: "min valid",
        index: (() => {
          const idx = new Index();
          idx.indexName = "index";
          idx.tableName = "table";
          idx.columns = [{ name: "col", collate: "", sort: "" }];
          return idx;
        })(),
        expected: true,
      },
      {
        name: "all fields",
        index: (() => {
          const idx = new Index();
          idx.optional = true;
          idx.unique = true;
          idx.schemaName = "schema";
          idx.indexName = "index";
          idx.tableName = "table";
          idx.columns = [{ name: "col", collate: "", sort: "" }];
          idx.where = "test = 1 OR test = 2";
          return idx;
        })(),
        expected: true,
      },
    ];

    for (const scenario of scenarios) {
      expect(scenario.index.isValid()).toBe(scenario.expected);
    }
  });

  it("Index.build", () => {
    const scenarios = [
      { name: "empty", index: new Index(), expected: "" },
      {
        name: "no index name",
        index: (() => {
          const idx = new Index();
          idx.tableName = "table";
          idx.columns = [{ name: "col", collate: "", sort: "" }];
          return idx;
        })(),
        expected: "",
      },
      {
        name: "no table name",
        index: (() => {
          const idx = new Index();
          idx.indexName = "index";
          idx.columns = [{ name: "col", collate: "", sort: "" }];
          return idx;
        })(),
        expected: "",
      },
      {
        name: "no columns",
        index: (() => {
          const idx = new Index();
          idx.indexName = "index";
          idx.tableName = "table";
          return idx;
        })(),
        expected: "",
      },
      {
        name: "min valid",
        index: (() => {
          const idx = new Index();
          idx.indexName = "index";
          idx.tableName = "table";
          idx.columns = [{ name: "col", collate: "", sort: "" }];
          return idx;
        })(),
        expected: "CREATE INDEX `index` ON `table` (`col`)",
      },
      {
        name: "all fields",
        index: (() => {
          const idx = new Index();
          idx.optional = true;
          idx.unique = true;
          idx.schemaName = "schema";
          idx.indexName = "index";
          idx.tableName = "table";
          idx.columns = [
            { name: "col1", collate: "NOCASE", sort: "asc" },
            { name: "col2", collate: "", sort: "desc" },
            { name: 'json_extract("col3", "$.a")', collate: "NOCASE", sort: "" },
          ];
          idx.where = "test = 1 OR test = 2";
          return idx;
        })(),
        expected:
          'CREATE UNIQUE INDEX IF NOT EXISTS `schema`.`index` ON `table` (\n  `col1` COLLATE NOCASE ASC,\n  `col2` DESC,\n  json_extract("col3", "$.a") COLLATE NOCASE\n) WHERE test = 1 OR test = 2',
      },
    ];

    for (const scenario of scenarios) {
      expect(scenario.index.build()).toBe(scenario.expected);
    }
  });

  it("hasSingleColumnUniqueIndex", () => {
    const scenarios = [
      { name: "empty indexes", column: "test", indexes: null as string[] | null, expected: false },
      {
        name: "empty column",
        column: "",
        indexes: ["CREATE UNIQUE INDEX `index1` ON `example` (`test`)"] as string[],
        expected: false,
      },
      {
        name: "mismatched column",
        column: "test",
        indexes: ["CREATE UNIQUE INDEX `index1` ON `example` (`test2`)"] as string[],
        expected: false,
      },
      {
        name: "non unique index",
        column: "test",
        indexes: ["CREATE INDEX `index1` ON `example` (`test`)"] as string[],
        expected: false,
      },
      {
        name: "matching columnd and unique index",
        column: "test",
        indexes: ["CREATE UNIQUE INDEX `index1` ON `example` (`test`)"] as string[],
        expected: true,
      },
      {
        name: "multiple columns",
        column: "test",
        indexes: ["CREATE UNIQUE INDEX `index1` ON `example` (`test`, `test2`)"] as string[],
        expected: false,
      },
      {
        name: "multiple indexes",
        column: "test",
        indexes: [
          "CREATE UNIQUE INDEX `index1` ON `example` (`test`, `test2`)",
          "CREATE UNIQUE INDEX `index2` ON `example` (`test`)",
        ] as string[],
        expected: true,
      },
      {
        name: "partial unique index",
        column: "test",
        indexes: ["CREATE UNIQUE INDEX `index` ON `example` (`test`) where test != ''"] as string[],
        expected: true,
      },
    ];

    for (const scenario of scenarios) {
      expect(hasSingleColumnUniqueIndex(scenario.column, scenario.indexes ?? [])).toBe(scenario.expected);
    }
  });

  it("findSingleColumnUniqueIndex", () => {
    const scenarios = [
      { name: "empty indexes", column: "test", indexes: null as string[] | null, expected: false },
      {
        name: "empty column",
        column: "",
        indexes: ["CREATE UNIQUE INDEX `index1` ON `example` (`test`)"] as string[],
        expected: false,
      },
      {
        name: "mismatched column",
        column: "test",
        indexes: ["CREATE UNIQUE INDEX `index1` ON `example` (`test2`)"] as string[],
        expected: false,
      },
      {
        name: "non unique index",
        column: "test",
        indexes: ["CREATE INDEX `index1` ON `example` (`test`)"] as string[],
        expected: false,
      },
      {
        name: "matching columnd and unique index",
        column: "test",
        indexes: ["CREATE UNIQUE INDEX `index1` ON `example` (`test`)"] as string[],
        expected: true,
      },
      {
        name: "multiple columns",
        column: "test",
        indexes: ["CREATE UNIQUE INDEX `index1` ON `example` (`test`, `test2`)"] as string[],
        expected: false,
      },
      {
        name: "multiple indexes",
        column: "test",
        indexes: [
          "CREATE UNIQUE INDEX `index1` ON `example` (`test`, `test2`)",
          "CREATE UNIQUE INDEX `index2` ON `example` (`test`)",
        ] as string[],
        expected: true,
      },
      {
        name: "partial unique index",
        column: "test",
        indexes: ["CREATE UNIQUE INDEX `index` ON `example` (`test`) where test != ''"] as string[],
        expected: true,
      },
    ];

    for (const scenario of scenarios) {
      const [index, exists] = findSingleColumnUniqueIndex(scenario.indexes ?? [], scenario.column);
      expect(exists).toBe(scenario.expected);

      if (!exists) {
        expect(index.columns.length).toBe(0);
      }

      if (exists) {
        expect(index.columns[0]?.name.toLowerCase()).toBe(scenario.column.toLowerCase());
      }
    }
  });
});
