// Ported from pocketbase/tools/filesystem/internal/s3blob/s3/list_objects_test.go

import { describe, expect, it } from "bun:test";
import { S3, type ListParams } from "./s3.ts";
import { BytesBody } from "./s3.ts";
import { NewClient } from "./tests/client.ts";

function responseWithBody(body: string) {
  return {
    status: 200,
    headers: new Headers(),
    body: new BytesBody(new TextEncoder().encode(body)),
  };
}

describe("S3 ListObjects", () => {
  it.serial("retrieves list", async () => {
    const listResponse = responseWithBody(`
      <?xml version="1.0" encoding="UTF-8"?>
      <ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
        <Name>example</Name>
        <ContinuationToken>ct</ContinuationToken>
        <NextContinuationToken>test_next</NextContinuationToken>
        <StartAfter>example0.txt</StartAfter>
        <KeyCount>1</KeyCount>
        <MaxKeys>3</MaxKeys>
        <Contents>
          <Key>prefixB/test/example.txt</Key>
          <LastModified>2025-01-01T01:02:03.123Z</LastModified>
          <ETag>etag1</ETag>
          <Size>123</Size>
        </Contents>
        <Contents>
          <Key>prefixA/escape.txt</Key>
          <LastModified>2025-01-02T01:02:03.123Z</LastModified>
          <Size>456</Size>
        </Contents>
        <CommonPrefixes>
          <Prefix>prefixA</Prefix>
        </CommonPrefixes>
        <CommonPrefixes>
          <Prefix>prefixB</Prefix>
        </CommonPrefixes>
      </ListBucketResult>
    `);

    const httpClient = NewClient({
      Method: "GET",
      URL: "http://test_bucket.example.com/?list-type=2&max-keys=1000",
      Response: listResponse,
    });

    const s3Client = Object.assign(new S3(), {
      Client: httpClient,
      Region: "test_region",
      Bucket: "test_bucket",
      Endpoint: "http://example.com",
      AccessKey: "123",
      SecretKey: "abc",
    });

    const params: ListParams = {
      ContinuationToken: "",
      Delimiter: "",
      Prefix: "",
      EncodingType: "",
      StartAfter: "",
      MaxKeys: 1000,
      FetchOwner: false,
    };

    const resp = await s3Client.ListObjects(null, params);

    expect(JSON.parse(JSON.stringify(resp))).toMatchSnapshot("response");

    const err = httpClient.AssertNoRemaining();
    if (err) {
      throw err;
    }
  });
});
