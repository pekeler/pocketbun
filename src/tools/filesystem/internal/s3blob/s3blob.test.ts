// Ported from pocketbase/tools/filesystem/internal/s3blob/s3blob_test.go

import { describe, it } from "bun:test";
import { ErrNotFound, type ListOptions, type WriterOptions } from "../../blob/driver.ts";
import { BytesBody, ResponseError, S3 } from "./s3/s3.ts";
import { NewClient } from "./s3/tests/client.ts";
import { ExpectHeaders } from "./s3/tests/headers.ts";
import { New } from "./s3blob.ts";

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

function isError(err: unknown, target: Error): boolean {
  if (err === target) {
    return true;
  }
  if (err instanceof AggregateError) {
    return err.errors.some((entry) => isError(entry, target));
  }
  const cause = (err as { cause?: unknown }).cause;
  if (cause instanceof Error) {
    return isError(cause, target);
  }
  return false;
}

describe("s3blob", () => {
  it("New", async () => {
    const scenarios = [
      { name: "blank", s3Client: Object.assign(new S3(), {}), expectError: true },
      { name: "no bucket", s3Client: Object.assign(new S3(), { Region: "b", Endpoint: "c" }), expectError: true },
      { name: "no endpoint", s3Client: Object.assign(new S3(), { Bucket: "a", Region: "b" }), expectError: true },
      { name: "no region", s3Client: Object.assign(new S3(), { Bucket: "a", Endpoint: "c" }), expectError: true },
      {
        name: "with bucket, endpoint and region",
        s3Client: Object.assign(new S3(), { Bucket: "a", Region: "b", Endpoint: "c" }),
        expectError: false,
      },
    ];

    for (const scenario of scenarios) {
      let err: Error | null = null;
      let drv = null;
      try {
        drv = await New(scenario.s3Client);
      } catch (error) {
        err = error as Error;
      }

      const hasErr = err !== null;
      if (hasErr !== scenario.expectError) {
        throw new Error(`Expected hasErr ${scenario.expectError}, got ${hasErr}`);
      }

      if (!err && !drv) {
        throw new Error("Expected non-nil driver instance");
      }
    }
  });

  it("Driver Close", async () => {
    const drv = await New(Object.assign(new S3(), { Bucket: "a", Region: "b", Endpoint: "c" }));
    await drv.Close();
  });

  it("Driver NormalizeError", async () => {
    const drv = await New(Object.assign(new S3(), { Bucket: "a", Region: "b", Endpoint: "c" }));

    const scenarios = [
      { name: "plain error", err: new Error("test"), expectErrNotFound: false },
      {
        name: "response error with only status (non-404)",
        err: Object.assign(new ResponseError(), { Status: 123 }),
        expectErrNotFound: false,
      },
      {
        name: "response error with only status (404)",
        err: Object.assign(new ResponseError(), { Status: 404 }),
        expectErrNotFound: true,
      },
      {
        name: "response error with custom code",
        err: Object.assign(new ResponseError(), { Code: "test" }),
        expectErrNotFound: false,
      },
      {
        name: "response error with NoSuchBucket code",
        err: Object.assign(new ResponseError(), { Code: "NoSuchBucket" }),
        expectErrNotFound: true,
      },
      {
        name: "response error with NoSuchKey code",
        err: Object.assign(new ResponseError(), { Code: "NoSuchKey" }),
        expectErrNotFound: true,
      },
      {
        name: "response error with NotFound code",
        err: Object.assign(new ResponseError(), { Code: "NotFound" }),
        expectErrNotFound: true,
      },
      {
        name: "wrapped response error with NotFound code",
        err: new AggregateError([Object.assign(new ResponseError(), { Code: "NotFound" })]),
        expectErrNotFound: true,
      },
      { name: "already normalized error", err: new AggregateError([new Error("test"), ErrNotFound]), expectErrNotFound: true },
    ];

    for (const scenario of scenarios) {
      const result = drv.NormalizeError(scenario.err as Error);
      const isErrNotFound = isError(result, ErrNotFound);
      if (isErrNotFound !== scenario.expectErrNotFound) {
        throw new Error(`Expected isErrNotFound ${scenario.expectErrNotFound}, got ${isErrNotFound}`);
      }
    }
  });

  it("Driver Delete escaping", async () => {
    const httpClient = NewClient({
      Method: "DELETE",
      URL: "https://test_bucket.example.com/..__0x2f__abc/test/",
    });

    const drv = await New(
      Object.assign(new S3(), {
        Bucket: "test_bucket",
        Region: "test_region",
        Endpoint: "https://example.com",
        Client: httpClient,
      }),
    );

    await drv.Delete(null, "../abc/test/");

    const err = httpClient.AssertNoRemaining();
    if (err) {
      throw err;
    }
  });

  it("Driver Copy escaping", async () => {
    const httpClient = NewClient({
      Method: "PUT",
      URL: "https://test_bucket.example.com/..__0x2f__a/",
      Match: (req) =>
        ExpectHeaders(req.headers, {
          "x-amz-copy-source": "test_bucket%2F..__0x2f__b%2F",
        }),
      Response: responseWithBody("<CopyObjectResult></CopyObjectResult>"),
    });

    const drv = await New(
      Object.assign(new S3(), {
        Bucket: "test_bucket",
        Region: "test_region",
        Endpoint: "https://example.com",
        Client: httpClient,
      }),
    );

    await drv.Copy(null, "../a/", "../b/");

    const err = httpClient.AssertNoRemaining();
    if (err) {
      throw err;
    }
  });

  it("Driver Attributes", async () => {
    const httpClient = NewClient({
      Method: "HEAD",
      URL: "https://test_bucket.example.com/..__0x2f__a/",
      Response: responseWithBody("", 200, {
        "Last-Modified": "Mon, 01 Feb 2025 03:04:05 GMT",
        "Cache-Control": "test_cache",
        "Content-Disposition": "test_disposition",
        "Content-Encoding": "test_encoding",
        "Content-Language": "test_language",
        "Content-Type": "test_type",
        "Content-Range": "test_range",
        Etag: '"ce5be8b6f53645c596306c4572ece521"',
        "Content-Length": "100",
        "x-amz-meta-AbC%40": "%40test_meta_a",
        "x-amz-meta-Def": "test_meta_b",
      }),
    });

    const drv = await New(
      Object.assign(new S3(), {
        Bucket: "test_bucket",
        Region: "test_region",
        Endpoint: "https://example.com",
        Client: httpClient,
      }),
    );

    const attrs = await drv.Attributes(null, "../a/");
    const raw = JSON.stringify(attrs);
    const expected =
      '{"cacheControl":"test_cache","contentDisposition":"test_disposition","contentEncoding":"test_encoding","contentLanguage":"test_language","contentType":"test_type","metadata":{"abc@":"@test_meta_a","def":"test_meta_b"},"createTime":"0001-01-01T00:00:00Z","modTime":"2025-02-01T03:04:05Z","size":100,"md5":"zlvotvU2RcWWMGxFcuzlIQ==","etag":"\\\"ce5be8b6f53645c596306c4572ece521\\\""}';

    if (raw !== expected) {
      throw new Error(`Expected attributes\n${expected}\ngot\n${raw}`);
    }

    const err = httpClient.AssertNoRemaining();
    if (err) {
      throw err;
    }
  });

  it("Driver ListPaged", async () => {
    const listResponse = () =>
      responseWithBody(`
      <?xml version="1.0" encoding="UTF-8"?>
      <ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
        <Name>example</Name>
        <ContinuationToken>ct</ContinuationToken>
        <NextContinuationToken>test_next</NextContinuationToken>
        <StartAfter>example0.txt</StartAfter>
        <KeyCount>1</KeyCount>
        <MaxKeys>3</MaxKeys>
        <Contents>
          <Key>..__0x2f__prefixB/test/example.txt</Key>
          <LastModified>2025-01-01T01:02:03.123Z</LastModified>
          <ETag>"ce5be8b6f53645c596306c4572ece521"</ETag>
          <Size>123</Size>
        </Contents>
        <Contents>
          <Key>prefixA/..__0x2f__escape.txt</Key>
          <LastModified>2025-01-02T01:02:03.123Z</LastModified>
          <Size>456</Size>
        </Contents>
        <CommonPrefixes>
          <Prefix>prefixA</Prefix>
        </CommonPrefixes>
        <CommonPrefixes>
          <Prefix>..__0x2f__prefixB</Prefix>
        </CommonPrefixes>
      </ListBucketResult>
    `);

    const expectedPage =
      '{"objects":[{"key":"../prefixB","modTime":"0001-01-01T00:00:00Z","size":0,"md5":null,"isDir":true},{"key":"../prefixB/test/example.txt","modTime":"2025-01-01T01:02:03.123Z","size":123,"md5":"zlvotvU2RcWWMGxFcuzlIQ==","isDir":false},{"key":"prefixA","modTime":"0001-01-01T00:00:00Z","size":0,"md5":null,"isDir":true},{"key":"prefixA/../escape.txt","modTime":"2025-01-02T01:02:03.123Z","size":456,"md5":null,"isDir":false}],"nextPageToken":"dGVzdF9uZXh0"}';

    const httpClient = NewClient(
      {
        Method: "GET",
        URL: "https://test_bucket.example.com/?list-type=2&max-keys=1000",
        Response: listResponse(),
      },
      {
        Method: "GET",
        URL: "https://test_bucket.example.com/?continuation-token=test_token&delimiter=test_delimiter&list-type=2&max-keys=123&prefix=test_prefix",
        Response: listResponse(),
      },
    );

    const drv = await New(
      Object.assign(new S3(), {
        Bucket: "test_bucket",
        Region: "test_region",
        Endpoint: "https://example.com",
        Client: httpClient,
      }),
    );

    const scenarios: Array<{ name: string; opts: ListOptions; expected: string }> = [
      {
        name: "empty options",
        opts: { Prefix: "", Delimiter: "", PageSize: 0, PageToken: new Uint8Array() },
        expected: expectedPage,
      },
      {
        name: "filled options",
        opts: {
          Prefix: "test_prefix",
          Delimiter: "test_delimiter",
          PageSize: 123,
          PageToken: new TextEncoder().encode("test_token"),
        },
        expected: expectedPage,
      },
    ];

    for (const scenario of scenarios) {
      const page = await drv.ListPaged(null, scenario.opts);
      const raw = JSON.stringify(page);
      if (raw !== scenario.expected) {
        throw new Error(`Expected page result\n${scenario.expected}\ngot\n${raw}`);
      }
    }

    const err = httpClient.AssertNoRemaining();
    if (err) {
      throw err;
    }
  });

  it("Driver NewRangeReader", async () => {
    const scenarios = [
      {
        offset: 0,
        length: 0,
        httpClient: NewClient({
          Method: "GET",
          URL: "https://test_bucket.example.com/..__0x2f__abc/test.txt",
          Match: (req) => ExpectHeaders(req.headers, { Range: "bytes=0-0" }),
          Response: responseWithBody("test", 200, {
            "Last-Modified": "Mon, 01 Feb 2025 03:04:05 GMT",
            "Content-Type": "test_ct",
            "Content-Length": "123",
          }),
        }),
        expectedAttrs: '{"contentType":"test_ct","modTime":"2025-02-01T03:04:05Z","size":123}',
      },
      {
        offset: 10,
        length: -1,
        httpClient: NewClient({
          Method: "GET",
          URL: "https://test_bucket.example.com/..__0x2f__abc/test.txt",
          Match: (req) => ExpectHeaders(req.headers, { Range: "bytes=10-" }),
          Response: responseWithBody("test", 200, {
            "Last-Modified": "Mon, 01 Feb 2025 03:04:05 GMT",
            "Content-Type": "test_ct",
            "Content-Range": "bytes 1-1/456",
            "Content-Length": "123",
          }),
        }),
        expectedAttrs: '{"contentType":"test_ct","modTime":"2025-02-01T03:04:05Z","size":456}',
      },
      {
        offset: 10,
        length: 0,
        httpClient: NewClient({
          Method: "GET",
          URL: "https://test_bucket.example.com/..__0x2f__abc/test.txt",
          Match: (req) => ExpectHeaders(req.headers, { Range: "bytes=10-10" }),
          Response: responseWithBody("test", 200, {
            "Last-Modified": "Mon, 01 Feb 2025 03:04:05 GMT",
            "Content-Type": "test_ct",
          }),
        }),
        expectedAttrs: '{"contentType":"test_ct","modTime":"2025-02-01T03:04:05Z","size":0}',
      },
      {
        offset: 10,
        length: 20,
        httpClient: NewClient({
          Method: "GET",
          URL: "https://test_bucket.example.com/..__0x2f__abc/test.txt",
          Match: (req) => ExpectHeaders(req.headers, { Range: "bytes=10-29" }),
          Response: responseWithBody("test", 200, {
            "Last-Modified": "Mon, 01 Feb 2025 03:04:05 GMT",
            "Content-Type": "test_ct",
            "Content-Range": "bytes invalid-456",
            "Content-Length": "123",
          }),
        }),
        expectedAttrs: '{"contentType":"test_ct","modTime":"2025-02-01T03:04:05Z","size":123}',
      },
    ];

    for (const scenario of scenarios) {
      const drv = await New(
        Object.assign(new S3(), {
          Bucket: "test_bucket",
          Region: "tesst_region",
          Endpoint: "https://example.com",
          Client: scenario.httpClient,
        }),
      );

      const reader = await drv.NewRangeReader(null, "../abc/test.txt", scenario.offset, scenario.length);

      if (scenario.length === 0) {
        const chunk = reader.read(1);
        if (chunk !== null) {
          throw new Error(`Expected empty body, got ${chunk.length}`);
        }
      }

      const rawAttrs = JSON.stringify(reader.Attributes());
      if (rawAttrs !== scenario.expectedAttrs) {
        throw new Error(`Expected attributes\n${scenario.expectedAttrs}\ngot\n${rawAttrs}`);
      }

      const err = scenario.httpClient.AssertNoRemaining();
      if (err) {
        throw err;
      }
    }
  });

  it("Driver NewTypedWriter", async () => {
    const httpClient = NewClient({
      Method: "PUT",
      URL: "https://test_bucket.example.com/..__0x2f__abc/test/",
      Match: (req) => {
        const body = req.body ? new TextDecoder().decode(req.body) : "";
        return (
          body === "test" &&
          ExpectHeaders(req.headers, {
            "cache-control": "test_cache_control",
            "content-disposition": "test_content_disposition",
            "content-encoding": "test_content_encoding",
            "content-language": "test_content_language",
            "content-type": "test_ct",
            "content-md5": "dGVzdA==",
          })
        );
      },
    });

    const drv = await New(
      Object.assign(new S3(), {
        Bucket: "test_bucket",
        Region: "test_region",
        Endpoint: "https://example.com",
        Client: httpClient,
      }),
    );

    const options: WriterOptions = {
      CacheControl: "test_cache_control",
      ContentDisposition: "test_content_disposition",
      ContentEncoding: "test_content_encoding",
      ContentLanguage: "test_content_language",
      ContentType: "test_content_type",
      DisableContentTypeDetection: false,
      ContentMD5: new TextEncoder().encode("test"),
      Metadata: { "@test_meta_a": "@test" },
      BufferSize: 0,
      MaxConcurrency: 0,
    };

    const writer = await drv.NewTypedWriter(null, "../abc/test/", "test_ct", options);
    let n = writer.write(null);
    if (n !== 0) {
      throw new Error(`Expected nil write to result in 0 written bytes, got ${n}`);
    }

    n = writer.write(new TextEncoder().encode("test"));
    if (n !== 4) {
      throw new Error(`Expected write to result in 4 written bytes, got ${n}`);
    }

    await writer.close();

    const err = httpClient.AssertNoRemaining();
    if (err) {
      throw err;
    }
  });
});
