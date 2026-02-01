// Ported from pocketbase/tests/app.go (simplified: only clones data dir and bootstraps BaseApp).

import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BaseApp } from "../src/core/base_app.ts";

export async function newTestApp(dataDir?: string): Promise<{ app: BaseApp; cleanup: () => Promise<void> }> {
  const source = dataDir ?? resolve(fileURLToPath(new URL("./data", import.meta.url)));
  const tempDir = await mkdtemp(join(tmpdir(), "pocketbun-test-"));
  await cp(source, tempDir, { recursive: true });

  const app = new BaseApp({ dataDir: tempDir, encryptionEnv: "pb_test_env" });
  app.bootstrap();

  return {
    app,
    cleanup: async () => {
      app.resetBootstrapState();
      await rm(tempDir, { recursive: true, force: true });
    },
  };
}
