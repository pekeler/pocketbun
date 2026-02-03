// Ported from pocketbase/tools/filesystem/internal/s3blob/s3/error_test.go

import { describe, it } from "bun:test";
import { ResponseError } from "./s3.ts";

function parseResponseErrorXml(raw: string): ResponseError {
  const err = new ResponseError();
  err.Code = extractXmlTag(raw, "Code");
  err.Message = extractXmlTag(raw, "Message");
  err.RequestId = extractXmlTag(raw, "RequestId");
  err.Resource = extractXmlTag(raw, "Resource");
  return err;
}

function extractXmlTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`);
  const match = regex.exec(xml);
  return match?.[1]?.trim() ?? "";
}

describe("ResponseError", () => {
  it("serialization", () => {
    const raw = `
      <?xml version="1.0" encoding="UTF-8"?>
      <Error>
        <Code>test_code</Code>
        <Message>test_message</Message>
        <RequestId>test_request_id</RequestId>
        <Resource>test_resource</Resource>
      </Error>
    `;

    const respErr = new ResponseError();
    respErr.Status = 123;
    respErr.Raw = new TextEncoder().encode("test");

    const parsed = parseResponseErrorXml(raw);
    respErr.Code = parsed.Code;
    respErr.Message = parsed.Message;
    respErr.RequestId = parsed.RequestId;
    respErr.Resource = parsed.Resource;

    const jsonStr = JSON.stringify(respErr);
    const expected =
      '{"code":"test_code","message":"test_message","requestId":"test_request_id","resource":"test_resource","status":123}';

    if (jsonStr !== expected) {
      throw new Error(`Expected JSON\n${expected}\ngot\n${jsonStr}`);
    }
  });

  it("error interface", () => {
    const scenarios = [
      {
        name: "empty",
        err: Object.assign(new ResponseError(), {}),
        expected: "0 S3ResponseError",
      },
      {
        name: "with code and message (nil raw)",
        err: Object.assign(new ResponseError(), {
          Status: 123,
          Code: "test_code",
          Message: "test_message",
        }),
        expected: "123 test_code: test_message",
      },
      {
        name: "with code and message (non-nil raw)",
        err: Object.assign(new ResponseError(), {
          Status: 123,
          Code: "test_code",
          Message: "test_message",
          Raw: new TextEncoder().encode("test_raw"),
        }),
        expected: "123 test_code: test_message\n(RAW: test_raw)",
      },
    ];

    for (const scenario of scenarios) {
      const result = scenario.err.Error();
      if (result !== scenario.expected) {
        throw new Error(`Expected\n${scenario.expected}\ngot\n${result}`);
      }
    }
  });
});
