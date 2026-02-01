// Ported from pocketbase/tools/hook/event.go

export type NextFunc = () => unknown;

type StopSignal = {
  stopped: boolean;
  error?: Error;
};

export interface Resolver {
  Next(): unknown;
  nextFunc(): NextFunc | null;
  setNextFunc(fn: NextFunc | null): void;
}

export class Event implements Resolver {
  #next: NextFunc | null = null;
  // Bun port uses a stop signal to abort hook chains (eg. batch timeout).
  #stopSignal: StopSignal | null = null;

  Next(): unknown {
    if (this.#stopSignal?.stopped) {
      if (this.#stopSignal.error) {
        throw this.#stopSignal.error;
      }
      return null;
    }
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

  setStopSignal(signal: StopSignal | null): void {
    this.#stopSignal = signal;
  }

  getStopSignal(): StopSignal | null {
    return this.#stopSignal;
  }
}
