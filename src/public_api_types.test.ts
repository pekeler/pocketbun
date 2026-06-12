// PocketBun-only: type-level regression coverage for the public package entrypoint.
//
// Why this file exists:
// Runtime tests don't catch exported TypeScript surface regressions. Bun's
// expectTypeOf lets us pin the package entrypoint and alias shapes that
// embedders rely on.

import { describe, expect, expectTypeOf, it } from "bun:test";
import type { PocketBase } from "./pocketbase.ts";
import {
  BaseApp,
  BindApis,
  BindCore,
  BindDbx,
  BindFilesystem,
  BindFilepath,
  BindForms,
  BindHTTP,
  BindMails,
  BindOS,
  BindSecurity,
  MustRegisterHooksPlugin,
  MustRegisterHooksPluginAsync,
  MustRegisterJSVM,
  MustRegisterJSVMAsync,
  MustRegisterServerJS,
  MustRegisterServerJSAsync,
  New,
  NewWithConfig,
  RegisterHooksPlugin,
  RegisterHooksPluginAsync,
  RegisterJSVM,
  RegisterJSVMAsync,
  RegisterServerJS,
  RegisterServerJSAsync,
  Static,
  TemplateLangJS,
  Version,
  bindApis,
  bindCore,
  bindDbx,
  bindFilesystem,
  bindFilepath,
  bindForms,
  bindHTTP,
  bindMails,
  bindOS,
  bindSecurity,
  mustRegisterMigrateCmd,
  mustRegisterServerJS,
  mustRegisterServerJSAsync,
  newPocketBase,
  newPocketBaseWithConfig,
  registerMigrateCmd,
  registerServerJS,
  registerServerJSAsync,
  requireAuth,
  requireGuestOnly,
  serveStatic,
  staticWildcardParam,
  templateLangJS,
  version,
  type App,
  type JSVMConfig,
  type MigrateCmdConfig,
  type PocketBaseConfig,
  type ServeEvent,
  type ServerJSConfig,
} from "../index.ts";
import { StaticWildcardParam } from "./apis/base.ts";
import { RequireAuth, RequireGuestOnly } from "./apis/middlewares.ts";
import {
  BindApis as InternalBindApis,
  BindCore as InternalBindCore,
  BindDbx as InternalBindDbx,
  BindFilesystem as InternalBindFilesystem,
  BindFilepath as InternalBindFilepath,
  BindForms as InternalBindForms,
  BindHTTP as InternalBindHTTP,
  BindMails as InternalBindMails,
  BindOS as InternalBindOS,
  BindSecurity as InternalBindSecurity,
} from "./plugins/jsvm/binds.ts";
import {
  MustRegister as InternalMustRegisterServerJS,
  MustRegisterAsync as InternalMustRegisterServerJSAsync,
  Register as InternalRegisterServerJS,
  RegisterAsync as InternalRegisterServerJSAsync,
} from "./plugins/jsvm/jsvm.ts";
import {
  MustRegister as InternalMustRegisterMigrateCmd,
  Register as InternalRegisterMigrateCmd,
  TemplateLangJS as InternalTemplateLangJS,
} from "./plugins/migratecmd/migratecmd.ts";

