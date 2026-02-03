// Ported from pocketbase/tools/filesystem/internal/s3blob/s3/tests/client.go

import type { HTTPClient, HttpRequest, HttpResponse } from "../s3.ts";
import { BytesBody } from "../s3.ts";

export type RequestStub = {
  Method: string;
  URL: string;
  Match?: (req: HttpRequest) => boolean;
  Response?: HttpResponse;
};

export class Client implements HTTPClient {
  private stubs: RequestStub[];

  constructor(stubs: RequestStub[]) {
    this.stubs = stubs;
  }

  static New(...stubs: RequestStub[]): Client {
    return new Client(stubs);
  }

  AssertNoRemaining(): Error | null {
    if (this.stubs.length === 0) {
      return null;
    }

    const parts = ["not all stub requests were processed:"];
    for (const stub of this.stubs) {
      parts.push(`- ${stub.Method} ${stub.URL}`);
    }

    return new Error(parts.join("\n"));
  }

  async Do(req: HttpRequest): Promise<HttpResponse> {
    for (let i = 0; i < this.stubs.length; i += 1) {
      const stub = this.stubs[i];
      if (!stub) {
        continue;
      }
      if (req.method !== stub.Method) {
        continue;
      }

      let pattern = stub.URL;
      if (!pattern.startsWith("^") || !pattern.endsWith("$")) {
        pattern = `^${escapeRegex(pattern)}$`;
      }

      const urlRegex = new RegExp(pattern);
      if (!urlRegex.test(req.url)) {
        continue;
      }

      if (stub.Match && !stub.Match(req)) {
        continue;
      }

      this.stubs.splice(i, 1);

      const response = normalizeResponse(stub.Response);
      response.request = req;
      return response;
    }

    const bodyText = req.body ? new TextDecoder().decode(req.body) : "";
    throw new Error(
      `the below request doesn't have a corresponding stub:\n${req.method} ${req.url}\nHeaders: ${JSON.stringify(
        headersToRecord(req.headers),
      )}\nBody: ${JSON.stringify(bodyText)}`,
    );
  }
}

export function NewClient(...stubs: RequestStub[]): Client {
  return Client.New(...stubs);
}

function normalizeResponse(response?: HttpResponse): HttpResponse {
  if (response) {
    if (!response.headers) {
      response.headers = new Headers();
    }
    if (!response.body) {
      response.body = new BytesBody(new Uint8Array());
    }
    return response;
  }

  return {
    status: 200,
    headers: new Headers(),
    body: new BytesBody(new Uint8Array()),
  };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function headersToRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  for (const [key, value] of headers.entries()) {
    record[key] = value;
  }
  return record;
}
