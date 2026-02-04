// Ported from pocketbase/core/record_model_superusers_test.go.

import { describe, expect, it } from "bun:test";
import { newTestApp } from "../tests/app.ts";
import { CollectionNameSuperusers } from "./collection_model.ts";

describe("Record.IsSuperuser", () => {
  it("returns true only for superusers", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const demo1 = app.FindRecordById("demo1", "84nmscqy84lsi1t");
      const user = app.FindAuthRecordByEmail("users", "test@example.com");
      const superuser = app.FindAuthRecordByEmail(CollectionNameSuperusers, "test@example.com");

      const scenarios = [
        { record: demo1, expected: false },
        { record: user, expected: false },
        { record: superuser, expected: true },
      ];

      for (const scenario of scenarios) {
        const result = scenario.record.IsSuperuser();
        expect(result).toBe(scenario.expected);
      }
    } finally {
      await cleanup();
    }
  });
});
