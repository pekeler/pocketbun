// PocketBun-only: test server/data helpers for Bun.

import { cp, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "../apis/serve.ts";
import { BaseApp } from "../core/base.ts";
import { removeDirWithRetry } from "./fs.ts";

const defaultServerStartAttempts = 5;

type BunServer = ReturnType<typeof Bun.serve>;
type BunServeOptions = Parameters<typeof Bun.serve>[0];
export type StartedServer = {
  server: ReturnType<typeof serve>;
  baseUrl: string;
  cleanup: () => Promise<void>;
  [Symbol.asyncDispose]: () => Promise<void>;
};

export async function startTestServer(): Promise<StartedServer> {
  const dataDir = await cloneTestData();
  const app = new BaseApp({ dataDir });
  app.bootstrap();

  let server: ReturnType<typeof serve>;
  try {
    server = await retryServerStart(() => serve(app, { httpAddr: "127.0.0.1:0" }));
  } catch (error) {
    app.resetBootstrapState();
    await removeDirWithRetry(dataDir);
    throw error;
  }

  const baseUrl = `http://127.0.0.1:${server.port}`;

  let cleaned = false;
  const cleanup = async () => {
    if (cleaned) {
      return;
    }
    cleaned = true;
    await server.stop();
    app.resetBootstrapState();
    await removeDirWithRetry(dataDir);
  };

  return {
    server,
    baseUrl,
    cleanup,
    [Symbol.asyncDispose]: cleanup,
  };
}

async function cloneTestData(): Promise<string> {
  const source = resolve(fileURLToPath(new URL("./data", import.meta.url)));
  const tempDir = await mkdtemp(join(tmpdir(), "pocketbun-test-"));
  await cp(source, tempDir, { recursive: true });
  return tempDir;
}

export function startBunServerWithRetry(options: BunServeOptions, attempts: number = defaultServerStartAttempts): BunServer {
  let lastError: unknown = null;
  const maxAttempts = Math.max(1, attempts);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const normalizedOptions = { ...options } as BunServeOptions & {
        hostname?: string;
        port?: number;
        unix?: string;
      };

      if (normalizedOptions.unix) {
        return Bun.serve(normalizedOptions as BunServeOptions);
      }

      const { unix: _unix, ...rest } = normalizedOptions;
      return Bun.serve({
        ...rest,
        hostname: rest.hostname ?? "127.0.0.1",
        port: rest.port ?? 0,
      } as BunServeOptions);
    } catch (error) {
      lastError = error;
      if (!isTransientServerStartError(error) || attempt === maxAttempts) {
        throw error;
      }
    }
  }

  throw normalizeError(lastError, "Failed to start test HTTP server.");
}

export async function retryServerStart<T>(
  start: () => T | Promise<T>,
  attempts: number = defaultServerStartAttempts,
): Promise<T> {
  let lastError: unknown = null;
  const maxAttempts = Math.max(1, attempts);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await start();
    } catch (error) {
      lastError = error;
      if (!isTransientServerStartError(error) || attempt === maxAttempts) {
        throw error;
      }
    }
  }

  throw normalizeError(lastError, "Failed to start server.");
}

function isTransientServerStartError(error: unknown): boolean {
  const code = extractErrorCode(error);
  if (code === "EADDRINUSE" || code === "EPERM" || code === "EACCES") {
    return true;
  }

  const message = error instanceof Error ? error.message : toErrorMessage(error, "");
  return (
    message.includes("Failed to start server") ||
    message.includes("Failed to listen at") ||
    message.includes("EADDRINUSE") ||
    message.includes("EPERM") ||
    message.includes("EACCES")
  );
}

function extractErrorCode(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "";
  }

  const record = error as { code?: unknown; cause?: { code?: unknown } };
  if (typeof record.code === "string") {
    return record.code;
  }
  if (record.cause && typeof record.cause.code === "string") {
    return record.cause.code;
  }
  return "";
}

function normalizeError(error: unknown, fallbackMessage: string): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(toErrorMessage(error, fallbackMessage));
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string" && error.length > 0) {
    return error;
  }
  if (typeof error === "number" || typeof error === "boolean" || typeof error === "bigint") {
    return `${error}`;
  }
  if (typeof error === "symbol") {
    return error.description ?? fallback;
  }
  return fallback;
}
