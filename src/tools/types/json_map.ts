// Ported from pocketbase/tools/types/json_map.go

import { deterministicJSONStringify } from "../../internal/compat/deterministic_json.ts";

export class JSONMap<T> {
  #value: Record<string, T>;

  constructor(initial: Record<string, T> = {}) {
    this.#value = { ...initial };
  }

  toJSON(): Record<string, T> {
    return { ...this.#value };
  }

  MarshalJSON(): string {
    return deterministicJSONStringify(this.toJSON());
  }

  toString(): string {
    return this.MarshalJSON();
  }

  String(): string {
    return this.toString();
  }

  Get(key: string): T | undefined {
    return this.#value[key];
  }

  get(key: string): T | undefined {
    return this.Get(key);
  }

  Set(key: string, value: T): void {
    this.#value[key] = value;
  }

  set(key: string, value: T): void {
    this.Set(key, value);
  }

  assign(values: Record<string, T>): void {
    this.#value = { ...values };
  }

  Value(): string {
    return this.MarshalJSON();
  }

  Scan(value: unknown): Error | null {
    try {
      if (value == null) {
        this.assign({});
        return null;
      }

      if (value instanceof JSONMap) {
        this.assign(value.toJSON());
        return null;
      }

      if (typeof value === "object" && !Array.isArray(value) && !(value instanceof Uint8Array)) {
        this.assign(value as Record<string, T>);
        return null;
      }

      let data = "";
      if (value instanceof Uint8Array) {
        data = new TextDecoder().decode(value);
      } else if (typeof value === "string") {
        data = value;
      } else {
        this.assign({});
        return new Error("failed to unmarshal JSONMap[T] value");
      }

      if (!data) {
        data = "{}";
      }

      const parsed = JSON.parse(data);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        this.assign({});
        return new Error("failed to unmarshal JSONMap[T] value");
      }

      this.assign(parsed as Record<string, T>);
      return null;
    } catch (error) {
      this.assign({});
      return error as Error;
    }
  }
}
