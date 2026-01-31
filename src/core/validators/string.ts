// Ported from pocketbase/core/validators/string.go

import { newError } from "../../internal/compat/validation.ts";
import { ErrUnsupportedValueType } from "./validators.ts";

export function isRegex(value: unknown): Error | null {
  if (typeof value !== "string") {
    return ErrUnsupportedValueType;
  }
  if (value === "") {
    return null;
  }
  try {
    new RegExp(value);
  } catch (error) {
    return newError("validation_invalid_regex", (error as Error).message);
  }
  return null;
}
