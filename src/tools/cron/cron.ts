// Ported from pocketbase/tools/cron/cron.go

import { Job } from "./job.ts";
import { Moment, NewMoment, NewSchedule } from "./schedule.ts";

// Cron is a crontab-like struct for tasks/jobs scheduling.
export class Cron {
  private timezone: string;
  private ticker: ReturnType<typeof setInterval> | null = null;
  private startTimer: ReturnType<typeof setTimeout> | null = null;
  private jobs: Job[] = [];
  private intervalMs: number;

  constructor() {
    this.intervalMs = 60_000;
    this.timezone = "UTC";
  }

  // SetInterval changes the current cron tick interval
  // (it usually should be >= 1 minute).
  SetInterval(ms: number): void {
    const wasStarted = this.ticker !== null;
    this.intervalMs = ms;
    if (wasStarted) {
      this.Start();
    }
  }

  // SetTimezone changes the current cron tick timezone.
  SetTimezone(timezone: string): void {
    this.timezone = timezone;
  }

  // MustAdd is similar to Add() but panic on failure.
  MustAdd(jobId: string, cronExpr: string, fn: (() => void) | null): void {
    const err = this.Add(jobId, cronExpr, fn);
    if (err) {
      throw err;
    }
  }

  // Add registers a single cron job.
  //
  // If there is already a job with the provided id, then the old job
  // will be replaced with the new one.
  //
  // cronExpr is a regular cron expression, eg. "0 */3 * * *" (aka. at minute 0 past every 3rd hour).
  // Check cron.NewSchedule() for the supported tokens.
  Add(jobId: string, cronExpr: string, fn: (() => void) | null): Error | null {
    if (!fn) {
      return new Error("failed to add new cron job: fn must be non-nil function");
    }

    let schedule: ReturnType<typeof NewSchedule>;
    try {
      schedule = NewSchedule(cronExpr);
    } catch (error) {
      return new Error(`failed to add new cron job: ${(error as Error).message}`);
    }

    this.jobs = this.jobs.filter((job) => job.Id() !== jobId);
    this.jobs.push(new Job(jobId, schedule, fn));

    return null;
  }

  // Remove removes a single cron job by its id.
  Remove(jobId: string): void {
    if (!this.jobs.length) {
      return;
    }
    this.jobs = this.jobs.filter((job) => job.Id() !== jobId);
  }

  // RemoveAll removes all registered cron jobs.
  RemoveAll(): void {
    this.jobs = [];
  }

  // Total returns the current total number of registered cron jobs.
  Total(): number {
    return this.jobs.length;
  }

  // Jobs returns a shallow copy of the currently registered cron jobs.
  Jobs(): Job[] {
    return [...this.jobs];
  }

  // Stop stops the current cron ticker (if not already).
  //
  // You can resume the ticker by calling Start().
  Stop(): void {
    if (this.startTimer) {
      clearTimeout(this.startTimer);
      this.startTimer = null;
    }

    if (!this.ticker) {
      return;
    }

    clearInterval(this.ticker);
    this.ticker = null;
  }

  // Start starts the cron ticker.
  //
  // Calling Start() on already started cron will restart the ticker.
  Start(): void {
    this.Stop();

    const now = Date.now();
    const interval = Math.max(1, Math.floor(this.intervalMs));
    const next = Math.floor((now + interval) / interval) * interval;
    const delay = Math.max(0, next - now);

    this.startTimer = setTimeout(() => {
      this.ticker = setInterval(() => {
        this.runDue(new Date());
      }, interval);

      this.runDue(new Date());
    }, delay);
  }

  // HasStarted checks whether the current Cron ticker has been started.
  HasStarted(): boolean {
    return this.ticker !== null;
  }

  // runDue runs all registered jobs that are scheduled for the provided time.
  private runDue(date: Date): void {
    const moment: Moment = NewMoment(date, this.timezone);
    for (const job of this.jobs) {
      if (job.Schedule().IsDue(moment)) {
        queueMicrotask(() => job.Run());
      }
    }
  }
}
