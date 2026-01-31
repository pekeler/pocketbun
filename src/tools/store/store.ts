// Ported from pocketbase/tools/store/store.go

export const ShrinkThreshold = 200;

export class Store<K, T> {
  #data: Map<K, T>;
  #deleted = 0;

  constructor(data: Map<K, T> | Record<string, T> | null = null) {
    this.#data = new Map<K, T>();
    this.reset(data);
  }

  reset(newData: Map<K, T> | Record<string, T> | null = null): void {
    if (newData instanceof Map) {
      this.#data = new Map(newData);
    } else if (newData && typeof newData === "object") {
      this.#data = new Map(Object.entries(newData) as [K, T][]);
    } else {
      this.#data = new Map();
    }
    this.#deleted = 0;
  }

  length(): number {
    return this.#data.size;
  }

  removeAll(): void {
    this.reset();
  }

  remove(key: K): void {
    const deleted = this.#data.delete(key);
    if (!deleted) {
      return;
    }
    this.#deleted += 1;
    if (this.#deleted >= ShrinkThreshold) {
      this.#data = new Map(this.#data);
      this.#deleted = 0;
    }
  }

  has(key: K): boolean {
    return this.#data.has(key);
  }

  get(key: K): T | undefined {
    return this.#data.get(key);
  }

  getOk(key: K): [T | undefined, boolean] {
    if (!this.#data.has(key)) {
      return [undefined, false];
    }
    return [this.#data.get(key), true];
  }

  getAll(): Map<K, T> {
    return new Map(this.#data);
  }

  values(): T[] {
    return Array.from(this.#data.values());
  }

  set(key: K, value: T): void {
    this.#data.set(key, value);
  }

  setFunc(key: K, fn: (old: T | undefined) => T): void {
    const oldValue = this.#data.get(key);
    this.#data.set(key, fn(oldValue));
  }

  getOrSet(key: K, setFunc: () => T): T {
    if (this.#data.has(key)) {
      return this.#data.get(key) as T;
    }

    const value = setFunc();
    this.#data.set(key, value);
    return value;
  }

  setIfLessThanLimit(key: K, value: T, maxAllowedElements: number): boolean {
    const hasKey = this.#data.has(key);
    if (!hasKey && this.#data.size >= maxAllowedElements) {
      return false;
    }
    this.#data.set(key, value);
    return true;
  }

  loadJSON(data: string): void {
    const raw = JSON.parse(data) as Record<string, T>;
    for (const [key, value] of Object.entries(raw)) {
      this.#data.set(key as unknown as K, value);
    }
  }

  toJSON(): Record<string, T> {
    return Object.fromEntries(this.#data);
  }
}
