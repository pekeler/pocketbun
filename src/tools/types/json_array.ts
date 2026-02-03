// Ported from pocketbase/tools/types/json_array.go

export class JSONArray<T> extends Array<T> {
  constructor(...items: T[]) {
    super(...items);
  }

  toJSON(): T[] {
    return Array.from(this);
  }

  MarshalJSON(): string {
    return JSON.stringify(this.toJSON());
  }

  String(): string {
    return this.MarshalJSON();
  }

  override toString(): string {
    return this.String();
  }

  Value(): string {
    return this.MarshalJSON();
  }

  Scan(value: unknown): Error | null {
    try {
      if (value == null) {
        this.length = 0;
        return null;
      }

      if (value instanceof JSONArray) {
        this.length = 0;
        this.push(...value);
        return null;
      }

      if (Array.isArray(value)) {
        this.length = 0;
        this.push(...(value as T[]));
        return null;
      }

      let data = "";
      if (value instanceof Uint8Array) {
        data = new TextDecoder().decode(value);
      } else if (typeof value === "string") {
        data = value;
      } else {
        return new Error("failed to unmarshal JSONArray value");
      }

      if (!data) {
        data = "[]";
      }

      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed)) {
        return new Error("failed to unmarshal JSONArray value");
      }

      this.length = 0;
      this.push(...(parsed as T[]));
      return null;
    } catch (error) {
      return error as Error;
    }
  }
}
