// PocketBun-only: multipart parsing helper for Bun Request objects.
//
// Why this file exists:
// Keep multipart parsing calls centralized while preserving the option to parse
// from request.clone() when callers need to avoid consuming the original body.

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
  formData: () => Promise<unknown>;
  clone?: () => MultipartRequestLike;
};

export async function parseMultipartFormData(
  request: MultipartRequestLike,
  options: MultipartParseOptions = {},
): Promise<ParsedFormData> {
  const parserRequest = options.preserveBody ? (cloneRequestIfPossible(request) ?? request) : request;
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- Bun supports Request.formData() for multipart parsing.
  return (await parserRequest.formData()) as ParsedFormData;
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
