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
  const parserRequest = options.preserveBody ? (cloneRequestIfPossible(request) ?? request) : request;

  try {
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- Bun supports Request.formData() for multipart parsing.
    return (await parserRequest.formData()) as ParsedFormData;
  } catch (error) {
    const recovered = await parseMultipartFormDataFallback(request, parserRequest, error as Error);
    if (recovered) {
      return recovered;
    }

    if (options.preserveBody && parserRequest !== request) {
      try {
        // Last-resort fallback: if clone-based preserve parsing fails, consume the original request body.
        // This keeps multipart handling working on runtimes where cloned multipart streams are unreliable.
        // eslint-disable-next-line @typescript-eslint/no-deprecated -- Bun supports Request.formData() for multipart parsing.
        return (await request.formData()) as ParsedFormData;
      } catch {
        // Ignore and rethrow the original error below.
      }
    }
    throw error;
  }
}

function cloneRequestIfPossible(request: MultipartRequestLike): MultipartRequestLike | null {
  if (typeof request.clone !== "function") {
    return null;
  }

  try {
    return request.clone();
  } catch {
    return null;
  }
}

async function parseMultipartFormDataFallback(
  request: MultipartRequestLike,
  parserRequest: MultipartRequestLike,
  originalError: Error,
): Promise<ParsedFormData | null> {
  const contentType = request.headers.get("content-type") ?? "";
  const hasMultipartHeader = contentType.toLowerCase().includes("multipart/form-data");

  const bodyCandidates: MultipartRequestLike[] = [];
  if (typeof request.clone === "function") {
    try {
      bodyCandidates.push(request.clone());
    } catch {
      // Ignore clone failure and continue with other candidates.
    }
  }
  if (parserRequest !== request) {
    bodyCandidates.push(parserRequest);
  }
  bodyCandidates.push(request);

  let body: ArrayBuffer | null = null;
  for (const candidate of bodyCandidates) {
    if (typeof candidate.arrayBuffer !== "function") {
      continue;
    }
    try {
      const candidateBody = await candidate.arrayBuffer();
      if (candidateBody.byteLength > 0) {
        body = candidateBody;
        break;
      }
      if (body === null) {
        body = candidateBody;
      }
    } catch {
      // Ignore consumed-body candidates and continue with the next fallback.
    }
  }
  if (body === null) {
    return null;
  }

  const bodyBytes = new Uint8Array(body);
  const boundary = detectMultipartBoundary(bodyBytes);
  if (!hasMultipartHeader && !boundary) {
    return null;
  }
  const normalizedContentType = normalizeMultipartContentType(contentType, boundary);
  if (!normalizedContentType) {
    return null;
  }

  const reconstructed = new Request(request.url ?? "http://localhost/", {
    method: request.method ?? "POST",
    headers: { "content-type": normalizedContentType },
    body: bodyBytes,
  });

  try {
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- Bun supports Request.formData() for multipart parsing.
    return (await reconstructed.formData()) as ParsedFormData;
  } catch (fallbackError) {
    throw new Error((fallbackError as Error).message, { cause: originalError });
  }
}

function detectMultipartBoundary(body: Uint8Array): string | null {
  if (body.length < 3 || body[0] !== 45 || body[1] !== 45) {
    return null;
  }

  const sample = new TextDecoder().decode(body.subarray(0, Math.min(body.length, 4096)));
  const firstLineEnd = sample.indexOf("\n");
  const firstLine = (firstLineEnd >= 0 ? sample.slice(0, firstLineEnd) : sample).trimEnd();
  if (!firstLine.startsWith("--")) {
    return null;
  }

  const boundary = firstLine.slice(2).trim();
  return boundary === "" ? null : boundary;
}

function normalizeMultipartContentType(contentType: string, boundary: string | null): string | null {
  const hasMultipartHeader = contentType.toLowerCase().includes("multipart/form-data");
  if (!hasMultipartHeader) {
    return boundary ? `multipart/form-data; boundary=${boundary}` : null;
  }

  if (!boundary) {
    return contentType;
  }

  if (/\bboundary=/i.test(contentType)) {
    return contentType.replace(/\bboundary=(?:"[^"]*"|[^;]*)/i, `boundary=${boundary}`);
  }

  const trimmed = contentType.trim();
  if (trimmed === "") {
    return `multipart/form-data; boundary=${boundary}`;
  }

  return trimmed.endsWith(";") ? `${trimmed} boundary=${boundary}` : `${trimmed}; boundary=${boundary}`;
}
