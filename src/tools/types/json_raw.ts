// Ported from pocketbase/tools/types/json_raw.go

export function ParseJSONRaw(value: unknown): [JSONRaw, Error | null] {
  const result = new JSONRaw();
  const err = result.Scan(value);
  return [result, err];
}

export class JSONRaw {
  #raw: string;

  constructor(raw = "") {
    this.#raw = raw;
  }

  static parse(value: unknown): JSONRaw {
    const [result] = ParseJSONRaw(value);
    return result;
  }

  toString(): string {
    return this.String();
  }

  // String returns the current JSONRaw instance as a json encoded string.
  String(): string {
    return this.MarshalJSON();
  }

  MarshalJSON(): string {
    return this.#raw === "" ? "null" : this.#raw;
  }

  UnmarshalJSON(raw: Uint8Array | string | null | undefined): Error | null {
    if (raw == null) {
      this.#raw = "";
      return null;
    }
    if (typeof raw === "string") {
      this.#raw = raw;
      return null;
    }
    this.#raw = new TextDecoder().decode(raw);
    return null;
  }

  // Value implements the [driver.Valuer] interface.
  Value(): string | null {
    if (this.#raw === "") {
      return null;
    }
    return this.#raw;
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

  Scan(value: unknown): Error | null {
    try {
      let data: string | null = null;

      if (value == null) {
        data = null;
      } else if (value instanceof JSONRaw) {
        data = value.#raw || null;
      } else if (value instanceof Uint8Array) {
        data = value.length ? new TextDecoder().decode(value) : null;
      } else if (typeof value === "string") {
        data = value || null;
      } else {
        data = JSON.stringify(value) ?? null;
      }

      return this.UnmarshalJSON(data);
    } catch (error) {
      return error as Error;
    }
  }

  scan(value: unknown): void {
    void this.Scan(value);
  }
}
