// PocketBun-only: end-to-end smoke test for the HTTP server and Admin UI.

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { startTestServer } from "../helpers.ts";

const superuserToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY";

type SSEEventPayload = {
  id: string;
  event: string;
  data: string;
};

type SSEReader = {
  read: () => Promise<{ value?: unknown; done: boolean }>;
  cancel: () => Promise<void>;
};

describe("e2e smoke", () => {
  type StartedServer = Awaited<ReturnType<typeof startTestServer>>;
  let server: StartedServer["server"];
  let baseUrl = "";
  let dataDir = "";
  let cleanup: StartedServer["cleanup"] | null = null;

  beforeAll(async () => {
    const started = await startTestServer();
    server = started.server;
    baseUrl = started.baseUrl;
    dataDir = started.dataDir;
    cleanup = started.cleanup;
  });

  afterAll(async () => {
    await server?.stop();
    return cleanup?.();
  });

  it("serves the admin UI index", async () => {
    const response = await fetch(`${baseUrl}/_/`);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("<title>PocketBase</title>");
    expect(body).toContain("/_/pocketbun-branding.js");
  });

  it("serves the health endpoint", async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    const body = (await response.json()) as { code: number; message: string };

    expect(response.status).toBe(200);
    expect(body.code).toBe(200);
    expect(body.message).toBe("API is healthy.");
  });

  it.serial("serves a generated thumb via file token", async () => {
    const tokenResponse = await fetch(`${baseUrl}/api/files/token`, {
      method: "POST",
      headers: {
        Authorization: superuserToken,
      },
    });
    expect(tokenResponse.status).toBe(200);
    const tokenBody = (await tokenResponse.json()) as { token: string };
    expect(tokenBody.token).toBeTruthy();

    const thumbUrl =
      `${baseUrl}/api/files/demo1/al1h9ijdeojtsjy/300_Jsjq7RdBgA.png` +
      `?token=${encodeURIComponent(tokenBody.token)}&thumb=100x100`;
    const cachedThumbPath = join(
      dataDir,
      "storage/wsmn24bux7wo113/al1h9ijdeojtsjy/thumbs_300_Jsjq7RdBgA.png/100x100_300_Jsjq7RdBgA.png",
    );
    await rm(cachedThumbPath, { force: true });
    await rm(`${cachedThumbPath}.attrs`, { force: true });

    const thumbResponse = await fetch(thumbUrl);

    expect(thumbResponse.status).toBe(200);
    expect(thumbResponse.headers.get("content-type") ?? "").toContain("image/webp");

    const body = new Uint8Array(await thumbResponse.arrayBuffer());
    expect(body.length).toBeGreaterThan(0);
  });

  it.serial("delivers realtime event after record create", async () => {
    const controller = new AbortController();
    const realtimeResponse = await fetch(`${baseUrl}/api/realtime`, {
      signal: controller.signal,
    });
    expect(realtimeResponse.status).toBe(200);

    const reader = realtimeResponse.body?.getReader();
    expect(reader).toBeDefined();
    if (!reader) {
      throw new Error("Missing realtime stream reader");
    }

    try {
      const sseState = { buffer: "", decoder: new TextDecoder() };
      const connectEvent = await readNextSSEEvent(reader, sseState, 5_000);
      expect(connectEvent.event).toBe("PB_CONNECT");

      const connectData = JSON.parse(connectEvent.data) as { clientId: string };
      expect(connectData.clientId).toBeTruthy();

      const subscribeResponse = await fetch(`${baseUrl}/api/realtime`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: superuserToken,
        },
        body: JSON.stringify({
          clientId: connectData.clientId,
          subscriptions: ["demo2/*"],
        }),
      });
      expect(subscribeResponse.status).toBe(204);

      const title = `e2e-realtime-${Date.now()}`;
      const createResponse = await fetch(`${baseUrl}/api/collections/demo2/records`, {
        method: "POST",
        headers: {
          Authorization: superuserToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title }),
      });
      expect(createResponse.status).toBe(200);

      const createBody = (await createResponse.json()) as { id: string; title: string };
      expect(createBody.id).toBeTruthy();
      expect(createBody.title).toBe(title);

      const recordEvent = await readNextSSEEvent(reader, sseState, 5_000);
      expect(recordEvent.event).toBe("demo2/*");

      const eventData = JSON.parse(recordEvent.data) as { action: string; record: { title: string; id: string } };
      expect(eventData.action).toBe("create");
      expect(eventData.record.id).toBe(createBody.id);
      expect(eventData.record.title).toBe(title);
    } finally {
      controller.abort();
      try {
        await reader.cancel();
      } catch {
        // ignore cancellation races
      }
    }
  });
});

async function readNextSSEEvent(
  reader: SSEReader,
  state: { buffer: string; decoder: TextDecoder },
  timeoutMs: number,
): Promise<SSEEventPayload> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const remaining = deadline - Date.now();
    const { value, done } = await withTimeout(reader.read(), remaining, "Timed out waiting for realtime event");
    if (done) {
      throw new Error("Realtime stream closed before receiving an event");
    }
    if (!(value instanceof Uint8Array)) {
      continue;
    }

    state.buffer += state.decoder.decode(value, { stream: true }).replace(/\r/g, "");

    while (true) {
      const separatorIdx = state.buffer.indexOf("\n\n");
      if (separatorIdx < 0) {
        break;
      }

      const block = state.buffer.slice(0, separatorIdx);
      state.buffer = state.buffer.slice(separatorIdx + 2);

      const event = parseSSEBlock(block);
      if (event) {
        return event;
      }
    }
  }

  throw new Error("Timed out waiting for realtime event");
}

function parseSSEBlock(block: string): SSEEventPayload | null {
  let id = "";
  let event = "";
  const dataLines: string[] = [];

  const lines = block.split("\n");
  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line || line.startsWith(":")) {
      continue;
    }
    if (line.startsWith("id:")) {
      id = line.slice(3).trim();
      continue;
    }
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (!id && !event && dataLines.length === 0) {
    return null;
  }

  return {
    id,
    event,
    data: dataLines.join("\n"),
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(timeoutMessage)), Math.max(timeoutMs, 1));
    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}
