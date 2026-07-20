// Ported from pocketbase/plugins/jsvm/binds_app_reset_test.go

import { expect, test } from "bun:test";
import { buildServeHandler } from "../../apis/serve.ts";
import { Record as RecordModel } from "../../core/record_model.ts";
import { newTestApp } from "../../tests/app.ts";
import { appBinds, baseBinds, hooksBinds, routerBinds } from "./binds.ts";

type BindScope = Record<string, any>;

test("hooks app reset", async () => {
  const { app, cleanup } = await newTestApp();
  try {
    const scope: BindScope = {};
    appBinds(scope, app);
    hooksBinds(app, scope);
    const originalApp = scope.$app;

    scope.onRecordCreate(async (e: any) => {
      await e.next();
      scope.$app = 123;
    }, "demo2");

    const collection = app.FindCollectionByNameOrId("demo2");
    const record = new RecordModel(collection, { title: "test" }, true);
    expect(await app.Save(record)).toBeNull();
    expect(scope.$app).toBe(originalApp);
  } finally {
    await cleanup();
  }
});

test("router handler app reset", async () => {
  const { app, cleanup } = await newTestApp();
  try {
    const scope: BindScope = {};
    appBinds(scope, app);
    routerBinds(app, scope);
    const originalApp = scope.$app;

    scope.routerAdd("GET", "/app-reset", (e: any) => {
      scope.$app = 123;
      return e.string(200, "test");
    });

    const response = await buildServeHandler(app)(new Request("http://127.0.0.1/app-reset"));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("test");
    expect(scope.$app).toBe(originalApp);
  } finally {
    await cleanup();
  }
});

test("router middleware function app reset", async () => {
  const { app, cleanup } = await newTestApp();
  try {
    const scope: BindScope = {};
    appBinds(scope, app);
    routerBinds(app, scope);
    const originalApp = scope.$app;

    scope.routerUse((e: any) => {
      scope.$app = 123;
      return e.string(200, "test");
    });

    const response = await buildServeHandler(app)(new Request("http://127.0.0.1/anything"));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("test");
    expect(scope.$app).toBe(originalApp);
  } finally {
    await cleanup();
  }
});

test("router middleware class app reset", async () => {
  const { app, cleanup } = await newTestApp();
  try {
    const scope: BindScope = {};
    appBinds(scope, app);
    baseBinds(scope);
    routerBinds(app, scope);
    const originalApp = scope.$app;

    scope.routerUse(
      new scope.Middleware((e: any) => {
        scope.$app = 123;
        return e.string(200, "test");
      }),
    );

    const response = await buildServeHandler(app)(new Request("http://127.0.0.1/anything"));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("test");
    expect(scope.$app).toBe(originalApp);
  } finally {
    await cleanup();
  }
});
