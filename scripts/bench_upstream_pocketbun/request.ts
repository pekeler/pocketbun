// Ported from vendor/pocketbase-benchmarks/benchmarks/request.go.
import type { BodyInit } from "bun";
import { Agent as HttpAgent, request as httpRequest } from "node:http";
import { Agent as HttpsAgent, request as httpsRequest } from "node:https";
import { setTimeout as delay } from "node:timers/promises";

export type BenchRequestOptions = {
  Body?: BodyInit | null;
  Context?: AbortSignal;
  Headers?: Record<string, string>;
  Method: string;
  Url: string;
};

const sharedHttpAgent = new HttpAgent({
  keepAlive: true,
  maxSockets: Number.POSITIVE_INFINITY,
  maxFreeSockets: 512,
  timeout: 30_000,
  keepAliveMsecs: 30_000,
});

const sharedHttpsAgent = new HttpsAgent({
  keepAlive: true,
  maxSockets: Number.POSITIVE_INFINITY,
  maxFreeSockets: 512,
  timeout: 30_000,
  keepAliveMsecs: 30_000,
});

export class BenchRequest {
  Body: BodyInit | null;
  Context?: AbortSignal;
  Headers: Record<string, string>;
  Method: string;
  Url: string;

  constructor(options: BenchRequestOptions) {
    this.Body = options.Body ?? null;
    this.Context = options.Context;
    this.Headers = options.Headers ?? {};
    this.Method = options.Method;
    this.Url = options.Url;
  }

  // If destBody is non-nil, it will read and unmarshal the request
  // response body into the specified variable.
  async Send(destBody: Record<string, unknown> | null): Promise<void> {
    const headers = new Headers();

    for (const [key, value] of Object.entries(this.Headers)) {
      headers.set(key, value);
    }

    // set default content-type header (if missing)
    if (!headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }

    // PocketBun-only: mirror upstream benchmark-runner retry behavior for
    // transient local socket exhaustion under very high client concurrency.
    let response: { status: number; bodyText: string } | null = null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        response = await sendWithSharedTransport({
          url: this.Url,
          method: this.Method,
          headers,
          body: this.Body,
          signal: this.Context,
          expectBody: destBody != null,
        });
        break;
      } catch (error) {
        if (!String(error).includes("can't assign requested address")) {
          throw error;
        }
        await delay(2);
      }
    }
    if (response == null) {
      throw new Error(`request transport failed for ${this.Method} ${this.Url}`);
    }

    if (response.status >= 400) {
      throw new Error(`request failed with status ${response.status}`);
    }

    if (destBody == null) {
      return;
    }

    const payload = JSON.parse(response.bodyText) as Record<string, unknown>;
    Object.assign(destBody, payload);
  }
}

type SendOptions = {
  url: string;
  method: string;
  headers: Headers;
  body: BodyInit | null;
  signal?: AbortSignal;
  expectBody: boolean;
};

async function sendWithSharedTransport(options: SendOptions): Promise<{ status: number; bodyText: string }> {
  const { url, method, headers, body, signal, expectBody } = options;
  const parsed = new URL(url);
  const isHttps = parsed.protocol === "https:";
  const requestImpl = isHttps ? httpsRequest : httpRequest;
  const agent = isHttps ? sharedHttpsAgent : sharedHttpAgent;

  const bodyPayload = await toRequestBody(body);
  const rawHeaders: Record<string, string> = {};
  for (const [key, value] of headers.entries()) {
    rawHeaders[key] = value;
  }
  if (bodyPayload != null && !("content-length" in rawHeaders)) {
    rawHeaders["content-length"] = String(Buffer.byteLength(bodyPayload));
  }

  return await new Promise<{ status: number; bodyText: string }>((resolve, reject) => {
    const req = requestImpl(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port ? Number(parsed.port) : undefined,
        method,
        path: `${parsed.pathname}${parsed.search}`,
        headers: rawHeaders,
        signal,
        agent,
      },
      (res) => {
        const status = res.statusCode ?? 0;

        if (!expectBody && status < 400) {
          res.resume();
          resolve({ status, bodyText: "" });
          return;
        }

        let bodyText = "";
        res.setEncoding("utf8");
        res.on("data", (chunk: string) => {
          bodyText += chunk;
        });
        res.once("end", () => resolve({ status, bodyText }));
      },
    );

    req.once("error", reject);

    if (bodyPayload != null && bodyPayload !== "") {
      req.write(bodyPayload);
    }
    req.end();
  });
}

async function toRequestBody(body: BodyInit | null): Promise<string | null> {
  if (body == null) {
    return null;
  }

  if (typeof body === "string") {
    return body;
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body).toString("utf8");
  }

  if (body instanceof ArrayBuffer) {
    return Buffer.from(body).toString("utf8");
  }

  if (typeof (body as { text?: () => Promise<string> }).text === "function") {
    return await (body as { text: () => Promise<string> }).text();
  }

  if (typeof (body as { arrayBuffer?: () => Promise<ArrayBuffer> }).arrayBuffer === "function") {
    const buffer = await (body as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer();
    return Buffer.from(buffer).toString("utf8");
  }

  if (typeof body === "number" || typeof body === "boolean" || typeof body === "bigint") {
    return String(body);
  }

  return JSON.stringify(body) ?? "";
}
