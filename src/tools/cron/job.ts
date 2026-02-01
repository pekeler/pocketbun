// Ported from pocketbase/tools/cron/job.go

import { Schedule } from "./schedule.ts";

export class Job {
  #fn: (() => void) | null;
  #schedule: Schedule;
  #id: string;

  constructor(id: string, schedule: Schedule, fn: (() => void) | null) {
    this.#id = id;
    this.#schedule = schedule;
    this.#fn = fn;
  }

  Id(): string {
    return this.#id;
  }

  Expression(): string {
    return this.#schedule.Expression();
  }

  Run(): void {
    if (this.#fn) {
      this.#fn();
    }
  }

  Schedule(): Schedule {
    return this.#schedule;
  }

  toJSON(): { id: string; expression: string } {
    return {
      id: this.Id(),
      expression: this.Expression(),
    };
  }
}
