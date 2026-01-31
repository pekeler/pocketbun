// PocketBun-only: test server/data helpers for Bun.

import { cp, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BaseApp } from "../src/core/base_app.ts";
import { serve } from "../src/apis/serve.ts";

export async function startTestServer(): Promise<{
  server: ReturnType<typeof serve>;
  baseUrl: string;
  cleanup: () => Promise<void>;
}> {
  const dataDir = await cloneTestData();
  const app = new BaseApp({ dataDir });
  app.bootstrap();

  const port = await getFreePort();
  const server = serve(app, { httpAddr: `127.0.0.1:${port}` });
  const baseUrl = `http://${server.hostname}:${server.port}`;

  return {
    server,
    baseUrl,
    cleanup: async () => {
      await server.stop();
      app.resetBootstrapState();
      await rm(dataDir, { recursive: true, force: true });
    },
  };
}

async function cloneTestData(): Promise<string> {
  const source = resolve(fileURLToPath(new URL("./data", import.meta.url)));
  const tempDir = await mkdtemp(join(tmpdir(), "pocketbun-test-"));
  await cp(source, tempDir, { recursive: true });
  return tempDir;
}

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();

    server.on("error", (error) => {
      reject(error);
    });

    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address && typeof address === "object") {
        const port = address.port;
        server.close(() => resolve(port));
        return;
      }

      server.close(() => reject(new Error("Failed to resolve a free port")));
    });
  });
}
