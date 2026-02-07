// PocketBun-only: read and rebind Bun Request bodies without Request.clone() to reduce hot-path overhead.

function requestMethodAllowsBody(method: string): boolean {
  const normalized = method.toUpperCase();
  return normalized !== "GET" && normalized !== "HEAD";
}

function rebindRequestBody(request: Request, body: string | Uint8Array): Request {
  if (!requestMethodAllowsBody(request.method)) {
    return new Request(request);
  }

  // Preserve Go's reread semantics by replacing the consumed request stream.
  // eslint-disable-next-line unicorn/no-invalid-fetch-options -- guarded above against GET/HEAD methods.
  return new Request(request, { body });
}

export async function readRequestTextAndRebind(request: Request): Promise<{ request: Request; text: string }> {
  if (!request.body) {
    return { request, text: "" };
  }

  const text = await request.text();
  return { request: rebindRequestBody(request, text), text };
}

export async function readRequestBytesAndRebind(request: Request): Promise<{ request: Request; body: Uint8Array }> {
  if (!request.body) {
    return { request, body: new Uint8Array(0) };
  }

  const source = new Uint8Array(await request.arrayBuffer());
  // Bun may consume/detach the provided buffer when used as Request body.
  const rebindBody = new Uint8Array(source);
  const body = new Uint8Array(source);
  return { request: rebindRequestBody(request, rebindBody), body };
}
