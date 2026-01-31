// Ported from pocketbase/tools/types/json_array.go

export class JSONArray<T> extends Array<T> {
  constructor(...items: T[]) {
    super(...items);
  }

  toJSON(): T[] {
    return Array.from(this);
  }

  override toString(): string {
    return JSON.stringify(this.toJSON());
  }
}
