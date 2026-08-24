// PocketBun-only: pins cluster IPC backpressure semantics without filling a real process channel.

import { describe, expect, it } from "bun:test";
import { waitForIpcSend } from "./ipc_send.ts";

describe("cluster IPC send", () => {
  it("waits for the callback when a queued send reports backpressure", async () => {
    let completed = false;
    const sent = waitForIpcSend((callback) => {
      queueMicrotask(() => {
        completed = true;
        callback(null);
      });
      return false;
    });

    expect(completed).toBeFalse();
    expect(await sent).toBeUndefined();
    expect(completed).toBeTrue();
  });

  it("rejects callback send errors", async () => {
    const error = await waitForIpcSend((callback) => {
      callback(new Error("channel closed"));
      return false;
    }).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("channel closed");
  });
});
