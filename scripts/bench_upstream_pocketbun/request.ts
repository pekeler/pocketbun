// Ported from vendor/pocketbase-benchmarks/benchmarks/request.go.
import type { BodyInit } from "bun";
import type { IncomingHttpHeaders } from "node:http";
import { AsyncLocalStorage } from "node:async_hooks";
import { Agent as HttpAgent, request as httpRequest } from "node:http";
import { Agent as HttpsAgent, request as httpsRequest } from "node:https";

export const benchmarkWorkerSlotHeader = "x-pocketbun-benchmark-worker-slot";

export type BenchRequestOptions = {
  Body?: BodyInit | null;
  Context?: AbortSignal;
  Headers?: Record<string, string>;
  Method: string;
  Url: string;
};

export type ExternalBenchRequest = {
  body: string | null;
  headers: Record<string, string>;
  method: string;
  url: string;
};

export type BenchResponse = {
  status: number;
  headers: IncomingHttpHeaders;
  bodyText: string;
};

const requestCapture = new AsyncLocalStorage<ExternalBenchRequest[]>();

const sharedHttpAgent = new HttpAgent({
  keepAlive: true,
  maxSockets: Number.POSITIVE_INFINITY,
  maxFreeSockets: 2_000,
  timeout: 120_000,
  keepAliveMsecs: 30_000,
  scheduling: "fifo",
});

const sharedHttpsAgent = new HttpsAgent({
  keepAlive: true,
  maxSockets: Number.POSITIVE_INFINITY,
  maxFreeSockets: 2_000,
  timeout: 120_000,
  keepAliveMsecs: 30_000,
  scheduling: "fifo",
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
  async Send(destBody: Record<string, unknown> | null): Promise<BenchResponse | null> {
    const headers = new Headers();

    for (const [key, value] of Object.entries(this.Headers)) {
      headers.set(key, value);
    }

    // set default content-type header (if missing)
    if (!headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }

    const captured = requestCapture.getStore();
    if (captured) {
      if (destBody != null) {
        throw new Error("external benchmark capture does not support response bodies");
      }
      captured.push({
        url: this.Url,
        method: this.Method,
        headers: Object.fromEntries(headers.entries()),
        body: await toRequestBody(this.Body),
      });
      return null;
    }

    const response = await sendWithSharedTransport({
      url: this.Url,
      method: this.Method,
      headers,
      body: this.Body,
      signal: this.Context,
      expectBody: destBody != null,
    });

    if (response.status >= 400) {
      throw new Error(`request failed with status ${response.status}`);
    }

    if (destBody == null) {
      return response;
    }

    const payload = JSON.parse(response.bodyText) as Record<string, unknown>;
    Object.assign(destBody, payload);
    return response;
  }
}

export async function captureBenchRequests(action: () => Promise<void>): Promise<ExternalBenchRequest[]> {
  const requests: ExternalBenchRequest[] = [];
  await requestCapture.run(requests, action);
  return requests;
}

type SendOptions = {
  url: string;
  method: string;
  headers: Headers;
  body: BodyInit | null;
  signal?: AbortSignal;
  expectBody: boolean;
};

async function sendWithSharedTransport(options: SendOptions): Promise<BenchResponse> {
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

  return await new Promise<BenchResponse>((resolve, reject) => {
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
          resolve({ status, headers: res.headers, bodyText: "" });
          return;
        }

        let bodyText = "";
        res.setEncoding("utf8");
        res.on("data", (chunk: string) => {
          bodyText += chunk;
        });
        res.once("end", () => resolve({ status, headers: res.headers, bodyText }));
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
