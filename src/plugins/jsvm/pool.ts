// Ported from pocketbase/plugins/jsvm/pool.go

export type PoolItem<T> = {
  busy: boolean;
  value: T;
};

export class VmsPool<T> {
  private factory: () => T;
  private items: PoolItem<T>[];

  constructor(size: number, factory: () => T) {
    this.factory = factory;
    this.items = Array.from({ length: size }, () => ({ busy: false, value: this.factory() }));
  }

  // run executes "call" with a vm created from the pool
  // (either from the buffer or a new one if all buffered vms are busy)
  run(call: (value: T) => Error | null): Error | null {
    let freeItem: PoolItem<T> | null = null;

    for (const item of this.items) {
      if (item.busy) {
        continue;
      }
      item.busy = true;
      freeItem = item;
      break;
    }

    if (!freeItem) {
      return call(this.factory());
    }

    const execErr = call(freeItem.value);
    freeItem.busy = false;
    return execErr;
  }
}

// newPool creates a new pool with pre-warmed vms generated from the specified factory.
export function newPool<T>(size: number, factory: () => T): VmsPool<T> {
  return new VmsPool(size, factory);
}
