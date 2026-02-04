// Ported from pocketbase/tools/types/types_test.go.

import { describe, expect, it } from "bun:test";
import { Pointer } from "./types.ts";

describe("Pointer", () => {
  it("returns a non-null value", () => {
    const s1 = Pointer("");
    expect(s1).toBe("");

    const s2 = Pointer("test");
    expect(s2).toBe("test");

    const s3 = Pointer(123);
    expect(s3).toBe(123);
  });
});
