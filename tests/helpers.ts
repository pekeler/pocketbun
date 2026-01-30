import { createServer } from "node:net";
import { BaseApp } from "../src/core/base_app.ts";
import { serve } from "../src/apis/serve.ts";

export async function startTestServer(): Promise<{
  server: ReturnType<typeof serve>;
  baseUrl: string;
}> {
  const port = await getFreePort();
  const app = new BaseApp();
  const server = serve(app, { httpAddr: `127.0.0.1:${port}` });
  const baseUrl = `http://${server.hostname}:${server.port}`;
  return { server, baseUrl };
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
