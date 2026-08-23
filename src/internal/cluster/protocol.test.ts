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
        kind: "control.recycle",
        token: "secret",
        reason: "restart",
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

  it("validates concrete coordinator requests and responses", () => {
    const operations = [
      {
        kind: "rate-limit.consume-batch",
        requests: [
          { limiterId: "GET /api/health", clientKey: "127.0.0.1", maxRequests: 2, duration: 60 },
          { limiterId: "GET /api/health", clientKey: "127.0.0.2", maxRequests: 2, duration: 60 },
        ],
      },
      { kind: "rate-limit.check", limiterId: "GET /api/health", clientKey: "127.0.0.1" },
      { kind: "expiring.claim", key: "password-reset/user", ttlMs: 120_000 },
      { kind: "expiring.release", key: "password-reset/user", claimToken: "claim" },
      { kind: "expiring.put", key: "apple/code", value: "Test User", ttlMs: 60_000 },
      { kind: "expiring.take", key: "apple/code" },
      {
        kind: "realtime.publish",
        event: {
          kind: "record",
          eventId: "event",
          action: "create",
          collectionId: "collection",
          recordJson: '{"id":"record"}',
        },
      },
      { kind: "realtime.prepare", eventId: "event", collectionId: "collection", recordJson: '{"id":"record"}' },
      { kind: "realtime.subscribe", clientId: "client", requestJson: '{"subscriptions":[]}' },
      {
        kind: "oauth2.deliver",
        clientId: "client",
        requestIP: "127.0.0.1",
        data: '{"code":"code"}',
        mode: "deliver",
      },
      { kind: "backup.acquire", name: "test.zip" },
      { kind: "backup.release", leaseToken: "lease" },
      { kind: "backup.phase", leaseToken: "lease", phase: "delete" },
      { kind: "backup.file-delete", fileKey: "collection/record/file.txt" },
      { kind: "backup.file-write", fileKey: "collection/record/file.txt" },
      { kind: "lifecycle.restart" },
      { kind: "restore.begin", leaseToken: "lease" },
      { kind: "restore.complete", leaseToken: "lease" },
      { kind: "restore.abort", leaseToken: "lease", fatal: false, error: "failed" },
    ];

    for (const operation of operations) {
      expect(
        parseClusterMessage({
          version: ClusterProtocolVersion,
          kind: "coordinator.request",
          token: "secret",
          requestId: crypto.randomUUID(),
          workerId: 2,
          operation,
        }),
      ).not.toBeNull();
    }

    expect(
      parseClusterMessage({
        version: ClusterProtocolVersion,
        kind: "coordinator.response",
        token: "secret",
        requestId: "request",
        ok: true,
        value: false,
      }),
    ).not.toBeNull();
    expect(
      parseClusterMessage({
        version: ClusterProtocolVersion,
        kind: "coordinator.response",
        token: "secret",
        requestId: "rate-batch",
        ok: true,
        value: [true, false],
      }),
    ).not.toBeNull();
    expect(
      parseClusterMessage({
        version: ClusterProtocolVersion,
        kind: "coordinator.delivery",
        token: "secret",
        requestId: "backup-state",
        operation: { kind: "backup.state", name: "test.zip" },
      }),
    ).not.toBeNull();
    expect(
      parseClusterMessage({
        version: ClusterProtocolVersion,
        kind: "coordinator.response",
        token: "secret",
        requestId: "request",
        ok: false,
        error: { message: "failed" },
      }),
    ).not.toBeNull();
    expect(
      parseClusterMessage({
        version: ClusterProtocolVersion,
        kind: "coordinator.request",
        token: "secret",
        requestId: "request",
        workerId: 2,
        operation: { kind: "expiring.claim", key: "", ttlMs: 0 },
      }),
    ).toBeNull();
    expect(
      parseClusterMessage({
        version: ClusterProtocolVersion,
        kind: "coordinator.request",
        token: "secret",
        requestId: "rate-batch",
        workerId: 2,
        operation: { kind: "rate-limit.consume-batch", requests: [] },
      }),
    ).toBeNull();

    expect(
      parseClusterMessage({
        version: ClusterProtocolVersion,
        kind: "coordinator.delivery",
        token: "secret",
        requestId: "delivery",
        operation: { kind: "realtime.subscribe", clientId: "client", requestJson: "{}" },
      }),
    ).not.toBeNull();
    expect(
      parseClusterMessage({
        version: ClusterProtocolVersion,
        kind: "coordinator.delivery-result",
        token: "secret",
        requestId: "delivery",
        workerId: 2,
        ok: true,
        value: "delivered",
      }),
    ).not.toBeNull();
  });
});
