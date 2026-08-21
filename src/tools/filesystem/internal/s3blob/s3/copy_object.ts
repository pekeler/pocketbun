// Ported from pocketbase/tools/filesystem/internal/s3blob/s3/copy_object.go

import type { HttpRequest, S3 } from "./s3.ts";
import { newRequest } from "./s3.ts";
import { parseXmlRoot, xmlChild, xmlText } from "./xml.ts";

export type CopyObjectResponse = {
  ETag: string;
  LastModified: Date;
  ChecksumType: string;
  ChecksumCRC32: string;
  ChecksumCRC32C: string;
  ChecksumCRC64NVME: string;
  ChecksumSHA1: string;
  ChecksumSHA256: string;
  toJSON?: () => Record<string, unknown>;
};

export async function copyObject(
  s3: S3,
  ctx: AbortSignal | null,
  srcKey: string,
  dstKey: string,
  ...optReqFuncs: Array<(req: HttpRequest) => void>
): Promise<CopyObjectResponse> {
  const req = newRequest(ctx, "PUT", s3.URL(dstKey), null);
  req.headers.set("x-amz-copy-source", encodeURIComponent(`${s3.Bucket}/${srcKey.replace(/^\/+/, "")}`));

  for (const fn of optReqFuncs) {
    if (fn) {
      fn(req);
    }
  }

  const resp = await s3.SignAndSend(req);
  const body = new TextDecoder().decode(resp.body.readAll());
  resp.body.close();

  return parseCopyObjectResponse(body);
}

function parseCopyObjectResponse(raw: string): CopyObjectResponse {
  const root = parseXmlRoot(raw);
  return {
    ETag: xmlText(xmlChild(root, "ETag")),
    LastModified: new Date(xmlText(xmlChild(root, "LastModified")) || 0),
    ChecksumType: xmlText(xmlChild(root, "ChecksumType")),
    ChecksumCRC32: xmlText(xmlChild(root, "ChecksumCRC32")),
    ChecksumCRC32C: xmlText(xmlChild(root, "ChecksumCRC32C")),
    ChecksumCRC64NVME: xmlText(xmlChild(root, "ChecksumCRC64NVME")),
    ChecksumSHA1: xmlText(xmlChild(root, "ChecksumSHA1")),
    ChecksumSHA256: xmlText(xmlChild(root, "ChecksumSHA256")),
    toJSON() {
      return {
        etag: this.ETag,
        lastModified: formatTime(this.LastModified),
        checksumType: this.ChecksumType,
        checksumCRC32: this.ChecksumCRC32,
        checksumCRC32C: this.ChecksumCRC32C,
        checksumCRC64NVME: this.ChecksumCRC64NVME,
        checksumSHA1: this.ChecksumSHA1,
        checksumSHA256: this.ChecksumSHA256,
      };
    },
  };
}

function formatTime(value: Date): string {
  return value.toISOString().replace(".000Z", "Z");
}
