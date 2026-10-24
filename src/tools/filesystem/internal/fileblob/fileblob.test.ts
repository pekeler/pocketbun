// PocketBun-only: regression coverage for upstream bucket escape checks.
import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { New } from "./fileblob.ts";

test("reject keys and list prefixes escaping the bucket", async () => {
  const dir = await mkdtemp(join(tmpdir(), "fileblob-"));
  try {
    const driver = New(dir);
    for (const key of ["", ".", ".."]) {
      expect(await driver.Attributes(null, key).catch((error: Error) => error.message)).toContain("escapes bucket root");
    }
    expect(
      await driver
        .ListPaged(null, { Prefix: "../", Delimiter: "", PageSize: 10, PageToken: new Uint8Array() })
        .catch((error: Error) => error.message),
    ).toContain("prefix escapes bucket root");
    expect(
      (await driver.ListPaged(null, { Prefix: "", Delimiter: "", PageSize: 10, PageToken: new Uint8Array() })).Objects,
    ).toEqual([]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
