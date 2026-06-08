// Ported from pocketbase/apis/sql_test.go

import { describe, it } from "bun:test";
import { runApiScenario, type ApiScenario } from "../tests/api.ts";

const regularUserToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6Im9hcDY0MGNvdDR5cnUycyIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.GfJo6EHIobgas_AXt-M-tj5IoQendPnrkMSe9ExuSEY";

const superuserToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY";

const scenarios: ApiScenario[] = [
  {
    name: "guest",
    method: "POST",
    url: "/api/sql",
    body: `{"query":"select 1"}`,
    expectedStatus: 401,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "regular user",
    method: "POST",
    url: "/api/sql",
    body: `{"query":"select 1"}`,
    headers: { Authorization: regularUserToken },
    expectedStatus: 403,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "superuser",
    method: "POST",
    url: "/api/sql",
    body: `{"query":"select 1"}`,
    headers: { Authorization: superuserToken },
    expectedStatus: 200,
    expectedContent: [
      `"execTime":`,
      `"affectedRows":0`,
      `"columns":[{"name":"1","type":"","nullable":true}]`,
      `"rows":[["1"]]`,
    ],
    expectedEvents: { "*": 0 },
  },
  {
    name: "empty query",
    method: "POST",
    url: "/api/sql",
    body: `{"query":""}`,
    headers: { Authorization: superuserToken },
    expectedStatus: 400,
    expectedContent: [`"data":{`, `"query":{`],
    expectedEvents: { "*": 0 },
  },
  {
    name: "invalid query",
    method: "POST",
    url: "/api/sql",
    body: `{"query":"invalid"}`,
    headers: { Authorization: superuserToken },
    expectedStatus: 400,
    expectedContent: [`"data":{}`, `Raw error:`, `SQL logic error`],
    expectedEvents: { "*": 0 },
  },
  {
    name: "query with length above the limit",
    method: "POST",
    url: "/api/sql",
    body: `{"query":"${"a".repeat(5001)}"}`,
    headers: { Authorization: superuserToken },
    expectedStatus: 400,
    expectedContent: [`"data":{`, `"query":{`],
    expectedEvents: { "*": 0 },
  },
  {
    name: "query with length equal to the limit",
    method: "POST",
    url: "/api/sql",
    body: `{"query":"select '${"a".repeat(4985)}' as id"}`,
    headers: { Authorization: superuserToken },
    expectedStatus: 200,
    expectedContent: [
      `"execTime":`,
      `"affectedRows":0`,
      `"columns":[{"name":"id","type":"","nullable":true}]`,
      `"rows":[["aaa`,
    ],
    expectedEvents: { "*": 0 },
  },
  {
    name: "single write query",
    method: "POST",
    url: "/api/sql",
    body: `{"query":"create table test_sql_table(id int primary key)"}`,
    headers: { Authorization: superuserToken },
    afterTest: (app) => {
      if (!app.HasTable("test_sql_table")) {
        throw new Error(`Missing expected new "test_sql_table" table`);
      }
    },
    expectedStatus: 200,
    expectedContent: [`"execTime":`, `"affectedRows":0`, `"columns":[]`, `"rows":[]`],
    expectedEvents: { "*": 0 },
  },
  {
    name: "multiple write queries",
    method: "POST",
    url: "/api/sql",
    body: `{"query":"create table test_sql_table(id int primary key);insert into test_sql_table(id)VALUES(1)"}`,
    headers: { Authorization: superuserToken },
    afterTest: (app) => {
      const row = app.db().query("select count(*) as total from test_sql_table").get() as { total: number } | null;
      if (row?.total !== 1) {
        throw new Error(`Expected exactly 1 row, found: ${row?.total ?? 0}`);
      }
    },
    expectedStatus: 200,
    expectedContent: [`"execTime":`, `"affectedRows":1`, `"columns":[]`, `"rows":[]`],
    expectedEvents: { "*": 0 },
  },
  {
    name: "alter write query",
    method: "POST",
    url: "/api/sql",
    body: `{"query":"alter table test_sql_table add column name text"}`,
    headers: { Authorization: superuserToken },
    beforeTest: (app) => {
      app.db().run("create table test_sql_table(id int primary key)");
    },
    afterTest: (app) => {
      const row = app.db().query("select name from pragma_table_info('test_sql_table') where name = 'name'").get() as {
        name?: string;
      } | null;
      if (row?.name !== "name") {
        throw new Error(`Missing expected new "test_sql_table.name" column`);
      }
    },
    expectedStatus: 200,
    expectedContent: [`"execTime":`, `"affectedRows":0`, `"columns":[]`, `"rows":[]`],
    expectedEvents: { "*": 0 },
  },
  {
    name: "replace write query",
    method: "POST",
    url: "/api/sql",
    body: `{"query":"replace into test_sql_table(id, name) values(1, 'updated')"}`,
    headers: { Authorization: superuserToken },
    beforeTest: (app) => {
      app.db().run("create table test_sql_table(id int primary key, name text)");
      app.db().run("insert into test_sql_table(id, name) values(1, 'initial')");
    },
    afterTest: (app) => {
      const row = app.db().query("select name from test_sql_table where id = 1").get() as { name?: string } | null;
      if (row?.name !== "updated") {
        throw new Error(`Expected REPLACE query to update row, got: ${row?.name ?? ""}`);
      }
    },
    expectedStatus: 200,
    expectedContent: [`"execTime":`, `"affectedRows":1`, `"columns":[]`, `"rows":[]`],
    expectedEvents: { "*": 0 },
  },
  {
    name: "multiple write queries (transaction rollback)",
    method: "POST",
    url: "/api/sql",
    body: `{"query":"create table test_sql_table(id int primary key);insert into test_sql_table(id)VALUES(1);invalid"}`,
    headers: { Authorization: superuserToken },
    afterTest: (app) => {
      if (app.HasTable("test_sql_table")) {
        throw new Error(`Expected table "test_sql_table" to not be created`);
      }
    },
    expectedStatus: 400,
    expectedContent: [`"data":{}`, `Raw error:`, `SQL logic error`],
    expectedEvents: { "*": 0 },
  },
  {
    name: "multiple read queries",
    method: "POST",
    url: "/api/sql",
    body: `{"query":"select 1;select 2"}`,
    headers: { Authorization: superuserToken },
    expectedStatus: 200,
    expectedContent: [
      `"execTime":`,
      `"affectedRows":0`,
      // only the result of the last query should be returned
      `"columns":[{"name":"2","type":"","nullable":true}]`,
      `"rows":[["2"]]`,
    ],
    expectedEvents: { "*": 0 },
  },
];

describe("SQL run", () => {
  for (const scenario of scenarios) {
    it(scenario.name ?? scenario.url, async () => {
      await runApiScenario(scenario);
    });
  }
});
