// PocketBun-only: pick a free port for Playwright and launch tests.

import { createServer } from "node:net";
import type { AddressInfo } from "node:net";

const port = await new Promise<number>((resolve, reject) => {
  const server = createServer();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const address = server.address() as AddressInfo;
    const selected = address.port;
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(selected);
    });
  });
});

const env = { ...process.env, POCKETBUN_E2E_PORT: String(port) };
const proc = Bun.spawn({
  cmd: ["playwright", "test"],
  env,
  stdio: ["inherit", "inherit", "inherit"],
});

const exitCode = await proc.exited;
process.exit(exitCode ?? 1);
