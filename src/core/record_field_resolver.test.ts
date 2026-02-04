// Ported from pocketbase/core/record_field_resolver_test.go.

import { describe, expect, it } from "bun:test";
import type { RequestInfo } from "./event_request.ts";
import { newTestApp } from "../tests/app.ts";
import { existInSliceWithRegex } from "../tools/list/list.ts";
import { buildFilterExpr } from "../tools/search/filter.ts";
import { DefaultFilterExprLimit } from "../tools/search/types.ts";
import { JSONRaw } from "../tools/types/index.ts";
import { RecordFieldResolver } from "./record_field_resolver.ts";

function appendWhere(baseSql: string, clause: string): string {
  if (!clause) {
    return baseSql;
  }
  if (/\bwhere\b/i.test(baseSql)) {
    return `${baseSql} AND (${clause})`;
  }
  return `${baseSql} WHERE ${clause}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function rewriteQuerySql(sql: string): string {
  let index = 0;
  let withParams = "";
  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i] ?? "";
    if (char === "{" && sql[i + 1] === ":") {
      const end = sql.indexOf("}", i + 2);
      if (end !== -1) {
        withParams += sql.slice(i, end + 1);
        index += 1;
        i = end;
        continue;
      }
    }
    if (char === "?") {
      withParams += `{:p${index++}}`;
      continue;
    }
    withParams += char;
  }

  return withParams.replace(/\{\{([^}]+)\}\}/g, (match, name, offset, full) => {
    const trimmed = String(name).trim();
    if (trimmed.startsWith("__sm") || trimmed.startsWith("__ml") || trimmed.startsWith("__mr")) {
      return `{{${trimmed}}}`;
    }
    if (trimmed.startsWith("__je")) {
      const before = String(full).slice(0, offset).toLowerCase();
      const lastJoin = before.lastIndexOf(" join ");
      const lastFrom = before.lastIndexOf(" from ");
      if (lastFrom > lastJoin) {
        return `{{${trimmed}}}`;
      }
    }
    return `\`${trimmed}\``;
  });
}

