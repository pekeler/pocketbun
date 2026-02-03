// Ported from pocketbase/core/view_test.go

import { describe, expect, it } from "bun:test";
import { newTestApp } from "../tests/app.ts";
import { Collection, CollectionNameSuperusers, CollectionTypeView } from "./collection_model.ts";
import { FieldTypeAutodate } from "./field_autodate.ts";
import { FieldTypeBool } from "./field_bool.ts";
import { FieldTypeDate } from "./field_date.ts";
import { FieldTypeEmail } from "./field_email.ts";
import { FieldTypeFile } from "./field_file.ts";
import { FieldTypeJSON } from "./field_json.ts";
import { FieldTypeNumber } from "./field_number.ts";
import { FieldTypeRelation } from "./field_relation.ts";
import { FieldTypeSelect } from "./field_select.ts";
import { FieldTypeText } from "./field_text.ts";
import { FieldTypeURL } from "./field_url.ts";

const tempViewLike = "%\\_temp\\_%";

type TestApp = Awaited<ReturnType<typeof newTestApp>>["app"];

function ensureNoTempViews(app: TestApp): void {
  const row = app
    .db()
    .query<{ total: number }, []>(
      `select count(*) as total from sqlite_schema where type = 'view' and [[name]] LIKE '${tempViewLike}' ESCAPE '\\'`,
    )
    .get();

  if (!row) {
    throw new Error("Failed to check for temp views");
  }

  if (row.total > 0) {
    throw new Error(`Expected all temp views to be deleted, got ${row.total}`);
  }
}

