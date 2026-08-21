// PocketBun-only: pins validation of the private cluster lifecycle protocol.

import { describe, expect, it } from "bun:test";
import { ClusterProtocolVersion, parseClusterMessage } from "./protocol.ts";

describe("cluster protocol", () => {
  it("accepts each lifecycle message", () => {
    expect(
      parseClusterMessage({
        version: ClusterProtocolVersion,
        kind: "worker.ready",
        token: "secret",
        role: "leader",
        slot: 0,
        workerId: 1,
        pid: 123,
        hostname: "127.0.0.1",
        port: 8090,
      }),
    ).not.toBeNull();
    expect(
      parseClusterMessage({
        version: ClusterProtocolVersion,
        kind: "worker.stopped",
        token: "secret",
        workerId: 1,
      }),
    ).not.toBeNull();
    expect(
      parseClusterMessage({
        version: ClusterProtocolVersion,
        kind: "control.shutdown",
        token: "secret",
        force: false,
      }),
    ).not.toBeNull();
  });

  it("rejects malformed, mismatched, and unknown messages", () => {
    expect(parseClusterMessage(null)).toBeNull();
    expect(parseClusterMessage([])).toBeNull();
    expect(parseClusterMessage({ version: 2, kind: "worker.stopped", token: "secret", workerId: 1 })).toBeNull();
    expect(parseClusterMessage({ version: 1, kind: "unknown", token: "secret" })).toBeNull();
    expect(
      parseClusterMessage({
        version: 1,
        kind: "worker.ready",
        token: "secret",
        role: "primary",
        slot: -1,
        workerId: 0,
        pid: 0,
        hostname: "127.0.0.1",
        port: 70_000,
      }),
    ).toBeNull();
  });
});
