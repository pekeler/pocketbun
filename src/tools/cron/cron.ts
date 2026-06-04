// Ported from pocketbase/tools/cron/cron.go

import { FireAndForget } from "../routine/routine.ts";
import { Job } from "./job.ts";
import { NewSchedule } from "./schedule.ts";

type BunCronHandle = {
  stop(): void;
};

const bunWithCron = Bun as typeof Bun & {
  cron: (cronExpr: string, handler: () => void) => BunCronHandle;
};

// Cron is a crontab-like struct for tasks/jobs scheduling.
export class Cron {
  private handles = new Map<string, BunCronHandle>();
  private jobs: Job[] = [];
  private started = false;

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
  // cronExpr is a Bun cron expression, eg. "0 */3 * * *" (aka. at minute 0 past every 3rd hour).
  // Supports Bun's 5-field cron grammar, including macros such as @daily/@hourly
  // and named month/weekday fields.
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

    this.Remove(jobId);

    const job = new Job(jobId, schedule, fn);
    this.jobs.push(job);
    if (this.started) {
      this.startJob(job);
    }

    return null;
  }

  // Remove removes a single cron job by its id.
  Remove(jobId: string): void {
    if (!this.jobs.length) {
      return;
    }
    this.stopBunJob(jobId);
    this.jobs = this.jobs.filter((job) => job.Id() !== jobId);
  }

  // RemoveAll removes all registered cron jobs.
  RemoveAll(): void {
    this.stopAllBunJobs();
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

  // Stop stops the current cron scheduler (if not already).
  //
  // You can resume the scheduler by calling Start().
  Stop(): void {
    this.started = false;
    this.stopAllBunJobs();
  }

  // Start starts the cron scheduler.
  //
  // Calling Start() on already started cron will restart the scheduler.
  Start(): void {
    this.Stop();
    this.started = true;
    for (const job of this.jobs) {
      this.startJob(job);
    }
  }

  // HasStarted checks whether the current Cron scheduler has been started.
  HasStarted(): boolean {
    return this.started;
  }

  private startJob(job: Job): void {
    this.stopBunJob(job.Id());
    this.handles.set(
      job.Id(),
      bunWithCron.cron(job.Expression(), () => {
        FireAndForget(() => job.Run());
      }),
    );
  }

  private stopBunJob(jobId: string): void {
    const handle = this.handles.get(jobId);
    if (!handle) {
      return;
    }

    handle.stop();
    this.handles.delete(jobId);
  }

  private stopAllBunJobs(): void {
    for (const handle of this.handles.values()) {
      handle.stop();
    }
    this.handles.clear();
  }
}
