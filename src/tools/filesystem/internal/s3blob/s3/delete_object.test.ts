// Ported from pocketbase/tools/filesystem/internal/s3blob/s3/delete_object_test.go

import { describe, it } from "bun:test";
import { S3 } from "./s3.ts";
import { NewClient } from "./tests/client.ts";

describe("S3 DeleteObject", () => {
  it("deletes object", async () => {
    const httpClient = NewClient({
      Method: "DELETE",
      URL: "http://test_bucket.example.com/test_key",
    });

    const s3Client = Object.assign(new S3(), {
      Client: httpClient,
      Region: "test_region",
      Bucket: "test_bucket",
      Endpoint: "http://example.com",
      AccessKey: "123",
      SecretKey: "abc",
    });

    await s3Client.DeleteObject(null, "test_key");

    const err = httpClient.AssertNoRemaining();
    if (err) {
      throw err;
    }
  });
});
