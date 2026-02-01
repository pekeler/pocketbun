// Ported from pocketbase/tools/types/json_raw.go

export class JSONRaw {
  #raw: string;

  constructor(raw = "") {
    this.#raw = raw;
  }

  static parse(value: unknown): JSONRaw {
    const result = new JSONRaw();
    result.scan(value);
    return result;
  }

  toString(): string {
    return this.#raw === "" ? "null" : this.#raw;
  }

  // String returns the current JSONRaw instance as a json encoded string.
  String(): string {
    return this.toString();
  }

  toJSON(): unknown {
    if (this.#raw === "" || this.#raw === "null") {
      return null;
    }
    try {
      return JSON.parse(this.#raw);
    } catch {
      return null;
    }
  }

  valueOf(): string {
    return this.toString();
  }

  scan(value: unknown): void {
    if (value == null) {
      this.#raw = "";
      return;
    }
    if (value instanceof JSONRaw) {
      this.#raw = value.#raw;
      return;
    }
    if (typeof value === "string") {
      this.#raw = value;
      return;
    }
    if (value instanceof Uint8Array) {
      this.#raw = new TextDecoder().decode(value);
      return;
    }
    try {
      this.#raw = JSON.stringify(value) ?? "";
    } catch {
      this.#raw = "";
    }
  }
}
