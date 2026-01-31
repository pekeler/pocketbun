// Ported from pocketbase/tools/hook/event.go

export type NextFunc = () => Promise<unknown>;

export interface Resolver {
  Next(): Promise<unknown>;
  nextFunc(): NextFunc | null;
  setNextFunc(fn: NextFunc | null): void;
}

export class Event implements Resolver {
  #next: NextFunc | null = null;

  async Next(): Promise<unknown> {
    if (this.#next) {
      return await this.#next();
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
