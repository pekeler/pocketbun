// Ported from pocketbase/tools/filesystem/blob/writer.go
// Deviation: Writer write/close operations are async because driver writers may be async in Bun.

import { createHash } from "node:crypto";
import type { Driver, DriverWriter, WriterOptions } from "./driver.ts";
import { wrapError } from "./errors.ts";

const sniffLen = 512;

export class Writer {
  #drv: Driver;
  #w: DriverWriter | null;
  #key: string;
  #cancel: () => void;
  #contentMD5: Uint8Array;
  #md5hash: ReturnType<typeof createHash>;

  #ctx: AbortSignal | null;
  #opts: WriterOptions | null;
  #bufChunks: Uint8Array[] | null;
  #bufSize = 0;

  constructor(
    drv: Driver,
    key: string,
    cancel: () => void,
    contentMD5: Uint8Array,
    writer: DriverWriter | null,
    ctx: AbortSignal | null,
    opts: WriterOptions | null,
  ) {
    this.#drv = drv;
    this.#key = key;
    this.#cancel = cancel;
    this.#contentMD5 = contentMD5;
    this.#md5hash = createHash("md5");
    this.#w = writer;
    this.#ctx = ctx;
    this.#opts = opts;
    this.#bufChunks = writer ? null : [];
  }

  async write(data?: Uint8Array | null): Promise<number> {
    if (!data || data.length === 0) {
      return 0;
    }

    if (this.#contentMD5.length > 0) {
      this.#md5hash.update(data);
    }

    if (this.#w) {
      return this.#write(data);
    }

    if (this.#bufChunks && this.#bufSize === 0 && data.length >= sniffLen) {
      return this.#open(data);
    }

    if (this.#bufChunks) {
      this.#bufChunks.push(data);
      this.#bufSize += data.length;
      if (this.#bufSize >= sniffLen) {
        const merged = mergeChunks(this.#bufChunks, this.#bufSize);
        this.#bufChunks = null;
        this.#bufSize = 0;
        const opened = await this.#open(merged);
        return data.length || opened;
      }
      return data.length;
    }

    return this.#write(data);
  }

  async close(): Promise<void> {
    if (this.#contentMD5.length > 0) {
      const md5sum = this.#md5hash.digest();
      if (!bytesEqual(md5sum, this.#contentMD5)) {
        this.#cancel();
        if (this.#w) {
          try {
            await this.#w.close();
          } catch {
            // ignore
          }
        }
        throw new Error(
          `the WriterOptions.ContentMD5 you specified (${Buffer.from(this.#contentMD5).toString("hex")}) did not match what was written (${Buffer.from(
            md5sum,
          ).toString("hex")})`,
        );
      }
    }

    this.#cancel();

    const writer = this.#w;
    if (writer) {
      await writer.close();
      return;
    }

    const data = this.#bufChunks ? mergeChunks(this.#bufChunks, this.#bufSize) : new Uint8Array();
    await this.#open(data);
    const openedWriter = this.#w;
    if (openedWriter) {
      await openedWriter.close();
    }
  }

  async #open(data: Uint8Array): Promise<number> {
    const contentType = detectContentType(data);
    if (!this.#opts) {
      throw new Error("Writer options missing for lazy writer open");
    }

    try {
      this.#w = await this.#drv.NewTypedWriter(this.#ctx, this.#key, contentType, this.#opts);
    } catch (err) {
      const wrapped = wrapError(this.#drv, err as Error, this.#key);
      if (wrapped) {
        throw wrapped;
      }
      throw err;
    }

    this.#bufChunks = null;
    this.#ctx = null;
    this.#opts = null;

    return this.#write(data);
  }

  #write(data: Uint8Array): number {
    if (!this.#w) {
      return 0;
    }
    const written = this.#w.write(data);
    return written;
  }
}

function detectContentType(data: Uint8Array): string {
  if (data.length === 0) {
    return "application/octet-stream";
  }
  if (data.length >= 8) {
    const pngSig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    let isPng = true;
    for (let i = 0; i < pngSig.length; i += 1) {
      if (data[i] !== pngSig[i]) {
        isPng = false;
        break;
      }
    }
    if (isPng) {
      return "image/png";
    }
  }

  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return "image/jpeg";
  }

  if (data.length >= 6) {
    const header = new TextDecoder().decode(data.slice(0, 6));
    if (header === "GIF87a" || header === "GIF89a") {
      return "image/gif";
    }
  }

  if (data.length >= 12) {
    const riff = new TextDecoder().decode(data.slice(0, 4));
    const webp = new TextDecoder().decode(data.slice(8, 12));
    if (riff === "RIFF" && webp === "WEBP") {
      return "image/webp";
    }
  }

  return "application/octet-stream";
}

function mergeChunks(chunks: Uint8Array[], size: number): Uint8Array {
  const merged = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}
