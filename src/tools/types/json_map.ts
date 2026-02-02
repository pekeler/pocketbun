// Ported from pocketbase/tools/types/json_map.go

export class JSONMap<T> {
  #value: Record<string, T>;

  constructor(initial: Record<string, T> = {}) {
    this.#value = { ...initial };
  }

  toJSON(): Record<string, T> {
    return { ...this.#value };
  }

  toString(): string {
    return JSON.stringify(this.toJSON());
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
}
