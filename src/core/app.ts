import type { Settings } from "./settings.ts";
import type { Store } from "./store.ts";

export interface App {
  dataDir(): string;
  settings(): Settings;
  store(): Store<string, unknown>;
}
