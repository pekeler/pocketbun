// Ported from pocketbase/tools/store/store.go

export const ShrinkThreshold = 200;

// Store defines a concurrent safe in memory key-value data store.
export class Store<K, T> {
  #data: Map<K, T>;
  #deleted = 0;
  #zeroValue: T | undefined;

  constructor(data: Map<K, T> | Record<string, T> | null = null, zeroValue?: T) {
    // Note: upstream uses a mutex; Bun's single-threaded JS runtime makes this unnecessary here.
    // If we introduce worker/shared concurrency, revisit this and add locking.
    // Deviation: Go maps return a type-specific zero value for missing keys. In TS we infer
    // that zero value from provided data or use an explicit zeroValue when the store is empty.
    this.#data = new Map<K, T>();
    this.#zeroValue = zeroValue;
    this.reset(data, zeroValue);
  }

  reset(newData: Map<K, T> | Record<string, T> | null = null, zeroValue?: T): void {
    if (zeroValue !== undefined) {
      this.#zeroValue = zeroValue;
    } else if (newData != null) {
      const derived = deriveZeroValue(newData);
      if (derived !== undefined) {
        this.#zeroValue = derived;
      }
    }

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
    if (!this.#data.has(key)) {
      return this.#zeroValue;
    }
    return this.#data.get(key);
  }

  getOk(key: K): [T | undefined, boolean] {
    if (!this.#data.has(key)) {
      return [this.#zeroValue, false];
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
    const oldValue = this.get(key);
    this.#data.set(key, fn(oldValue));
  }

  getOrSet(key: K, setFunc: () => T): T {
    if (this.#data.has(key)) {
      return this.#data.get(key) as T;
    }

    const value = setFunc();
    if (this.#data.has(key)) {
      return this.#data.get(key) as T;
    }
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

function deriveZeroValue<K, T>(data: Map<K, T> | Record<string, T>): T | undefined {
  if (data instanceof Map) {
    for (const value of data.values()) {
      return zeroValueFromSample(value);
    }
    return undefined;
  }

  for (const key of Object.keys(data)) {
    return zeroValueFromSample(data[key] as T);
  }

  return undefined;
}

function zeroValueFromSample<T>(sample: T): T | undefined {
  if (sample === null) {
    return sample;
  }
  if (sample === undefined) {
    return undefined;
  }

  switch (typeof sample) {
    case "string":
      return "" as T;
    case "number":
      return 0 as T;
    case "boolean":
      return false as T;
    case "bigint":
      return 0n as T;
    case "object":
      return null as T;
    default:
      return undefined;
  }
}
