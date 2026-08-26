// PocketBun-only: pins aggregate rate limits and expiring coordinator state without spawning processes.

import { describe, expect, it } from "bun:test";
import { ClusterCoordinator } from "./coordinator.ts";

describe("cluster coordinator", () => {
  it("shares and replaces rate limiters by their current rule", () => {
    const coordinator = new ClusterCoordinator();
    const request = {
      limiterId: "GET /api/health",
      clientKey: "127.0.0.1",
      maxRequests: 2,
      duration: 60,
    };
    const consume = () => coordinator.handle({ kind: "rate-limit.consume-batch", requests: [request] });

    expect(consume()).toEqual([true]);
    expect(consume()).toEqual([true]);
    expect(consume()).toEqual([false]);
    expect(
      coordinator.handle({ kind: "rate-limit.check", limiterId: request.limiterId, clientKey: request.clientKey }),
    ).toBeTrue();
    expect(coordinator.handle({ kind: "rate-limit.consume-batch", requests: [{ ...request, maxRequests: 1 }] })).toEqual([
      true,
    ]);
  });

  it("batches rate-limit decisions without changing their order", () => {
    const coordinator = new ClusterCoordinator();
    const request = {
      limiterId: "GET /api/health",
      clientKey: "127.0.0.1",
      maxRequests: 2,
      duration: 60,
    };

    expect(coordinator.handle({ kind: "rate-limit.consume-batch", requests: [request, request, request] })).toEqual([
      true,
      true,
      false,
    ]);
  });

  it("claims, releases, expires, stores, and consumes transient values", async () => {
    const coordinator = new ClusterCoordinator();
    const expiring = (coordinator as unknown as { expiring: Map<string, unknown> }).expiring;
    const claim = coordinator.handle({ kind: "expiring.claim", key: "email/user", ttlMs: 10 });
    expect(typeof claim).toBe("string");
    expect(coordinator.handle({ kind: "expiring.claim", key: "email/user", ttlMs: 10 })).toBeNull();
    expect(coordinator.handle({ kind: "expiring.release", key: "email/user", claimToken: "stale" })).toBeNull();
    expect(coordinator.handle({ kind: "expiring.claim", key: "email/user", ttlMs: 10 })).toBeNull();
    expect(coordinator.handle({ kind: "expiring.release", key: "email/user", claimToken: String(claim) })).toBeNull();
    expect(typeof coordinator.handle({ kind: "expiring.claim", key: "email/user", ttlMs: 10 })).toBe("string");
    await Bun.sleep(15);
    expect(expiring.has("email/user")).toBeFalse();
    expect(typeof coordinator.handle({ kind: "expiring.claim", key: "email/user", ttlMs: 10 })).toBe("string");

    expect(coordinator.handle({ kind: "expiring.put", key: "apple/code", value: "Old User", ttlMs: 10 })).toBeNull();
    expect(coordinator.handle({ kind: "expiring.put", key: "apple/code", value: "Test User", ttlMs: 60_000 })).toBeNull();
    await Bun.sleep(15);
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
    expect(coordinator.setBackupPhase(3, String(lease), "delete")).toBeFalse();
    expect(coordinator.setBackupPhase(2, String(lease), "delete")).toBeTrue();
    expect(coordinator.backupMutationOwner("delete")).toBe(2);
    expect(coordinator.backupMutationOwner("write")).toBeNull();
    expect(coordinator.setBackupPhase(2, String(lease), "write")).toBeTrue();
    expect(coordinator.backupMutationOwner("delete")).toBe(2);
    expect(coordinator.backupMutationOwner("write")).toBe(2);
    expect(coordinator.releaseBackupForWorker(2)).toBeTrue();
    expect(coordinator.activeBackupName()).toBeNull();
  });

  it("serializes realtime presence snapshots", async () => {
    const coordinator = new ClusterCoordinator();
    let releaseFirst!: () => void;
    const firstBlocked = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let firstStarted!: () => void;
    const firstStart = new Promise<void>((resolve) => {
      firstStarted = resolve;
    });
    const snapshots: number[][] = [];

    expect(coordinator.realtimeWorkerIds()).toEqual([]);
    const first = coordinator.updateRealtimeWorker(3, true, async (workerIds) => {
      snapshots.push(workerIds);
      firstStarted();
      await firstBlocked;
    });
    await firstStart;
    const second = coordinator.updateRealtimeWorker(1, true, async (workerIds) => {
      snapshots.push(workerIds);
    });
    const exit = coordinator.updateRealtimeWorker(1, false, async (workerIds) => {
      snapshots.push(workerIds);
    });

    await Bun.sleep(0);
    expect(snapshots).toEqual([[3]]);
    releaseFirst();
    await Promise.all([first, second, exit]);

    expect(coordinator.hasRealtimeWorker(1)).toBeFalse();
    expect(coordinator.realtimeWorkerIds()).toEqual([3]);
    expect(snapshots).toEqual([[3], [3, 1], [3]]);
  });
});
