// Ported from pocketbase/tools/router/error_test.go

import { describe, expect, it } from "bun:test";
import { ErrRequired, ValidationErrors, newError } from "../../internal/compat/validation.ts";
import { NotFoundError } from "../filesystem/filesystem.ts";
import {
  NewApiError,
  NewBadRequestError,
  NewForbiddenError,
  NewInternalServerError,
  NewNotFoundError,
  NewTooManyRequestsError,
  NewUnauthorizedError,
  ToApiError,
} from "./api_error.ts";

class MockSafeErrorItem {
  Code(): string {
    return "mock_code";
  }

  Error(): string {
    return "mock_error";
  }

  Resolve(data: Record<string, unknown>): Record<string, unknown> {
    return { ...data, mock_resolve: 123 };
  }
}

function errorsIs(err: unknown, target: unknown): boolean {
  if (err === target) {
    return true;
  }
  if (err && typeof (err as { Is?: (target: unknown) => boolean }).Is === "function") {
    return (err as { Is: (target: unknown) => boolean }).Is(target);
  }
  const cause = (err as { cause?: unknown })?.cause;
  if (cause) {
    return errorsIs(cause, target);
  }
  return false;
}

describe("api_error", () => {
  it("NewApiError with raw data", () => {
    const err = NewApiError(300, "message_test", "rawData_test");
    const result = JSON.stringify(err);
    const expected = `{"data":{},"message":"Message_test.","status":300}`;

    expect(result).toBe(expected);
    expect(err.Error()).toBe("Message_test.");
    expect(err.RawData()).toBe("rawData_test");
  });

  it("NewApiError with validation data", () => {
    const err = NewApiError(300, "message_test", {
      err1: new Error("test error"),
      err2: ErrRequired,
      err3: new ValidationErrors({
        "err3.1": new Error("test error"),
        "err3.2": ErrRequired,
        "err3.3": new ValidationErrors({
          "err3.3.1": ErrRequired,
        }),
      }),
      err4: new MockSafeErrorItem(),
      err5: { "err5.1": ErrRequired },
    });

    const result = JSON.stringify(err);
    const expected =
      `{"data":{"err1":{"code":"validation_invalid_value","message":"Invalid value."},` +
      `"err2":{"code":"validation_required","message":"Cannot be blank."},` +
      `"err3":{"err3.1":{"code":"validation_invalid_value","message":"Invalid value."},` +
      `"err3.2":{"code":"validation_required","message":"Cannot be blank."},` +
      `"err3.3":{"err3.3.1":{"code":"validation_required","message":"Cannot be blank."}}},` +
      `"err4":{"code":"mock_code","message":"Mock_error.","mock_resolve":123},` +
      `"err5":{"err5.1":{"code":"validation_required","message":"Cannot be blank."}}},` +
      `"message":"Message_test.","status":300}`;

    expect(result).toBe(expected);
    expect(err.Error()).toBe("Message_test.");
    expect(err.RawData()).not.toBeNull();
  });

  it("NewNotFoundError", () => {
    const scenarios = [
      { message: "", data: null, expected: `{"data":{},"message":"The requested resource wasn't found.","status":404}` },
      { message: "demo", data: "rawData_test", expected: `{"data":{},"message":"Demo.","status":404}` },
      {
        message: "demo",
        data: new ValidationErrors({ err1: newError("test_code", "test_message") }),
        expected: `{"data":{"err1":{"code":"test_code","message":"Test_message."}},"message":"Demo.","status":404}`,
      },
    ];

    for (const scenario of scenarios) {
      const err = NewNotFoundError(scenario.message, scenario.data);
      expect(JSON.stringify(err)).toBe(scenario.expected);
    }
  });

  it("NewBadRequestError", () => {
    const scenarios = [
      {
        message: "",
        data: null,
        expected: `{"data":{},"message":"Something went wrong while processing your request.","status":400}`,
      },
      { message: "demo", data: "rawData_test", expected: `{"data":{},"message":"Demo.","status":400}` },
      {
        message: "demo",
        data: new ValidationErrors({ err1: newError("test_code", "test_message") }),
        expected: `{"data":{"err1":{"code":"test_code","message":"Test_message."}},"message":"Demo.","status":400}`,
      },
    ];

    for (const scenario of scenarios) {
      const err = NewBadRequestError(scenario.message, scenario.data);
      expect(JSON.stringify(err)).toBe(scenario.expected);
    }
  });

  it("NewForbiddenError", () => {
    const scenarios = [
      {
        message: "",
        data: null,
        expected: `{"data":{},"message":"You are not allowed to perform this request.","status":403}`,
      },
      { message: "demo", data: "rawData_test", expected: `{"data":{},"message":"Demo.","status":403}` },
      {
        message: "demo",
        data: new ValidationErrors({ err1: newError("test_code", "test_message") }),
        expected: `{"data":{"err1":{"code":"test_code","message":"Test_message."}},"message":"Demo.","status":403}`,
      },
    ];

    for (const scenario of scenarios) {
      const err = NewForbiddenError(scenario.message, scenario.data);
      expect(JSON.stringify(err)).toBe(scenario.expected);
    }
  });

  it("NewUnauthorizedError", () => {
    const scenarios = [
      { message: "", data: null, expected: `{"data":{},"message":"Missing or invalid authentication.","status":401}` },
      { message: "demo", data: "rawData_test", expected: `{"data":{},"message":"Demo.","status":401}` },
      {
        message: "demo",
        data: new ValidationErrors({ err1: newError("test_code", "test_message") }),
        expected: `{"data":{"err1":{"code":"test_code","message":"Test_message."}},"message":"Demo.","status":401}`,
      },
    ];

    for (const scenario of scenarios) {
      const err = NewUnauthorizedError(scenario.message, scenario.data);
      expect(JSON.stringify(err)).toBe(scenario.expected);
    }
  });

  it("NewInternalServerError", () => {
    const scenarios = [
      {
        message: "",
        data: null,
        expected: `{"data":{},"message":"Something went wrong while processing your request.","status":500}`,
      },
      { message: "demo", data: "rawData_test", expected: `{"data":{},"message":"Demo.","status":500}` },
      {
        message: "demo",
        data: new ValidationErrors({ err1: newError("test_code", "test_message") }),
        expected: `{"data":{"err1":{"code":"test_code","message":"Test_message."}},"message":"Demo.","status":500}`,
      },
    ];

    for (const scenario of scenarios) {
      const err = NewInternalServerError(scenario.message, scenario.data);
      expect(JSON.stringify(err)).toBe(scenario.expected);
    }
  });

  it("NewTooManyRequestsError", () => {
    const scenarios = [
      { message: "", data: null, expected: `{"data":{},"message":"Too Many Requests.","status":429}` },
      { message: "demo", data: "rawData_test", expected: `{"data":{},"message":"Demo.","status":429}` },
      {
        message: "demo",
        data: new ValidationErrors({ err1: newError("test_code", "test_message").SetParams({ test: 123 }) }),
        expected: `{"data":{"err1":{"code":"test_code","message":"Test_message.","params":{"test":123}}},"message":"Demo.","status":429}`,
      },
    ];

    for (const scenario of scenarios) {
      const err = NewTooManyRequestsError(scenario.message, scenario.data);
      expect(JSON.stringify(err)).toBe(scenario.expected);
    }
  });

  it("ApiError.Is", () => {
    const err0 = NewInternalServerError("", null);
    const err1 = NewInternalServerError("", null);
    const err2 = new Error("test");
    const err3 = new Error("wrapped", { cause: err0 });

    const scenarios = [
      { err: err0, target: null, expected: false },
      { err: err0, target: err1, expected: false },
      { err: err0, target: err2, expected: false },
      { err: err0, target: err0, expected: true },
      { err: err3, target: err0, expected: true },
    ];

    for (const scenario of scenarios) {
      const result = errorsIs(scenario.err, scenario.target);
      expect(result).toBe(scenario.expected);
    }
  });

  it("ToApiError", () => {
    const scenarios = [
      {
        name: "regular error",
        err: new Error("test"),
        expected: `{"data":{},"message":"Something went wrong while processing your request.","status":400}`,
      },
      {
        name: "NotFoundError",
        err: new NotFoundError(),
        expected: `{"data":{},"message":"The requested resource wasn't found.","status":404}`,
      },
      {
        name: "sql.ErrNoRows",
        err: new Error("sql: no rows in result set"),
        expected: `{"data":{},"message":"The requested resource wasn't found.","status":404}`,
      },
      {
        name: "ApiError",
        err: NewForbiddenError("test", null),
        expected: `{"data":{},"message":"Test.","status":403}`,
      },
      {
        name: "wrapped ApiError",
        err: new Error("wrapped", { cause: NewForbiddenError("test", null) }),
        expected: `{"data":{},"message":"Test.","status":403}`,
      },
    ];

    for (const scenario of scenarios) {
      const result = JSON.stringify(ToApiError(scenario.err));
      expect(result).toBe(scenario.expected);
    }
  });
});
