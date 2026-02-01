// Ported from pocketbase/tools/hook/event.go

export type NextFunc = () => unknown;

type StopSignal = {
  stopped: boolean;
  error?: Error;
};

// Resolver defines a common interface for a Hook event (see [Event]).
export interface Resolver {
  Next(): unknown;
  nextFunc(): NextFunc | null;
  setNextFunc(fn: NextFunc | null): void;
}

// Event implements [Resolver] and it is intended to be used as a base
// Hook event that you can embed in your custom typed event structs.
//
// Example:
//
//	type CustomEvent struct {
//		hook.Event
//
//		SomeField int
//	}
export class Event implements Resolver {
  #next: NextFunc | null = null;
  // Bun port uses a stop signal to abort hook chains (eg. batch timeout).
  #stopSignal: StopSignal | null = null;

  // Next calls the next hook handler.
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

  // nextFunc returns the function that Next calls.
  nextFunc(): NextFunc | null {
    return this.#next;
  }

  // setNextFunc sets the function that Next calls.
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
