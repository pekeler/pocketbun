// Ported from pocketbase/tools/filesystem/internal/s3blob/s3/s3_test.go

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

describe("S3", () => {
  it("URL", () => {
    const path = "/test_key/a/b c@d?a=@1&b=!2#@a b c";
    const expectedPath = "/test_key/a/b%20c%40d?a=@1&b=!2#@a b c";

    const scenarios = [
      {
        name: "no schema",
        s3Client: Object.assign(new S3(), {
          Region: "test_region",
          Bucket: "test_bucket",
          Endpoint: "example.com/",
          AccessKey: "123",
          SecretKey: "abc",
        }),
        expected: `https://test_bucket.example.com${expectedPath}`,
      },
      {
        name: "with https schema",
        s3Client: Object.assign(new S3(), {
          Region: "test_region",
          Bucket: "test_bucket",
          Endpoint: "https://example.com/",
          AccessKey: "123",
          SecretKey: "abc",
        }),
        expected: `https://test_bucket.example.com${expectedPath}`,
      },
      {
        name: "with http schema",
        s3Client: Object.assign(new S3(), {
          Region: "test_region",
          Bucket: "test_bucket",
          Endpoint: "http://example.com/",
          AccessKey: "123",
          SecretKey: "abc",
        }),
        expected: `http://test_bucket.example.com${expectedPath}`,
      },
      {
        name: "path style addressing (non-explicit schema)",
        s3Client: Object.assign(new S3(), {
          Region: "test_region",
          Bucket: "test_bucket",
          Endpoint: "example.com/",
          AccessKey: "123",
          SecretKey: "abc",
          UsePathStyle: true,
        }),
        expected: `https://example.com/test_bucket${expectedPath}`,
      },
      {
        name: "path style addressing (explicit schema)",
        s3Client: Object.assign(new S3(), {
          Region: "test_region",
          Bucket: "test_bucket",
          Endpoint: "http://example.com/",
          AccessKey: "123",
          SecretKey: "abc",
          UsePathStyle: true,
        }),
        expected: `http://example.com/test_bucket${expectedPath}`,
      },
    ];

    for (const scenario of scenarios) {
      const result = scenario.s3Client.URL(path);
      if (result !== scenario.expected) {
        throw new Error(`Expected URL\n${scenario.expected}\ngot\n${result}`);
      }
    }
  });

  it("SignAndSend", async () => {
    const scenarios: Array<{
      name: string;
      path: string;
      reqFunc: (req: { headers: Headers }) => void;
      s3Client: S3;
    }> = [
      {
        name: "minimal",
        path: "/test",
        reqFunc: (req) => {
          req.headers.set("x-amz-date", "20250102T150405Z");
        },
        s3Client: Object.assign(new S3(), {
          Region: "test_region",
          Bucket: "test_bucket",
          Endpoint: "https://example.com/",
          AccessKey: "123",
          SecretKey: "abc",
          Client: NewClient({
            Method: "GET",
            URL: "https://test_bucket.example.com/test",
            Response: responseWithBody("test_response"),
            Match: (req) =>
              ExpectHeaders(req.headers, {
                Authorization:
                  "AWS4-HMAC-SHA256 Credential=123/20250102/test_region/s3/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=ea093662bc1deef08dfb4ac35453dfaad5ea89edf102e9dd3b7156c9a27e4c1f",
                Host: "test_bucket.example.com",
                "Accept-Encoding": "identity",
                "X-Amz-Content-Sha256": "UNSIGNED-PAYLOAD",
                "X-Amz-Date": "20250102T150405Z",
              }),
          }),
        }),
      },
      {
        name: "minimal with different access and secret keys",
        path: "/test",
        reqFunc: (req) => {
          req.headers.set("x-amz-date", "20250102T150405Z");
        },
        s3Client: Object.assign(new S3(), {
          Region: "test_region",
          Bucket: "test_bucket",
          Endpoint: "https://example.com/",
          AccessKey: "456",
          SecretKey: "def",
          Client: NewClient({
            Method: "GET",
            URL: "https://test_bucket.example.com/test",
            Response: responseWithBody("test_response"),
            Match: (req) =>
              ExpectHeaders(req.headers, {
                Authorization:
                  "AWS4-HMAC-SHA256 Credential=456/20250102/test_region/s3/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=17510fa1f724403dd0a563b61c9b31d1d718f877fcbd75455620d17a8afce5fb",
                Host: "test_bucket.example.com",
                "Accept-Encoding": "identity",
                "X-Amz-Content-Sha256": "UNSIGNED-PAYLOAD",
                "X-Amz-Date": "20250102T150405Z",
              }),
          }),
        }),
      },
      {
        name: "minimal with special characters",
        path: "/ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 -_.~!@&*():=$()?a=1&@b=@2#@a b c",
        reqFunc: (req) => {
          req.headers.set("x-amz-date", "20250102T150405Z");
        },
        s3Client: Object.assign(new S3(), {
          Region: "test_region",
          Bucket: "test_bucket",
          Endpoint: "https://example.com/",
          AccessKey: "456",
          SecretKey: "def",
          Client: NewClient({
            Method: "GET",
            URL: "https://test_bucket.example.com/ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789%20-_.~%21%40%26%2A%28%29%3A%3D%24%28%29?a=1&@b=@2#@a%20b%20c",
            Response: responseWithBody("test_response"),
            Match: (req) =>
              ExpectHeaders(req.headers, {
                Authorization:
                  "AWS4-HMAC-SHA256 Credential=456/20250102/test_region/s3/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=9458a033554f52913801b3de16f54409b36ed25c6da3aed14e64439500e2c5e1",
                Host: "test_bucket.example.com",
                "Accept-Encoding": "identity",
                "X-Amz-Content-Sha256": "UNSIGNED-PAYLOAD",
                "X-Amz-Date": "20250102T150405Z",
              }),
          }),
        }),
      },
      {
        name: "with extra headers",
        path: "/test",
        reqFunc: (req) => {
          req.headers.set("x-amz-date", "20250102T150405Z");
          req.headers.set("x-amz-content-sha256", "test_sha256");
          req.headers.set("x-amz-example", "123");
          req.headers.set("x-amz-meta-a", "456");
          req.headers.set("content-type", "image/png");
          req.headers.set("accept-encoding", "custom");
          req.headers.set("x-test", "789");
        },
        s3Client: Object.assign(new S3(), {
          Region: "test_region",
          Bucket: "test_bucket",
          Endpoint: "https://example.com/",
          AccessKey: "123",
          SecretKey: "abc",
          Client: NewClient({
            Method: "GET",
            URL: "https://test_bucket.example.com/test",
            Response: responseWithBody("test_response"),
            Match: (req) =>
              ExpectHeaders(req.headers, {
                Authorization:
                  "AWS4-HMAC-SHA256 Credential=123/20250102/test_region/s3/aws4_request, SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date;x-amz-example;x-amz-meta-a, Signature=86dccbcd012c33073dc99e9d0a9e0b717a4d8c11c37848cfa9a4a02716bc0db3",
                Host: "test_bucket.example.com",
                "Accept-Encoding": "custom",
                "X-Amz-Content-Sha256": "test_sha256",
                "X-Amz-Date": "20250102T150405Z",
                "X-Test": "789",
              }),
          }),
        }),
      },
    ];

    for (const scenario of scenarios) {
      const req = {
        headers: new Headers(),
      };
      scenario.reqFunc(req);

      const request = {
        method: "GET",
        url: scenario.s3Client.URL(scenario.path),
        headers: req.headers,
        body: null,
      };

      await scenario.s3Client.SignAndSend(request);

      const client = scenario.s3Client.Client as ReturnType<typeof NewClient>;
      const err = client.AssertNoRemaining();
      if (err) {
        throw err;
      }
    }
  });
});
