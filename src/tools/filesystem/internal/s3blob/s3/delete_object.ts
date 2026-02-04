// Ported from pocketbase/tools/filesystem/internal/s3blob/s3/delete_object.go

import type { HttpRequest, S3 } from "./s3.ts";
import { newRequest } from "./s3.ts";

export async function deleteObject(
  s3: S3,
  ctx: AbortSignal | null,
  key: string,
  ...optReqFuncs: Array<(req: HttpRequest) => void>
): Promise<void> {
  const req = newRequest(ctx, "DELETE", s3.URL(key), null);

  for (const fn of optReqFuncs) {
    if (fn) {
      fn(req);
    }
  }

  const resp = await s3.SignAndSend(req);
  resp.body.close();
}
