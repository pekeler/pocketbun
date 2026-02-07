// Ported from pocketbase/tools/filesystem/blob/reader.go
// Deviation: Reader methods that may recreate the underlying range reader are async.

import type { Driver, DriverReader } from "./driver.ts";
import { wrapError } from "./errors.ts";

const seekStart = 0;
const seekCurrent = 1;
const seekEnd = 2;

export class Reader {
  #ctx: AbortSignal | null;
  #r: DriverReader;
  #drv: Driver;
  #key: string;
  #baseOffset: number;
  #baseLength: number;
  #relativeOffset: number;
  #savedOffset: number;

  constructor(ctx: AbortSignal | null, drv: Driver, reader: DriverReader, key: string, baseOffset: number, baseLength: number) {
    this.#ctx = ctx;
    this.#drv = drv;
    this.#r = reader;
    this.#key = key;
    this.#baseOffset = baseOffset;
    this.#baseLength = baseLength;
    this.#relativeOffset = 0;
    this.#savedOffset = -1;
  }

  async read(size?: number): Promise<Uint8Array | null> {
    await this.#ensureReader();
    const chunk = typeof this.#r.readAsync === "function" ? await this.#r.readAsync(size) : this.#r.read(size);
    if (chunk) {
      this.#relativeOffset += chunk.length;
    }
    return chunk;
  }

  async readAll(): Promise<Uint8Array> {
    await this.#ensureReader();
    const chunk = typeof this.#r.readAllAsync === "function" ? await this.#r.readAllAsync() : this.#r.readAll();
    this.#relativeOffset += chunk.length;
    return chunk;
  }

  seek(offset: number, whence = seekStart): number {
    if (this.#savedOffset === -1) {
      this.#savedOffset = this.#relativeOffset;
    }

    let maxRelativeOffset = this.Size() - this.#baseOffset;
    if (this.#baseLength >= 0 && this.#baseLength < maxRelativeOffset) {
      maxRelativeOffset = this.#baseLength;
    }

    switch (whence) {
      case seekStart:
        this.#relativeOffset = offset;
        break;
      case seekCurrent:
        this.#relativeOffset += offset;
        break;
      case seekEnd:
        this.#relativeOffset = maxRelativeOffset + offset;
        break;
      default:
        break;
    }

    if (this.#relativeOffset < 0) {
      const invalid = this.#relativeOffset;
      this.#relativeOffset = 0;
      throw new Error(`Seek resulted in invalid offset ${invalid}, using 0`);
    }
    if (this.#relativeOffset > maxRelativeOffset) {
      console.warn(
        "blob.Reader.Seek set an offset after EOF (base offset/length from NewRangeReader %d, %d; actual blob size %d; relative offset %d -> absolute offset %d).",
        this.#baseOffset,
        this.#baseLength,
        this.Size(),
        this.#relativeOffset,
        this.#baseOffset + this.#relativeOffset,
      );
      this.#relativeOffset = maxRelativeOffset;
    }

    return this.#relativeOffset;
  }

  close(): void {
    this.#r.close();
  }

  ContentType(): string {
    return this.#r.Attributes().ContentType;
  }

  ModTime(): Date {
    return this.#r.Attributes().ModTime;
  }

  Size(): number {
    return this.#r.Attributes().Size;
  }

  async #ensureReader(): Promise<void> {
    if (this.#savedOffset === -1) {
      return;
    }
    const saved = this.#savedOffset;
    if (this.#relativeOffset === saved) {
      this.#savedOffset = -1;
      return;
    }
    let length = this.#baseLength;
    if (length >= 0) {
      length -= this.#relativeOffset;
      if (length < 0) {
        throw new Error(`invalid Seek (base length ${this.#baseLength}, relative offset ${this.#relativeOffset})`);
      }
    }
    try {
      const nextReader = await this.#drv.NewRangeReader(this.#ctx, this.#key, this.#baseOffset + this.#relativeOffset, length);
      this.#r.close();
      this.#r = nextReader;
      this.#savedOffset = -1;
    } catch (err) {
      const wrapped = wrapError(this.#drv, err as Error, this.#key);
      if (wrapped) {
        throw wrapped;
      }
    }
  }
}
