// PocketBun-only: pins the lightweight process-local cluster context and CLI worker bounds.

import { afterEach, describe, expect, it } from "bun:test";
import {
  MaxClusterWorkers,
  clusterEnabled,
  clusterReusePort,
  clusterRole,
  clusterToken,
  clusterWorkerAddress,
  clusterWorkerId,
  clusterWorkerSlot,
  configureClusterWorker,
  resetClusterContextForTest,
  runsClusterSingletons,
  validateWorkerCount,
} from "./context.ts";

afterEach(() => {
  resetClusterContextForTest();
});

describe("cluster context", () => {
  it.serial("is disabled until a CLI worker configures it", () => {
    expect(clusterEnabled()).toBeFalse();
    expect(clusterRole()).toBe("disabled");
    expect(clusterWorkerId()).toBeNull();
    expect(clusterWorkerSlot()).toBeNull();
    expect(clusterWorkerAddress()).toBe("");
    expect(clusterReusePort()).toBeFalse();
    expect(runsClusterSingletons()).toBeTrue();

    configureClusterWorker({
      role: "leader",
      slot: 0,
      address: "127.0.0.1:8090",
      reusePort: true,
      token: "secret",
      workerId: 2,
    });

    expect(clusterEnabled()).toBeTrue();
    expect(clusterRole()).toBe("leader");
    expect(clusterWorkerId()).toBe(2);
    expect(clusterWorkerSlot()).toBe(0);
    expect(clusterWorkerAddress()).toBe("127.0.0.1:8090");
    expect(clusterReusePort()).toBeTrue();
    expect(runsClusterSingletons()).toBeTrue();
    expect(clusterToken()).toBe("secret");
    expect(() =>
      configureClusterWorker({
        role: "follower",
        slot: 1,
        address: "127.0.0.1:8091",
        reusePort: false,
        token: "other",
        workerId: 3,
      }),
    ).toThrow("already configured");
  });

  it.serial("reserves singleton work for the leader", () => {
    configureClusterWorker({
      role: "follower",
      slot: 1,
      address: "127.0.0.1:8091",
      reusePort: false,
      token: "secret",
      workerId: 3,
    });

    expect(runsClusterSingletons()).toBeFalse();
  });

  it("accepts only the documented worker range", () => {
    expect(validateWorkerCount(1)).toBeNull();
    expect(validateWorkerCount(MaxClusterWorkers)).toBeNull();
    expect(validateWorkerCount(0)?.message).toContain("between 1");
    expect(validateWorkerCount(-1)?.message).toContain("between 1");
    expect(validateWorkerCount(1.5)?.message).toContain("between 1");
    expect(validateWorkerCount(MaxClusterWorkers + 1)?.message).toContain(String(MaxClusterWorkers));
  });
});