// oxlint-disable typescript-eslint/no-deprecated
// Compatibility alias regression coverage intentionally touches deprecated exports.
describe("public api types", () => {
  it("keeps the PocketBase constructor helpers typed", () => {
    expectTypeOf(newPocketBase).returns.toEqualTypeOf<PocketBase>();
    expectTypeOf(newPocketBaseWithConfig).returns.toEqualTypeOf<PocketBase>();
    expectTypeOf<Parameters<typeof newPocketBaseWithConfig>>().toEqualTypeOf<[PocketBaseConfig]>();
    expect(newPocketBase).toBe(New);
    expect(newPocketBaseWithConfig).toBe(NewWithConfig);
    expect(version).toBe(Version);
    expectTypeOf(version).toBeString();

    expectTypeOf(New).returns.toEqualTypeOf<PocketBase>();
    expectTypeOf(NewWithConfig).returns.toEqualTypeOf<PocketBase>();
    expectTypeOf<Parameters<typeof NewWithConfig>>().toEqualTypeOf<[PocketBaseConfig]>();
    expectTypeOf(Version).toBeString();
  });

  it("keeps lowercase BaseApp hook aliases in the public type surface", () => {
    expectTypeOf(BaseApp).instance.toHaveProperty("onServe");
    expectTypeOf(BaseApp).instance.toHaveProperty("onTerminate");
    expectTypeOf(BaseApp).instance.toHaveProperty("onRecordCreate");
    expectTypeOf(BaseApp).instance.toHaveProperty("save");
    expectTypeOf(BaseApp).instance.toHaveProperty("newFilesystem");
    expectTypeOf(BaseApp).instance.toHaveProperty("findRecordsByFilter");
    expectTypeOf(BaseApp).instance.toHaveProperty("runInTransaction");
    expectTypeOf(BaseApp).instance.toHaveProperty("createBackup");
    expectTypeOf(BaseApp).instance.toHaveProperty("recordQuery");
  });

  it("keeps lowercase App aliases in the public type surface", () => {
    expectTypeOf<App>().toHaveProperty("save");
    expectTypeOf<App>().toHaveProperty("findRecordsByFilter");
    expectTypeOf<App>().toHaveProperty("runInTransaction");
    expectTypeOf<App>().toHaveProperty("createBackup");
    expectTypeOf<App>().toHaveProperty("recordQuery");
  });

  it("keeps lowercase ServeEvent aliases in the public type surface", () => {
    expectTypeOf<ServeEvent>().toHaveProperty("router");
    expectTypeOf<ServeEvent["router"]>().toEqualTypeOf<ServeEvent["Router"]>();
    expectTypeOf<ServeEvent>().toHaveProperty("installerFunc");
  });

  it("re-exports server-side JavaScript registration helpers with legacy aliases", () => {
    expect(registerServerJS).toBe(InternalRegisterServerJS);
    expect(mustRegisterServerJS).toBe(InternalMustRegisterServerJS);
    expect(registerServerJSAsync).toBe(InternalRegisterServerJSAsync);
    expect(mustRegisterServerJSAsync).toBe(InternalMustRegisterServerJSAsync);

    /* eslint-disable typescript-eslint/no-deprecated -- compatibility alias regression coverage */
    expect(RegisterServerJS).toBe(InternalRegisterServerJS);
    expect(MustRegisterServerJS).toBe(InternalMustRegisterServerJS);
    expect(RegisterServerJSAsync).toBe(InternalRegisterServerJSAsync);
    expect(MustRegisterServerJSAsync).toBe(InternalMustRegisterServerJSAsync);

    /* eslint-disable typescript-eslint/no-deprecated -- compatibility alias regression coverage */
    expect(RegisterJSVM).toBe(RegisterServerJS);
    expect(MustRegisterJSVM).toBe(MustRegisterServerJS);
    expect(RegisterJSVMAsync).toBe(RegisterServerJSAsync);
    expect(MustRegisterJSVMAsync).toBe(MustRegisterServerJSAsync);

    expect(RegisterHooksPlugin).toBe(RegisterServerJS);
    expect(MustRegisterHooksPlugin).toBe(MustRegisterServerJS);
    expect(RegisterHooksPluginAsync).toBe(RegisterServerJSAsync);
    expect(MustRegisterHooksPluginAsync).toBe(MustRegisterServerJSAsync);

    expectTypeOf<JSVMConfig>().toEqualTypeOf<ServerJSConfig>();
    /* eslint-enable typescript-eslint/no-deprecated */
  });

  it("re-exports the upstream-style JSVM bind helpers from the package entrypoint", () => {
    expect(bindCore).toBe(InternalBindCore);
    expect(bindDbx).toBe(InternalBindDbx);
    expect(bindMails).toBe(InternalBindMails);
    expect(bindSecurity).toBe(InternalBindSecurity);
    expect(bindFilesystem).toBe(InternalBindFilesystem);
    expect(bindFilepath).toBe(InternalBindFilepath);
    expect(bindOS).toBe(InternalBindOS);
    expect(bindForms).toBe(InternalBindForms);
    expect(bindApis).toBe(InternalBindApis);
    expect(bindHTTP).toBe(InternalBindHTTP);

    /* eslint-disable typescript-eslint/no-deprecated -- compatibility alias regression coverage */
    expect(BindCore).toBe(InternalBindCore);
    expect(BindDbx).toBe(InternalBindDbx);
    expect(BindMails).toBe(InternalBindMails);
    expect(BindSecurity).toBe(InternalBindSecurity);
    expect(BindFilesystem).toBe(InternalBindFilesystem);
    expect(BindFilepath).toBe(InternalBindFilepath);
    expect(BindOS).toBe(InternalBindOS);
    expect(BindForms).toBe(InternalBindForms);
    expect(BindApis).toBe(InternalBindApis);
    expect(BindHTTP).toBe(InternalBindHTTP);
    /* eslint-enable typescript-eslint/no-deprecated */
  });

  it("re-exports lower-camel package helpers with legacy aliases", () => {
    expect(serveStatic).toBe(Static);
    expect(staticWildcardParam).toBe(StaticWildcardParam);
    expect(requireGuestOnly).toBe(RequireGuestOnly);
    expect(requireAuth).toBe(RequireAuth);
    expect(registerMigrateCmd).toBe(InternalRegisterMigrateCmd);
    expect(mustRegisterMigrateCmd).toBe(InternalMustRegisterMigrateCmd);
    expect(templateLangJS).toBe(InternalTemplateLangJS);
    expect(TemplateLangJS).toBe(InternalTemplateLangJS);
    expectTypeOf<MigrateCmdConfig>().toHaveProperty("templateLang");
  });
});
