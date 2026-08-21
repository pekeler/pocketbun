// PocketBun-only: tests cluster platform planning and the same-data-directory primary guard.

import { describe, expect, it } from "bun:test";
import { mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalClusterGuardFileName } from "../../core/base_paths.ts";
import { acquirePrimaryGuard, parseClusterAddress, planClusterWorkers } from "./primary.ts";

describe("cluster primary", () => {
  it("plans the qualified platform topology", () => {
    const plans = planClusterWorkers(3, "127.0.0.1:9000");
    expect(plans.map((plan) => plan.role)).toEqual(["leader", "follower", "follower"]);
    expect(plans.map((plan) => plan.slot)).toEqual([0, 1, 2]);

    if (process.platform === "linux") {
      expect(plans.map((plan) => plan.address)).toEqual(["127.0.0.1:9000", "127.0.0.1:9000", "127.0.0.1:9000"]);
      expect(plans.every((plan) => plan.reusePort)).toBeTrue();
      expect(() => planClusterWorkers(2, "0.0.0.0:9000")).not.toThrow();
    } else {
      expect(plans.map((plan) => plan.address)).toEqual(["127.0.0.1:9000", "127.0.0.1:9001", "127.0.0.1:9002"]);
      expect(plans.every((plan) => !plan.reusePort)).toBeTrue();
      expect(() => planClusterWorkers(2, "0.0.0.0:9000")).toThrow("loopback");
      expect(() => planClusterWorkers(3, "127.0.0.1:65534")).toThrow("exceeds 65535");
    }

    expect(() => planClusterWorkers(3, "127.0.0.1:0")).toThrow("port 0");
  });

  it("parses host, port, and bracketed IPv6 addresses", () => {
    expect(parseClusterAddress("localhost")).toEqual({ hostname: "localhost", port: 8090 });
    expect(parseClusterAddress(":9000")).toEqual({ hostname: "127.0.0.1", port: 9000 });
    expect(parseClusterAddress("[::1]:9001")).toEqual({ hostname: "::1", port: 9001 });
    expect(() => parseClusterAddress("127.0.0.1:nope")).toThrow("invalid --http address");
  });

  it.serial("rejects a live owner and recovers a stale guard", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "pocketbun-cluster-guard-"));
    try {
      const first = await acquirePrimaryGuard(dataDir);
      try {
        const conflict = await acquirePrimaryGuard(dataDir).catch((error: unknown) => error);
        expect(conflict).toBeInstanceOf(Error);
        expect((conflict as Error).message).toContain(`PID ${process.pid} already owns`);
      } finally {
        await first.release();
      }

      const child = Bun.spawn({ cmd: [process.execPath, "-e", "process.exit(0)"], stdout: "ignore", stderr: "ignore" });
      const deadPid = child.pid;
      await child.exited;
      const guardPath = join(dataDir, LocalClusterGuardFileName);
      await writeFile(
        guardPath,
        JSON.stringify({ pid: deadPid, token: "stale-owner", startedAt: new Date(Date.now() - 60_000).toISOString() }),
      );
      const old = new Date(Date.now() - 10_000);
      await utimes(guardPath, old, old);

      const recovered = await acquirePrimaryGuard(dataDir);
      await recovered.release();
      expect(await Bun.file(guardPath).exists()).toBeFalse();
    } finally {
      await rm(dataDir, { recursive: true, force: true });
    }
  });
});
