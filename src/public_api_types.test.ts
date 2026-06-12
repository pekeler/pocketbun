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
  Version,
  type JSVMConfig,
  type PocketBaseConfig,
  type ServerJSConfig,
} from "../index.ts";
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

describe("public api types", () => {
  it("keeps the PocketBase constructor helpers typed", () => {
    expectTypeOf(New).returns.toEqualTypeOf<PocketBase>();
    expectTypeOf(NewWithConfig).returns.toEqualTypeOf<PocketBase>();
    expectTypeOf<Parameters<typeof NewWithConfig>>().toEqualTypeOf<[PocketBaseConfig]>();
    expectTypeOf(Version).toBeString();
  });

  it("keeps lowercase BaseApp hook aliases in the public type surface", () => {
    expectTypeOf(BaseApp).instance.toHaveProperty("onServe");
    expectTypeOf(BaseApp).instance.toHaveProperty("onTerminate");
    expectTypeOf(BaseApp).instance.toHaveProperty("onRecordCreate");
  });

  it("re-exports server-side JavaScript registration helpers with legacy aliases", () => {
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
  });
});
