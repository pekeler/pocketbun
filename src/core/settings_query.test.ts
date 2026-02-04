// Ported from pocketbase/core/settings_query_test.go.

import { describe, expect, it } from "bun:test";
import { newTestApp, type TestApp } from "../tests/app.ts";
import { JSONRaw } from "../tools/types/index.ts";
import { ParamsKeySettings } from "./settings_model.ts";

function readParamValue(app: TestApp): string {
  const row = app.db().query("select value from _params where id = ?").get(ParamsKeySettings) as
    | { value?: string | Uint8Array }
    | undefined;
  if (!row?.value) {
    return "";
  }
  if (typeof row.value === "string") {
    return row.value;
  }
  return new TextDecoder().decode(row.value);
}

function expectEventCalls(app: TestApp, events: Record<string, number>): void {
  const expectedKeys = Object.keys(events);
  const actualKeys = Object.keys(app.eventCalls);
  expect(actualKeys.length).toBe(expectedKeys.length);

  for (const [name, total] of Object.entries(events)) {
    const actual = app.eventCalls[name];
    expect(actual).toBe(total);
  }
}

describe("ReloadSettings", () => {
  it("reloads settings from the db", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      app.db().query("delete from _params").run();

      app.settings().meta.appName = "test_name_after_delete";
      app.resetEventCalls();

      const err = app.ReloadSettings();
      expect(err).toBeNull();

      expectEventCalls(app, {
        OnModelCreate: 1,
        OnModelCreateExecute: 1,
        OnModelAfterCreateSuccess: 1,
        OnModelValidate: 1,
        OnSettingsReload: 1,
      });

      const rawValue = readParamValue(app);
      expect(rawValue).toContain("test_name_after_delete");

      app
        .db()
        .query("update _params set value = ? where id = ?")
        .run(new JSONRaw(`{"meta":{"appName":"test_name_after_update"}}`).String(), ParamsKeySettings);

      app.resetEventCalls();
      const reloadErr = app.ReloadSettings();
      expect(reloadErr).toBeNull();
      expectEventCalls(app, { OnSettingsReload: 1 });

      app.resetEventCalls();
      const secondErr = app.ReloadSettings();
      expect(secondErr).toBeNull();
      expectEventCalls(app, { OnSettingsReload: 1 });

      expect(app.settings().meta.appName).toBe("test_name_after_update");
    } finally {
      await cleanup();
    }
  });

  it("reloads settings with encryption", async () => {
    const { app, cleanup } = await newTestApp();
    const originalEnv = process.env.pb_test_env;
    process.env.pb_test_env = "a".repeat(32);
    try {
      app.db().query("delete from _params").run();

      app.settings().meta.appName = "test_name_after_delete";
      app.resetEventCalls();

      const err = app.ReloadSettings();
      expect(err).toBeNull();

      expectEventCalls(app, {
        OnModelCreate: 1,
        OnModelCreateExecute: 1,
        OnModelAfterCreateSuccess: 1,
        OnModelValidate: 1,
        OnSettingsReload: 1,
      });

      const rawValue = readParamValue(app);
      expect(rawValue).not.toBe("");
      expect(rawValue).not.toContain("test_name");

      app.settings().meta.appName = "test_name_after_update";
      const saveErr = await app.Save(app.settings());
      expect(saveErr).toBeNull();

      app.resetEventCalls();
      const reloadErr = app.ReloadSettings();
      expect(reloadErr).toBeNull();
      expectEventCalls(app, { OnSettingsReload: 1 });

      const updatedRawValue = readParamValue(app);
      expect(updatedRawValue).not.toBe("");
      expect(updatedRawValue).not.toContain("test_name");

      expect(app.settings().meta.appName).toBe("test_name_after_update");
    } finally {
      if (originalEnv === undefined) {
        delete process.env.pb_test_env;
      } else {
        process.env.pb_test_env = originalEnv;
      }
      await cleanup();
    }
  });
});
