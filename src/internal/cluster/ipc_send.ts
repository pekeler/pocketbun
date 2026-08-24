// PocketBun-only: waits for the authoritative completion callback when Bun queues cluster IPC messages.

export function waitForIpcSend(send: (callback: (error: Error | null) => void) => boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    send((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}
