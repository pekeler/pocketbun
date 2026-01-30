export const StoreKeyActiveBackup = "activeBackup";

export class Store<K, V> {
  #data = new Map<K, V>();

  has(key: K): boolean {
    return this.#data.has(key);
  }

  get(key: K): V | undefined {
    return this.#data.get(key);
  }

  set(key: K, value: V): void {
    this.#data.set(key, value);
  }

  delete(key: K): void {
    this.#data.delete(key);
  }
}