describe("view helpers", () => {
  it("DeleteView", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scenarios = [
        { viewName: "", expectError: true },
        { viewName: "demo1", expectError: true },
        { viewName: "missing", expectError: false },
        { viewName: "view1", expectError: false },
        { viewName: "VieW1", expectError: false },
      ];

      for (const scenario of scenarios) {
        const err = app.DeleteView(scenario.viewName);
        const hasErr = !!err;
        expect(hasErr).toBe(scenario.expectError);
      }

      ensureNoTempViews(app);
    } finally {
      await cleanup();
    }
  });

  it("SaveView", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scenarios = [
        {
          name: "empty name and query",
          viewName: "",
          query: "",
          expectError: true,
          expectColumns: null as string[] | null,
        },
        {
          name: "empty name",
          viewName: "",
          query: `select * from ${CollectionNameSuperusers}`,
          expectError: true,
          expectColumns: null as string[] | null,
        },
        {
          name: "empty query",
          viewName: "123Test",
          query: "",
          expectError: true,
          expectColumns: null as string[] | null,
        },
        {
          name: "invalid query",
          viewName: "123Test",
          query: "123 456",
          expectError: true,
          expectColumns: null as string[] | null,
        },
        {
          name: "missing table",
          viewName: "123Test",
          query: "select id from missing",
          expectError: true,
          expectColumns: null as string[] | null,
        },
        {
          name: "non select query",
          viewName: "123Test",
          query: `drop table ${CollectionNameSuperusers}`,
          expectError: true,
          expectColumns: null as string[] | null,
        },
        {
          name: "multiple select queries",
          viewName: "123Test",
          query: `select *, count(id) as c from ${CollectionNameSuperusers}; select * from demo1;`,
          expectError: true,
          expectColumns: null as string[] | null,
        },
        {
          name: "try to break the parent parenthesis",
          viewName: "123Test",
          query: `select *, count(id) as c from \`${CollectionNameSuperusers}\`)`,
          expectError: true,
          expectColumns: null as string[] | null,
        },
        {
          name: "simple select query (+ trimmed semicolon)",
          viewName: "123Test",
          query: `;select *, count(id) as c from ${CollectionNameSuperusers};`,
          expectError: false,
          expectColumns: ["id", "created", "updated", "password", "tokenKey", "email", "emailVisibility", "verified", "c"],
        },
        {
          name: "update old view with new query",
          viewName: "123Test",
          query: `select 1 as test from ${CollectionNameSuperusers}`,
          expectError: false,
          expectColumns: ["test"],
        },
      ];

      for (const scenario of scenarios) {
        const err = await app.SaveView(scenario.viewName, scenario.query);
        const hasErr = !!err;
        expect(hasErr).toBe(scenario.expectError);

        if (hasErr) {
          continue;
        }

        const infoRows = app.TableInfo(scenario.viewName);
        expect(infoRows.length).toBe(scenario.expectColumns?.length ?? 0);

        for (const row of infoRows) {
          if (!scenario.expectColumns?.includes(row.Name)) {
            throw new Error(`Missing ${row.Name} column in ${scenario.expectColumns?.join(", ")}`);
          }
        }
      }

      ensureNoTempViews(app);
    } finally {
      await cleanup();
    }
  });

  it("CreateViewFieldsWithDiscardedNestedTransaction", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      await app.RunInTransaction(async (txApp) => {
        let threw = false;
        try {
          await txApp.CreateViewFields("select id from missing");
        } catch {
          threw = true;
        }
        expect(threw).toBe(true);
        return null;
      });

      ensureNoTempViews(app);
    } finally {
      await cleanup();
    }
  });

  it("CreateViewFields", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scenarios = [
        {
          name: "empty query",
          query: "",
          expectError: true,
          expectFields: null as Record<string, string> | null,
        },
        {
          name: "invalid query",
          query: "test 123456",
          expectError: true,
          expectFields: null as Record<string, string> | null,
        },
        {
          name: "missing table",
          query: "select id from missing",
          expectError: true,
          expectFields: null as Record<string, string> | null,
        },
        {
          name: "query with wildcard column",
          query: "select a.id, a.* from demo1 a",
          expectError: true,
          expectFields: null as Record<string, string> | null,
        },
        {
          name: "query without id",
          query: "select text, url, created, updated from demo1",
          expectError: true,
          expectFields: null as Record<string, string> | null,
        },
        {
          name: "query with comments",
          query: `
            select
            -- test single line
            demo1.id,
            demo1.text,
            /* multi
             * line comment block */
            demo1.url, demo1.created, demo1.updated from/* inline comment block with no spaces between the identifiers */demo1
            -- comment before join
            join demo2 ON (
              -- comment inside join
              demo2.id = demo1.id
            )
            -- comment before where
            where (
              -- comment inside where
              demo2.id = demo1.id
            )
          `,
          expectError: false,
          expectFields: {
            id: FieldTypeText,
            text: FieldTypeText,
            url: FieldTypeURL,
            created: FieldTypeAutodate,
            updated: FieldTypeAutodate,
          },
        },
        {
          name: "query with all fields and quoted identifiers",
          query: `
            select
              "id",
              "created",
              "updated",
              [text],
              \`bool\`,
              "url",
              "select_one",
              "select_many",
              "file_one",
              "demo1"."file_many",
              \`demo1\`.\`number\` number_alias,
              "email",
              "datetime",
              "json",
              "rel_one",
              "rel_many",
              'single_quoted_custom_literal' as 'single_quoted_column'
            from demo1
          `,
          expectError: false,
          expectFields: {
            id: FieldTypeText,
            created: FieldTypeAutodate,
            updated: FieldTypeAutodate,
            text: FieldTypeText,
            bool: FieldTypeBool,
            url: FieldTypeURL,
            select_one: FieldTypeSelect,
            select_many: FieldTypeSelect,
            file_one: FieldTypeFile,
            file_many: FieldTypeFile,
            number_alias: FieldTypeNumber,
            email: FieldTypeEmail,
            datetime: FieldTypeDate,
            json: FieldTypeJSON,
            rel_one: FieldTypeRelation,
            rel_many: FieldTypeRelation,
            single_quoted_column: FieldTypeJSON,
          },
        },
        {
          name: "query with indirect relations fields",
          query: "select a.id, b.id as bid, b.created from demo1 as a left join demo2 b",
          expectError: false,
          expectFields: {
            id: FieldTypeText,
            bid: FieldTypeRelation,
            created: FieldTypeAutodate,
          },
        },
        {
          name: "query with multiple froms, joins and style of aliasses",
          query: `
            select
              a.id as id,
              b.id as bid,
              lj.id cid,
              ij.id as did,
              a.bool,
              ${CollectionNameSuperusers}.id as eid,
              ${CollectionNameSuperusers}.email
            from demo1 a, demo2 as b
            left join demo3 lj on lj.id = 123
            inner join demo4 as ij on ij.id = 123
            join ${CollectionNameSuperusers}
            where 1=1
            group by a.id
            limit 10
          `,
          expectError: false,
          expectFields: {
            id: FieldTypeText,
            bid: FieldTypeRelation,
            cid: FieldTypeRelation,
            did: FieldTypeRelation,
            bool: FieldTypeBool,
            eid: FieldTypeRelation,
            email: FieldTypeEmail,
          },
        },
        {
          name: "query with casts",
          query: `select
            a.id,
            count(a.id) count,
            cast(a.id as int) cast_int,
            cast(a.id as integer) cast_integer,
            cast(a.id as real) cast_real,
            cast(a.id as decimal) cast_decimal,
            cast(a.id as numeric) cast_numeric,
            cast(a.id as text) cast_text,
            cast(a.id as bool) cast_bool,
            cast(a.id as boolean) cast_boolean,
            avg(a.id) avg,
            sum(a.id) sum,
            total(a.id) total,
            min(a.id) min,
            max(a.id) max
          from demo1 a`,
          expectError: false,
          expectFields: {
            id: FieldTypeText,
            count: FieldTypeNumber,
            total: FieldTypeNumber,
            cast_int: FieldTypeNumber,
            cast_integer: FieldTypeNumber,
            cast_real: FieldTypeNumber,
            cast_decimal: FieldTypeNumber,
            cast_numeric: FieldTypeNumber,
            cast_text: FieldTypeText,
            cast_bool: FieldTypeBool,
            cast_boolean: FieldTypeBool,
            sum: FieldTypeJSON,
            avg: FieldTypeJSON,
            min: FieldTypeJSON,
            max: FieldTypeJSON,
          },
        },
        {
          name: "query with multiline cast",
          query: `select
            id,
            cast(
              (
                case
                  when count(a.id) = 1 then 21
                  when count(a.id) = 2 then 18
                  else 0
                end
              ) as int
            ) as cast_int
          from demo1 a`,
          expectError: false,
          expectFields: {
            id: FieldTypeText,
            cast_int: FieldTypeNumber,
          },
        },
        {
          name: "query with case-insensitive and extra-spaced cast",
          query: `select
            id,
            CaSt( a.id  aS iNt ) as cast_int
          from demo1 a`,
          expectError: false,
          expectFields: {
            id: FieldTypeText,
            cast_int: FieldTypeNumber,
          },
        },
        {
          name: "query with reserved auth collection fields",
          query: `
            select
              a.id,
              a.username,
              a.email,
              a.emailVisibility,
              a.verified,
              demo1.id relid
            from users a
            left join demo1
          `,
          expectError: false,
          expectFields: {
            id: FieldTypeText,
            username: FieldTypeText,
            email: FieldTypeEmail,
            emailVisibility: FieldTypeBool,
            verified: FieldTypeBool,
            relid: FieldTypeRelation,
          },
        },
        {
          name: "query with unknown fields and aliases",
          query: `select
            id,
            id as id2,
            text as text_alias,
            url as url_alias,
            "demo1"."bool" as bool_alias,
            number as number_alias,
            created created_alias,
            updated updated_alias,
            123 as custom
          from demo1`,
          expectError: false,
          expectFields: {
            id: FieldTypeText,
            id2: FieldTypeRelation,
            text_alias: FieldTypeText,
            url_alias: FieldTypeURL,
            bool_alias: FieldTypeBool,
            number_alias: FieldTypeNumber,
            created_alias: FieldTypeAutodate,
            updated_alias: FieldTypeAutodate,
            custom: FieldTypeJSON,
          },
        },
        {
          name: "query with distinct and reordered id column",
          query: `select distinct
            id as id2,
            id,
            123 as custom
          from demo1`,
          expectError: false,
          expectFields: {
            id2: FieldTypeRelation,
            id: FieldTypeText,
            custom: FieldTypeJSON,
          },
        },
        {
          name: "query with aliasing the same field multiple times",
          query: `select
            a.id as id,
            a.text as alias1,
            a.text as alias2,
            b.text as alias3,
            b.text as alias4
          from demo1 a
          left join demo1 as b`,
          expectError: false,
          expectFields: {
            id: FieldTypeText,
            alias1: FieldTypeText,
            alias2: FieldTypeText,
            alias3: FieldTypeText,
            alias4: FieldTypeText,
          },
        },
      ];

      for (const scenario of scenarios) {
        let result: Awaited<ReturnType<TestApp["CreateViewFields"]>> | null = null;
        let hasErr = false;
        let err: Error | null = null;

        try {
          result = await app.CreateViewFields(scenario.query);
        } catch (error) {
          hasErr = true;
          err = error as Error;
        }

        if (hasErr !== scenario.expectError) {
          throw new Error(`Expected hasErr ${scenario.expectError}, got ${hasErr} (${err})`);
        }

        if (hasErr || !result) {
          continue;
        }

        if (Object.keys(scenario.expectFields ?? {}).length !== result.length) {
          throw new Error(
            `Expected ${Object.keys(scenario.expectFields ?? {}).length} fields, got ${result.length}: ${JSON.stringify(result)}`,
          );
        }

        for (const [name, typ] of Object.entries(scenario.expectFields ?? {})) {
          const field = result.GetByName(name);
          if (!field) {
            throw new Error(`Expected to find field ${name}, got null`);
          }
          if (field.Type() !== typ) {
            throw new Error(`Expected field ${name} to be ${typ}, got ${field.Type()}`);
          }
        }
      }

      ensureNoTempViews(app);
    } finally {
      await cleanup();
    }
  });

  it("FindRecordByViewFile", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const prevCollection = app.findCollectionByNameOrId("demo1");
      if (!prevCollection) {
        throw new Error("Missing demo1 collection");
      }

      const totalLevels = 6;
      let fileOneAlias = "file_one one0";
      let fileManyAlias = "file_many many0";
      const mockCollections: Collection[] = [];

      let currentCollection = prevCollection;

      for (let i = 0; i <= totalLevels; i += 1) {
        const view = new Collection();
        view.Type = CollectionTypeView;
        view.Name = `_test_view${i}`;
        view.ViewQuery = `select id, ${fileOneAlias}, ${fileManyAlias} from ${currentCollection.Name}`;

        const err = await app.Save(view);
        if (err) {
          throw new Error(`Failed to save view${i}: ${err.message}`);
        }

        mockCollections.push(view);
        currentCollection = view;
        fileOneAlias = `one${i} one${i + 1}`;
        fileManyAlias = `many${i} many${i + 1}`;
      }

      const fileOneName = "test_d61b33QdDU.txt";
      const fileManyName = "test_QZFjKjXchk.txt";
      const expectedRecordId = "84nmscqy84lsi1t";

      const scenarios = [
        {
          name: "missing collection",
          collectionNameOrId: "missing",
          fileFieldName: "a",
          filename: fileOneName,
          expectError: true,
          expectRecordId: "",
        },
        {
          name: "non-view collection",
          collectionNameOrId: "demo1",
          fileFieldName: "file_one",
          filename: fileOneName,
          expectError: true,
          expectRecordId: "",
        },
        {
          name: "view collection after the max recursion limit",
          collectionNameOrId: mockCollections[totalLevels - 1]!.Name,
          fileFieldName: `one${totalLevels - 1}`,
          filename: fileOneName,
          expectError: true,
          expectRecordId: "",
        },
        {
          name: "first view collection (single file)",
          collectionNameOrId: mockCollections[0]!.Name,
          fileFieldName: "one0",
          filename: fileOneName,
          expectError: false,
          expectRecordId: expectedRecordId,
        },
        {
          name: "first view collection (many files)",
          collectionNameOrId: mockCollections[0]!.Name,
          fileFieldName: "many0",
          filename: fileManyName,
          expectError: false,
          expectRecordId: expectedRecordId,
        },
        {
          name: "last view collection before the recursion limit (single file)",
          collectionNameOrId: mockCollections[totalLevels - 2]!.Name,
          fileFieldName: `one${totalLevels - 2}`,
          filename: fileOneName,
          expectError: false,
          expectRecordId: expectedRecordId,
        },
        {
          name: "last view collection before the recursion limit (many files)",
          collectionNameOrId: mockCollections[totalLevels - 2]!.Name,
          fileFieldName: `many${totalLevels - 2}`,
          filename: fileManyName,
          expectError: false,
          expectRecordId: expectedRecordId,
        },
      ];

      for (const scenario of scenarios) {
        let record: ReturnType<TestApp["FindRecordByViewFile"]> | null = null;
        let hasErr = false;
        let err: Error | null = null;

        try {
          record = app.FindRecordByViewFile(scenario.collectionNameOrId, scenario.fileFieldName, scenario.filename);
        } catch (error) {
          hasErr = true;
          err = error as Error;
        }

        if (hasErr !== scenario.expectError) {
          throw new Error(`Expected hasErr ${scenario.expectError}, got ${hasErr} (${err})`);
        }

        if (hasErr || !record) {
          continue;
        }

        if (record.Id !== scenario.expectRecordId) {
          throw new Error(`Expected recordId ${scenario.expectRecordId}, got ${record.Id}`);
        }
      }
    } finally {
      await cleanup();
    }
  });
});
