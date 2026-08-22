// PocketBun-only: keeps the few built-in expiring values process-local normally and primary-atomic in cluster mode.

import type { App } from "../../core/app.ts";
import { clusterEnabled } from "./context.ts";

export async function claimExpiringValue(app: App, key: string, ttlMs: number): Promise<string | null> {
  if (clusterEnabled()) {
    const { claimClusterExpiringValue } = await import("./worker.ts");
    return claimClusterExpiringValue(key, ttlMs);
  }
  if (app.store().has(key)) {
    return null;
  }
  const claimToken = crypto.randomUUID();
  app.store().set(key, claimToken);
  setTimeout(() => {
    if (app.store().get(key) === claimToken) {
      app.store().remove(key);
    }
  }, ttlMs);
  return claimToken;
}

export async function releaseExpiringValue(app: App, key: string, claimToken: string): Promise<void> {
  if (clusterEnabled()) {
    const { releaseClusterExpiringValue } = await import("./worker.ts");
    await releaseClusterExpiringValue(key, claimToken);
    return;
  }
  if (app.store().get(key) === claimToken) {
    app.store().remove(key);
  }
}

export async function putExpiringValue(app: App, key: string, value: string, ttlMs: number): Promise<void> {
  if (clusterEnabled()) {
    const { putClusterExpiringValue } = await import("./worker.ts");
    await putClusterExpiringValue(key, value, ttlMs);
    return;
  }
  app.store().set(key, value);
  setTimeout(() => {
    if (app.store().get(key) === value) {
      app.store().remove(key);
    }
  }, ttlMs);
}

export async function takeExpiringValue(app: App, key: string): Promise<string | null> {
  if (clusterEnabled()) {
    const { takeClusterExpiringValue } = await import("./worker.ts");
    return takeClusterExpiringValue(key);
  }
  const value = app.store().get(key);
  if (typeof value !== "string") {
    return null;
  }
  app.store().remove(key);
  return value;
}
