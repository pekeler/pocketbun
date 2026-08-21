// Ported from pocketbase/tools/filesystem/internal/s3blob/s3/uploader_test.go

import { describe, it } from "bun:test";
import { S3, Uploader } from "./s3.ts";
import { BytesBody } from "./s3.ts";
import { NewClient } from "./tests/client.ts";
import { ExpectHeaders } from "./tests/headers.ts";

function responseWithBody(body: string, status = 200, headers?: Record<string, string | string[]>) {
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
    status,
    headers: resHeaders,
    body: new BytesBody(new TextEncoder().encode(body)),
  };
}

describe("S3 Uploader", () => {
  it("required fields", async () => {
    const s3Client = Object.assign(new S3(), {
      Client: NewClient({ Method: "PUT", URL: "^.+$" }),
      Region: "test_region",
      Bucket: "test_bucket",
      Endpoint: "http://example.com",
      AccessKey: "123",
      SecretKey: "abc",
    });

    const scenarios = [
      { name: "blank", uploader: new Uploader(), expectedError: true },
      { name: "no Key", uploader: Object.assign(new Uploader(), { S3: s3Client, Payload: "test" }), expectedError: true },
      { name: "no S3", uploader: Object.assign(new Uploader(), { Key: "abc", Payload: "test" }), expectedError: true },
      { name: "no Payload", uploader: Object.assign(new Uploader(), { S3: s3Client, Key: "abc" }), expectedError: true },
      {
        name: "with S3, Key and Payload",
        uploader: Object.assign(new Uploader(), { S3: s3Client, Key: "abc", Payload: "test" }),
        expectedError: false,
      },
    ];

    for (const scenario of scenarios) {
      let err: Error | null = null;
      try {
        await scenario.uploader.Upload(null);
      } catch (error) {
        err = error as Error;
      }

      const hasErr = err !== null;
      if (hasErr !== scenario.expectedError) {
        throw new Error(`Expected hasErr ${scenario.expectedError}, got ${hasErr}`);
      }
    }
  });

  it("single upload", async () => {
    const httpClient = NewClient({
      Method: "PUT",
      URL: "http://test_bucket.example.com/test_key",
      Match: (req) => {
        const body = req.body ? new TextDecoder().decode(req.body) : "";
        return (
          body === "abcdefg" &&
          ExpectHeaders(req.headers, {
            "Content-Length": "7",
            "x-amz-meta-a": "123",
            "x-amz-meta-b": "456",
            test_header: "test",
            Authorization: "^.+Credential=123/.+$",
          })
        );
      },
    });

    const uploader = Object.assign(new Uploader(), {
      S3: Object.assign(new S3(), {
        Client: httpClient,
        Region: "test_region",
        Bucket: "test_bucket",
        Endpoint: "http://example.com",
        AccessKey: "123",
        SecretKey: "abc",
      }),
      Key: "test_key",
      Payload: "abcdefg",
      Metadata: { a: "123", b: "456" },
      MinPartSize: 8,
    });

    await uploader.Upload(null, (req) => req.headers.set("test_header", "test"));

    const err = httpClient.AssertNoRemaining();
    if (err) {
      throw err;
    }
  });

  it("multipart upload success", async () => {
    const maxConcurrencies = [-1, 0, 1, 10];

    for (const mc of maxConcurrencies) {
      const httpClient = NewClient(
        {
          Method: "POST",
          URL: "http://test_bucket.example.com/test_key?uploads",
          Match: (req) =>
            ExpectHeaders(req.headers, {
              "x-amz-meta-a": "123",
              "x-amz-meta-b": "456",
              test_header: "test",
              Authorization: "^.+Credential=123/.+$",
            }),
          Response: responseWithBody(`
            <?xml version="1.0" encoding="UTF-8"?>
            <InitiateMultipartUploadResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
              <Bucket>test_bucket</Bucket>
              <Key>test_key</Key>
              <UploadId kind="multipart">test&amp;id</UploadId>
            </InitiateMultipartUploadResult>
          `),
        },
        {
          Method: "PUT",
          URL: "http://test_bucket.example.com/test_key?partNumber=1&uploadId=test%26id",
          Match: (req) => {
            const body = req.body ? new TextDecoder().decode(req.body) : "";
            return (
              body === "abc" &&
              ExpectHeaders(req.headers, {
                "Content-Length": "3",
                test_header: "test",
                Authorization: "^.+Credential=123/.+$",
              })
            );
          },
          Response: responseWithBody("", 200, { Etag: "etag1" }),
        },
        {
          Method: "PUT",
          URL: "http://test_bucket.example.com/test_key?partNumber=2&uploadId=test%26id",
          Match: (req) => {
            const body = req.body ? new TextDecoder().decode(req.body) : "";
            return (
              body === "def" &&
              ExpectHeaders(req.headers, {
                "Content-Length": "3",
                test_header: "test",
                Authorization: "^.+Credential=123/.+$",
              })
            );
          },
          Response: responseWithBody("", 200, { Etag: "etag2" }),
        },
        {
          Method: "PUT",
          URL: "http://test_bucket.example.com/test_key?partNumber=3&uploadId=test%26id",
          Match: (req) => {
            const body = req.body ? new TextDecoder().decode(req.body) : "";
            return (
              body === "g" &&
              ExpectHeaders(req.headers, {
                "Content-Length": "1",
                test_header: "test",
                Authorization: "^.+Credential=123/.+$",
              })
            );
          },
          Response: responseWithBody("", 200, { Etag: "etag3" }),
        },
        {
          Method: "POST",
          URL: "http://test_bucket.example.com/test_key?uploadId=test%26id",
          Match: (req) => {
            const body = req.body ? new TextDecoder().decode(req.body) : "";
            const expected =
              "<CompleteMultipartUpload><Part><ETag>etag1</ETag><PartNumber>1</PartNumber></Part><Part><ETag>etag2</ETag><PartNumber>2</PartNumber></Part><Part><ETag>etag3</ETag><PartNumber>3</PartNumber></Part></CompleteMultipartUpload>";
            return (
              body.includes(expected) &&
              ExpectHeaders(req.headers, {
                test_header: "test",
                Authorization: "^.+Credential=123/.+$",
              })
            );
          },
        },
      );

      const uploader = Object.assign(new Uploader(), {
        S3: Object.assign(new S3(), {
          Client: httpClient,
          Region: "test_region",
          Bucket: "test_bucket",
          Endpoint: "http://example.com",
          AccessKey: "123",
          SecretKey: "abc",
        }),
        Key: "test_key",
        Payload: "abcdefg",
        Metadata: { a: "123", b: "456" },
        MinPartSize: 3,
        MaxConcurrency: mc,
      });

      await uploader.Upload(null, (req) => req.headers.set("test_header", "test"));

      const err = httpClient.AssertNoRemaining();
      if (err) {
        throw err;
      }
    }
  });

  it("multipart upload part failure", async () => {
    const httpClient = NewClient(
      {
        Method: "POST",
        URL: "http://test_bucket.example.com/test_key?uploads",
        Match: (req) =>
          ExpectHeaders(req.headers, {
            "x-amz-meta-a": "123",
            "x-amz-meta-b": "456",
            test_header: "test",
            Authorization: "^.+Credential=123/.+$",
          }),
        Response: responseWithBody(`
          <?xml version="1.0" encoding="UTF-8"?>
          <InitiateMultipartUploadResult>
            <Bucket>test_bucket</Bucket>
            <Key>test_key</Key>
            <UploadId>test_id</UploadId>
          </InitiateMultipartUploadResult>
        `),
      },
      {
        Method: "PUT",
        URL: "http://test_bucket.example.com/test_key?partNumber=1&uploadId=test_id",
        Match: (req) => {
          const body = req.body ? new TextDecoder().decode(req.body) : "";
          return (
            body === "abc" &&
            ExpectHeaders(req.headers, {
              "Content-Length": "3",
              test_header: "test",
              Authorization: "^.+Credential=123/.+$",
            })
          );
        },
        Response: responseWithBody("", 200, { Etag: "etag1" }),
      },
      {
        Method: "PUT",
        URL: "http://test_bucket.example.com/test_key?partNumber=2&uploadId=test_id",
        Match: (req) =>
          ExpectHeaders(req.headers, {
            test_header: "test",
            Authorization: "^.+Credential=123/.+$",
          }),
        Response: responseWithBody("", 400),
      },
      {
        Method: "DELETE",
        URL: "http://test_bucket.example.com/test_key?uploadId=test_id",
        Match: (req) =>
          ExpectHeaders(req.headers, {
            test_header: "test",
            Authorization: "^.+Credential=123/.+$",
          }),
      },
    );

    const uploader = Object.assign(new Uploader(), {
      S3: Object.assign(new S3(), {
        Client: httpClient,
        Region: "test_region",
        Bucket: "test_bucket",
        Endpoint: "http://example.com",
        AccessKey: "123",
        SecretKey: "abc",
      }),
      Key: "test_key",
      Payload: "abcdefg",
      Metadata: { a: "123", b: "456" },
      MinPartSize: 3,
    });

    let err: Error | null = null;
    try {
      await uploader.Upload(null, (req) => req.headers.set("test_header", "test"));
    } catch (error) {
      err = error as Error;
    }

    if (!err) {
      throw new Error("Expected non-nil error");
    }

    const remaining = httpClient.AssertNoRemaining();
    if (remaining) {
      throw remaining;
    }
  });

  it("multipart upload complete failure", async () => {
    const httpClient = NewClient(
      {
        Method: "POST",
        URL: "http://test_bucket.example.com/test_key?uploads",
        Match: (req) =>
          ExpectHeaders(req.headers, {
            "x-amz-meta-a": "123",
            "x-amz-meta-b": "456",
            test_header: "test",
            Authorization: "^.+Credential=123/.+$",
          }),
        Response: responseWithBody(`
          <?xml version="1.0" encoding="UTF-8"?>
          <InitiateMultipartUploadResult>
            <Bucket>test_bucket</Bucket>
            <Key>test_key</Key>
            <UploadId>test_id</UploadId>
          </InitiateMultipartUploadResult>
        `),
      },
      {
        Method: "PUT",
        URL: "http://test_bucket.example.com/test_key?partNumber=1&uploadId=test_id",
        Match: (req) => {
          const body = req.body ? new TextDecoder().decode(req.body) : "";
          return (
            body === "abc" &&
            ExpectHeaders(req.headers, {
              "Content-Length": "3",
              test_header: "test",
              Authorization: "^.+Credential=123/.+$",
            })
          );
        },
        Response: responseWithBody("", 200, { Etag: "etag1" }),
      },
      {
        Method: "PUT",
        URL: "http://test_bucket.example.com/test_key?partNumber=2&uploadId=test_id",
        Match: (req) => {
          const body = req.body ? new TextDecoder().decode(req.body) : "";
          return (
            body === "def" &&
            ExpectHeaders(req.headers, {
              "Content-Length": "3",
              test_header: "test",
              Authorization: "^.+Credential=123/.+$",
            })
          );
        },
        Response: responseWithBody("", 200, { Etag: "etag2" }),
      },
      {
        Method: "POST",
        URL: "http://test_bucket.example.com/test_key?uploadId=test_id",
        Match: (req) =>
          ExpectHeaders(req.headers, {
            test_header: "test",
            Authorization: "^.+Credential=123/.+$",
          }),
        Response: responseWithBody("", 400),
      },
      {
        Method: "DELETE",
        URL: "http://test_bucket.example.com/test_key?uploadId=test_id",
        Match: (req) =>
          ExpectHeaders(req.headers, {
            test_header: "test",
            Authorization: "^.+Credential=123/.+$",
          }),
      },
    );

    const uploader = Object.assign(new Uploader(), {
      S3: Object.assign(new S3(), {
        Client: httpClient,
        Region: "test_region",
        Bucket: "test_bucket",
        Endpoint: "http://example.com",
        AccessKey: "123",
        SecretKey: "abc",
      }),
      Key: "test_key",
      Payload: "abcdef",
      Metadata: { a: "123", b: "456" },
      MinPartSize: 3,
    });

    let err: Error | null = null;
    try {
      await uploader.Upload(null, (req) => req.headers.set("test_header", "test"));
    } catch (error) {
      err = error as Error;
    }

    if (!err) {
      throw new Error("Expected non-nil error");
    }

    const remaining = httpClient.AssertNoRemaining();
    if (remaining) {
      throw remaining;
    }
  });
});
