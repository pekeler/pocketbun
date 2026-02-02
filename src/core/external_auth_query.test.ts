// Ported from pocketbase/core/external_auth_query_test.go.

import { describe, expect, it } from "bun:test";
import { newTestApp } from "../tests/app.ts";
import { HashExp } from "../tools/dbx/expr.ts";
import { CollectionNameSuperusers } from "./collection.ts";

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
      const demo1 = app.findCollectionByNameOrId("demo1");
      const superusers = app.findCollectionByNameOrId(CollectionNameSuperusers);
      const clients = app.findCollectionByNameOrId("clients");
      const users = app.findCollectionByNameOrId("users");

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
});
