// Ported from pocketbase/tools/router/buffer_with_file.go

import { randomUUID } from "node:crypto";
import { closeSync, openSync, readSync, unlinkSync, writeSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DefaultMaxMemory } from "./event.ts";

export type BufferWithFileReadResult = {
  n: number;
  eof: boolean;
};

// newBufferWithFile initializes and returns a new bufferWithFile with the specified memoryLimit.
//
// If memoryLimit is negative or zero, defaults to [DefaultMaxMemory].
export function newBufferWithFile(memoryLimit: number): bufferWithFile {
  if (memoryLimit <= 0) {
    memoryLimit = DefaultMaxMemory;
  }

  return new bufferWithFile(memoryLimit);
}

// bufferWithFile is similar to `bytes.Buffer` but after the limit it
// fallbacks to a temporary file to minimize excessive memory usage.
export class bufferWithFile {
  #buf: Buffer | null;
  #fd: number | null;
  #filePath: string | null;
  readonly #memoryLimit: number;
  #fileReadOffset: number;

  constructor(memoryLimit: number) {
    this.#buf = Buffer.alloc(0);
    this.#fd = null;
    this.#filePath = null;
    this.#memoryLimit = memoryLimit;
    this.#fileReadOffset = 0;
  }

  get bufLength(): number {
    return this.#buf?.length ?? 0;
  }

  get filePath(): string | null {
    return this.#filePath;
  }

  get memoryLimit(): number {
    return this.#memoryLimit;
  }

  // Read implements the standard reader contract by reading
  // up to len(p) bytes into p.
  read(p: Uint8Array): BufferWithFileReadResult {
    if (this.#buf == null) {
      throw new Error("[bufferWithFile.Read] not initialized or already closed");
    }

    const maxToRead = p.length;
    let n = 0;

    // Read first from the memory buffer.
    if (this.#buf.length > 0 && maxToRead > 0) {
      const chunk = this.#buf.subarray(0, maxToRead);
      p.set(chunk, 0);
      n = chunk.length;
      this.#buf = this.#buf.subarray(n);
    }

    // Continue reading from the file to fill the remaining bytes.
    if (n < maxToRead && this.#fd != null) {
      const fileN = readSync(this.#fd, p, n, maxToRead - n, this.#fileReadOffset);
      this.#fileReadOffset += fileN;
      n += fileN;
    }

    // Return EOF if the buffers are empty and nothing has been read
    // (to minimize potential breaking changes and for consistency with the bytes.Buffer rules).
    if (n === 0 && maxToRead > 0) {
      return { n: 0, eof: true };
    }

    return { n, eof: false };
  }

  // Write implements the standard writer contract by writing the
  // content of p into the buffer.
  //
  // If the current memory buffer doesn't have enough space to hold len(p),
  // it writes p into a temp disk file.
  write(p: Uint8Array): number {
    if (this.#buf == null) {
      throw new Error("[bufferWithFile.Write] not initialized or already closed");
    }

    // Already above the limit -> continue with the file.
    if (this.#fd != null) {
      return writeSync(this.#fd, p);
    }

    // Above limit -> create and write to file.
    if (this.#buf.length + p.length > this.#memoryLimit) {
      this.#ensureFile();
      return writeSync(this.#fd!, p);
    }

    // Write in memory.
    this.#buf = Buffer.concat([this.#buf, Buffer.from(p)]);
    return p.length;
  }

  // Close cleans up the in-memory buffer and removes the fallback temp file (if any).
  //
  // It is safe to call close multiple times.
  // Once close is invoked the buffer no longer can be used and should be discarded.
  close(): void {
    const errors: Error[] = [];

    if (this.#fd != null) {
      try {
        closeSync(this.#fd);
      } catch (error) {
        errors.push(asError(error));
      }

      this.#fd = null;
    }

    if (this.#filePath != null) {
      try {
        unlinkSync(this.#filePath);
      } catch (error) {
        errors.push(asError(error));
      }

      this.#filePath = null;
    }

    this.#buf = null;
    this.#fileReadOffset = 0;

    if (errors.length === 1) {
      throw errors[0]!;
    }

    if (errors.length > 1) {
      throw new AggregateError(errors, "bufferWithFile.close failed");
    }
  }

  #ensureFile(): void {
    if (this.#fd != null) {
      return;
    }

    const path = join(tmpdir(), `pb_buffer_file_${randomUUID()}`);
    this.#fd = openSync(path, "w+");
    this.#filePath = path;
  }
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
