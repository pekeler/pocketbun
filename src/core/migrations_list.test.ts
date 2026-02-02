// Ported from pocketbase/core/migrations_list_test.go.

import { describe, expect, it } from "bun:test";
import { MigrationsList } from "./migrations_list.ts";

describe("MigrationsList", () => {
  it("orders and copies migrations", () => {
    const l1 = new MigrationsList();
    l1.Add({ file: "5_test.go" });
    l1.Add({});
    l1.Register(undefined, undefined, "3_test.go");
    l1.Register(undefined, undefined, "1_test.go");
    l1.Register(undefined, undefined, "2_test.go");
    l1.Register(undefined, undefined);

    const l2 = new MigrationsList();
    l2.Register(undefined, undefined, "4_test.go");
    l2.Copy(l1);

    const expected = [
      "1_test.go",
      "2_test.go",
      "3_test.go",
      "4_test.go",
      "5_test.go",
      "migrations_list.test.ts",
      "migrations_list.test.ts",
    ];

    const items = l2.Items();
    if (items.length !== expected.length) {
      const names = items.map((item) => item.file);
      throw new Error(`Expected ${expected.length} items, got ${items.length}:\n${names.join("\n")}`);
    }

    for (let i = 0; i < expected.length; i += 1) {
      const item = l2.Item(i);
      expect(item?.file).toBe(expected[i]);
    }
  });
});
