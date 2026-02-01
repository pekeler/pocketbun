// Ported from pocketbase/core/event_request_batch_test.go

import { describe, it } from "bun:test";
import { testValidationErrors } from "../../tests/validation_errors.ts";
import { InternalRequest } from "./event_request_batch.ts";

describe("InternalRequest", () => {
  it("validate", () => {
    const scenarios: Array<{ name: string; request: InternalRequest; expectedErrors: string[] }> = [
      {
        name: "empty struct",
        request: new InternalRequest(),
        expectedErrors: ["method", "url"],
      },
      {
        name: "GET method",
        request: new InternalRequest({ url: "test", method: "GET" }),
        expectedErrors: [],
      },
      {
        name: "POST method",
        request: new InternalRequest({ url: "test", method: "POST" }),
        expectedErrors: [],
      },
      {
        name: "PUT method",
        request: new InternalRequest({ url: "test", method: "PUT" }),
        expectedErrors: [],
      },
      {
        name: "PATCH method",
        request: new InternalRequest({ url: "test", method: "PATCH" }),
        expectedErrors: [],
      },
      {
        name: "DELETE method",
        request: new InternalRequest({ url: "test", method: "DELETE" }),
        expectedErrors: [],
      },
      {
        name: "unknown method",
        request: new InternalRequest({ url: "test", method: "unknown" }),
        expectedErrors: ["method"],
      },
      {
        name: "url <= 2000",
        request: new InternalRequest({ url: "a".repeat(2000), method: "GET" }),
        expectedErrors: [],
      },
      {
        name: "url > 2000",
        request: new InternalRequest({ url: "a".repeat(2001), method: "GET" }),
        expectedErrors: ["url"],
      },
    ];

    for (const scenario of scenarios) {
      testValidationErrors(scenario.request.Validate(), scenario.expectedErrors);
    }
  });
});
