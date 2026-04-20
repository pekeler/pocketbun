// Ported from pocketbase/tools/router/buffer_with_file_test.go

import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { newBufferWithFile } from "./buffer_with_file.ts";
import { DefaultMaxMemory } from "./event.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

describe("newBufferWithFile", () => {
  it("defaults negative and zero limits to DefaultMaxMemory", () => {
    const negative = newBufferWithFile(-1);
    expect(negative.memoryLimit).toBe(DefaultMaxMemory);
    expect(negative.filePath).toBeNull();
    expect(negative.bufLength).toBe(0);

    const zero = newBufferWithFile(0);
    expect(zero.memoryLimit).toBe(DefaultMaxMemory);
    expect(zero.filePath).toBeNull();
    expect(zero.bufLength).toBe(0);

    const positive = newBufferWithFile(1);
    expect(positive.memoryLimit).toBe(1);
    expect(positive.filePath).toBeNull();
    expect(positive.bufLength).toBe(0);
  });
});

describe("bufferWithFile", () => {
  it("writes, reads, and cleans up the temp file", () => {
    const b = newBufferWithFile(4);

    expect(b.write(encoder.encode("ab"))).toBe(2);
    expect(b.bufLength).toBe(2);
    expect(b.filePath).toBeNull();

    expect(b.write(encoder.encode("c"))).toBe(1);
    expect(b.bufLength).toBe(3);
    expect(b.filePath).toBeNull();

    expect(b.write(encoder.encode("de"))).toBe(2);
    expect(b.bufLength).toBe(3);
    expect(b.filePath).not.toBeNull();

    const empty = new Uint8Array(0);
    expect(b.read(empty)).toEqual({ n: 0, eof: false });

    const underLimit = new Uint8Array(2);
    expect(b.read(underLimit)).toEqual({ n: 2, eof: false });
    expect(decoder.decode(underLimit)).toBe("ab");

    const beyondLimit = new Uint8Array(3);
    expect(b.read(beyondLimit)).toEqual({ n: 3, eof: false });
    expect(decoder.decode(beyondLimit)).toBe("cde");

    const drained = new Uint8Array(3);
    expect(b.read(drained)).toEqual({ n: 0, eof: true });

    const filename = b.filePath;
    expect(filename).not.toBeNull();
    expect(existsSync(filename!)).toBe(true);

    b.close();

    expect(existsSync(filename!)).toBe(false);
    expect(b.filePath).toBeNull();
    expect(b.bufLength).toBe(0);
  });
});
