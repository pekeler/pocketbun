// Ported from pocketbase/core/mfa_query_test.go.

import { describe, expect, it } from "bun:test";
import { StubMFARecords } from "../../tests/dynamic_stubs.ts";
import { newTestApp } from "../../tests/test_app.ts";
import { CollectionNameSuperusers } from "./collection.ts";

describe("mfa queries", () => {
  it("FindAllMFAsByRecord", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const stubErr = StubMFARecords(app);
      expect(stubErr).toBeNull();

      const demo1 = app.FindRecordById("demo1", "84nmscqy84lsi1t");
      const superuser2 = app.FindAuthRecordByEmail(CollectionNameSuperusers, "test2@example.com");
      const superuser4 = app.FindAuthRecordByEmail(CollectionNameSuperusers, "test4@example.com");
      const user1 = app.FindAuthRecordByEmail("users", "test@example.com");

      const scenarios = [
        { record: demo1, expected: [] },
        { record: superuser2, expected: ["superuser2_0", "superuser2_3", "superuser2_2", "superuser2_1", "superuser2_4"] },
        { record: superuser4, expected: [] },
        { record: user1, expected: ["user1_0"] },
      ];

      for (const scenario of scenarios) {
        const result = app.FindAllMFAsByRecord(scenario.record);
        expect(result.length).toBe(scenario.expected.length);
        for (const [index, id] of scenario.expected.entries()) {
          expect(result[index]?.Id).toBe(id);
        }
      }
    } finally {
      await cleanup();
    }
  });

  it("FindAllMFAsByCollection", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const stubErr = StubMFARecords(app);
      expect(stubErr).toBeNull();

      const demo1 = app.findCollectionByNameOrId("demo1");
      const superusers = app.findCollectionByNameOrId(CollectionNameSuperusers);
      const clients = app.findCollectionByNameOrId("clients");
      const users = app.findCollectionByNameOrId("users");

      if (!demo1 || !superusers || !clients || !users) {
        throw new Error("missing collections");
      }

      const scenarios = [
        { collection: demo1, expected: [] },
        {
          collection: superusers,
          expected: [
            "superuser2_0",
            "superuser2_3",
            "superuser3_0",
            "superuser2_2",
            "superuser3_1",
            "superuser2_1",
            "superuser2_4",
          ],
        },
        { collection: clients, expected: [] },
        { collection: users, expected: ["user1_0"] },
      ];

      for (const scenario of scenarios) {
        const result = app.FindAllMFAsByCollection(scenario.collection);
        expect(result.length).toBe(scenario.expected.length);
        for (const [index, id] of scenario.expected.entries()) {
          expect(result[index]?.Id).toBe(id);
        }
      }
    } finally {
      await cleanup();
    }
  });

  it("FindMFAById", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const stubErr = StubMFARecords(app);
      expect(stubErr).toBeNull();

      const scenarios = [
        { id: "", expectError: true },
        { id: "84nmscqy84lsi1t", expectError: true },
        { id: "superuser2_0", expectError: false },
        { id: "superuser2_4", expectError: false },
        { id: "user1_0", expectError: false },
      ];

      for (const scenario of scenarios) {
        let err: Error | null = null;
        let resultId = "";
        try {
          const result = app.FindMFAById(scenario.id);
          resultId = result.Id;
        } catch (error) {
          err = error as Error;
        }

        expect(Boolean(err)).toBe(scenario.expectError);
        if (!scenario.expectError) {
          expect(resultId).toBe(scenario.id);
        }
      }
    } finally {
      await cleanup();
    }
  });

  it("DeleteAllMFAsByRecord", async () => {
    const { app: testApp, cleanup: cleanupTest } = await newTestApp();
    try {
      const demo1 = testApp.FindRecordById("demo1", "84nmscqy84lsi1t");
      const superuser2 = testApp.FindAuthRecordByEmail(CollectionNameSuperusers, "test2@example.com");
      const superuser4 = testApp.FindAuthRecordByEmail(CollectionNameSuperusers, "test4@example.com");
      const user1 = testApp.FindAuthRecordByEmail("users", "test@example.com");

      const scenarios = [
        { record: demo1, deletedIds: [] },
        { record: superuser2, deletedIds: ["superuser2_0", "superuser2_1", "superuser2_3", "superuser2_2", "superuser2_4"] },
        { record: superuser4, deletedIds: [] },
        { record: user1, deletedIds: ["user1_0"] },
      ];

      for (const scenario of scenarios) {
        const { app, cleanup } = await newTestApp();
        try {
          const stubErr = StubMFARecords(app);
          expect(stubErr).toBeNull();

          const deletedIds: string[] = [];
          app.OnRecordAfterDeleteSuccess().BindFunc((e) => {
            if (e.Record) {
              deletedIds.push(e.Record.Id);
            }
            return e.Next();
          });

          const err = app.DeleteAllMFAsByRecord(scenario.record);
          expect(err).toBeNull();

          expect(deletedIds.length).toBe(scenario.deletedIds.length);
          for (const id of scenario.deletedIds) {
            expect(deletedIds.includes(id)).toBe(true);
          }
        } finally {
          await cleanup();
        }
      }
    } finally {
      await cleanupTest();
    }
  });

  it("DeleteExpiredMFAs", async () => {
    const checkDeletedIds = async (
      expectedDeletedIds: string[],
      mutate?: (app: Awaited<ReturnType<typeof newTestApp>>["app"]) => void,
    ) => {
      const { app, cleanup } = await newTestApp();
      try {
        if (mutate) {
          mutate(app);
        }

        const stubErr = StubMFARecords(app);
        expect(stubErr).toBeNull();

        const deletedIds: string[] = [];
        app.OnRecordDelete().BindFunc((e) => {
          if (e.Record) {
            deletedIds.push(e.Record.Id);
          }
          return e.Next();
        });

        const err = app.DeleteExpiredMFAs();
        expect(err).toBeNull();

        expect(deletedIds.length).toBe(expectedDeletedIds.length);
        for (const id of expectedDeletedIds) {
          expect(deletedIds.includes(id)).toBe(true);
        }
      } finally {
        await cleanup();
      }
    };

    await checkDeletedIds(["user1_0", "superuser2_1", "superuser2_4"]);

    await checkDeletedIds(["user1_0", "superuser2_1", "superuser2_2", "superuser2_4", "superuser3_1"], (app) => {
      const superusers = app.findCollectionByNameOrId(CollectionNameSuperusers);
      if (!superusers) {
        throw new Error("missing superusers collection");
      }
      superusers.MFA.Duration = 60;
      const err = app.Save(superusers);
      if (err) {
        throw err;
      }
    });
  });
});
