// PocketBun-only: pins aggregate rate limits and expiring coordinator state without spawning processes.

import { describe, expect, it } from "bun:test";
import { ClusterCoordinator } from "./coordinator.ts";

describe("cluster coordinator", () => {
  it("shares and replaces rate limiters by their current rule", () => {
    const coordinator = new ClusterCoordinator();
    const operation = {
      kind: "rate-limit.consume" as const,
      limiterId: "GET /api/health",
      clientKey: "127.0.0.1",
      maxRequests: 2,
      duration: 60,
    };

    expect(coordinator.handle(operation)).toBeTrue();
    expect(coordinator.handle(operation)).toBeTrue();
    expect(coordinator.handle(operation)).toBeFalse();
    expect(
      coordinator.handle({ kind: "rate-limit.check", limiterId: operation.limiterId, clientKey: operation.clientKey }),
    ).toBeTrue();
    expect(coordinator.handle({ ...operation, maxRequests: 1 })).toBeTrue();
  });

  it("claims, releases, expires, stores, and consumes transient values", async () => {
    const coordinator = new ClusterCoordinator();
    const claim = coordinator.handle({ kind: "expiring.claim", key: "email/user", ttlMs: 10 });
    expect(typeof claim).toBe("string");
    expect(coordinator.handle({ kind: "expiring.claim", key: "email/user", ttlMs: 10 })).toBeNull();
    expect(coordinator.handle({ kind: "expiring.release", key: "email/user", claimToken: "stale" })).toBeNull();
    expect(coordinator.handle({ kind: "expiring.claim", key: "email/user", ttlMs: 10 })).toBeNull();
    expect(coordinator.handle({ kind: "expiring.release", key: "email/user", claimToken: String(claim) })).toBeNull();
    expect(typeof coordinator.handle({ kind: "expiring.claim", key: "email/user", ttlMs: 10 })).toBe("string");
    await Bun.sleep(15);
    expect(typeof coordinator.handle({ kind: "expiring.claim", key: "email/user", ttlMs: 10 })).toBe("string");

    expect(coordinator.handle({ kind: "expiring.put", key: "apple/code", value: "Test User", ttlMs: 60_000 })).toBeNull();
    expect(coordinator.handle({ kind: "expiring.take", key: "apple/code" })).toBe("Test User");
    expect(coordinator.handle({ kind: "expiring.take", key: "apple/code" })).toBeNull();
  });

  it("owns one token-protected backup lease and releases it with its worker", () => {
    const coordinator = new ClusterCoordinator();
    const lease = coordinator.acquireBackup(2, "test.zip");
    expect(typeof lease).toBe("string");
    expect(coordinator.activeBackupName()).toBe("test.zip");
    expect(coordinator.acquireBackup(3, "other.zip")).toBeNull();
    expect(coordinator.releaseBackup(3, String(lease))).toBeFalse();
    expect(coordinator.releaseBackup(2, "stale")).toBeFalse();
    expect(coordinator.ownsBackup(2, String(lease))).toBeTrue();
    expect(coordinator.releaseBackupForWorker(2)).toBeTrue();
    expect(coordinator.activeBackupName()).toBeNull();
  });
});
