// PocketBun-only: tests the migrate helper and its async extension behavior.

import { describe, expect, it } from "bun:test";
import type { App } from "./app.ts";
import { migrate, migrateAsync } from "./migrate.ts";

type FakeMigrateApp = Pick<
  App,
  "isBootstrapped" | "bootstrap" | "runSystemMigrations" | "runAppMigrations" | "runAllMigrations"
> & {
  bootstrapAsync?: () => Promise<void>;
};

function newFakeApp(options: { bootstrapped?: boolean; withAsyncBootstrap?: boolean }): { app: App; calls: string[] } {
  const calls: string[] = [];
  let bootstrapped = options.bootstrapped ?? false;

  const fakeApp: FakeMigrateApp = {
    isBootstrapped: () => bootstrapped,
    bootstrap: () => {
      calls.push("bootstrap");
      bootstrapped = true;
    },
    runSystemMigrations: () => {
      calls.push("system");
    },
    runAppMigrations: () => {
      calls.push("app");
    },
    runAllMigrations: () => {
      calls.push("all");
    },
  };

  if (options.withAsyncBootstrap) {
    fakeApp.bootstrapAsync = async () => {
      calls.push("bootstrapAsync");
      bootstrapped = true;
    };
  }

  return { app: fakeApp as unknown as App, calls };
}

describe("migrate helper", () => {
  it("uses sync bootstrap and all migrations by default", () => {
    const { app, calls } = newFakeApp({ withAsyncBootstrap: true });

    migrate(app);

    expect(calls).toEqual(["bootstrap", "all"]);
  });

  it("skips bootstrap when already bootstrapped", () => {
    const { app, calls } = newFakeApp({ bootstrapped: true, withAsyncBootstrap: true });

    migrate(app, "system");

    expect(calls).toEqual(["system"]);
  });
});

describe("migrateAsync helper", () => {
  it("uses async bootstrap when available", async () => {
    const { app, calls } = newFakeApp({ withAsyncBootstrap: true });

    await migrateAsync(app);

    expect(calls).toEqual(["bootstrapAsync", "all"]);
  });

  it("falls back to sync bootstrap when async bootstrap is unavailable", async () => {
    const { app, calls } = newFakeApp({ withAsyncBootstrap: false });

    await migrateAsync(app, "app");

    expect(calls).toEqual(["bootstrap", "app"]);
  });

  it("runs the selected mode when already bootstrapped", async () => {
    const { app, calls } = newFakeApp({ bootstrapped: true, withAsyncBootstrap: true });

    await migrateAsync(app, "system");

    expect(calls).toEqual(["system"]);
  });
});
