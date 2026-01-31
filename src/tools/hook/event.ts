// Ported from pocketbase/tools/hook/event.go

export type NextFunc = () => unknown;

export interface Resolver {
  Next(): unknown;
  nextFunc(): NextFunc | null;
  setNextFunc(fn: NextFunc | null): void;
}

export class Event implements Resolver {
  #next: NextFunc | null = null;

  Next(): unknown {
    if (this.#next) {
      return this.#next();
    }
    return null;
  }

  nextFunc(): NextFunc | null {
    return this.#next;
  }

  setNextFunc(fn: NextFunc | null): void {
    this.#next = fn;
  }
}
