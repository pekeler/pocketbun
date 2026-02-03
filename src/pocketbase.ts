// Ported from pocketbase/pocketbase.go (CLI removed; PocketBun is library-first).

import { BaseApp, type BaseAppConfig } from "./core/base.ts";

export type PocketBaseConfig = BaseAppConfig;

// PocketBase defines the main PocketBun app wrapper.
// Deviation: PocketBase does not embed CLI/launcher wiring because PocketBun ships as a library.
export class PocketBase extends BaseApp {
  constructor(config: PocketBaseConfig = {}) {
    super(config);
  }
}
