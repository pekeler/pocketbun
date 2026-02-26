// PocketBun-only: regression tests for internal validation helpers.
//
// Why this file exists:
// `src/internal/compat/validation.ts` is a PocketBun replacement for selected
// ozzo-validation primitives used across forms and model validators.

import { describe, expect, it } from "bun:test";
import { ErrRequired, ValidationError, ValidationErrors, isEmptyValue, newError, required } from "./validation.ts";

describe("validation helpers", () => {
  describe("ValidationError", () => {
    it("exposes code/message/params helpers", () => {
      const err = new ValidationError("test_code", "test message");
      expect(err.Error()).toBe("test message");
      expect(err.Code()).toBe("test_code");
      expect(err.Message()).toBe("test message");
      expect(err.Params()).toEqual({});

      err.setParams({ a: 1 });
      expect(err.Params()).toEqual({ a: 1 });
      err.SetParams({ b: 2 });
      expect(err.Params()).toEqual({ b: 2 });
    });

    it("creates new errors via helper", () => {
      const err = newError("sample", "sample message");
      expect(err).toBeInstanceOf(ValidationError);
      expect(err.code).toBe("sample");
      expect(err.message).toBe("sample message");
    });
  });

  describe("required", () => {
    it("returns ErrRequired for zero values", () => {
      expect(required(null)).toBe(ErrRequired);
      expect(required(undefined)).toBe(ErrRequired);
      expect(required("")).toBe(ErrRequired);
      expect(required(false)).toBe(ErrRequired);
      expect(required(0)).toBe(ErrRequired);
      expect(required(0n)).toBe(ErrRequired);
      expect(required([])).toBe(ErrRequired);
      expect(required({ length: 0 })).toBe(ErrRequired);
      expect(required({ size: 0 })).toBe(ErrRequired);
      expect(required({ isZero: () => true })).toBe(ErrRequired);
      expect(required({ IsZero: () => true })).toBe(ErrRequired);
    });

    it("accepts non-zero values", () => {
      expect(required("x")).toBeNull();
      expect(required(true)).toBeNull();
      expect(required(1)).toBeNull();
      expect(required(1n)).toBeNull();
      expect(required([1])).toBeNull();
      expect(required({ length: 1 })).toBeNull();
      expect(required({ size: 1 })).toBeNull();
      expect(required({})).toBeNull();
    });
  });

  describe("ValidationErrors", () => {
    it("formats sorted messages and trims trailing periods", () => {
      const errs = new ValidationErrors({
        b: new Error("Second."),
        a: new Error("First"),
      });

      expect(errs.message).toBe("a: First; b: Second.");
      expect(errs.errors).toEqual({
        b: expect.any(Error),
        a: expect.any(Error),
      });
    });

    it("returns empty message for empty errors", () => {
      const errs = new ValidationErrors();
      expect(errs.message).toBe("");
      expect(errs.errors).toEqual({});
    });
  });

  it("isEmptyValue mirrors required", () => {
    expect(isEmptyValue("")).toBe(true);
    expect(isEmptyValue(0)).toBe(true);
    expect(isEmptyValue("value")).toBe(false);
    expect(isEmptyValue(1)).toBe(false);
  });
});