describe("record field resolver", () => {
  it("RecordFieldResolverAllowedFields", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const collection = app.FindCollectionByNameOrId("demo1");
      const resolver = new RecordFieldResolver(app, collection, null, false);

      const fields = resolver.AllowedFields();
      expect(fields.length).toBe(8);

      const newFields = ["a", "b", "c"];
      const expected = [...newFields];
      resolver.SetAllowedFields(newFields);

      newFields[2] = "d";

      const nextFields = resolver.AllowedFields();
      expect(nextFields.length).toBe(expected.length);
      for (let i = 0; i < expected.length; i += 1) {
        expect(nextFields[i]).toBe(expected[i]);
      }
    } finally {
      await cleanup();
    }
  });

  it("RecordFieldResolverAllowHiddenFields", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const collection = app.FindCollectionByNameOrId("demo1");
      const resolver = new RecordFieldResolver(app, collection, null, false);

      const allowHiddenFields = resolver.AllowHiddenFields();
      expect(allowHiddenFields).toBe(false);

      const expected = !allowHiddenFields;
      resolver.SetAllowHiddenFields(expected);

      expect(resolver.AllowHiddenFields()).toBe(expected);
    } finally {
      await cleanup();
    }
  });

  it("RecordFieldResolverUpdateQuery", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const authRecord = app.FindRecordById("users", "4q1xlclmfloku33");

      const requestInfo: RequestInfo = {
        context: "ctx",
        method: "get",
        headers: {
          a: "123",
          b: "456",
        },
        query: {
          a: "",
          b: "123",
        },
        body: {
          a: null,
          b: 123,
          number: 10,
          select_many: ["optionA", "optionC"],
          rel_one: "test",
          rel_many: ["test1", "test2"],
          file_one: "test",
          file_many: ["test1", "test2", "test3"],
          self_rel_one: "test",
          self_rel_many: ["test1"],
          rel_many_cascade: ["test1", "test2"],
          rel_one_cascade: "test1",
          rel_one_no_cascade: "test1",
        },
        auth: authRecord,
      };

      const scenarios = [
        {
          name: "none relation field (with all default operators)",
          collectionIdOrName: "demo4",
          rule: "title = true || title != 'test' || title ~ 'test1' || title !~ '%test2' || title > 1 || title >= 2 || title < 3 || title <= 4",
          allowHiddenFields: false,
          expectQuery:
            "SELECT `demo4`.* FROM `demo4` WHERE ([[demo4.title]] = 1 OR [[demo4.title]] IS NOT {:TEST} OR [[demo4.title]] LIKE {:TEST} ESCAPE '\\' OR [[demo4.title]] NOT LIKE {:TEST} ESCAPE '\\' OR [[demo4.title]] > {:TEST} OR [[demo4.title]] >= {:TEST} OR [[demo4.title]] < {:TEST} OR [[demo4.title]] <= {:TEST})",
        },
        {
          name: "none relation field (with all opt/any operators)",
          collectionIdOrName: "demo4",
          rule: "title ?= true || title ?!= 'test' || title ?~ 'test1' || title ?!~ '%test2' || title ?> 1 || title ?>= 2 || title ?< 3 || title ?<= 4",
          allowHiddenFields: false,
          expectQuery:
            "SELECT `demo4`.* FROM `demo4` WHERE ([[demo4.title]] = 1 OR [[demo4.title]] IS NOT {:TEST} OR [[demo4.title]] LIKE {:TEST} ESCAPE '\\' OR [[demo4.title]] NOT LIKE {:TEST} ESCAPE '\\' OR [[demo4.title]] > {:TEST} OR [[demo4.title]] >= {:TEST} OR [[demo4.title]] < {:TEST} OR [[demo4.title]] <= {:TEST})",
        },
        {
          name: "single direct rel",
          collectionIdOrName: "demo4",
          rule: "self_rel_one > true",
          allowHiddenFields: false,
          expectQuery: "SELECT `demo4`.* FROM `demo4` WHERE [[demo4.self_rel_one]] > 1",
        },
        {
          name: "single direct rel (with id)",
          collectionIdOrName: "demo4",
          rule: "self_rel_one.id > true",
          allowHiddenFields: false,
          expectQuery: "SELECT `demo4`.* FROM `demo4` WHERE [[demo4.self_rel_one]] > 1",
        },
        {
          name: "multiple direct rel (with id)",
          collectionIdOrName: "demo4",
          rule: "self_rel_many.id ?> true",
          allowHiddenFields: false,
          expectQuery:
            "SELECT DISTINCT `demo4`.* FROM `demo4` LEFT JOIN json_each(CASE WHEN iif(json_valid([[demo4.self_rel_many]]), json_type([[demo4.self_rel_many]])='array', FALSE) THEN [[demo4.self_rel_many]] ELSE json_array([[demo4.self_rel_many]]) END) `__je_demo4_self_rel_many` LEFT JOIN `demo4` `demo4_self_rel_many` ON [[demo4_self_rel_many.id]] = [[__je_demo4_self_rel_many.value]] WHERE [[demo4_self_rel_many.id]] > 1",
        },
        {
          name: "rel to collection with empty list rule",
          collectionIdOrName: "demo4",
          rule: "self_rel_one.created > true",
          allowHiddenFields: false,
          expectQuery:
            "SELECT DISTINCT `demo4`.* FROM `demo4` LEFT JOIN `demo4` `demo4_self_rel_one` ON [[demo4_self_rel_one.id]] = [[demo4.self_rel_one]] WHERE [[demo4_self_rel_one.created]] > 1",
        },
        {
          name: "rel to collection with non-empty list rule",
          collectionIdOrName: "demo4",
          rule: "rel_one_cascade.created > true",
          allowHiddenFields: false,
          expectQuery:
            "SELECT DISTINCT `demo4`.* FROM `demo4` LEFT JOIN `demo3` `demo4_rel_one_cascade` ON [[demo4_rel_one_cascade.id]] = [[demo4.rel_one_cascade]] WHERE (({:TEST} IS NOT '' AND {:TEST} IS NOT {:TEST})) AND ([[demo4_rel_one_cascade.created]] > 1)",
        },
        {
          name: "rel to collection with non-empty list rule (with allowHiddenFields)",
          collectionIdOrName: "demo4",
          rule: "rel_one_cascade.created > true",
          allowHiddenFields: true,
          expectQuery:
            "SELECT DISTINCT `demo4`.* FROM `demo4` LEFT JOIN `demo3` `demo4_rel_one_cascade` ON [[demo4_rel_one_cascade.id]] = [[demo4.rel_one_cascade]] WHERE [[demo4_rel_one_cascade.created]] > 1",
        },
        {
          name: "rel to collection with superusers only list rule",
          collectionIdOrName: "demo1",
          rule: "rel_many.created ?> true",
          allowHiddenFields: false,
          expectQuery: "",
        },
        {
          name: "rel to collection with superusers only list rule (with allowHiddenFields)",
          collectionIdOrName: "demo1",
          rule: "rel_many.created ?> true",
          allowHiddenFields: true,
          expectQuery:
            "SELECT DISTINCT `demo1`.* FROM `demo1` LEFT JOIN json_each(CASE WHEN iif(json_valid([[demo1.rel_many]]), json_type([[demo1.rel_many]])='array', FALSE) THEN [[demo1.rel_many]] ELSE json_array([[demo1.rel_many]]) END) `__je_demo1_rel_many` LEFT JOIN `users` `demo1_rel_many` ON [[demo1_rel_many.id]] = [[__je_demo1_rel_many.value]] WHERE [[demo1_rel_many.created]] > 1",
        },
        {
          name: "nested rels with all empty list rules",
          collectionIdOrName: "demo4",
          rule: "self_rel_one.self_rel_one.title > true",
          allowHiddenFields: false,
          expectQuery:
            "SELECT DISTINCT `demo4`.* FROM `demo4` LEFT JOIN `demo4` `demo4_self_rel_one` ON [[demo4_self_rel_one.id]] = [[demo4.self_rel_one]] LEFT JOIN `demo4` `demo4_self_rel_one_self_rel_one` ON [[demo4_self_rel_one_self_rel_one.id]] = [[demo4_self_rel_one.self_rel_one]] WHERE [[demo4_self_rel_one_self_rel_one.title]] > 1",
        },
        {
          name: "nested rels with non-empty list rule",
          collectionIdOrName: "demo4",
          rule: "self_rel_one.rel_one_cascade.created > true",
          allowHiddenFields: false,
          expectQuery:
            "SELECT DISTINCT `demo4`.* FROM `demo4` LEFT JOIN `demo4` `demo4_self_rel_one` ON [[demo4_self_rel_one.id]] = [[demo4.self_rel_one]] LEFT JOIN `demo3` `demo4_self_rel_one_rel_one_cascade` ON [[demo4_self_rel_one_rel_one_cascade.id]] = [[demo4_self_rel_one.rel_one_cascade]] WHERE (({:TEST} IS NOT '' AND {:TEST} IS NOT {:TEST})) AND ([[demo4_self_rel_one_rel_one_cascade.created]] > 1)",
        },
        {
          name: "nested rels with non-empty list rule (joins reuse test)",
          collectionIdOrName: "demo4",
          rule: "self_rel_one.rel_one_cascade.created > true && self_rel_one.rel_one_cascade.updated > true",
          allowHiddenFields: false,
          expectQuery:
            "SELECT DISTINCT `demo4`.* FROM `demo4` LEFT JOIN `demo4` `demo4_self_rel_one` ON [[demo4_self_rel_one.id]] = [[demo4.self_rel_one]] LEFT JOIN `demo3` `demo4_self_rel_one_rel_one_cascade` ON [[demo4_self_rel_one_rel_one_cascade.id]] = [[demo4_self_rel_one.rel_one_cascade]] WHERE (({:TEST} IS NOT '' AND {:TEST} IS NOT {:TEST})) AND (([[demo4_self_rel_one_rel_one_cascade.created]] > 1 AND [[demo4_self_rel_one_rel_one_cascade.updated]] > 1))",
        },
        {
          name: "nested rels with non-empty list rule (with allowHiddenFields)",
          collectionIdOrName: "demo4",
          rule: "self_rel_one.rel_one_cascade.created > true",
          allowHiddenFields: true,
          expectQuery:
            "SELECT DISTINCT `demo4`.* FROM `demo4` LEFT JOIN `demo4` `demo4_self_rel_one` ON [[demo4_self_rel_one.id]] = [[demo4.self_rel_one]] LEFT JOIN `demo3` `demo4_self_rel_one_rel_one_cascade` ON [[demo4_self_rel_one_rel_one_cascade.id]] = [[demo4_self_rel_one.rel_one_cascade]] WHERE [[demo4_self_rel_one_rel_one_cascade.created]] > 1",
        },
        {
          name: "non-relation field + single rel",
          collectionIdOrName: "demo4",
          rule: "title > true || self_rel_one.title > true",
          allowHiddenFields: false,
          expectQuery:
            "SELECT DISTINCT `demo4`.* FROM `demo4` LEFT JOIN `demo4` `demo4_self_rel_one` ON [[demo4_self_rel_one.id]] = [[demo4.self_rel_one]] WHERE ([[demo4.title]] > 1 OR [[demo4_self_rel_one.title]] > 1)",
        },
        {
          name: "nested incomplete relations (opt/any operator)",
          collectionIdOrName: "demo4",
          rule: "self_rel_many.self_rel_one ?> true",
          allowHiddenFields: false,
          expectQuery:
            "SELECT DISTINCT `demo4`.* FROM `demo4` LEFT JOIN json_each(CASE WHEN iif(json_valid([[demo4.self_rel_many]]), json_type([[demo4.self_rel_many]])='array', FALSE) THEN [[demo4.self_rel_many]] ELSE json_array([[demo4.self_rel_many]]) END) `__je_demo4_self_rel_many` LEFT JOIN `demo4` `demo4_self_rel_many` ON [[demo4_self_rel_many.id]] = [[__je_demo4_self_rel_many.value]] WHERE [[demo4_self_rel_many.self_rel_one]] > 1",
        },
        {
          name: "nested incomplete relations (multi-match operator)",
          collectionIdOrName: "demo4",
          rule: "self_rel_many.self_rel_one > true",
          allowHiddenFields: false,
          expectQuery:
            "SELECT DISTINCT `demo4`.* FROM `demo4` LEFT JOIN json_each(CASE WHEN iif(json_valid([[demo4.self_rel_many]]), json_type([[demo4.self_rel_many]])='array', FALSE) THEN [[demo4.self_rel_many]] ELSE json_array([[demo4.self_rel_many]]) END) `__je_demo4_self_rel_many` LEFT JOIN `demo4` `demo4_self_rel_many` ON [[demo4_self_rel_many.id]] = [[__je_demo4_self_rel_many.value]] WHERE ((([[demo4_self_rel_many.self_rel_one]] > 1) AND (NOT EXISTS (SELECT 1 FROM (SELECT [[__mm_demo4_self_rel_many.self_rel_one]] as [[multiMatchValue]] FROM `demo4` `__mm_demo4` LEFT JOIN json_each(CASE WHEN iif(json_valid([[__mm_demo4.self_rel_many]]), json_type([[__mm_demo4.self_rel_many]])='array', FALSE) THEN [[__mm_demo4.self_rel_many]] ELSE json_array([[__mm_demo4.self_rel_many]]) END) `__mm_demo4_self_rel_many_je` LEFT JOIN `demo4` `__mm_demo4_self_rel_many` ON [[__mm_demo4_self_rel_many.id]] = [[__mm_demo4_self_rel_many_je.value]] WHERE [[__mm_demo4.id]] = [[demo4.id]]) {{__smTEST}} WHERE NOT ([[__smTEST.multiMatchValue]] > 1)))))",
        },
        {
          name: "nested complete relations (opt/any operator)",
          collectionIdOrName: "demo4",
          rule: "self_rel_many.self_rel_one.title ?> true",
          allowHiddenFields: false,
          expectQuery:
            "SELECT DISTINCT `demo4`.* FROM `demo4` LEFT JOIN json_each(CASE WHEN iif(json_valid([[demo4.self_rel_many]]), json_type([[demo4.self_rel_many]])='array', FALSE) THEN [[demo4.self_rel_many]] ELSE json_array([[demo4.self_rel_many]]) END) `__je_demo4_self_rel_many` LEFT JOIN `demo4` `demo4_self_rel_many` ON [[demo4_self_rel_many.id]] = [[__je_demo4_self_rel_many.value]] LEFT JOIN `demo4` `demo4_self_rel_many_self_rel_one` ON [[demo4_self_rel_many_self_rel_one.id]] = [[demo4_self_rel_many.self_rel_one]] WHERE [[demo4_self_rel_many_self_rel_one.title]] > 1",
        },
        {
          name: "nested complete relations (multi-match operator)",
          collectionIdOrName: "demo4",
          rule: "self_rel_many.self_rel_one.title > true",
          allowHiddenFields: false,
          expectQuery:
            "SELECT DISTINCT `demo4`.* FROM `demo4` LEFT JOIN json_each(CASE WHEN iif(json_valid([[demo4.self_rel_many]]), json_type([[demo4.self_rel_many]])='array', FALSE) THEN [[demo4.self_rel_many]] ELSE json_array([[demo4.self_rel_many]]) END) `__je_demo4_self_rel_many` LEFT JOIN `demo4` `demo4_self_rel_many` ON [[demo4_self_rel_many.id]] = [[__je_demo4_self_rel_many.value]] LEFT JOIN `demo4` `demo4_self_rel_many_self_rel_one` ON [[demo4_self_rel_many_self_rel_one.id]] = [[demo4_self_rel_many.self_rel_one]] WHERE ((([[demo4_self_rel_many_self_rel_one.title]] > 1) AND (NOT EXISTS (SELECT 1 FROM (SELECT [[__mm_demo4_self_rel_many_self_rel_one.title]] as [[multiMatchValue]] FROM `demo4` `__mm_demo4` LEFT JOIN json_each(CASE WHEN iif(json_valid([[__mm_demo4.self_rel_many]]), json_type([[__mm_demo4.self_rel_many]])='array', FALSE) THEN [[__mm_demo4.self_rel_many]] ELSE json_array([[__mm_demo4.self_rel_many]]) END) `__mm_demo4_self_rel_many_je` LEFT JOIN `demo4` `__mm_demo4_self_rel_many` ON [[__mm_demo4_self_rel_many.id]] = [[__mm_demo4_self_rel_many_je.value]] LEFT JOIN `demo4` `__mm_demo4_self_rel_many_self_rel_one` ON [[__mm_demo4_self_rel_many_self_rel_one.id]] = [[__mm_demo4_self_rel_many.self_rel_one]] WHERE [[__mm_demo4.id]] = [[demo4.id]]) {{__smTEST}} WHERE NOT ([[__smTEST.multiMatchValue]] > 1)))))",
        },
        {
          name: "repeated nested relations (opt/any operator)",
          collectionIdOrName: "demo4",
          rule: "self_rel_many.self_rel_one.self_rel_many.self_rel_one.title ?> true",
          allowHiddenFields: false,
          expectQuery:
            "SELECT DISTINCT `demo4`.* FROM `demo4` LEFT JOIN json_each(CASE WHEN iif(json_valid([[demo4.self_rel_many]]), json_type([[demo4.self_rel_many]])='array', FALSE) THEN [[demo4.self_rel_many]] ELSE json_array([[demo4.self_rel_many]]) END) `__je_demo4_self_rel_many` LEFT JOIN `demo4` `demo4_self_rel_many` ON [[demo4_self_rel_many.id]] = [[__je_demo4_self_rel_many.value]] LEFT JOIN `demo4` `demo4_self_rel_many_self_rel_one` ON [[demo4_self_rel_many_self_rel_one.id]] = [[demo4_self_rel_many.self_rel_one]] LEFT JOIN json_each(CASE WHEN iif(json_valid([[demo4_self_rel_many_self_rel_one.self_rel_many]]), json_type([[demo4_self_rel_many_self_rel_one.self_rel_many]])='array', FALSE) THEN [[demo4_self_rel_many_self_rel_one.self_rel_many]] ELSE json_array([[demo4_self_rel_many_self_rel_one.self_rel_many]]) END) `__je_demo4_self_rel_many_self_rel_one_self_rel_many` LEFT JOIN `demo4` `demo4_self_rel_many_self_rel_one_self_rel_many` ON [[demo4_self_rel_many_self_rel_one_self_rel_many.id]] = [[__je_demo4_self_rel_many_self_rel_one_self_rel_many.value]] LEFT JOIN `demo4` `demo4_self_rel_many_self_rel_one_self_rel_many_self_rel_one` ON [[demo4_self_rel_many_self_rel_one_self_rel_many_self_rel_one.id]] = [[demo4_self_rel_many_self_rel_one_self_rel_many.self_rel_one]] WHERE [[demo4_self_rel_many_self_rel_one_self_rel_many_self_rel_one.title]] > 1",
        },
        {
          name: "repeated nested relations (multi-match operator)",
          collectionIdOrName: "demo4",
          rule: "self_rel_many.self_rel_one.self_rel_many.self_rel_one.title > true",
          allowHiddenFields: false,
          expectQuery:
            "SELECT DISTINCT `demo4`.* FROM `demo4` LEFT JOIN json_each(CASE WHEN iif(json_valid([[demo4.self_rel_many]]), json_type([[demo4.self_rel_many]])='array', FALSE) THEN [[demo4.self_rel_many]] ELSE json_array([[demo4.self_rel_many]]) END) `__je_demo4_self_rel_many` LEFT JOIN `demo4` `demo4_self_rel_many` ON [[demo4_self_rel_many.id]] = [[__je_demo4_self_rel_many.value]] LEFT JOIN `demo4` `demo4_self_rel_many_self_rel_one` ON [[demo4_self_rel_many_self_rel_one.id]] = [[demo4_self_rel_many.self_rel_one]] LEFT JOIN json_each(CASE WHEN iif(json_valid([[demo4_self_rel_many_self_rel_one.self_rel_many]]), json_type([[demo4_self_rel_many_self_rel_one.self_rel_many]])='array', FALSE) THEN [[demo4_self_rel_many_self_rel_one.self_rel_many]] ELSE json_array([[demo4_self_rel_many_self_rel_one.self_rel_many]]) END) `__je_demo4_self_rel_many_self_rel_one_self_rel_many` LEFT JOIN `demo4` `demo4_self_rel_many_self_rel_one_self_rel_many` ON [[demo4_self_rel_many_self_rel_one_self_rel_many.id]] = [[__je_demo4_self_rel_many_self_rel_one_self_rel_many.value]] LEFT JOIN `demo4` `demo4_self_rel_many_self_rel_one_self_rel_many_self_rel_one` ON [[demo4_self_rel_many_self_rel_one_self_rel_many_self_rel_one.id]] = [[demo4_self_rel_many_self_rel_one_self_rel_many.self_rel_one]] WHERE ((([[demo4_self_rel_many_self_rel_one_self_rel_many_self_rel_one.title]] > 1) AND (NOT EXISTS (SELECT 1 FROM (SELECT [[__mm_demo4_self_rel_many_self_rel_one_self_rel_many_self_rel_one.title]] as [[multiMatchValue]] FROM `demo4` `__mm_demo4` LEFT JOIN json_each(CASE WHEN iif(json_valid([[__mm_demo4.self_rel_many]]), json_type([[__mm_demo4.self_rel_many]])='array', FALSE) THEN [[__mm_demo4.self_rel_many]] ELSE json_array([[__mm_demo4.self_rel_many]]) END) `__mm_demo4_self_rel_many_je` LEFT JOIN `demo4` `__mm_demo4_self_rel_many` ON [[__mm_demo4_self_rel_many.id]] = [[__mm_demo4_self_rel_many_je.value]] LEFT JOIN `demo4` `__mm_demo4_self_rel_many_self_rel_one` ON [[__mm_demo4_self_rel_many_self_rel_one.id]] = [[__mm_demo4_self_rel_many.self_rel_one]] LEFT JOIN json_each(CASE WHEN iif(json_valid([[__mm_demo4_self_rel_many_self_rel_one.self_rel_many]]), json_type([[__mm_demo4_self_rel_many_self_rel_one.self_rel_many]])='array', FALSE) THEN [[__mm_demo4_self_rel_many_self_rel_one.self_rel_many]] ELSE json_array([[__mm_demo4_self_rel_many_self_rel_one.self_rel_many]]) END) `__mm_demo4_self_rel_many_self_rel_one_self_rel_many_je` LEFT JOIN `demo4` `__mm_demo4_self_rel_many_self_rel_one_self_rel_many` ON [[__mm_demo4_self_rel_many_self_rel_one_self_rel_many.id]] = [[__mm_demo4_self_rel_many_self_rel_one_self_rel_many_je.value]] LEFT JOIN `demo4` `__mm_demo4_self_rel_many_self_rel_one_self_rel_many_self_rel_one` ON [[__mm_demo4_self_rel_many_self_rel_one_self_rel_many_self_rel_one.id]] = [[__mm_demo4_self_rel_many_self_rel_one_self_rel_many.self_rel_one]] WHERE [[__mm_demo4.id]] = [[demo4.id]]) {{__smTEST}} WHERE NOT ([[__smTEST.multiMatchValue]] > 1)))))",
        },
        {
          name: "multiple relations (opt/any operators)",
          collectionIdOrName: "demo4",
          rule: "self_rel_many.title ?= 'test' || self_rel_one.json_object.a ?> true",
          allowHiddenFields: false,
          expectQuery:
            "SELECT DISTINCT `demo4`.* FROM `demo4` LEFT JOIN json_each(CASE WHEN iif(json_valid([[demo4.self_rel_many]]), json_type([[demo4.self_rel_many]])='array', FALSE) THEN [[demo4.self_rel_many]] ELSE json_array([[demo4.self_rel_many]]) END) `__je_demo4_self_rel_many` LEFT JOIN `demo4` `demo4_self_rel_many` ON [[demo4_self_rel_many.id]] = [[__je_demo4_self_rel_many.value]] LEFT JOIN `demo4` `demo4_self_rel_one` ON [[demo4_self_rel_one.id]] = [[demo4.self_rel_one]] WHERE ([[demo4_self_rel_many.title]] = {:TEST} OR (CASE WHEN json_valid([[demo4_self_rel_one.json_object]]) THEN JSON_EXTRACT([[demo4_self_rel_one.json_object]], '$.a') ELSE JSON_EXTRACT(json_object('pb', [[demo4_self_rel_one.json_object]]), '$.pb.a') END) > 1)",
        },
        {
          name: "multiple relations (multi-match operators)",
          collectionIdOrName: "demo4",
          rule: "self_rel_many.title = 'test' || self_rel_one.json_object.a > true",
          allowHiddenFields: false,
          expectQuery:
            "SELECT DISTINCT `demo4`.* FROM `demo4` LEFT JOIN json_each(CASE WHEN iif(json_valid([[demo4.self_rel_many]]), json_type([[demo4.self_rel_many]])='array', FALSE) THEN [[demo4.self_rel_many]] ELSE json_array([[demo4.self_rel_many]]) END) `__je_demo4_self_rel_many` LEFT JOIN `demo4` `demo4_self_rel_many` ON [[demo4_self_rel_many.id]] = [[__je_demo4_self_rel_many.value]] LEFT JOIN `demo4` `demo4_self_rel_one` ON [[demo4_self_rel_one.id]] = [[demo4.self_rel_one]] WHERE ((([[demo4_self_rel_many.title]] = {:TEST}) AND (NOT EXISTS (SELECT 1 FROM (SELECT [[__mm_demo4_self_rel_many.title]] as [[multiMatchValue]] FROM `demo4` `__mm_demo4` LEFT JOIN json_each(CASE WHEN iif(json_valid([[__mm_demo4.self_rel_many]]), json_type([[__mm_demo4.self_rel_many]])='array', FALSE) THEN [[__mm_demo4.self_rel_many]] ELSE json_array([[__mm_demo4.self_rel_many]]) END) `__mm_demo4_self_rel_many_je` LEFT JOIN `demo4` `__mm_demo4_self_rel_many` ON [[__mm_demo4_self_rel_many.id]] = [[__mm_demo4_self_rel_many_je.value]] WHERE [[__mm_demo4.id]] = [[demo4.id]]) {{__smTEST}} WHERE NOT ([[__smTEST.multiMatchValue]] = {:TEST})))) OR (((CASE WHEN json_valid([[demo4_self_rel_one.json_object]]) THEN JSON_EXTRACT([[demo4_self_rel_one.json_object]], '$.a') ELSE JSON_EXTRACT(json_object('pb', [[demo4_self_rel_one.json_object]]), '$.pb.a') END) > 1) AND (NOT EXISTS (SELECT 1 FROM (SELECT (CASE WHEN json_valid([[__mm_demo4_self_rel_one.json_object]]) THEN JSON_EXTRACT([[__mm_demo4_self_rel_one.json_object]], '$.a') ELSE JSON_EXTRACT(json_object('pb', [[__mm_demo4_self_rel_one.json_object]]), '$.pb.a') END) as [[multiMatchValue]] FROM `demo4` `__mm_demo4` LEFT JOIN `demo4` `__mm_demo4_self_rel_one` ON [[__mm_demo4_self_rel_one.id]] = [[__mm_demo4.self_rel_one]] WHERE [[__mm_demo4.id]] = [[demo4.id]]) {{__smTEST}} WHERE NOT ([[__smTEST.multiMatchValue]] > 1)))))",
        },
        {
          name: "back relations via single relation field (without unique index)",
          collectionIdOrName: "demo3",
          rule: "demo4_via_rel_one_cascade.id = true",
          allowHiddenFields: false,
          expectQuery:
            "SELECT DISTINCT `demo3`.* FROM `demo3` LEFT JOIN `demo4` `demo3_demo4_via_rel_one_cascade` ON [[demo3_demo4_via_rel_one_cascade.rel_one_cascade]] = [[demo3.id]] WHERE ((([[demo3_demo4_via_rel_one_cascade.id]] = 1) AND (NOT EXISTS (SELECT 1 FROM (SELECT [[__mm_demo3_demo4_via_rel_one_cascade.id]] as [[multiMatchValue]] FROM `demo3` `__mm_demo3` LEFT JOIN `demo4` `__mm_demo3_demo4_via_rel_one_cascade` ON [[__mm_demo3_demo4_via_rel_one_cascade.rel_one_cascade]] = [[__mm_demo3.id]] WHERE [[__mm_demo3.id]] = [[demo3.id]]) {{__smTEST}} WHERE NOT ([[__smTEST.multiMatchValue]] = 1)))))",
        },
        {
          name: "back relations via single relation field (with unique index)",
          collectionIdOrName: "demo3",
          rule: "demo4_via_rel_one_unique.id = true",
          allowHiddenFields: false,
          expectQuery:
            "SELECT DISTINCT `demo3`.* FROM `demo3` LEFT JOIN `demo4` `demo3_demo4_via_rel_one_unique` ON [[demo3_demo4_via_rel_one_unique.rel_one_unique]] = [[demo3.id]] WHERE [[demo3_demo4_via_rel_one_unique.id]] = 1",
        },
        {
          name: "back relations via multiple relation field (opt/any operators)",
          collectionIdOrName: "demo3",
          rule: "demo4_via_rel_many_cascade.id ?= true",
          allowHiddenFields: false,
          expectQuery:
            "SELECT DISTINCT `demo3`.* FROM `demo3` LEFT JOIN `demo4` `demo3_demo4_via_rel_many_cascade` ON [[demo3.id]] IN (SELECT [[__je_demo3_demo4_via_rel_many_cascade.value]] FROM json_each(CASE WHEN iif(json_valid([[demo3_demo4_via_rel_many_cascade.rel_many_cascade]]), json_type([[demo3_demo4_via_rel_many_cascade.rel_many_cascade]])='array', FALSE) THEN [[demo3_demo4_via_rel_many_cascade.rel_many_cascade]] ELSE json_array([[demo3_demo4_via_rel_many_cascade.rel_many_cascade]]) END) {{__je_demo3_demo4_via_rel_many_cascade}}) WHERE [[demo3_demo4_via_rel_many_cascade.id]] = 1",
        },
        {
          name: "back relations via multiple relation field (multi-match operators)",
          collectionIdOrName: "demo3",
          rule: "demo4_via_rel_many_cascade.id = true",
          allowHiddenFields: false,
          expectQuery:
            "SELECT DISTINCT `demo3`.* FROM `demo3` LEFT JOIN `demo4` `demo3_demo4_via_rel_many_cascade` ON [[demo3.id]] IN (SELECT [[__je_demo3_demo4_via_rel_many_cascade.value]] FROM json_each(CASE WHEN iif(json_valid([[demo3_demo4_via_rel_many_cascade.rel_many_cascade]]), json_type([[demo3_demo4_via_rel_many_cascade.rel_many_cascade]])='array', FALSE) THEN [[demo3_demo4_via_rel_many_cascade.rel_many_cascade]] ELSE json_array([[demo3_demo4_via_rel_many_cascade.rel_many_cascade]]) END) {{__je_demo3_demo4_via_rel_many_cascade}}) WHERE ((([[demo3_demo4_via_rel_many_cascade.id]] = 1) AND (NOT EXISTS (SELECT 1 FROM (SELECT [[__mm_demo3_demo4_via_rel_many_cascade.id]] as [[multiMatchValue]] FROM `demo3` `__mm_demo3` LEFT JOIN `demo4` `__mm_demo3_demo4_via_rel_many_cascade` ON [[__mm_demo3.id]] IN (SELECT [[__je___mm_demo3_demo4_via_rel_many_cascade.value]] FROM json_each(CASE WHEN iif(json_valid([[__mm_demo3_demo4_via_rel_many_cascade.rel_many_cascade]]), json_type([[__mm_demo3_demo4_via_rel_many_cascade.rel_many_cascade]])='array', FALSE) THEN [[__mm_demo3_demo4_via_rel_many_cascade.rel_many_cascade]] ELSE json_array([[__mm_demo3_demo4_via_rel_many_cascade.rel_many_cascade]]) END) {{__je___mm_demo3_demo4_via_rel_many_cascade}}) WHERE [[__mm_demo3.id]] = [[demo3.id]]) {{__smTEST}} WHERE NOT ([[__smTEST.multiMatchValue]] = 1)))))",
        },
        {
          name: "back relations via unique multiple relation field (should be the same as multi-match)",
          collectionIdOrName: "demo3",
          rule: "demo4_via_rel_many_unique.id = true",
          allowHiddenFields: false,
          expectQuery:
            "SELECT DISTINCT `demo3`.* FROM `demo3` LEFT JOIN `demo4` `demo3_demo4_via_rel_many_unique` ON [[demo3.id]] IN (SELECT [[__je_demo3_demo4_via_rel_many_unique.value]] FROM json_each(CASE WHEN iif(json_valid([[demo3_demo4_via_rel_many_unique.rel_many_unique]]), json_type([[demo3_demo4_via_rel_many_unique.rel_many_unique]])='array', FALSE) THEN [[demo3_demo4_via_rel_many_unique.rel_many_unique]] ELSE json_array([[demo3_demo4_via_rel_many_unique.rel_many_unique]]) END) {{__je_demo3_demo4_via_rel_many_unique}}) WHERE ((([[demo3_demo4_via_rel_many_unique.id]] = 1) AND (NOT EXISTS (SELECT 1 FROM (SELECT [[__mm_demo3_demo4_via_rel_many_unique.id]] as [[multiMatchValue]] FROM `demo3` `__mm_demo3` LEFT JOIN `demo4` `__mm_demo3_demo4_via_rel_many_unique` ON [[__mm_demo3.id]] IN (SELECT [[__je___mm_demo3_demo4_via_rel_many_unique.value]] FROM json_each(CASE WHEN iif(json_valid([[__mm_demo3_demo4_via_rel_many_unique.rel_many_unique]]), json_type([[__mm_demo3_demo4_via_rel_many_unique.rel_many_unique]])='array', FALSE) THEN [[__mm_demo3_demo4_via_rel_many_unique.rel_many_unique]] ELSE json_array([[__mm_demo3_demo4_via_rel_many_unique.rel_many_unique]]) END) {{__je___mm_demo3_demo4_via_rel_many_unique}}) WHERE [[__mm_demo3.id]] = [[demo3.id]]) {{__smTEST}} WHERE NOT ([[__smTEST.multiMatchValue]] = 1)))))",
        },
        {
          name: "view back relation with non-empty and superusers list rules",
          collectionIdOrName: "demo1",
          rule: "view1_via_rel_one.rel_many.created ?> true",
          allowHiddenFields: false,
          expectQuery: "",
        },
        {
          name: "view back relation with non-empty and superusers list rules (with allowHiddenFields)",
          collectionIdOrName: "demo1",
          rule: "view1_via_rel_one.rel_many.created ?> true",
          allowHiddenFields: true,
          expectQuery:
            "SELECT DISTINCT `demo1`.* FROM `demo1` LEFT JOIN `view1` `demo1_view1_via_rel_one` ON [[demo1_view1_via_rel_one.rel_one]] = [[demo1.id]] LEFT JOIN json_each(CASE WHEN iif(json_valid([[demo1_view1_via_rel_one.rel_many]]), json_type([[demo1_view1_via_rel_one.rel_many]])='array', FALSE) THEN [[demo1_view1_via_rel_one.rel_many]] ELSE json_array([[demo1_view1_via_rel_one.rel_many]]) END) `__je_demo1_view1_via_rel_one_rel_many` LEFT JOIN `users` `demo1_view1_via_rel_one_rel_many` ON [[demo1_view1_via_rel_one_rel_many.id]] = [[__je_demo1_view1_via_rel_one_rel_many.value]] WHERE [[demo1_view1_via_rel_one_rel_many.created]] > 1",
        },
        {
          name: "recursive back relations with non-empty list rule",
          collectionIdOrName: "demo3",
          rule: "demo4_via_rel_many_cascade.rel_one_cascade.demo4_via_rel_many_cascade.id ?= true",
          allowHiddenFields: false,
          expectQuery:
            "SELECT DISTINCT `demo3`.* FROM `demo3` LEFT JOIN `demo4` `demo3_demo4_via_rel_many_cascade` ON [[demo3.id]] IN (SELECT [[__je_demo3_demo4_via_rel_many_cascade.value]] FROM json_each(CASE WHEN iif(json_valid([[demo3_demo4_via_rel_many_cascade.rel_many_cascade]]), json_type([[demo3_demo4_via_rel_many_cascade.rel_many_cascade]])='array', FALSE) THEN [[demo3_demo4_via_rel_many_cascade.rel_many_cascade]] ELSE json_array([[demo3_demo4_via_rel_many_cascade.rel_many_cascade]]) END) {{__je_demo3_demo4_via_rel_many_cascade}}) LEFT JOIN `demo3` `demo3_demo4_via_rel_many_cascade_rel_one_cascade` ON [[demo3_demo4_via_rel_many_cascade_rel_one_cascade.id]] = [[demo3_demo4_via_rel_many_cascade.rel_one_cascade]] LEFT JOIN `demo4` `demo3_demo4_via_rel_many_cascade_rel_one_cascade_demo4_via_rel_many_cascade` ON [[demo3_demo4_via_rel_many_cascade_rel_one_cascade.id]] IN (SELECT [[__je_demo3_demo4_via_rel_many_cascade_rel_one_cascade_demo4_via_rel_many_cascade.value]] FROM json_each(CASE WHEN iif(json_valid([[demo3_demo4_via_rel_many_cascade_rel_one_cascade_demo4_via_rel_many_cascade.rel_many_cascade]]), json_type([[demo3_demo4_via_rel_many_cascade_rel_one_cascade_demo4_via_rel_many_cascade.rel_many_cascade]])='array', FALSE) THEN [[demo3_demo4_via_rel_many_cascade_rel_one_cascade_demo4_via_rel_many_cascade.rel_many_cascade]] ELSE json_array([[demo3_demo4_via_rel_many_cascade_rel_one_cascade_demo4_via_rel_many_cascade.rel_many_cascade]]) END) {{__je_demo3_demo4_via_rel_many_cascade_rel_one_cascade_demo4_via_rel_many_cascade}}) WHERE (({:TEST} IS NOT '' AND {:TEST} IS NOT {:TEST})) AND ([[demo3_demo4_via_rel_many_cascade_rel_one_cascade_demo4_via_rel_many_cascade.id]] = 1)",
        },
        {
          name: "recursive back relations with non-empty list rule (with allowHiddenFields)",
          collectionIdOrName: "demo3",
          rule: "demo4_via_rel_many_cascade.rel_one_cascade.demo4_via_rel_many_cascade.id ?= true",
          allowHiddenFields: true,
          expectQuery:
            "SELECT DISTINCT `demo3`.* FROM `demo3` LEFT JOIN `demo4` `demo3_demo4_via_rel_many_cascade` ON [[demo3.id]] IN (SELECT [[__je_demo3_demo4_via_rel_many_cascade.value]] FROM json_each(CASE WHEN iif(json_valid([[demo3_demo4_via_rel_many_cascade.rel_many_cascade]]), json_type([[demo3_demo4_via_rel_many_cascade.rel_many_cascade]])='array', FALSE) THEN [[demo3_demo4_via_rel_many_cascade.rel_many_cascade]] ELSE json_array([[demo3_demo4_via_rel_many_cascade.rel_many_cascade]]) END) {{__je_demo3_demo4_via_rel_many_cascade}}) LEFT JOIN `demo3` `demo3_demo4_via_rel_many_cascade_rel_one_cascade` ON [[demo3_demo4_via_rel_many_cascade_rel_one_cascade.id]] = [[demo3_demo4_via_rel_many_cascade.rel_one_cascade]] LEFT JOIN `demo4` `demo3_demo4_via_rel_many_cascade_rel_one_cascade_demo4_via_rel_many_cascade` ON [[demo3_demo4_via_rel_many_cascade_rel_one_cascade.id]] IN (SELECT [[__je_demo3_demo4_via_rel_many_cascade_rel_one_cascade_demo4_via_rel_many_cascade.value]] FROM json_each(CASE WHEN iif(json_valid([[demo3_demo4_via_rel_many_cascade_rel_one_cascade_demo4_via_rel_many_cascade.rel_many_cascade]]), json_type([[demo3_demo4_via_rel_many_cascade_rel_one_cascade_demo4_via_rel_many_cascade.rel_many_cascade]])='array', FALSE) THEN [[demo3_demo4_via_rel_many_cascade_rel_one_cascade_demo4_via_rel_many_cascade.rel_many_cascade]] ELSE json_array([[demo3_demo4_via_rel_many_cascade_rel_one_cascade_demo4_via_rel_many_cascade.rel_many_cascade]]) END) {{__je_demo3_demo4_via_rel_many_cascade_rel_one_cascade_demo4_via_rel_many_cascade}}) WHERE [[demo3_demo4_via_rel_many_cascade_rel_one_cascade_demo4_via_rel_many_cascade.id]] = 1",
        },
        {
          name: "@collection join (opt/any operators)",
          collectionIdOrName: "demo4",
          rule: "@collection.demo1.text ?> true || @collection.demo2.active ?> true || @collection.demo1:demo1_alias.file_one ?> true",
          allowHiddenFields: true,
          expectQuery:
            "SELECT DISTINCT `demo4`.* FROM `demo4` LEFT JOIN `demo1` `__collection_demo1` LEFT JOIN `demo2` `__collection_demo2` LEFT JOIN `demo1` `__collection_alias_demo1_alias` WHERE ([[__collection_demo1.text]] > 1 OR [[__collection_demo2.active]] > 1 OR [[__collection_alias_demo1_alias.file_one]] > 1)",
        },
        {
          name: "@collection join (multi-match operators)",
          collectionIdOrName: "demo4",
          rule: "@collection.demo1.text > true || @collection.demo2.active > true || @collection.demo1.file_one > true",
          allowHiddenFields: true,
          expectQuery:
            "SELECT DISTINCT `demo4`.* FROM `demo4` LEFT JOIN `demo1` `__collection_demo1` LEFT JOIN `demo2` `__collection_demo2` WHERE ((([[__collection_demo1.text]] > 1) AND (NOT EXISTS (SELECT 1 FROM (SELECT [[__mm___collection_demo1.text]] as [[multiMatchValue]] FROM `demo4` `__mm_demo4` LEFT JOIN `demo1` `__mm___collection_demo1` WHERE [[__mm_demo4.id]] = [[demo4.id]]) {{__smTEST}} WHERE NOT ([[__smTEST.multiMatchValue]] > 1)))) OR (([[__collection_demo2.active]] > 1) AND (NOT EXISTS (SELECT 1 FROM (SELECT [[__mm___collection_demo2.active]] as [[multiMatchValue]] FROM `demo4` `__mm_demo4` LEFT JOIN `demo2` `__mm___collection_demo2` WHERE [[__mm_demo4.id]] = [[demo4.id]]) {{__smTEST}} WHERE NOT ([[__smTEST.multiMatchValue]] > 1)))) OR (([[__collection_demo1.file_one]] > 1) AND (NOT EXISTS (SELECT 1 FROM (SELECT [[__mm___collection_demo1.file_one]] as [[multiMatchValue]] FROM `demo4` `__mm_demo4` LEFT JOIN `demo1` `__mm___collection_demo1` WHERE [[__mm_demo4.id]] = [[demo4.id]]) {{__smTEST}} WHERE NOT ([[__smTEST.multiMatchValue]] > 1)))))",
        },
        {
          name: "@request.auth fields",
          collectionIdOrName: "demo4",
          rule: "@request.auth.id > true || @request.auth.username > true || @request.auth.rel.title > true || @request.body.demo < true || @request.auth.missingA.missingB > false",
          allowHiddenFields: true,
          expectQuery:
            "SELECT DISTINCT `demo4`.* FROM `demo4` LEFT JOIN `users` `__auth_users` ON `__auth_users`.`id`={:p0} LEFT JOIN `demo2` `__auth_users_rel` ON [[__auth_users_rel.id]] = [[__auth_users.rel]] WHERE ({:TEST} > 1 OR [[__auth_users.username]] > 1 OR [[__auth_users_rel.title]] > 1 OR NULL < 1 OR NULL > 0)",
        },
        {
          name: "@request.* static fields",
          collectionIdOrName: "demo4",
          rule: "@request.context = true || @request.query.a = true || @request.query.b = true || @request.query.missing = true || @request.headers.a = true || @request.headers.missing = true",
          allowHiddenFields: true,
          expectQuery:
            "SELECT `demo4`.* FROM `demo4` WHERE ({:TEST} = 1 OR '' = 1 OR {:TEST} = 1 OR '' = 1 OR {:TEST} = 1 OR '' = 1)",
        },
        {
          name: "direct hidden field (add emailVisibility)",
          collectionIdOrName: "users",
          rule: "email > true",
          allowHiddenFields: false,
          expectQuery: "SELECT `users`.* FROM `users` WHERE ((([[users.email]] > 1) AND ([[users.emailVisibility]] = TRUE)))",
        },
        {
          name: "direct hidden field (force ignore emailVisibility)",
          collectionIdOrName: "users",
          rule: "email > true",
          allowHiddenFields: true,
          expectQuery: "SELECT `users`.* FROM `users` WHERE [[users.email]] > 1",
        },
        {
          name: "mixed regular with hidden field and modifier (add emailVisibility)",
          collectionIdOrName: "nologin",
          rule: "id > true || email > true || email:lower > false",
          allowHiddenFields: false,
          expectQuery:
            "SELECT `nologin`.* FROM `nologin` WHERE ([[nologin.id]] > 1 OR (([[nologin.email]] > 1) AND ([[nologin.emailVisibility]] = TRUE)) OR ((LOWER([[nologin.email]]) > 0) AND ([[nologin.emailVisibility]] = TRUE)))",
        },
        {
          name: "system filters in a public auth collection with hidden field and no allowHiddenFields (multi-match and add emailVisibility)",
          collectionIdOrName: "demo4",
          rule: "@collection.nologin.email > true || @request.auth.email > true",
          allowHiddenFields: false,
          expectQuery:
            "SELECT DISTINCT `demo4`.* FROM `demo4` LEFT JOIN `nologin` `__collection_nologin` WHERE ((((([[__collection_nologin.email]] > 1) AND (NOT EXISTS (SELECT 1 FROM (SELECT [[__mm___collection_nologin.email]] as [[multiMatchValue]] FROM `demo4` `__mm_demo4` LEFT JOIN `nologin` `__mm___collection_nologin` WHERE [[__mm_demo4.id]] = [[demo4.id]]) {{__smTEST}} WHERE NOT ([[__smTEST.multiMatchValue]] > 1))))) AND ([[__collection_nologin.emailVisibility]] = TRUE)) OR {:TEST} > 1)",
        },
        {
          name: "system filters in a superuser auth collection with hidden field and NO allowHiddenFields (multi-match and add emailVisibility)",
          collectionIdOrName: "demo4",
          rule: "@collection.users.email > true || @request.auth.email > true",
          allowHiddenFields: false,
          expectQuery: "",
        },
        {
          name: "system filters in a superuser auth collection with hidden field and allowHiddenFields (multi-match and add emailVisibility)",
          collectionIdOrName: "demo4",
          rule: "@collection.users.email > true || @request.auth.email > true",
          allowHiddenFields: true,
          expectQuery:
            "SELECT DISTINCT `demo4`.* FROM `demo4` LEFT JOIN `users` `__collection_users` WHERE ((([[__collection_users.email]] > 1) AND (NOT EXISTS (SELECT 1 FROM (SELECT [[__mm___collection_users.email]] as [[multiMatchValue]] FROM `demo4` `__mm_demo4` LEFT JOIN `users` `__mm___collection_users` WHERE [[__mm_demo4.id]] = [[demo4.id]]) {{__smTEST}} WHERE NOT ([[__smTEST.multiMatchValue]] > 1)))) OR {:TEST} > 1)",
        },
        {
          name: "collection filter in a non-empty list rule collection",
          collectionIdOrName: "demo4",
          rule: "@collection.demo3.title > true",
          allowHiddenFields: false,
          expectQuery:
            "SELECT DISTINCT `demo4`.* FROM `demo4` LEFT JOIN `demo3` `__collection_demo3` WHERE (({:TEST} IS NOT '' AND {:TEST} IS NOT {:TEST})) AND (((([[__collection_demo3.title]] > 1) AND (NOT EXISTS (SELECT 1 FROM (SELECT [[__mm___collection_demo3.title]] as [[multiMatchValue]] FROM `demo4` `__mm_demo4` LEFT JOIN `demo3` `__mm___collection_demo3` WHERE [[__mm_demo4.id]] = [[demo4.id]]) {{__smTEST}} WHERE NOT ([[__smTEST.multiMatchValue]] > 1))))))",
        },
        {
          name: "collection filter in a non-empty list rule collection (with allowHiddenFields)",
          collectionIdOrName: "demo4",
          rule: "@collection.demo3.title > true",
          allowHiddenFields: true,
          expectQuery:
            "SELECT DISTINCT `demo4`.* FROM `demo4` LEFT JOIN `demo3` `__collection_demo3` WHERE ((([[__collection_demo3.title]] > 1) AND (NOT EXISTS (SELECT 1 FROM (SELECT [[__mm___collection_demo3.title]] as [[multiMatchValue]] FROM `demo4` `__mm_demo4` LEFT JOIN `demo3` `__mm___collection_demo3` WHERE [[__mm_demo4.id]] = [[demo4.id]]) {{__smTEST}} WHERE NOT ([[__smTEST.multiMatchValue]] > 1)))))",
        },
        {
          name: "collection fields with :lower modifier",
          collectionIdOrName: "demo1",
          rule:
            "@request.body.rel_one:lower > true ||" +
            "@request.body.rel_many:lower > true ||" +
            "@request.body.rel_many.email:lower > true ||" +
            "text:lower > true ||" +
            "bool:lower > true ||" +
            "url:lower > true ||" +
            "select_one:lower > true ||" +
            "select_many:lower > true ||" +
            "file_one:lower > true ||" +
            "file_many:lower > true ||" +
            "number:lower > true ||" +
            "email:lower > true ||" +
            "datetime:lower > true ||" +
            "json:lower > true ||" +
            "rel_one:lower > true ||" +
            "rel_many:lower > true ||" +
            "rel_many.name:lower > true ||" +
            "created:lower > true",
          allowHiddenFields: true,
          expectQuery:
            "SELECT DISTINCT `demo1`.* FROM `demo1` LEFT JOIN `users` `__data_users_rel_many` ON [[__data_users_rel_many.id]] IN ({:p0}, {:p1}) LEFT JOIN json_each(CASE WHEN iif(json_valid([[demo1.rel_many]]), json_type([[demo1.rel_many]])='array', FALSE) THEN [[demo1.rel_many]] ELSE json_array([[demo1.rel_many]]) END) `__je_demo1_rel_many` LEFT JOIN `users` `demo1_rel_many` ON [[demo1_rel_many.id]] = [[__je_demo1_rel_many.value]] WHERE (LOWER({:infoLowerrel_oneTEST}) > 1 OR LOWER({:infoLowerrel_manyTEST}) > 1 OR ((LOWER([[__data_users_rel_many.email]]) > 1) AND (NOT EXISTS (SELECT 1 FROM (SELECT LOWER([[__mm___data_users_rel_many.email]]) as [[multiMatchValue]] FROM `demo1` `__mm_demo1` LEFT JOIN `users` `__mm___data_users_rel_many` ON [[__mm___data_users_rel_many.id]] IN ({:p4}, {:p5}) WHERE [[__mm_demo1.id]] = [[demo1.id]]) {{__smTEST}} WHERE NOT ([[__smTEST.multiMatchValue]] > 1)))) OR LOWER([[demo1.text]]) > 1 OR LOWER([[demo1.bool]]) > 1 OR LOWER([[demo1.url]]) > 1 OR LOWER([[demo1.select_one]]) > 1 OR LOWER([[demo1.select_many]]) > 1 OR LOWER([[demo1.file_one]]) > 1 OR LOWER([[demo1.file_many]]) > 1 OR LOWER([[demo1.number]]) > 1 OR LOWER([[demo1.email]]) > 1 OR LOWER([[demo1.datetime]]) > 1 OR LOWER((CASE WHEN json_valid([[demo1.json]]) THEN JSON_EXTRACT([[demo1.json]], '$') ELSE JSON_EXTRACT(json_object('pb', [[demo1.json]]), '$.pb') END)) > 1 OR LOWER([[demo1.rel_one]]) > 1 OR LOWER([[demo1.rel_many]]) > 1 OR ((LOWER([[demo1_rel_many.name]]) > 1) AND (NOT EXISTS (SELECT 1 FROM (SELECT LOWER([[__mm_demo1_rel_many.name]]) as [[multiMatchValue]] FROM `demo1` `__mm_demo1` LEFT JOIN json_each(CASE WHEN iif(json_valid([[__mm_demo1.rel_many]]), json_type([[__mm_demo1.rel_many]])='array', FALSE) THEN [[__mm_demo1.rel_many]] ELSE json_array([[__mm_demo1.rel_many]]) END) `__mm_demo1_rel_many_je` LEFT JOIN `users` `__mm_demo1_rel_many` ON [[__mm_demo1_rel_many.id]] = [[__mm_demo1_rel_many_je.value]] WHERE [[__mm_demo1.id]] = [[demo1.id]]) {{__smTEST}} WHERE NOT ([[__smTEST.multiMatchValue]] > 1)))) OR LOWER([[demo1.created]]) > 1)",
        },
        {
          name: "static @request fields with :lower modifier",
          collectionIdOrName: "demo1",
          rule:
            "@request.body.a:lower > true ||" +
            "@request.body.b:lower > true ||" +
            "@request.body.c:lower > true ||" +
            "@request.query.a:lower > true ||" +
            "@request.query.b:lower > true ||" +
            "@request.query.c:lower > true ||" +
            "@request.headers.a:lower > true ||" +
            "@request.headers.c:lower > true",
          allowHiddenFields: false,
          expectQuery:
            "SELECT `demo1`.* FROM `demo1` WHERE (NULL > 1 OR LOWER({:TEST}) > 1 OR NULL > 1 OR LOWER({:TEST}) > 1 OR LOWER({:TEST}) > 1 OR NULL > 1 OR LOWER({:TEST}) > 1 OR NULL > 1)",
        },
        {
          name: "isset modifier",
          collectionIdOrName: "demo1",
          rule:
            "@request.body.a:isset > true ||" +
            "@request.body.b:isset > true ||" +
            "@request.body.c:isset > true ||" +
            "@request.query.a:isset > true ||" +
            "@request.query.b:isset > true ||" +
            "@request.query.c:isset > true ||" +
            "@request.headers.a:isset > true ||" +
            "@request.headers.c:isset > true",
          allowHiddenFields: false,
          expectQuery:
            "SELECT `demo1`.* FROM `demo1` WHERE (TRUE > 1 OR TRUE > 1 OR FALSE > 1 OR TRUE > 1 OR TRUE > 1 OR FALSE > 1 OR TRUE > 1 OR FALSE > 1)",
        },
        {
          name: "@request.body.rel.* fields",
          collectionIdOrName: "demo4",
          rule:
            "@request.body.rel_one_cascade.title > true &&" +
            "@request.body.rel_one_no_cascade.title < true &&" +
            "@request.body.self_rel_many.title = true",
          allowHiddenFields: false,
          // NOTE: Positional placeholder numbering differs from upstream because we omit
          // empty-string params that don't have placeholders in the SQL.
          expectQuery:
            "SELECT DISTINCT `demo4`.* FROM `demo4` LEFT JOIN `demo3` `__data_demo3_rel_one_cascade` ON [[__data_demo3_rel_one_cascade.id]]={:p0} LEFT JOIN `demo3` `__data_demo3_rel_one_no_cascade` ON [[__data_demo3_rel_one_no_cascade.id]]={:p1} LEFT JOIN `demo4` `__data_demo4_self_rel_many` ON [[__data_demo4_self_rel_many.id]]={:p2} WHERE ((({:TEST} IS NOT '' AND {:TEST} IS NOT {:TEST})) AND (({:TEST} IS NOT '' AND {:TEST} IS NOT {:TEST}))) AND (([[__data_demo3_rel_one_cascade.title]] > 1 AND [[__data_demo3_rel_one_no_cascade.title]] < 1 AND (([[__data_demo4_self_rel_many.title]] = 1) AND (NOT EXISTS (SELECT 1 FROM (SELECT [[__mm___data_demo4_self_rel_many.title]] as [[multiMatchValue]] FROM `demo4` `__mm_demo4` LEFT JOIN `demo4` `__mm___data_demo4_self_rel_many` ON [[__mm___data_demo4_self_rel_many.id]]={:p9} WHERE [[__mm_demo4.id]] = [[demo4.id]]) {{__smTEST}} WHERE NOT ([[__smTEST.multiMatchValue]] = 1))))))",
        },
        {
          name: "@request.body.arrayble:each fields",
          collectionIdOrName: "demo1",
          rule:
            "@request.body.select_one:each > true &&" +
            "@request.body.select_one:each ?< true &&" +
            "@request.body.select_many:each > true &&" +
            "@request.body.select_many:each ?< true &&" +
            "@request.body.file_one:each > true &&" +
            "@request.body.file_one:each ?< true &&" +
            "@request.body.file_many:each > true &&" +
            "@request.body.file_many:each ?< true &&" +
            "@request.body.rel_one:each > true &&" +
            "@request.body.rel_one:each ?< true &&" +
            "@request.body.rel_many:each > true &&" +
            "@request.body.rel_many:each ?< true",
          allowHiddenFields: false,
          expectQuery:
            "SELECT DISTINCT `demo1`.* FROM `demo1` LEFT JOIN json_each({:dataEachTEST}) `__dataEach_je_select_one` LEFT JOIN json_each({:dataEachTEST}) `__dataEach_je_select_many` LEFT JOIN json_each({:dataEachTEST}) `__dataEach_je_file_one` LEFT JOIN json_each({:dataEachTEST}) `__dataEach_je_file_many` LEFT JOIN json_each({:dataEachTEST}) `__dataEach_je_rel_one` LEFT JOIN json_each({:dataEachTEST}) `__dataEach_je_rel_many` WHERE ([[__dataEach_je_select_one.value]] > 1 AND [[__dataEach_je_select_one.value]] < 1 AND (([[__dataEach_je_select_many.value]] > 1) AND (NOT EXISTS (SELECT 1 FROM (SELECT [[__mm___dataEach_je_select_many.value]] as [[multiMatchValue]] FROM `demo1` `__mm_demo1` LEFT JOIN json_each({:mmdataEachTEST}) `__mm___dataEach_je_select_many` WHERE [[__mm_demo1.id]] = [[demo1.id]]) {{__smTEST}} WHERE NOT ([[__smTEST.multiMatchValue]] > 1)))) AND [[__dataEach_je_select_many.value]] < 1 AND [[__dataEach_je_file_one.value]] > 1 AND [[__dataEach_je_file_one.value]] < 1 AND (([[__dataEach_je_file_many.value]] > 1) AND (NOT EXISTS (SELECT 1 FROM (SELECT [[__mm___dataEach_je_file_many.value]] as [[multiMatchValue]] FROM `demo1` `__mm_demo1` LEFT JOIN json_each({:mmdataEachTEST}) `__mm___dataEach_je_file_many` WHERE [[__mm_demo1.id]] = [[demo1.id]]) {{__smTEST}} WHERE NOT ([[__smTEST.multiMatchValue]] > 1)))) AND [[__dataEach_je_file_many.value]] < 1 AND [[__dataEach_je_rel_one.value]] > 1 AND [[__dataEach_je_rel_one.value]] < 1 AND (([[__dataEach_je_rel_many.value]] > 1) AND (NOT EXISTS (SELECT 1 FROM (SELECT [[__mm___dataEach_je_rel_many.value]] as [[multiMatchValue]] FROM `demo1` `__mm_demo1` LEFT JOIN json_each({:mmdataEachTEST}) `__mm___dataEach_je_rel_many` WHERE [[__mm_demo1.id]] = [[demo1.id]]) {{__smTEST}} WHERE NOT ([[__smTEST.multiMatchValue]] > 1)))) AND [[__dataEach_je_rel_many.value]] < 1)",
        },
        {
          name: "regular arrayble:each fields",
          collectionIdOrName: "view1",
          rule:
            "select_one:each > true &&" +
            "select_one:each ?< true &&" +
            "select_many:each > true &&" +
            "select_many:each ?< true &&" +
            "file_one:each > true &&" +
            "file_one:each ?< true &&" +
            "file_many:each > true &&" +
            "file_many:each ?< true &&" +
            "rel_one:each > true &&" +
            "rel_one:each ?< true &&" +
            "rel_many:each > true &&" +
            "rel_many:each ?< true",
          allowHiddenFields: false,
          expectQuery:
            "SELECT DISTINCT `view1`.* FROM `view1` LEFT JOIN json_each(CASE WHEN iif(json_valid([[view1.select_one]]), json_type([[view1.select_one]])='array', FALSE) THEN [[view1.select_one]] ELSE json_array([[view1.select_one]]) END) `__je_view1_select_one` LEFT JOIN json_each(CASE WHEN iif(json_valid([[view1.select_many]]), json_type([[view1.select_many]])='array', FALSE) THEN [[view1.select_many]] ELSE json_array([[view1.select_many]]) END) `__je_view1_select_many` LEFT JOIN json_each(CASE WHEN iif(json_valid([[view1.file_one]]), json_type([[view1.file_one]])='array', FALSE) THEN [[view1.file_one]] ELSE json_array([[view1.file_one]]) END) `__je_view1_file_one` LEFT JOIN json_each(CASE WHEN iif(json_valid([[view1.file_many]]), json_type([[view1.file_many]])='array', FALSE) THEN [[view1.file_many]] ELSE json_array([[view1.file_many]]) END) `__je_view1_file_many` LEFT JOIN json_each(CASE WHEN iif(json_valid([[view1.rel_one]]), json_type([[view1.rel_one]])='array', FALSE) THEN [[view1.rel_one]] ELSE json_array([[view1.rel_one]]) END) `__je_view1_rel_one` LEFT JOIN json_each(CASE WHEN iif(json_valid([[view1.rel_many]]), json_type([[view1.rel_many]])='array', FALSE) THEN [[view1.rel_many]] ELSE json_array([[view1.rel_many]]) END) `__je_view1_rel_many` WHERE ([[__je_view1_select_one.value]] > 1 AND [[__je_view1_select_one.value]] < 1 AND (([[__je_view1_select_many.value]] > 1) AND (NOT EXISTS (SELECT 1 FROM (SELECT [[__je___mm_view1_select_many.value]] as [[multiMatchValue]] FROM `view1` `__mm_view1` LEFT JOIN json_each(CASE WHEN iif(json_valid([[__mm_view1.select_many]]), json_type([[__mm_view1.select_many]])='array', FALSE) THEN [[__mm_view1.select_many]] ELSE json_array([[__mm_view1.select_many]]) END) `__je___mm_view1_select_many` WHERE [[__mm_view1.id]] = [[view1.id]]) {{__smTEST}} WHERE NOT ([[__smTEST.multiMatchValue]] > 1)))) AND [[__je_view1_select_many.value]] < 1 AND [[__je_view1_file_one.value]] > 1 AND [[__je_view1_file_one.value]] < 1 AND (([[__je_view1_file_many.value]] > 1) AND (NOT EXISTS (SELECT 1 FROM (SELECT [[__je___mm_view1_file_many.value]] as [[multiMatchValue]] FROM `view1` `__mm_view1` LEFT JOIN json_each(CASE WHEN iif(json_valid([[__mm_view1.file_many]]), json_type([[__mm_view1.file_many]])='array', FALSE) THEN [[__mm_view1.file_many]] ELSE json_array([[__mm_view1.file_many]]) END) `__je___mm_view1_file_many` WHERE [[__mm_view1.id]] = [[view1.id]]) {{__smTEST}} WHERE NOT ([[__smTEST.multiMatchValue]] > 1)))) AND [[__je_view1_file_many.value]] < 1 AND [[__je_view1_rel_one.value]] > 1 AND [[__je_view1_rel_one.value]] < 1 AND (([[__je_view1_rel_many.value]] > 1) AND (NOT EXISTS (SELECT 1 FROM (SELECT [[__je___mm_view1_rel_many.value]] as [[multiMatchValue]] FROM `view1` `__mm_view1` LEFT JOIN json_each(CASE WHEN iif(json_valid([[__mm_view1.rel_many]]), json_type([[__mm_view1.rel_many]])='array', FALSE) THEN [[__mm_view1.rel_many]] ELSE json_array([[__mm_view1.rel_many]]) END) `__je___mm_view1_rel_many` WHERE [[__mm_view1.id]] = [[view1.id]]) {{__smTEST}} WHERE NOT ([[__smTEST.multiMatchValue]] > 1)))) AND [[__je_view1_rel_many.value]] < 1)",
        },
        {
          name: "arrayble:each vs arrayble:each",
          collectionIdOrName: "demo1",
          rule:
            "select_one:each != select_many:each &&" +
            "select_many:each > select_one:each &&" +
            "select_many:each ?< select_one:each &&" +
            "select_many:each = @request.body.select_many:each",
          allowHiddenFields: false,
          expectQuery:
            "SELECT DISTINCT `demo1`.* FROM `demo1` LEFT JOIN json_each(CASE WHEN iif(json_valid([[demo1.select_one]]), json_type([[demo1.select_one]])='array', FALSE) THEN [[demo1.select_one]] ELSE json_array([[demo1.select_one]]) END) `__je_demo1_select_one` LEFT JOIN json_each(CASE WHEN iif(json_valid([[demo1.select_many]]), json_type([[demo1.select_many]])='array', FALSE) THEN [[demo1.select_many]] ELSE json_array([[demo1.select_many]]) END) `__je_demo1_select_many` LEFT JOIN json_each({:dataEachTEST}) `__dataEach_je_select_many` WHERE (((COALESCE([[__je_demo1_select_one.value]], '') IS NOT COALESCE([[__je_demo1_select_many.value]], '')) AND (NOT EXISTS (SELECT 1 FROM (SELECT [[__je___mm_demo1_select_many.value]] as [[multiMatchValue]] FROM `demo1` `__mm_demo1` LEFT JOIN json_each(CASE WHEN iif(json_valid([[__mm_demo1.select_many]]), json_type([[__mm_demo1.select_many]])='array', FALSE) THEN [[__mm_demo1.select_many]] ELSE json_array([[__mm_demo1.select_many]]) END) `__je___mm_demo1_select_many` WHERE [[__mm_demo1.id]] = [[demo1.id]]) {{__smTEST}} WHERE NOT (COALESCE([[__je_demo1_select_one.value]], '') IS NOT COALESCE([[__smTEST.multiMatchValue]], ''))))) AND (([[__je_demo1_select_many.value]] > [[__je_demo1_select_one.value]]) AND (NOT EXISTS (SELECT 1 FROM (SELECT [[__je___mm_demo1_select_many.value]] as [[multiMatchValue]] FROM `demo1` `__mm_demo1` LEFT JOIN json_each(CASE WHEN iif(json_valid([[__mm_demo1.select_many]]), json_type([[__mm_demo1.select_many]])='array', FALSE) THEN [[__mm_demo1.select_many]] ELSE json_array([[__mm_demo1.select_many]]) END) `__je___mm_demo1_select_many` WHERE [[__mm_demo1.id]] = [[demo1.id]]) {{__smTEST}} WHERE NOT ([[__smTEST.multiMatchValue]] > [[__je_demo1_select_one.value]])))) AND [[__je_demo1_select_many.value]] < [[__je_demo1_select_one.value]] AND (([[__je_demo1_select_many.value]] = [[__dataEach_je_select_many.value]]) AND (NOT EXISTS (SELECT 1 FROM (SELECT [[__je___mm_demo1_select_many.value]] as [[multiMatchValue]] FROM `demo1` `__mm_demo1` LEFT JOIN json_each(CASE WHEN iif(json_valid([[__mm_demo1.select_many]]), json_type([[__mm_demo1.select_many]])='array', FALSE) THEN [[__mm_demo1.select_many]] ELSE json_array([[__mm_demo1.select_many]]) END) `__je___mm_demo1_select_many` WHERE [[__mm_demo1.id]] = [[demo1.id]]) {{__mlTEST}} LEFT JOIN (SELECT [[__mm___dataEach_je_select_many.value]] as [[multiMatchValue]] FROM `demo1` `__mm_demo1` LEFT JOIN json_each({:mmdataEachTEST}) `__mm___dataEach_je_select_many` WHERE [[__mm_demo1.id]] = [[demo1.id]]) {{__mrTEST}} WHERE NOT (COALESCE([[__mlTEST.multiMatchValue]], '') = COALESCE([[__mrTEST.multiMatchValue]], ''))))))",
        },
        {
          name: "mixed multi-match vs multi-match in superuser only collections",
          collectionIdOrName: "demo1",
          rule:
            "rel_many.rel.active != rel_many.name &&" +
            "rel_many.rel.active ?= rel_many.name &&" +
            "rel_many.rel.title ~ rel_one.email &&" +
            "@collection.demo2.active = rel_many.rel.active &&" +
            "@collection.demo2.active ?= rel_many.rel.active &&" +
            "rel_many.verified > @request.body.rel_many.verified",
          allowHiddenFields: false,
          expectQuery: "",
        },
        {
          name: "mixed multi-match vs multi-match in superuser only collections (with allowHiddenFields)",
          collectionIdOrName: "demo1",
          rule:
            "rel_many.rel.active != rel_many.name &&" +
            "rel_many.rel.active ?= rel_many.name &&" +
            "rel_many.rel.title ~ rel_one.email &&" +
            "@collection.demo2.active = rel_many.rel.active &&" +
            "@collection.demo2.active ?= rel_many.rel.active &&" +
            "rel_many.verified > @request.body.rel_many.verified",
          allowHiddenFields: true,
          expectQuery:
            "SELECT DISTINCT `demo1`.* FROM `demo1` LEFT JOIN json_each(CASE WHEN iif(json_valid([[demo1.rel_many]]), json_type([[demo1.rel_many]])='array', FALSE) THEN [[demo1.rel_many]] ELSE json_array([[demo1.rel_many]]) END) `__je_demo1_rel_many` LEFT JOIN `users` `demo1_rel_many` ON [[demo1_rel_many.id]] = [[__je_demo1_rel_many.value]] LEFT JOIN `demo2` `demo1_rel_many_rel` ON [[demo1_rel_many_rel.id]] = [[demo1_rel_many.rel]] LEFT JOIN `demo1` `demo1_rel_one` ON [[demo1_rel_one.id]] = [[demo1.rel_one]] LEFT JOIN `demo2` `__collection_demo2` LEFT JOIN `users` `__data_users_rel_many` ON [[__data_users_rel_many.id]] IN ({:p0}, {:p1}) WHERE (((COALESCE([[demo1_rel_many_rel.active]], '') IS NOT COALESCE([[demo1_rel_many.name]], '')) AND (NOT EXISTS (SELECT 1 FROM (SELECT [[__mm_demo1_rel_many_rel.active]] as [[multiMatchValue]] FROM `demo1` `__mm_demo1` LEFT JOIN json_each(CASE WHEN iif(json_valid([[__mm_demo1.rel_many]]), json_type([[__mm_demo1.rel_many]])='array', FALSE) THEN [[__mm_demo1.rel_many]] ELSE json_array([[__mm_demo1.rel_many]]) END) `__mm_demo1_rel_many_je` LEFT JOIN `users` `__mm_demo1_rel_many` ON [[__mm_demo1_rel_many.id]] = [[__mm_demo1_rel_many_je.value]] LEFT JOIN `demo2` `__mm_demo1_rel_many_rel` ON [[__mm_demo1_rel_many_rel.id]] = [[__mm_demo1_rel_many.rel]] WHERE [[__mm_demo1.id]] = [[demo1.id]]) {{__mlTEST}} LEFT JOIN (SELECT [[__mm_demo1_rel_many.name]] as [[multiMatchValue]] FROM `demo1` `__mm_demo1` LEFT JOIN json_each(CASE WHEN iif(json_valid([[__mm_demo1.rel_many]]), json_type([[__mm_demo1.rel_many]])='array', FALSE) THEN [[__mm_demo1.rel_many]] ELSE json_array([[__mm_demo1.rel_many]]) END) `__mm_demo1_rel_many_je` LEFT JOIN `users` `__mm_demo1_rel_many` ON [[__mm_demo1_rel_many.id]] = [[__mm_demo1_rel_many_je.value]] WHERE [[__mm_demo1.id]] = [[demo1.id]]) {{__mrTEST}} WHERE NOT (COALESCE([[__mlTEST.multiMatchValue]], '') IS NOT COALESCE([[__mrTEST.multiMatchValue]], ''))))) AND COALESCE([[demo1_rel_many_rel.active]], '') = COALESCE([[demo1_rel_many.name]], '') AND (([[demo1_rel_many_rel.title]] LIKE ('%' || [[demo1_rel_one.email]] || '%') ESCAPE '\\') AND (NOT EXISTS (SELECT 1 FROM (SELECT [[__mm_demo1_rel_many_rel.title]] as [[multiMatchValue]] FROM `demo1` `__mm_demo1` LEFT JOIN json_each(CASE WHEN iif(json_valid([[__mm_demo1.rel_many]]), json_type([[__mm_demo1.rel_many]])='array', FALSE) THEN [[__mm_demo1.rel_many]] ELSE json_array([[__mm_demo1.rel_many]]) END) `__mm_demo1_rel_many_je` LEFT JOIN `users` `__mm_demo1_rel_many` ON [[__mm_demo1_rel_many.id]] = [[__mm_demo1_rel_many_je.value]] LEFT JOIN `demo2` `__mm_demo1_rel_many_rel` ON [[__mm_demo1_rel_many_rel.id]] = [[__mm_demo1_rel_many.rel]] WHERE [[__mm_demo1.id]] = [[demo1.id]]) {{__smTEST}} WHERE NOT ([[__smTEST.multiMatchValue]] LIKE ('%' || [[demo1_rel_one.email]] || '%') ESCAPE '\\')))) AND ((COALESCE([[__collection_demo2.active]], '') = COALESCE([[demo1_rel_many_rel.active]], '')) AND (NOT EXISTS (SELECT 1 FROM (SELECT [[__mm___collection_demo2.active]] as [[multiMatchValue]] FROM `demo1` `__mm_demo1` LEFT JOIN `demo2` `__mm___collection_demo2` WHERE [[__mm_demo1.id]] = [[demo1.id]]) {{__mlTEST}} LEFT JOIN (SELECT [[__mm_demo1_rel_many_rel.active]] as [[multiMatchValue]] FROM `demo1` `__mm_demo1` LEFT JOIN json_each(CASE WHEN iif(json_valid([[__mm_demo1.rel_many]]), json_type([[__mm_demo1.rel_many]])='array', FALSE) THEN [[__mm_demo1.rel_many]] ELSE json_array([[__mm_demo1.rel_many]]) END) `__mm_demo1_rel_many_je` LEFT JOIN `users` `__mm_demo1_rel_many` ON [[__mm_demo1_rel_many.id]] = [[__mm_demo1_rel_many_je.value]] LEFT JOIN `demo2` `__mm_demo1_rel_many_rel` ON [[__mm_demo1_rel_many_rel.id]] = [[__mm_demo1_rel_many.rel]] WHERE [[__mm_demo1.id]] = [[demo1.id]]) {{__mrTEST}} WHERE NOT (COALESCE([[__mlTEST.multiMatchValue]], '') = COALESCE([[__mrTEST.multiMatchValue]], ''))))) AND COALESCE([[__collection_demo2.active]], '') = COALESCE([[demo1_rel_many_rel.active]], '') AND (([[demo1_rel_many.verified]] > [[__data_users_rel_many.verified]]) AND (NOT EXISTS (SELECT 1 FROM (SELECT [[__mm_demo1_rel_many.verified]] as [[multiMatchValue]] FROM `demo1` `__mm_demo1` LEFT JOIN json_each(CASE WHEN iif(json_valid([[__mm_demo1.rel_many]]), json_type([[__mm_demo1.rel_many]])='array', FALSE) THEN [[__mm_demo1.rel_many]] ELSE json_array([[__mm_demo1.rel_many]]) END) `__mm_demo1_rel_many_je` LEFT JOIN `users` `__mm_demo1_rel_many` ON [[__mm_demo1_rel_many.id]] = [[__mm_demo1_rel_many_je.value]] WHERE [[__mm_demo1.id]] = [[demo1.id]]) {{__mlTEST}} LEFT JOIN (SELECT [[__mm___data_users_rel_many.verified]] as [[multiMatchValue]] FROM `demo1` `__mm_demo1` LEFT JOIN `users` `__mm___data_users_rel_many` ON [[__mm___data_users_rel_many.id]] IN ({:p2}, {:p3}) WHERE [[__mm_demo1.id]] = [[demo1.id]]) {{__mrTEST}} WHERE NOT ([[__mlTEST.multiMatchValue]] > [[__mrTEST.multiMatchValue]])))))",
        },
        {
          name: "@request.body.arrayable:length fields",
          collectionIdOrName: "demo1",
          rule:
            "@request.body.select_one:length > 1 &&" +
            "@request.body.select_one:length ?> 2 &&" +
            "@request.body.select_many:length < 3 &&" +
            "@request.body.select_many:length ?> 4 &&" +
            "@request.body.rel_one:length = 5 &&" +
            "@request.body.rel_one:length ?= 6 &&" +
            "@request.body.rel_many:length != 7 &&" +
            "@request.body.rel_many:length ?!= 8 &&" +
            "@request.body.file_one:length = 9 &&" +
            "@request.body.file_one:length ?= 0 &&" +
            "@request.body.file_many:length != 1 &&" +
            "@request.body.file_many:length ?!= 2",
          allowHiddenFields: false,
          expectQuery:
            "SELECT `demo1`.* FROM `demo1` WHERE (0 > {:TEST} AND 0 > {:TEST} AND 2 < {:TEST} AND 2 > {:TEST} AND 1 = {:TEST} AND 1 = {:TEST} AND 2 IS NOT {:TEST} AND 2 IS NOT {:TEST} AND 1 = {:TEST} AND 1 = {:TEST} AND 3 IS NOT {:TEST} AND 3 IS NOT {:TEST})",
        },
        {
          name: "regular arrayable:length fields",
          collectionIdOrName: "demo4",
          rule:
            "@request.body.self_rel_one.self_rel_many:length > 1 &&" +
            "@request.body.self_rel_one.self_rel_many:length ?> 2 &&" +
            "@request.body.rel_many_cascade.files:length ?< 3 &&" +
            "@request.body.rel_many_cascade.files:length < 4 &&" +
            "@request.body.rel_one_cascade.files:length < 4.1 &&" +
            "self_rel_one.self_rel_many:length = 5 &&" +
            "self_rel_one.self_rel_many:length ?= 6 &&" +
            "self_rel_one.rel_many_cascade.files:length != 7 &&" +
            "self_rel_one.rel_many_cascade.files:length ?!= 8",
          allowHiddenFields: true,
          expectQuery:
            "SELECT DISTINCT `demo4`.* FROM `demo4` LEFT JOIN `demo4` `__data_demo4_self_rel_one` ON [[__data_demo4_self_rel_one.id]]={:p0} LEFT JOIN `demo3` `__data_demo3_rel_many_cascade` ON [[__data_demo3_rel_many_cascade.id]] IN ({:p1}, {:p2}) LEFT JOIN `demo3` `__data_demo3_rel_one_cascade` ON [[__data_demo3_rel_one_cascade.id]]={:p3} LEFT JOIN `demo4` `demo4_self_rel_one` ON [[demo4_self_rel_one.id]] = [[demo4.self_rel_one]] LEFT JOIN json_each(CASE WHEN iif(json_valid([[demo4_self_rel_one.rel_many_cascade]]), json_type([[demo4_self_rel_one.rel_many_cascade]])='array', FALSE) THEN [[demo4_self_rel_one.rel_many_cascade]] ELSE json_array([[demo4_self_rel_one.rel_many_cascade]]) END) `__je_demo4_self_rel_one_rel_many_cascade` LEFT JOIN `demo3` `demo4_self_rel_one_rel_many_cascade` ON [[demo4_self_rel_one_rel_many_cascade.id]] = [[__je_demo4_self_rel_one_rel_many_cascade.value]] WHERE (json_array_length(CASE WHEN iif(json_valid([[__data_demo4_self_rel_one.self_rel_many]]), json_type([[__data_demo4_self_rel_one.self_rel_many]])='array', FALSE) THEN [[__data_demo4_self_rel_one.self_rel_many]] ELSE (CASE WHEN [[__data_demo4_self_rel_one.self_rel_many]] = '' OR [[__data_demo4_self_rel_one.self_rel_many]] IS NULL THEN json_array() ELSE json_array([[__data_demo4_self_rel_one.self_rel_many]]) END) END) > {:TEST} AND json_array_length(CASE WHEN iif(json_valid([[__data_demo4_self_rel_one.self_rel_many]]), json_type([[__data_demo4_self_rel_one.self_rel_many]])='array', FALSE) THEN [[__data_demo4_self_rel_one.self_rel_many]] ELSE (CASE WHEN [[__data_demo4_self_rel_one.self_rel_many]] = '' OR [[__data_demo4_self_rel_one.self_rel_many]] IS NULL THEN json_array() ELSE json_array([[__data_demo4_self_rel_one.self_rel_many]]) END) END) > {:TEST} AND json_array_length(CASE WHEN iif(json_valid([[__data_demo3_rel_many_cascade.files]]), json_type([[__data_demo3_rel_many_cascade.files]])='array', FALSE) THEN [[__data_demo3_rel_many_cascade.files]] ELSE (CASE WHEN [[__data_demo3_rel_many_cascade.files]] = '' OR [[__data_demo3_rel_many_cascade.files]] IS NULL THEN json_array() ELSE json_array([[__data_demo3_rel_many_cascade.files]]) END) END) < {:TEST} AND ((json_array_length(CASE WHEN iif(json_valid([[__data_demo3_rel_many_cascade.files]]), json_type([[__data_demo3_rel_many_cascade.files]])='array', FALSE) THEN [[__data_demo3_rel_many_cascade.files]] ELSE (CASE WHEN [[__data_demo3_rel_many_cascade.files]] = '' OR [[__data_demo3_rel_many_cascade.files]] IS NULL THEN json_array() ELSE json_array([[__data_demo3_rel_many_cascade.files]]) END) END) < {:TEST}) AND (NOT EXISTS (SELECT 1 FROM (SELECT json_array_length(CASE WHEN iif(json_valid([[__mm___data_demo3_rel_many_cascade.files]]), json_type([[__mm___data_demo3_rel_many_cascade.files]])='array', FALSE) THEN [[__mm___data_demo3_rel_many_cascade.files]] ELSE (CASE WHEN [[__mm___data_demo3_rel_many_cascade.files]] = '' OR [[__mm___data_demo3_rel_many_cascade.files]] IS NULL THEN json_array() ELSE json_array([[__mm___data_demo3_rel_many_cascade.files]]) END) END) as [[multiMatchValue]] FROM `demo4` `__mm_demo4` LEFT JOIN `demo3` `__mm___data_demo3_rel_many_cascade` ON [[__mm___data_demo3_rel_many_cascade.id]] IN ({:p8}, {:p9}) WHERE [[__mm_demo4.id]] = [[demo4.id]]) {{__smTEST}} WHERE NOT ([[__smTEST.multiMatchValue]] < {:TEST})))) AND json_array_length(CASE WHEN iif(json_valid([[__data_demo3_rel_one_cascade.files]]), json_type([[__data_demo3_rel_one_cascade.files]])='array', FALSE) THEN [[__data_demo3_rel_one_cascade.files]] ELSE (CASE WHEN [[__data_demo3_rel_one_cascade.files]] = '' OR [[__data_demo3_rel_one_cascade.files]] IS NULL THEN json_array() ELSE json_array([[__data_demo3_rel_one_cascade.files]]) END) END) < {:TEST} AND json_array_length(CASE WHEN iif(json_valid([[demo4_self_rel_one.self_rel_many]]), json_type([[demo4_self_rel_one.self_rel_many]])='array', FALSE) THEN [[demo4_self_rel_one.self_rel_many]] ELSE (CASE WHEN [[demo4_self_rel_one.self_rel_many]] = '' OR [[demo4_self_rel_one.self_rel_many]] IS NULL THEN json_array() ELSE json_array([[demo4_self_rel_one.self_rel_many]]) END) END) = {:TEST} AND json_array_length(CASE WHEN iif(json_valid([[demo4_self_rel_one.self_rel_many]]), json_type([[demo4_self_rel_one.self_rel_many]])='array', FALSE) THEN [[demo4_self_rel_one.self_rel_many]] ELSE (CASE WHEN [[demo4_self_rel_one.self_rel_many]] = '' OR [[demo4_self_rel_one.self_rel_many]] IS NULL THEN json_array() ELSE json_array([[demo4_self_rel_one.self_rel_many]]) END) END) = {:TEST} AND ((json_array_length(CASE WHEN iif(json_valid([[demo4_self_rel_one_rel_many_cascade.files]]), json_type([[demo4_self_rel_one_rel_many_cascade.files]])='array', FALSE) THEN [[demo4_self_rel_one_rel_many_cascade.files]] ELSE (CASE WHEN [[demo4_self_rel_one_rel_many_cascade.files]] = '' OR [[demo4_self_rel_one_rel_many_cascade.files]] IS NULL THEN json_array() ELSE json_array([[demo4_self_rel_one_rel_many_cascade.files]]) END) END) IS NOT {:TEST}) AND (NOT EXISTS (SELECT 1 FROM (SELECT json_array_length(CASE WHEN iif(json_valid([[__mm_demo4_self_rel_one_rel_many_cascade.files]]), json_type([[__mm_demo4_self_rel_one_rel_many_cascade.files]])='array', FALSE) THEN [[__mm_demo4_self_rel_one_rel_many_cascade.files]] ELSE (CASE WHEN [[__mm_demo4_self_rel_one_rel_many_cascade.files]] = '' OR [[__mm_demo4_self_rel_one_rel_many_cascade.files]] IS NULL THEN json_array() ELSE json_array([[__mm_demo4_self_rel_one_rel_many_cascade.files]]) END) END) as [[multiMatchValue]] FROM `demo4` `__mm_demo4` LEFT JOIN `demo4` `__mm_demo4_self_rel_one` ON [[__mm_demo4_self_rel_one.id]] = [[__mm_demo4.self_rel_one]] LEFT JOIN json_each(CASE WHEN iif(json_valid([[__mm_demo4_self_rel_one.rel_many_cascade]]), json_type([[__mm_demo4_self_rel_one.rel_many_cascade]])='array', FALSE) THEN [[__mm_demo4_self_rel_one.rel_many_cascade]] ELSE json_array([[__mm_demo4_self_rel_one.rel_many_cascade]]) END) `__mm_demo4_self_rel_one_rel_many_cascade_je` LEFT JOIN `demo3` `__mm_demo4_self_rel_one_rel_many_cascade` ON [[__mm_demo4_self_rel_one_rel_many_cascade.id]] = [[__mm_demo4_self_rel_one_rel_many_cascade_je.value]] WHERE [[__mm_demo4.id]] = [[demo4.id]]) {{__smTEST}} WHERE NOT ([[__smTEST.multiMatchValue]] IS NOT {:TEST})))) AND json_array_length(CASE WHEN iif(json_valid([[demo4_self_rel_one_rel_many_cascade.files]]), json_type([[demo4_self_rel_one_rel_many_cascade.files]])='array', FALSE) THEN [[demo4_self_rel_one_rel_many_cascade.files]] ELSE (CASE WHEN [[demo4_self_rel_one_rel_many_cascade.files]] = '' OR [[demo4_self_rel_one_rel_many_cascade.files]] IS NULL THEN json_array() ELSE json_array([[demo4_self_rel_one_rel_many_cascade.files]]) END) END) IS NOT {:TEST})",
        },
        {
          name: "request body :changed modifier with non-existing collection field",
          collectionIdOrName: "demo1",
          rule: "@request.body.a:changed > 1",
          allowHiddenFields: true,
          expectQuery: "",
        },
        {
          name: "regular body :changed modifier",
          collectionIdOrName: "demo1",
          rule:
            "@request.body.number:changed = false &&" +
            "@request.body.email:changed = true &&" +
            "@request.body.number:changed = @request.body.select_many:changed",
          allowHiddenFields: true,
          expectQuery:
            "SELECT `demo1`.* FROM `demo1` WHERE ((TRUE = 1 AND {:TEST} IS NOT [[demo1.number]]) IS 0 AND (FALSE = 1 AND ('' IS NOT [[demo1.email]] AND [[demo1.email]] IS NOT NULL)) IS 1 AND (TRUE = 1 AND {:TEST} IS NOT [[demo1.number]]) IS (TRUE = 1 AND {:TEST} IS NOT [[demo1.select_many]]))",
        },
        {
          name: "json_extract and json_array_length COALESCE equal normalizations",
          collectionIdOrName: "demo4",
          rule: "json_object.a.b = '' && self_rel_many:length != 2 && json_object.a.b > 3 && self_rel_many:length <= 4",
          allowHiddenFields: false,
          expectQuery:
            "SELECT `demo4`.* FROM `demo4` WHERE ((CASE WHEN json_valid([[demo4.json_object]]) THEN JSON_EXTRACT([[demo4.json_object]], '$.a.b') ELSE JSON_EXTRACT(json_object('pb', [[demo4.json_object]]), '$.pb.a.b') END) IS {:TEST} AND json_array_length(CASE WHEN iif(json_valid([[demo4.self_rel_many]]), json_type([[demo4.self_rel_many]])='array', FALSE) THEN [[demo4.self_rel_many]] ELSE (CASE WHEN [[demo4.self_rel_many]] = '' OR [[demo4.self_rel_many]] IS NULL THEN json_array() ELSE json_array([[demo4.self_rel_many]]) END) END) IS NOT {:TEST} AND (CASE WHEN json_valid([[demo4.json_object]]) THEN JSON_EXTRACT([[demo4.json_object]], '$.a.b') ELSE JSON_EXTRACT(json_object('pb', [[demo4.json_object]]), '$.pb.a.b') END) > {:TEST} AND json_array_length(CASE WHEN iif(json_valid([[demo4.self_rel_many]]), json_type([[demo4.self_rel_many]])='array', FALSE) THEN [[demo4.self_rel_many]] ELSE (CASE WHEN [[demo4.self_rel_many]] = '' OR [[demo4.self_rel_many]] IS NULL THEN json_array() ELSE json_array([[demo4.self_rel_many]]) END) END) <= {:TEST})",
        },
        {
          name: "json field equal normalization checks",
          collectionIdOrName: "demo4",
          rule:
            "json_object = '' || json_object != '' || '' = json_object || '' != json_object ||" +
            "json_object = null || json_object != null || null = json_object || null != json_object ||" +
            "json_object = true || json_object != true || true = json_object || true != json_object ||" +
            "json_object = json_object || json_object != json_object ||" +
            "json_object = title || title != json_object ||" +
            "self_rel_many.json_object = '' || null = self_rel_many.json_object ||" +
            "self_rel_many.json_object = self_rel_many.json_object",
          allowHiddenFields: false,
          expectQuery:
            "SELECT DISTINCT `demo4`.* FROM `demo4` LEFT JOIN json_each(CASE WHEN iif(json_valid([[demo4.self_rel_many]]), json_type([[demo4.self_rel_many]])='array', FALSE) THEN [[demo4.self_rel_many]] ELSE json_array([[demo4.self_rel_many]]) END) `__je_demo4_self_rel_many` LEFT JOIN `demo4` `demo4_self_rel_many` ON [[demo4_self_rel_many.id]] = [[__je_demo4_self_rel_many.value]] WHERE ((CASE WHEN json_valid([[demo4.json_object]]) THEN JSON_EXTRACT([[demo4.json_object]], '$') ELSE JSON_EXTRACT(json_object('pb', [[demo4.json_object]]), '$.pb') END) IS {:TEST} OR (CASE WHEN json_valid([[demo4.json_object]]) THEN JSON_EXTRACT([[demo4.json_object]], '$') ELSE JSON_EXTRACT(json_object('pb', [[demo4.json_object]]), '$.pb') END) IS NOT {:TEST} OR {:TEST} IS (CASE WHEN json_valid([[demo4.json_object]]) THEN JSON_EXTRACT([[demo4.json_object]], '$') ELSE JSON_EXTRACT(json_object('pb', [[demo4.json_object]]), '$.pb') END) OR {:TEST} IS NOT (CASE WHEN json_valid([[demo4.json_object]]) THEN JSON_EXTRACT([[demo4.json_object]], '$') ELSE JSON_EXTRACT(json_object('pb', [[demo4.json_object]]), '$.pb') END) OR (CASE WHEN json_valid([[demo4.json_object]]) THEN JSON_EXTRACT([[demo4.json_object]], '$') ELSE JSON_EXTRACT(json_object('pb', [[demo4.json_object]]), '$.pb') END) IS NULL OR (CASE WHEN json_valid([[demo4.json_object]]) THEN JSON_EXTRACT([[demo4.json_object]], '$') ELSE JSON_EXTRACT(json_object('pb', [[demo4.json_object]]), '$.pb') END) IS NOT NULL OR NULL IS (CASE WHEN json_valid([[demo4.json_object]]) THEN JSON_EXTRACT([[demo4.json_object]], '$') ELSE JSON_EXTRACT(json_object('pb', [[demo4.json_object]]), '$.pb') END) OR NULL IS NOT (CASE WHEN json_valid([[demo4.json_object]]) THEN JSON_EXTRACT([[demo4.json_object]], '$') ELSE JSON_EXTRACT(json_object('pb', [[demo4.json_object]]), '$.pb') END) OR (CASE WHEN json_valid([[demo4.json_object]]) THEN JSON_EXTRACT([[demo4.json_object]], '$') ELSE JSON_EXTRACT(json_object('pb', [[demo4.json_object]]), '$.pb') END) IS 1 OR (CASE WHEN json_valid([[demo4.json_object]]) THEN JSON_EXTRACT([[demo4.json_object]], '$') ELSE JSON_EXTRACT(json_object('pb', [[demo4.json_object]]), '$.pb') END) IS NOT 1 OR 1 IS (CASE WHEN json_valid([[demo4.json_object]]) THEN JSON_EXTRACT([[demo4.json_object]], '$') ELSE JSON_EXTRACT(json_object('pb', [[demo4.json_object]]), '$.pb') END) OR 1 IS NOT (CASE WHEN json_valid([[demo4.json_object]]) THEN JSON_EXTRACT([[demo4.json_object]], '$') ELSE JSON_EXTRACT(json_object('pb', [[demo4.json_object]]), '$.pb') END) OR (CASE WHEN json_valid([[demo4.json_object]]) THEN JSON_EXTRACT([[demo4.json_object]], '$') ELSE JSON_EXTRACT(json_object('pb', [[demo4.json_object]]), '$.pb') END) IS (CASE WHEN json_valid([[demo4.json_object]]) THEN JSON_EXTRACT([[demo4.json_object]], '$') ELSE JSON_EXTRACT(json_object('pb', [[demo4.json_object]]), '$.pb') END) OR (CASE WHEN json_valid([[demo4.json_object]]) THEN JSON_EXTRACT([[demo4.json_object]], '$') ELSE JSON_EXTRACT(json_object('pb', [[demo4.json_object]]), '$.pb') END) IS NOT (CASE WHEN json_valid([[demo4.json_object]]) THEN JSON_EXTRACT([[demo4.json_object]], '$') ELSE JSON_EXTRACT(json_object('pb', [[demo4.json_object]]), '$.pb') END) OR (CASE WHEN json_valid([[demo4.json_object]]) THEN JSON_EXTRACT([[demo4.json_object]], '$') ELSE JSON_EXTRACT(json_object('pb', [[demo4.json_object]]), '$.pb') END) IS [[demo4.title]] OR [[demo4.title]] IS NOT (CASE WHEN json_valid([[demo4.json_object]]) THEN JSON_EXTRACT([[demo4.json_object]], '$') ELSE JSON_EXTRACT(json_object('pb', [[demo4.json_object]]), '$.pb') END) OR (((CASE WHEN json_valid([[demo4_self_rel_many.json_object]]) THEN JSON_EXTRACT([[demo4_self_rel_many.json_object]], '$') ELSE JSON_EXTRACT(json_object('pb', [[demo4_self_rel_many.json_object]]), '$.pb') END) IS {:TEST}) AND (NOT EXISTS (SELECT 1 FROM (SELECT (CASE WHEN json_valid([[__mm_demo4_self_rel_many.json_object]]) THEN JSON_EXTRACT([[__mm_demo4_self_rel_many.json_object]], '$') ELSE JSON_EXTRACT(json_object('pb', [[__mm_demo4_self_rel_many.json_object]]), '$.pb') END) as [[multiMatchValue]] FROM `demo4` `__mm_demo4` LEFT JOIN json_each(CASE WHEN iif(json_valid([[__mm_demo4.self_rel_many]]), json_type([[__mm_demo4.self_rel_many]])='array', FALSE) THEN [[__mm_demo4.self_rel_many]] ELSE json_array([[__mm_demo4.self_rel_many]]) END) `__mm_demo4_self_rel_many_je` LEFT JOIN `demo4` `__mm_demo4_self_rel_many` ON [[__mm_demo4_self_rel_many.id]] = [[__mm_demo4_self_rel_many_je.value]] WHERE [[__mm_demo4.id]] = [[demo4.id]]) {{__smTEST}} WHERE NOT ([[__smTEST.multiMatchValue]] IS {:TEST})))) OR ((NULL IS (CASE WHEN json_valid([[demo4_self_rel_many.json_object]]) THEN JSON_EXTRACT([[demo4_self_rel_many.json_object]], '$') ELSE JSON_EXTRACT(json_object('pb', [[demo4_self_rel_many.json_object]]), '$.pb') END)) AND (NOT EXISTS (SELECT 1 FROM (SELECT (CASE WHEN json_valid([[__mm_demo4_self_rel_many.json_object]]) THEN JSON_EXTRACT([[__mm_demo4_self_rel_many.json_object]], '$') ELSE JSON_EXTRACT(json_object('pb', [[__mm_demo4_self_rel_many.json_object]]), '$.pb') END) as [[multiMatchValue]] FROM `demo4` `__mm_demo4` LEFT JOIN json_each(CASE WHEN iif(json_valid([[__mm_demo4.self_rel_many]]), json_type([[__mm_demo4.self_rel_many]])='array', FALSE) THEN [[__mm_demo4.self_rel_many]] ELSE json_array([[__mm_demo4.self_rel_many]]) END) `__mm_demo4_self_rel_many_je` LEFT JOIN `demo4` `__mm_demo4_self_rel_many` ON [[__mm_demo4_self_rel_many.id]] = [[__mm_demo4_self_rel_many_je.value]] WHERE [[__mm_demo4.id]] = [[demo4.id]]) {{__smTEST}} WHERE NOT (NULL IS [[__smTEST.multiMatchValue]])))) OR (((CASE WHEN json_valid([[demo4_self_rel_many.json_object]]) THEN JSON_EXTRACT([[demo4_self_rel_many.json_object]], '$') ELSE JSON_EXTRACT(json_object('pb', [[demo4_self_rel_many.json_object]]), '$.pb') END) IS (CASE WHEN json_valid([[demo4_self_rel_many.json_object]]) THEN JSON_EXTRACT([[demo4_self_rel_many.json_object]], '$') ELSE JSON_EXTRACT(json_object('pb', [[demo4_self_rel_many.json_object]]), '$.pb') END)) AND (NOT EXISTS (SELECT 1 FROM (SELECT (CASE WHEN json_valid([[__mm_demo4_self_rel_many.json_object]]) THEN JSON_EXTRACT([[__mm_demo4_self_rel_many.json_object]], '$') ELSE JSON_EXTRACT(json_object('pb', [[__mm_demo4_self_rel_many.json_object]]), '$.pb') END) as [[multiMatchValue]] FROM `demo4` `__mm_demo4` LEFT JOIN json_each(CASE WHEN iif(json_valid([[__mm_demo4.self_rel_many]]), json_type([[__mm_demo4.self_rel_many]])='array', FALSE) THEN [[__mm_demo4.self_rel_many]] ELSE json_array([[__mm_demo4.self_rel_many]]) END) `__mm_demo4_self_rel_many_je` LEFT JOIN `demo4` `__mm_demo4_self_rel_many` ON [[__mm_demo4_self_rel_many.id]] = [[__mm_demo4_self_rel_many_je.value]] WHERE [[__mm_demo4.id]] = [[demo4.id]]) {{__mlTEST}} LEFT JOIN (SELECT (CASE WHEN json_valid([[__mm_demo4_self_rel_many.json_object]]) THEN JSON_EXTRACT([[__mm_demo4_self_rel_many.json_object]], '$') ELSE JSON_EXTRACT(json_object('pb', [[__mm_demo4_self_rel_many.json_object]]), '$.pb') END) as [[multiMatchValue]] FROM `demo4` `__mm_demo4` LEFT JOIN json_each(CASE WHEN iif(json_valid([[__mm_demo4.self_rel_many]]), json_type([[__mm_demo4.self_rel_many]])='array', FALSE) THEN [[__mm_demo4.self_rel_many]] ELSE json_array([[__mm_demo4.self_rel_many]]) END) `__mm_demo4_self_rel_many_je` LEFT JOIN `demo4` `__mm_demo4_self_rel_many` ON [[__mm_demo4_self_rel_many.id]] = [[__mm_demo4_self_rel_many_je.value]] WHERE [[__mm_demo4.id]] = [[demo4.id]]) {{__mrTEST}} WHERE NOT ([[__mlTEST.multiMatchValue]] IS [[__mrTEST.multiMatchValue]])))))",
        },
        {
          name: "geoPoint props access",
          collectionIdOrName: "view1",
          rule: "point = '' || point.lat > 1 || point.lon < 2 || point.something > 3",
          allowHiddenFields: false,
          expectQuery:
            "SELECT `view1`.* FROM `view1` WHERE (([[view1.point]] = '' OR [[view1.point]] IS NULL) OR (CASE WHEN json_valid([[view1.point]]) THEN JSON_EXTRACT([[view1.point]], '$.lat') ELSE JSON_EXTRACT(json_object('pb', [[view1.point]]), '$.pb.lat') END) > {:TEST} OR (CASE WHEN json_valid([[view1.point]]) THEN JSON_EXTRACT([[view1.point]], '$.lon') ELSE JSON_EXTRACT(json_object('pb', [[view1.point]]), '$.pb.lon') END) < {:TEST} OR (CASE WHEN json_valid([[view1.point]]) THEN JSON_EXTRACT([[view1.point]], '$.something') ELSE JSON_EXTRACT(json_object('pb', [[view1.point]]), '$.pb.something') END) > {:TEST})",
        },
        {
          name: "strftime with fixed string as time-value against known empty value (null normalizations)",
          collectionIdOrName: "demo5",
          rule: "strftime('%Y-%m', '2026-01-01') = ''",
          allowHiddenFields: false,
          expectQuery:
            "SELECT `demo5`.* FROM `demo5` WHERE ((strftime({:TEST},{:TEST}) = '' OR strftime({:TEST},{:TEST}) IS NULL))",
        },
        {
          name: "strftime without multi-match",
          collectionIdOrName: "demo5",
          rule: "strftime('%Y-%m', rel_one.created) = true",
          allowHiddenFields: false,
          expectQuery:
            "SELECT DISTINCT `demo5`.* FROM `demo5` LEFT JOIN `demo4` `demo5_rel_one` ON [[demo5_rel_one.id]] = [[demo5.rel_one]] WHERE strftime({:TEST},[[demo5_rel_one.created]]) = 1",
        },
        {
          name: "strftime with multi-match",
          collectionIdOrName: "demo5",
          rule: "strftime('%Y-%m', rel_many.created) = true",
          allowHiddenFields: false,
          expectQuery:
            "SELECT DISTINCT `demo5`.* FROM `demo5` LEFT JOIN json_each(CASE WHEN iif(json_valid([[demo5.rel_many]]), json_type([[demo5.rel_many]])='array', FALSE) THEN [[demo5.rel_many]] ELSE json_array([[demo5.rel_many]]) END) `__je_demo5_rel_many` LEFT JOIN `demo4` `demo5_rel_many` ON [[demo5_rel_many.id]] = [[__je_demo5_rel_many.value]] WHERE (((strftime({:TEST},[[demo5_rel_many.created]]) = 1) AND (NOT EXISTS (SELECT 1 FROM (SELECT strftime({:TEST},[[__mm_demo5_rel_many.created]]) as [[multiMatchValue]] FROM `demo5` `__mm_demo5` LEFT JOIN json_each(CASE WHEN iif(json_valid([[__mm_demo5.rel_many]]), json_type([[__mm_demo5.rel_many]])='array', FALSE) THEN [[__mm_demo5.rel_many]] ELSE json_array([[__mm_demo5.rel_many]]) END) `__mm_demo5_rel_many_je` LEFT JOIN `demo4` `__mm_demo5_rel_many` ON [[__mm_demo5_rel_many.id]] = [[__mm_demo5_rel_many_je.value]] WHERE [[__mm_demo5.id]] = [[demo5.id]]) {{__smTEST}} WHERE NOT ([[__smTEST.multiMatchValue]] = 1)))))",
        },
      ];

      for (const scenario of scenarios) {
        const collection = app.FindCollectionByNameOrId(scenario.collectionIdOrName);
        const expectError = scenario.expectQuery === "";
        const resolver = new RecordFieldResolver(app, collection, requestInfo, scenario.allowHiddenFields);

        let expr: { sql: string; params: unknown[] } | null = null;
        let exprErr: Error | null = null;
        try {
          expr = buildFilterExpr(scenario.rule, resolver, DefaultFilterExprLimit);
        } catch (error) {
          exprErr = error as Error;
        }

        const exprHasErr = exprErr !== null;
        expect(exprHasErr).toBe(expectError);

        let updated: { select: string; params: unknown[] } | null = null;
        let updateErr: Error | null = null;
        try {
          updated = resolver.UpdateQuery({
            select: `select {{${collection.name}}}.* from {{${collection.name}}}`,
            params: [],
          });
        } catch (error) {
          updateErr = error as Error;
        }

        if (updateErr && expectError) {
          throw updateErr;
        }
        if (expectError) {
          continue;
        }
        if (updateErr || !expr || !updated) {
          throw updateErr ?? new Error("failed to build query");
        }

        let rawQuery = appendWhere(updated.select, expr.sql);
        rawQuery = rewriteQuerySql(rawQuery);

        const expectedPattern = `^${escapeRegExp(scenario.expectQuery)}$`.replaceAll("TEST", "\\w+");

        if (!existInSliceWithRegex(rawQuery, [expectedPattern])) {
          throw new Error(`Expected query\n ${expectedPattern} \ngot:\n ${rawQuery}`);
        }
      }
    } finally {
      await cleanup();
    }
  });

  it("RecordFieldResolverResolveCollectionFields", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const collection = app.FindCollectionByNameOrId("demo4");
      const authRecord = app.FindRecordById("users", "4q1xlclmfloku33");

      const requestInfo: RequestInfo = {
        context: "ctx",
        method: "get",
        headers: {},
        query: {},
        body: {},
        auth: authRecord,
      };

      const resolver = new RecordFieldResolver(app, collection, requestInfo, true);

      const scenarios = [
        { fieldName: "", expectError: true, expectName: "" },
        { fieldName: " ", expectError: true, expectName: "" },
        { fieldName: "unknown", expectError: true, expectName: "" },
        { fieldName: "invalid format", expectError: true, expectName: "" },
        { fieldName: "id", expectError: false, expectName: "[[demo4.id]]" },
        { fieldName: "created", expectError: false, expectName: "[[demo4.created]]" },
        { fieldName: "updated", expectError: false, expectName: "[[demo4.updated]]" },
        { fieldName: "title", expectError: false, expectName: "[[demo4.title]]" },
        { fieldName: "title.test", expectError: true, expectName: "" },
        { fieldName: "self_rel_many", expectError: false, expectName: "[[demo4.self_rel_many]]" },
        { fieldName: "self_rel_many.", expectError: true, expectName: "" },
        { fieldName: "self_rel_many.unknown", expectError: true, expectName: "" },
        { fieldName: "self_rel_many.title", expectError: false, expectName: "[[demo4_self_rel_many.title]]" },
        {
          fieldName: "self_rel_many.self_rel_one.self_rel_many.title",
          expectError: false,
          expectName: "[[demo4_self_rel_many_self_rel_one_self_rel_many.title]]",
        },
        {
          fieldName: "self_rel_many.self_rel_many.self_rel_many.self_rel_many.self_rel_many.self_rel_many.id",
          expectError: false,
          expectName: "[[demo4_self_rel_many_self_rel_many_self_rel_many_self_rel_many_self_rel_many_self_rel_many.id]]",
        },
        {
          fieldName: "self_rel_many.self_rel_many.self_rel_many.self_rel_many.self_rel_many.self_rel_many.self_rel_many.id",
          expectError: true,
          expectName: "",
        },
        { fieldName: "rel_one_cascade.demo4_via_title.id", expectError: true, expectName: "" },
        { fieldName: "rel_one_cascade.demo4_via_self_rel_one.id", expectError: true, expectName: "" },
        {
          fieldName: "rel_one_cascade.demo4_via_rel_one_cascade.id",
          expectError: false,
          expectName: "[[demo4_rel_one_cascade_demo4_via_rel_one_cascade.id]]",
        },
        {
          fieldName: "rel_one_cascade.demo4_via_rel_one_cascade.rel_one_cascade.demo4_via_rel_one_cascade.id",
          expectError: false,
          expectName: "[[demo4_rel_one_cascade_demo4_via_rel_one_cascade_rel_one_cascade_demo4_via_rel_one_cascade.id]]",
        },
        {
          fieldName: "json_array.0",
          expectError: false,
          expectName:
            "(CASE WHEN json_valid([[demo4.json_array]]) THEN JSON_EXTRACT([[demo4.json_array]], '$[0]') ELSE JSON_EXTRACT(json_object('pb', [[demo4.json_array]]), '$.pb[0]') END)",
        },
        {
          fieldName: "json_object.a.b.c",
          expectError: false,
          expectName:
            "(CASE WHEN json_valid([[demo4.json_object]]) THEN JSON_EXTRACT([[demo4.json_object]], '$.a.b.c') ELSE JSON_EXTRACT(json_object('pb', [[demo4.json_object]]), '$.pb.a.b.c') END)",
        },
        {
          fieldName: "json_object.a.b.c.e.f.g.h.i.j.k.l.m.n.o.p",
          expectError: false,
          expectName:
            "(CASE WHEN json_valid([[demo4.json_object]]) THEN JSON_EXTRACT([[demo4.json_object]], '$.a.b.c.e.f.g.h.i.j.k.l.m.n.o.p') ELSE JSON_EXTRACT(json_object('pb', [[demo4.json_object]]), '$.pb.a.b.c.e.f.g.h.i.j.k.l.m.n.o.p') END)",
        },
        { fieldName: "@request.auth.rel", expectError: false, expectName: "[[__auth_users.rel]]" },
        { fieldName: "@request.auth.rel.title", expectError: false, expectName: "[[__auth_users_rel.title]]" },
        {
          fieldName: "@request.auth.demo1_via_rel_many.id",
          expectError: false,
          expectName: "[[__auth_users_demo1_via_rel_many.id]]",
        },
        { fieldName: "@request.auth.rel.missing", expectError: false, expectName: "NULL" },
        { fieldName: "@request.auth.missing_via_rel", expectError: false, expectName: "NULL" },
        { fieldName: "@request.auth.demo1_via_file_one.id", expectError: false, expectName: "NULL" },
        { fieldName: "@request.auth.demo1_via_rel_one.id", expectError: false, expectName: "NULL" },
        { fieldName: "@collect", expectError: true, expectName: "" },
        { fieldName: "collection.demo4.title", expectError: true, expectName: "" },
        { fieldName: "@collection", expectError: true, expectName: "" },
        { fieldName: "@collection.unknown", expectError: true, expectName: "" },
        { fieldName: "@collection.demo2", expectError: true, expectName: "" },
        { fieldName: "@collection.demo2.", expectError: true, expectName: "" },
        { fieldName: "@collection.demo2:someAlias", expectError: true, expectName: "" },
        { fieldName: "@collection.demo2:someAlias.", expectError: true, expectName: "" },
        { fieldName: "@collection.demo2.title", expectError: false, expectName: "[[__collection_demo2.title]]" },
        {
          fieldName: "@collection.demo2:someAlias.title",
          expectError: false,
          expectName: "[[__collection_alias_someAlias.title]]",
        },
        { fieldName: "@collection.demo4.id", expectError: false, expectName: "[[__collection_demo4.id]]" },
        {
          fieldName: "@collection.demo4.created",
          expectError: false,
          expectName: "[[__collection_demo4.created]]",
        },
        {
          fieldName: "@collection.demo4.updated",
          expectError: false,
          expectName: "[[__collection_demo4.updated]]",
        },
        { fieldName: "@collection.demo4.self_rel_many.missing", expectError: true, expectName: "" },
        {
          fieldName: "@collection.demo4.self_rel_many.self_rel_one.self_rel_many.self_rel_one.title",
          expectError: false,
          expectName: "[[__collection_demo4_self_rel_many_self_rel_one_self_rel_many_self_rel_one.title]]",
        },
      ];

      for (const scenario of scenarios) {
        let result: { identifier: string; params: unknown[] } | null = null;
        let err: Error | null = null;
        try {
          result = resolver.Resolve(scenario.fieldName);
        } catch (error) {
          err = error as Error;
        }

        const hasErr = err !== null;
        expect(hasErr).toBe(scenario.expectError);

        if (hasErr || !result) {
          continue;
        }

        expect(result.identifier).toBe(scenario.expectName);
        expect(result.params.length).toBe(0);
      }
    } finally {
      await cleanup();
    }
  });

  it("RecordFieldResolverResolveStaticRequestInfoFields", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const collection = app.FindCollectionByNameOrId("demo1");
      const authRecord = app.FindRecordById("users", "4q1xlclmfloku33");

      const requestInfo: RequestInfo = {
        context: "ctx",
        method: "get",
        query: {
          a: "123",
        },
        body: {
          number: "10",
          number_unknown: "20",
          raw_json_obj: new JSONRaw(`{"a":123}`),
          raw_json_arr1: new JSONRaw(`[123, 456]`),
          raw_json_arr2: new JSONRaw(`[{"a":123},{"b":456}]`),
          raw_json_simple: new JSONRaw(`123`),
          b: 456,
          c: { sub: 1 },
        },
        headers: {
          d: "789",
        },
        auth: authRecord,
      };

      const resolver = new RecordFieldResolver(app, collection, requestInfo, true);

      const scenarios = [
        { fieldName: "@request", expectError: true, expectParamValue: "" },
        { fieldName: "@request.invalid format", expectError: true, expectParamValue: "" },
        { fieldName: "@request.invalid_format2!", expectError: true, expectParamValue: "" },
        { fieldName: "@request.missing", expectError: true, expectParamValue: "" },
        { fieldName: "@request.context", expectError: false, expectParamValue: '"ctx"' },
        { fieldName: "@request.method", expectError: false, expectParamValue: '"get"' },
        { fieldName: "@request.query", expectError: true, expectParamValue: "" },
        { fieldName: "@request.query.a", expectError: false, expectParamValue: '"123"' },
        { fieldName: "@request.query.a.missing", expectError: false, expectParamValue: "" },
        { fieldName: "@request.headers", expectError: true, expectParamValue: "" },
        { fieldName: "@request.headers.missing", expectError: false, expectParamValue: "" },
        { fieldName: "@request.headers.d", expectError: false, expectParamValue: '"789"' },
        { fieldName: "@request.headers.d.sub", expectError: false, expectParamValue: "" },
        { fieldName: "@request.body", expectError: true, expectParamValue: "" },
        { fieldName: "@request.body.b", expectError: false, expectParamValue: "456" },
        { fieldName: "@request.body.number", expectError: false, expectParamValue: "10" },
        { fieldName: "@request.body.number_unknown", expectError: false, expectParamValue: '"20"' },
        { fieldName: "@request.body.b.missing", expectError: false, expectParamValue: "" },
        { fieldName: "@request.body.c", expectError: false, expectParamValue: '"{\\"sub\\":1}"' },
        { fieldName: "@request.auth", expectError: true, expectParamValue: "" },
        { fieldName: "@request.auth.id", expectError: false, expectParamValue: '"4q1xlclmfloku33"' },
        {
          fieldName: "@request.auth.collectionId",
          expectError: false,
          expectParamValue: `"${authRecord.collection().Id}"`,
        },
        {
          fieldName: "@request.auth.collectionName",
          expectError: false,
          expectParamValue: `"${authRecord.collection().Name}"`,
        },
        { fieldName: "@request.auth.verified", expectError: false, expectParamValue: "false" },
        { fieldName: "@request.auth.emailVisibility", expectError: false, expectParamValue: "false" },
        { fieldName: "@request.auth.email", expectError: false, expectParamValue: '"test@example.com"' },
        { fieldName: "@request.auth.missing", expectError: false, expectParamValue: "NULL" },
        { fieldName: "@request.body.raw_json_simple", expectError: false, expectParamValue: '"123"' },
        { fieldName: "@request.body.raw_json_simple.a", expectError: false, expectParamValue: "NULL" },
        { fieldName: "@request.body.raw_json_obj.a", expectError: false, expectParamValue: "123" },
        { fieldName: "@request.body.raw_json_obj.b", expectError: false, expectParamValue: "NULL" },
        { fieldName: "@request.body.raw_json_arr1.1", expectError: false, expectParamValue: "456" },
        { fieldName: "@request.body.raw_json_arr1.3", expectError: false, expectParamValue: "NULL" },
        { fieldName: "@request.body.raw_json_arr2.0.a", expectError: false, expectParamValue: "123" },
        { fieldName: "@request.body.raw_json_arr2.0.b", expectError: false, expectParamValue: "NULL" },
      ];

      for (const scenario of scenarios) {
        let result: { identifier: string; params: unknown[] } | null = null;
        let err: Error | null = null;
        try {
          result = resolver.Resolve(scenario.fieldName);
        } catch (error) {
          err = error as Error;
        }

        const hasErr = err !== null;
        expect(hasErr).toBe(scenario.expectError);

        if (hasErr || !result) {
          continue;
        }

        if (result.params.length === 0) {
          expect(result.identifier).toBe("NULL");
          continue;
        }

        expect(result.params.length).toBe(1);
        expect(result.identifier.startsWith("{:")).toBe(true);
        expect(result.identifier.endsWith("}")).toBe(true);

        const paramValue = result.params[0];
        const encoded = JSON.stringify(paramValue);
        expect(encoded).toBe(scenario.expectParamValue);
      }

      expect(authRecord.EmailVisibility()).toBe(false);
      if (authRecord.PublicExport()["email"] !== undefined) {
        throw new Error("Expected the original authRecord email to not be exported");
      }
    } finally {
      await cleanup();
    }
  });
});
