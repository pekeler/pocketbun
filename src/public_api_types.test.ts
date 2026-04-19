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
  New,
  NewWithConfig,
  Version,
  type PocketBaseConfig,
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
