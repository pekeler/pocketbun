// Ported from pocketbase/tools/router/rereadable_read_closer.go

export interface Rereader {
  Reread(): void;
}

// RereadableReadCloser defines a reader that can be reread from the start.
// It buffers all read data to allow resetting to the beginning.
export class RereadableReadCloser implements Rereader {
  #buffer: Uint8Array;
  #offset: number;
  #closed: boolean;

  constructor(input: Uint8Array | ArrayBuffer | string) {
    if (typeof input === "string") {
      this.#buffer = new TextEncoder().encode(input);
    } else if (input instanceof ArrayBuffer) {
      this.#buffer = new Uint8Array(input);
    } else {
      this.#buffer = input;
    }
    this.#offset = 0;
    this.#closed = false;
  }

  read(size?: number): Uint8Array | null {
    if (this.#closed) {
      return null;
    }
    if (this.#offset >= this.#buffer.length) {
      return null;
    }
    const end = size && size > 0 ? Math.min(this.#buffer.length, this.#offset + size) : this.#buffer.length;
    const chunk = this.#buffer.slice(this.#offset, end);
    this.#offset = end;
    return chunk;
  }

  readAll(): Uint8Array {
    const chunk = this.read();
    this.Reread();
    return chunk ?? new Uint8Array();
  }

  close(): void {
    this.#closed = true;
  }

  Reread(): void {
    if (this.#buffer.length === 0) {
      return;
    }
    this.#offset = 0;
  }
}
