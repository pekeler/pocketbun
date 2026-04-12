// Ported from pocketbase/tools/filesystem/internal/s3blob/s3/get_object_test.go

import { describe, expect, it } from "bun:test";
import { S3 } from "./s3.ts";
import { BytesBody } from "./s3.ts";
import { NewClient } from "./tests/client.ts";
import { ExpectHeaders } from "./tests/headers.ts";

function responseWithBody(body: string, headers?: Record<string, string | string[]>) {
  const resHeaders = new Headers();
  if (headers) {
    for (const [key, value] of Object.entries(headers)) {
      if (Array.isArray(value)) {
        for (const entry of value) {
          resHeaders.append(key, entry);
        }
      } else {
        resHeaders.set(key, value);
      }
    }
  }

  return {
    status: 200,
    headers: resHeaders,
    body: new BytesBody(new TextEncoder().encode(body)),
  };
}

describe("S3 GetObject", () => {
  it.serial("retrieves object", async () => {
    const httpClient = NewClient({
      Method: "GET",
      URL: "http://test_bucket.example.com/test_key",
      Match: (req) =>
        ExpectHeaders(req.headers, {
          test_header: "test",
          Authorization: "^.+Credential=123/.+$",
        }),
      Response: responseWithBody("test", {
        "Last-Modified": "Mon, 01 Feb 2025 03:04:05 GMT",
        "Cache-Control": "test_cache",
        "Content-Disposition": "test_disposition",
        "Content-Encoding": "test_encoding",
        "Content-Language": "test_language",
        "Content-Type": "test_type",
        "Content-Range": "test_range",
        Etag: "test_etag",
        "Content-Length": "100",
        "x-amz-meta-AbC": "test_meta_a",
        "x-amz-meta-Def": "test_meta_b",
      }),
    });

    const s3Client = Object.assign(new S3(), {
      Client: httpClient,
      Region: "test_region",
      Bucket: "test_bucket",
      Endpoint: "http://example.com",
      AccessKey: "123",
      SecretKey: "abc",
    });

    const resp = await s3Client.GetObject(null, "test_key", (req) => {
      req.headers.set("test_header", "test");
    });

    const bodyStr = new TextDecoder().decode(resp.Body.readAll());
    if (bodyStr !== "test") {
      throw new Error(`Expected body\n${JSON.stringify("test")}\ngot\n${JSON.stringify(bodyStr)}`);
    }

    expect(JSON.parse(JSON.stringify(resp))).toMatchSnapshot("response");

    const err = httpClient.AssertNoRemaining();
    if (err) {
      throw err;
    }
  });
});
