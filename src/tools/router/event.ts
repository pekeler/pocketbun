export type NextHandler = () => Promise<void>;

export class Event {
  request: Request;
  params: Record<string, string>;
  responseHeaders: Headers;
  #next: NextHandler | null;
  #remoteAddress: string | null;

  constructor(options: {
    request: Request;
    params?: Record<string, string>;
    remoteAddress?: string | null;
    next?: NextHandler | null;
  }) {
    this.request = options.request;
    this.params = options.params ?? {};
    this.responseHeaders = new Headers();
    this.#next = options.next ?? null;
    this.#remoteAddress = options.remoteAddress ?? null;
  }

  async next(): Promise<void> {
    if (this.#next) {
      await this.#next();
    }
  }

  json(status: number, body: unknown): Response {
    if (!this.responseHeaders.has("Content-Type")) {
      this.responseHeaders.set("Content-Type", "application/json; charset=utf-8");
    }
    return new Response(JSON.stringify(body), {
      status,
      headers: this.responseHeaders,
    });
  }

  async bindBody<T extends object>(target: T): Promise<void> {
    const contentType = this.request.headers.get("Content-Type") ?? "";
    if (!this.request.body) {
      return;
    }

    if (contentType.includes("application/json")) {
      try {
        const parsed = await this.request.json();
        if (parsed && typeof parsed === "object") {
          Object.assign(target, parsed as object);
        }
      } catch {
        // ignore malformed JSON for now; upstream returns error later in request validation
      }
    }
  }

  remoteIP(): string {
    return this.#remoteAddress ?? "";
  }
}
