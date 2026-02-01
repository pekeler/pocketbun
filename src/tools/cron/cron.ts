// Ported from pocketbase/tools/cron/cron.go

import { Job } from "./job.ts";
import { Moment, NewMoment, NewSchedule } from "./schedule.ts";

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

  SetInterval(ms: number): void {
    const wasStarted = this.ticker !== null;
    this.intervalMs = ms;
    if (wasStarted) {
      this.Start();
    }
  }

  SetTimezone(timezone: string): void {
    this.timezone = timezone;
  }

  MustAdd(jobId: string, cronExpr: string, fn: (() => void) | null): void {
    const err = this.Add(jobId, cronExpr, fn);
    if (err) {
      throw err;
    }
  }

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

  Remove(jobId: string): void {
    if (!this.jobs.length) {
      return;
    }
    this.jobs = this.jobs.filter((job) => job.Id() !== jobId);
  }

  RemoveAll(): void {
    this.jobs = [];
  }

  Total(): number {
    return this.jobs.length;
  }

  Jobs(): Job[] {
    return [...this.jobs];
  }

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

  HasStarted(): boolean {
    return this.ticker !== null;
  }

  private runDue(date: Date): void {
    const moment: Moment = NewMoment(date, this.timezone);
    for (const job of this.jobs) {
      if (job.Schedule().IsDue(moment)) {
        queueMicrotask(() => job.Run());
      }
    }
  }
}
