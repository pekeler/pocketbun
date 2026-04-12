// PocketBun-only: type-level regression coverage for the public package entrypoint.
//
// Why this file exists:
// Runtime tests don't catch exported TypeScript surface regressions. Bun's
// expectTypeOf lets us pin the package entrypoint and alias shapes that
// embedders rely on.

import { describe, expectTypeOf, it } from "bun:test";
import type { PocketBase } from "./pocketbase.ts";
import { BaseApp, New, NewWithConfig, Version, type PocketBaseConfig } from "../index.ts";

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
});
