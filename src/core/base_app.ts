import { Settings } from "./settings.ts";
import { Store } from "./store.ts";
import type { App } from "./app.ts";

export type BaseAppConfig = {
  dataDir?: string;
};

export class BaseApp implements App {
  #dataDir: string;
  #settings: Settings;
  #store: Store<string, unknown>;

  constructor(config: BaseAppConfig = {}) {
    this.#dataDir = config.dataDir ?? "pb_data";
    this.#settings = new Settings();
    this.#store = new Store();
  }

  dataDir(): string {
    return this.#dataDir;
  }

  settings(): Settings {
    return this.#settings;
  }

  store(): Store<string, unknown> {
    return this.#store;
  }
}
