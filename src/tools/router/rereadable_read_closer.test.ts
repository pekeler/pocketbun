// Ported from pocketbase/tools/router/rereadable_read_closer_test.go

import { describe, expect, it } from "bun:test";
import { RereadableReadCloser } from "./rereadable_read_closer.ts";

describe("RereadableReadCloser", () => {
  it("reads multiple times", () => {
    const content = "test";
    const reader = new RereadableReadCloser(content);

    for (let i = 0; i < 3; i += 1) {
      const raw = reader.readAll();
      const str = new TextDecoder().decode(raw);
      expect(str).toBe(content);
    }
  });
});
