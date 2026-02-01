// Ported from pocketbase/tools/cron/job.go

import { Schedule } from "./schedule.ts";

// Job defines a single registered cron job.
export class Job {
  #fn: (() => void) | null;
  #schedule: Schedule;
  #id: string;

  constructor(id: string, schedule: Schedule, fn: (() => void) | null) {
    this.#id = id;
    this.#schedule = schedule;
    this.#fn = fn;
  }

  // Id returns the cron job id.
  Id(): string {
    return this.#id;
  }

  // Expression returns the plain cron job schedule expression.
  Expression(): string {
    return this.#schedule.Expression();
  }

  // Run runs the cron job function.
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
