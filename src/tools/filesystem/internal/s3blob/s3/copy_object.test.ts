// Ported from pocketbase/tools/filesystem/internal/s3blob/s3/copy_object_test.go

import { describe, it } from "bun:test";
import { S3 } from "./s3.ts";
import { BytesBody } from "./s3.ts";
import { NewClient } from "./tests/client.ts";
import { ExpectHeaders } from "./tests/headers.ts";

function responseWithBody(body: string) {
  return {
    status: 200,
    headers: new Headers(),
    body: new BytesBody(new TextEncoder().encode(body)),
  };
}

describe("S3 CopyObject", () => {
  it("copies object", async () => {
    const httpClient = NewClient({
      Method: "PUT",
      URL: "http://test_bucket.example.com/test2",
      Match: (req) =>
        ExpectHeaders(req.headers, {
          "x-amz-copy-source": "test_bucket%2Ftest1",
          Authorization: "^.+Credential=123/.+$",
        }),
      Response: responseWithBody(`
        <?xml version="1.0" encoding="UTF-8"?>
        <CopyObjectResult>
          <LastModified>2025-01-02T03:04:05.123Z</LastModified>
          <ETag>test_etag</ETag>
        </CopyObjectResult>
      `),
    });

    const s3Client = Object.assign(new S3(), {
      Client: httpClient,
      Region: "test_region",
      Bucket: "test_bucket",
      Endpoint: "http://example.com",
      AccessKey: "123",
      SecretKey: "abc",
    });

    const result = await s3Client.CopyObject(null, "test1", "test2");

    const raw = JSON.stringify(result);
    const expected =
      '{"etag":"test_etag","lastModified":"2025-01-02T03:04:05.123Z","checksumType":"","checksumCRC32":"","checksumCRC32C":"","checksumCRC64NVME":"","checksumSHA1":"","checksumSHA256":""}';
    if (raw !== expected) {
      throw new Error(`Expected\n${expected}\ngot\n${raw}`);
    }

    const err = httpClient.AssertNoRemaining();
    if (err) {
      throw err;
    }
  });
});
