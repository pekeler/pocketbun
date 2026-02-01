// Ported from pocketbase/core/record_query_test.go (partial: FindRecordById/FindAuthRecordByToken/FindAuthRecordByEmail).

import { describe, expect, it } from "bun:test";
import { findSingleColumnUniqueIndex } from "../tools/dbutils/index.ts";
import { newTestApp } from "../../tests/test_app.ts";
import type { RecordQueryFilter } from "./record_query.ts";
import { FieldNameEmail } from "./record.ts";
import { TokenTypeAuth, TokenTypeFile } from "./record_tokens.ts";

describe("FindRecordById", () => {
  it("finds records by id with optional filters", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const byTitle = (title: string): RecordQueryFilter => (q) => {
        q.AndWhere({ title });
        return null;
      };

      const byActive = (active: boolean): RecordQueryFilter => (q) => {
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
        { collectionIdOrName: "demo2", id: "0yxhwia2amd8gec", filters: [null, null], expectError: false },
        { collectionIdOrName: "demo2", id: "0yxhwia2amd8gec", filters: [null, () => null], expectError: false },
        { collectionIdOrName: "demo2", id: "0yxhwia2amd8gec", filters: [byTitle("missing")], expectError: true },
        { collectionIdOrName: "demo2", id: "0yxhwia2amd8gec", filters: [errFilter], expectError: true },
        { collectionIdOrName: "demo2", id: "0yxhwia2amd8gec", filters: [byTitle("test3")], expectError: false },
        { collectionIdOrName: "demo2", id: "0yxhwia2amd8gec", filters: [byTitle("test3"), null], expectError: false },
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
      { collectionIdOrName: "missing", email: "test@example.com", nocaseIndex: false, expectError: true },
      { collectionIdOrName: "demo2", email: "test@example.com", nocaseIndex: false, expectError: true },
      { collectionIdOrName: "users", email: "missing@example.com", nocaseIndex: false, expectError: true },
      { collectionIdOrName: "users", email: "test@example.com", nocaseIndex: false, expectError: false },
      { collectionIdOrName: "clients", email: "test2@example.com", nocaseIndex: false, expectError: false },
      { collectionIdOrName: "clients", email: "TeSt2@example.com", nocaseIndex: false, expectError: true },
      { collectionIdOrName: "clients", email: "TeSt2@example.com", nocaseIndex: true, expectError: false },
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

            const err = app.Save(collection);
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
