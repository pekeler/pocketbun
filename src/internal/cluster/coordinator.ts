// PocketBun-only: owns the small set of transient values that must be atomic across HTTP workers.

import type { CoordinatorOperation, CoordinatorValue } from "./protocol.ts";
import { RateLimiter } from "../../apis/rate_limiter.ts";

type LimiterEntry = {
  maxRequests: number;
  duration: number;
  limiter: RateLimiter;
};

type ExpiringEntry = {
  value: string | null;
  expiresAt: number;
  claimToken?: string;
};

type BackupLease = {
  workerId: number;
  name: string;
  token: string;
};

export class ClusterCoordinator {
  private readonly limiters = new Map<string, LimiterEntry>();
  private readonly expiring = new Map<string, ExpiringEntry>();
  private backupLease: BackupLease | null = null;
  private lastLimiterCleanup = Date.now();

  handle(operation: CoordinatorOperation): CoordinatorValue {
    switch (operation.kind) {
      case "rate-limit.consume":
        return this.consumeRateLimit(operation);
      case "rate-limit.check":
        return this.limiters.get(operation.limiterId)?.limiter.isLimited(operation.clientKey) ?? false;
      case "expiring.claim":
        return this.claim(operation.key, operation.ttlMs);
      case "expiring.release":
        if (this.getExpiring(operation.key)?.claimToken === operation.claimToken) {
          this.expiring.delete(operation.key);
        }
        return null;
      case "expiring.put":
        this.expiring.set(operation.key, { value: operation.value, expiresAt: Date.now() + operation.ttlMs });
        return null;
      case "expiring.take": {
        const entry = this.getExpiring(operation.key);
        this.expiring.delete(operation.key);
        return entry?.value ?? null;
      }
      case "realtime.publish":
      case "realtime.prepare":
      case "realtime.subscribe":
      case "oauth2.deliver":
      case "backup.acquire":
      case "backup.release":
      case "lifecycle.restart":
      case "restore.begin":
      case "restore.complete":
      case "restore.abort":
        throw new Error(`${operation.kind} must be coordinated with ready workers`);
    }
  }

  acquireBackup(workerId: number, name: string): string | null {
    if (this.backupLease) {
      return null;
    }
    const token = crypto.randomUUID();
    this.backupLease = { workerId, name, token };
    return token;
  }

  releaseBackup(workerId: number, token: string): boolean {
    if (!this.backupLease || this.backupLease.workerId !== workerId || this.backupLease.token !== token) {
      return false;
    }
    this.backupLease = null;
    return true;
  }

  releaseBackupForWorker(workerId: number): boolean {
    if (this.backupLease?.workerId !== workerId) {
      return false;
    }
    this.backupLease = null;
    return true;
  }

  ownsBackup(workerId: number, token: string): boolean {
    return this.backupLease?.workerId === workerId && this.backupLease.token === token;
  }

  activeBackupName(): string | null {
    return this.backupLease?.name ?? null;
  }

  private consumeRateLimit(operation: Extract<CoordinatorOperation, { kind: "rate-limit.consume" }>): boolean {
    let entry = this.limiters.get(operation.limiterId);
    if (!entry || entry.maxRequests !== operation.maxRequests || entry.duration !== operation.duration) {
      entry = {
        maxRequests: operation.maxRequests,
        duration: operation.duration,
        limiter: new RateLimiter(operation.maxRequests, operation.duration, 1800),
      };
      this.limiters.set(operation.limiterId, entry);
    }

    const now = Date.now();
    if (now - this.lastLimiterCleanup >= 30 * 60 * 1000) {
      for (const item of this.limiters.values()) {
        item.limiter.clean();
      }
      this.lastLimiterCleanup = now;
    }

    return entry.limiter.isAllowed(operation.clientKey);
  }

  private claim(key: string, ttlMs: number): string | null {
    if (this.getExpiring(key)) {
      return null;
    }
    const claimToken = crypto.randomUUID();
    this.expiring.set(key, { value: null, expiresAt: Date.now() + ttlMs, claimToken });
    return claimToken;
  }

  private getExpiring(key: string): ExpiringEntry | null {
    const entry = this.expiring.get(key);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt <= Date.now()) {
      this.expiring.delete(key);
      return null;
    }
    return entry;
  }
}
