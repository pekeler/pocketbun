// Ported from pocketbase/core/auth_origin_query_test.go.

import { describe, expect, it } from "bun:test";
import { newTestApp } from "../../tests/test_app.ts";
import { CollectionNameSuperusers } from "./collection.ts";

describe("auth origin queries", () => {
  it("FindAllAuthOriginsByRecord", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const demo1 = app.FindRecordById("demo1", "84nmscqy84lsi1t");
      const superuser2 = app.FindAuthRecordByEmail(CollectionNameSuperusers, "test2@example.com");
      const superuser4 = app.FindAuthRecordByEmail(CollectionNameSuperusers, "test4@example.com");
      const client1 = app.FindAuthRecordByEmail("clients", "test@example.com");

      const scenarios = [
        { record: demo1, expected: [] as string[] },
        { record: superuser2, expected: ["5798yh833k6w6w0", "ic55o70g4f8pcl4", "dmy260k6ksjr4ib"] },
        { record: superuser4, expected: [] as string[] },
        { record: client1, expected: ["9r2j0m74260ur8i"] },
      ];

      for (const scenario of scenarios) {
        const result = app.FindAllAuthOriginsByRecord(scenario.record);

        expect(result.length).toBe(scenario.expected.length);
        for (let i = 0; i < scenario.expected.length; i += 1) {
          expect(result[i]?.ProxyRecord().Id).toBe(scenario.expected[i]);
        }
      }
    } finally {
      await cleanup();
    }
  });

  it("FindAllAuthOriginsByCollection", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const demo1 = app.findCollectionByNameOrId("demo1");
      const superusers = app.findCollectionByNameOrId(CollectionNameSuperusers);
      const clients = app.findCollectionByNameOrId("clients");

      if (!demo1 || !superusers || !clients) {
        throw new Error("Missing expected collections");
      }

      const scenarios = [
        { collection: demo1, expected: [] as string[] },
        {
          collection: superusers,
          expected: ["5798yh833k6w6w0", "ic55o70g4f8pcl4", "dmy260k6ksjr4ib", "5f29jy38bf5zm3f"],
        },
        { collection: clients, expected: ["9r2j0m74260ur8i"] },
      ];

      for (const scenario of scenarios) {
        const result = app.FindAllAuthOriginsByCollection(scenario.collection);

        expect(result.length).toBe(scenario.expected.length);
        for (let i = 0; i < scenario.expected.length; i += 1) {
          expect(result[i]?.ProxyRecord().Id).toBe(scenario.expected[i]);
        }
      }
    } finally {
      await cleanup();
    }
  });

  it("FindAuthOriginById", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scenarios = [
        { id: "", expectError: true },
        { id: "84nmscqy84lsi1t", expectError: true },
        { id: "9r2j0m74260ur8i", expectError: false },
      ];

      for (const scenario of scenarios) {
        let result: ReturnType<typeof app.FindAuthOriginById> | null = null;
        let err: Error | null = null;

        try {
          result = app.FindAuthOriginById(scenario.id);
        } catch (error) {
          err = error as Error;
        }

        const hasErr = err !== null;
        expect(hasErr).toBe(scenario.expectError);

        if (!hasErr) {
          expect(result?.ProxyRecord().Id).toBe(scenario.id);
        }
      }
    } finally {
      await cleanup();
    }
  });

  it("FindAuthOriginByRecordAndFingerprint", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const demo1 = app.FindRecordById("demo1", "84nmscqy84lsi1t");
      const superuser2 = app.FindAuthRecordByEmail(CollectionNameSuperusers, "test2@example.com");

      const scenarios = [
        { record: demo1, fingerprint: "6afbfe481c31c08c55a746cccb88ece0", expectError: true },
        { record: superuser2, fingerprint: "", expectError: true },
        { record: superuser2, fingerprint: "abc", expectError: true },
        { record: superuser2, fingerprint: "22bbbcbed36e25321f384ccf99f60057", expectError: false },
        { record: superuser2, fingerprint: "6afbfe481c31c08c55a746cccb88ece0", expectError: false },
      ];

      for (const scenario of scenarios) {
        let result: ReturnType<typeof app.FindAuthOriginByRecordAndFingerprint> | null = null;
        let err: Error | null = null;

        try {
          result = app.FindAuthOriginByRecordAndFingerprint(scenario.record, scenario.fingerprint);
        } catch (error) {
          err = error as Error;
        }

        const hasErr = err !== null;
        expect(hasErr).toBe(scenario.expectError);

        if (!hasErr && result) {
          expect(result.Fingerprint()).toBe(scenario.fingerprint);
          expect(result.RecordRef()).toBe(scenario.record.Id);
          expect(result.CollectionRef()).toBe(scenario.record.collection().id);
        }
      }
    } finally {
      await cleanup();
    }
  });

  it("DeleteAllAuthOriginsByRecord", async () => {
    const { app: testApp, cleanup: testCleanup } = await newTestApp();
    try {
      const demo1 = testApp.FindRecordById("demo1", "84nmscqy84lsi1t");
      const superuser2 = testApp.FindAuthRecordByEmail(CollectionNameSuperusers, "test2@example.com");
      const superuser4 = testApp.FindAuthRecordByEmail(CollectionNameSuperusers, "test4@example.com");
      const client1 = testApp.FindAuthRecordByEmail("clients", "test@example.com");

      const scenarios = [
        { record: demo1, deletedIds: [] as string[] },
        {
          record: superuser2,
          deletedIds: ["5798yh833k6w6w0", "ic55o70g4f8pcl4", "dmy260k6ksjr4ib"],
        },
        { record: superuser4, deletedIds: [] as string[] },
        { record: client1, deletedIds: ["9r2j0m74260ur8i"] },
      ];

      for (const scenario of scenarios) {
        const { app, cleanup } = await newTestApp();
        try {
          const deletedIds: string[] = [];
          app.OnRecordDelete().BindFunc((e) => {
            if (e.Record) {
              deletedIds.push(e.Record.Id);
            }
            return e.Next();
          });

          const err = app.DeleteAllAuthOriginsByRecord(scenario.record);
          if (err) {
            throw err;
          }

          expect(deletedIds.length).toBe(scenario.deletedIds.length);
          for (const id of scenario.deletedIds) {
            expect(deletedIds.includes(id)).toBe(true);
          }
        } finally {
          await cleanup();
        }
      }
    } finally {
      await testCleanup();
    }
  });
});
