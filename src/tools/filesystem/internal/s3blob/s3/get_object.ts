// Ported from pocketbase/tools/filesystem/internal/s3blob/s3/get_object.go

import type { Body, HttpRequest, S3 } from "./s3.ts";
import { loadHeadResponse, type HeadObjectResponse } from "./head_object.ts";
import { newRequest } from "./s3.ts";

export type GetObjectResponse = HeadObjectResponse & {
  Body: Body;
};

export async function getObject(
  s3: S3,
  ctx: AbortSignal | null,
  key: string,
  ...optReqFuncs: Array<(req: HttpRequest) => void>
): Promise<GetObjectResponse> {
  const req = newRequest(ctx, "GET", s3.URL(key), null);

  for (const fn of optReqFuncs) {
    if (fn) {
      fn(req);
    }
  }

  const resp = await s3.SignAndSend(req);
  const result = loadHeadResponse(resp.headers);
  return { ...result, Body: resp.body };
}
