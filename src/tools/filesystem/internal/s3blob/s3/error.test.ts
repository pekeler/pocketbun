// Ported from pocketbase/tools/filesystem/internal/s3blob/s3/error_test.go

import { describe, expect, it } from "bun:test";
import { parseResponseErrorXml, ResponseError } from "./error.ts";

describe("ResponseError", () => {
  it.serial("serialization", () => {
    const raw = `
      <?xml version="1.0" encoding="UTF-8"?>
      <Error xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
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

    expect(JSON.parse(JSON.stringify(respErr))).toMatchSnapshot("serialization");
  });

  it("parses namespaces, attributes, entities, and empty tags", () => {
    const parsed = parseResponseErrorXml(`
      <s3:Error xmlns:s3="http://s3.amazonaws.com/doc/2006-03-01/">
        <s3:Code retryable="false">Invalid&amp;Code</s3:Code>
        <s3:Message>bad &lt;request&gt;</s3:Message>
        <s3:RequestId>request-id</s3:RequestId>
        <s3:Resource/>
      </s3:Error>
    `);

    expect(parsed).toEqual({
      Code: "Invalid&Code",
      Message: "bad <request>",
      RequestId: "request-id",
      Resource: "",
    });
  });

  it("rejects malformed XML", () => {
    expect(() => parseResponseErrorXml("<Error><Code>broken</Error>")).toThrow(SyntaxError);
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
