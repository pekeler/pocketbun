// PocketBun-only: robust multipart parsing helper for Bun Request objects.
//
// Why this file exists:
// Bun's native formData() may fail on some incoming multipart requests.
// We keep the standard fast path first and fallback to reconstructing a
// synthetic Request from raw bytes when needed.

export type MultipartParseOptions = {
  // If true, parse from request.clone() to avoid consuming the original body.
  preserveBody?: boolean;
};

type ParsedFormData = {
  get: (name: string) => unknown;
  getAll: (name: string) => unknown[];
  entries?: () => IterableIterator<[string, unknown]>;
  forEach?: (cb: (value: unknown, key: string) => void) => void;
  [Symbol.iterator]?: () => IterableIterator<[string, unknown]>;
};

type MultipartRequestLike = {
  headers: { get: (name: string) => string | null };
  formData: () => Promise<unknown>;
  clone?: () => MultipartRequestLike;
  arrayBuffer?: () => Promise<ArrayBuffer>;
  url?: string;
  method?: string;
};

export async function parseMultipartFormData(
  request: MultipartRequestLike,
  options: MultipartParseOptions = {},
): Promise<ParsedFormData> {
  const parserRequest = options.preserveBody && typeof request.clone === "function" ? request.clone() : request;

  try {
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- Bun supports Request.formData() for multipart parsing.
    return (await parserRequest.formData()) as ParsedFormData;
  } catch (error) {
    const recovered = await parseMultipartFormDataFallback(request, parserRequest, error as Error);
    if (recovered) {
      return recovered;
    }
    throw error;
  }
}

async function parseMultipartFormDataFallback(
  request: MultipartRequestLike,
  parserRequest: MultipartRequestLike,
  originalError: Error,
): Promise<ParsedFormData | null> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return null;
  }

  let body: ArrayBuffer;
  try {
    if (typeof parserRequest.arrayBuffer !== "function") {
      throw new Error("request arrayBuffer() is unavailable");
    }
    body = await parserRequest.arrayBuffer();
  } catch {
    try {
      if (typeof request.clone !== "function") {
        return null;
      }
      const clone = request.clone();
      if (typeof clone.arrayBuffer !== "function") {
        return null;
      }
      body = await clone.arrayBuffer();
    } catch {
      return null;
    }
  }

  const reconstructed = new Request(request.url ?? "http://localhost/", {
    method: request.method ?? "POST",
    headers: { "content-type": contentType },
    body,
  });

  try {
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- Bun supports Request.formData() for multipart parsing.
    return (await reconstructed.formData()) as ParsedFormData;
  } catch (fallbackError) {
    throw new Error((fallbackError as Error).message, { cause: originalError });
  }
}
