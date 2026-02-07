// Ported from pocketbase/plugins/jsvm/form_data_test.go

import { describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NewFileFromBytes, NewFileFromPath, PathReader } from "../../tools/filesystem/file.ts";
import { FormData } from "./form_data.ts";

describe("jsvm FormData", () => {
  it("append and set", () => {
    const data = new FormData();

    data.append("a", 1);
    data.append("a", 2);

    data.append("b", 3);
    data.append("b", 4);
    data.set("b", 5);

    data.set("c", 6);
    data.set("c", 7);

    expect(data.getAll("a")?.length).toBe(2);
    expect(data.getAll("a")?.[0]).toBe(1);
    expect(data.getAll("a")?.[1]).toBe(2);

    expect(data.getAll("b")?.length).toBe(1);
    expect(data.getAll("b")?.[0]).toBe(5);

    expect(data.getAll("c")?.length).toBe(1);
    expect(data.getAll("c")?.[0]).toBe(7);
  });

  it("delete", () => {
    const data = new FormData();
    data.append("a", 1);
    data.append("a", 2);
    data.append("b", 3);

    data.delete("missing");
    data.delete("a");

    expect(data.keys().length).toBe(1);
    expect(data.get("b")).toBe(3);
  });

  it("get", () => {
    const data = new FormData();
    data.append("a", 1);
    data.append("a", 2);

    expect(data.get("missing")).toBeNull();
    expect(data.get("a")).toBe(1);
  });

  it("getAll", () => {
    const data = new FormData();
    data.append("a", 1);
    data.append("a", 2);

    expect(data.getAll("missing")).toBeNull();
    expect(data.getAll("a")).toEqual([1, 2]);
  });

  it("has", () => {
    const data = new FormData();
    data.append("a", 1);

    expect(data.has("missing")).toBe(false);
    expect(data.has("a")).toBe(true);
  });

  it("keys", () => {
    const data = new FormData();
    data.append("a", 1);
    data.append("b", 1);
    data.append("c", 1);
    data.append("a", 1);

    const keys = data.keys();
    expect(keys.includes("a")).toBe(true);
    expect(keys.includes("b")).toBe(true);
    expect(keys.includes("c")).toBe(true);
  });

  it("values", () => {
    const data = new FormData();
    data.append("a", 1);
    data.append("b", 2);
    data.append("c", 3);
    data.append("a", 4);

    const values = data.values();
    expect(values).toEqual(expect.arrayContaining([1, 2, 3, 4]));
  });

  it("entries", () => {
    const data = new FormData();
    data.append("a", 1);
    data.append("b", 2);
    data.append("c", 3);
    data.append("a", 4);

    const entries = data.entries();
    const raw = JSON.stringify(entries);
    expect(entries.length).toBe(4);
    expect(raw.includes(`["a",1]`)).toBe(true);
    expect(raw.includes(`["a",4]`)).toBe(true);
    expect(raw.includes(`["b",2]`)).toBe(true);
    expect(raw.includes(`["c",3]`)).toBe(true);
  });

  it("toMultipart", () => {
    const file = NewFileFromBytes(new Uint8Array([97, 98, 99]), "test");
    const data = new FormData();
    data.append("a", 1);
    data.append("b", "test1");
    data.append("b", "test2");
    data.append("c", file);

    const { body, contentType } = data.toMultipart();
    const bodyStr = new TextDecoder().decode(body);

    expect(contentType.startsWith("multipart/form-data; boundary=")).toBe(true);
    expect(bodyStr.includes(`name="a"`)).toBe(true);
    expect(bodyStr.includes("1")).toBe(true);
    expect(bodyStr.includes(`name="b"`)).toBe(true);
    expect(bodyStr.includes("test1")).toBe(true);
    expect(bodyStr.includes("test2")).toBe(true);
    expect(bodyStr.includes(`name="c"`)).toBe(true);
  });

  it("toMultipartAsync", async () => {
    const file = NewFileFromBytes(new Uint8Array([97, 98, 99]), "test");
    const data = new FormData();
    data.append("a", 1);
    data.append("b", "test1");
    data.append("b", "test2");
    data.append("c", file);

    const { body, contentType } = await data.toMultipartAsync();
    const bodyStr = new TextDecoder().decode(body);

    expect(contentType.startsWith("multipart/form-data; boundary=")).toBe(true);
    expect(bodyStr.includes(`name="a"`)).toBe(true);
    expect(bodyStr.includes("1")).toBe(true);
    expect(bodyStr.includes(`name="b"`)).toBe(true);
    expect(bodyStr.includes("test1")).toBe(true);
    expect(bodyStr.includes("test2")).toBe(true);
    expect(bodyStr.includes(`name="c"`)).toBe(true);
  });

  it("toMultipartAsync prefers async disk reads for path-backed readers", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "pb-form-data-"));
    try {
      const path = join(tempDir, "sample.txt");
      await writeFile(path, "abc");

      const file = NewFileFromPath(path);
      const reader = file.Reader;
      if (!(reader instanceof PathReader)) {
        throw new Error("expected path reader");
      }
      (reader as unknown as { Open: () => never }).Open = () => {
        throw new Error("sync open should not be used for path readers");
      };

      const data = new FormData();
      data.append("file", file);

      const { body } = await data.toMultipartAsync();
      expect(new TextDecoder().decode(body).includes("abc")).toBe(true);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
