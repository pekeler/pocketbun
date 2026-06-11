// Ported from pocketbase/core/external_auth_query_test.go.

import { describe, expect, it } from "bun:test";
import { newTestApp } from "../tests/app.ts";
import { HashExp } from "../tools/dbx/expr.ts";
import { CollectionNameSuperusers } from "./collection_model.ts";

describe("external auth queries", () => {
  it("FindAllExternalAuthsByRecord", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const demo1 = app.FindRecordById("demo1", "84nmscqy84lsi1t");
      const superuser1 = app.FindAuthRecordByEmail(CollectionNameSuperusers, "test@example.com");
      const user1 = app.FindAuthRecordByEmail("users", "test@example.com");
      const user2 = app.FindAuthRecordByEmail("users", "test2@example.com");
      const user3 = app.FindAuthRecordByEmail("users", "test3@example.com");
      const client1 = app.FindAuthRecordByEmail("clients", "test@example.com");

      const scenarios = [
        { record: demo1, expected: [] as string[] },
        { record: superuser1, expected: [] as string[] },
        { record: client1, expected: ["f1z5b3843pzc964"] },
        { record: user1, expected: ["clmflokuq1xl341", "dlmflokuq1xl342"] },
        { record: user2, expected: [] as string[] },
        { record: user3, expected: ["5eto7nmys833164"] },
      ];

      for (const scenario of scenarios) {
        const result = app.FindAllExternalAuthsByRecord(scenario.record);

        expect(result.length).toBe(scenario.expected.length);
        for (let i = 0; i < scenario.expected.length; i += 1) {
          expect(result[i]?.ProxyRecord().Id).toBe(scenario.expected[i]);
        }
      }
    } finally {
      await cleanup();
    }
  });

  it("FindAllExternalAuthsByCollection", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const demo1 = app.findCollectionByNameOrIdOrNull("demo1");
      const superusers = app.findCollectionByNameOrIdOrNull(CollectionNameSuperusers);
      const clients = app.findCollectionByNameOrIdOrNull("clients");
      const users = app.findCollectionByNameOrIdOrNull("users");

      if (!demo1 || !superusers || !clients || !users) {
        throw new Error("Missing expected collections");
      }

      const scenarios = [
        { collection: demo1, expected: [] as string[] },
        { collection: superusers, expected: [] as string[] },
        { collection: clients, expected: ["f1z5b3843pzc964"] },
        { collection: users, expected: ["5eto7nmys833164", "clmflokuq1xl341", "dlmflokuq1xl342"] },
      ];

      for (const scenario of scenarios) {
        const result = app.FindAllExternalAuthsByCollection(scenario.collection);

        expect(result.length).toBe(scenario.expected.length);
        for (let i = 0; i < scenario.expected.length; i += 1) {
          expect(result[i]?.ProxyRecord().Id).toBe(scenario.expected[i]);
        }
      }
    } finally {
      await cleanup();
    }
  });

  it("FindFirstExternalAuthByExpr", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scenarios = [
        { expr: HashExp({ collectionRef: "invalid" }), expectedId: "" },
        { expr: HashExp({ collectionRef: "_pb_users_auth_" }), expectedId: "5eto7nmys833164" },
        {
          expr: HashExp({ collectionRef: "_pb_users_auth_", provider: "gitlab" }),
          expectedId: "dlmflokuq1xl342",
        },
      ];

      for (const scenario of scenarios) {
        let result: ReturnType<typeof app.FindFirstExternalAuthByExpr> | null = null;
        let err: Error | null = null;

        try {
          result = app.FindFirstExternalAuthByExpr(scenario.expr);
        } catch (error) {
          err = error as Error;
        }

        const hasErr = err !== null;
        const expectErr = scenario.expectedId === "";
        expect(hasErr).toBe(expectErr);

        if (!hasErr) {
          expect(result?.ProxyRecord().Id).toBe(scenario.expectedId);
        }
      }
    } finally {
      await cleanup();
    }
  });

  it("DeleteAllExternalAuthsByRecord", async () => {
    const { app: testApp, cleanup } = await newTestApp();
    try {
      const demo1 = testApp.FindRecordById("demo1", "84nmscqy84lsi1t");
      const user1 = testApp.FindAuthRecordByEmail("users", "test@example.com");
      const client1 = testApp.FindAuthRecordByEmail("clients", "test@example.com");
      const client2 = testApp.FindAuthRecordByEmail("clients", "test2@example.com");

      const scenarios = [
        { record: demo1, deletedIds: [] as string[] },
        { record: user1, deletedIds: ["dlmflokuq1xl342", "clmflokuq1xl341"] },
        { record: client1, deletedIds: ["f1z5b3843pzc964"] },
        { record: client2, deletedIds: [] as string[] },
      ];

      for (const scenario of scenarios) {
        const { app, cleanup: scenarioCleanup } = await newTestApp();
        try {
          const record = app.FindRecordById(scenario.record.collection().name, scenario.record.Id);
          const deletedIds: string[] = [];

          app.OnRecordDelete().BindFunc((event) => {
            if (event.Record) {
              deletedIds.push(event.Record.Id);
            }
            return event.Next();
          });

          const err = await app.DeleteAllExternalAuthsByRecord(record);
          expect(err).toBeNull();
          expect(deletedIds.length).toBe(scenario.deletedIds.length);
          for (const id of scenario.deletedIds) {
            expect(deletedIds.includes(id)).toBe(true);
          }
        } finally {
          await scenarioCleanup();
        }
      }
    } finally {
      await cleanup();
    }
  });
});
