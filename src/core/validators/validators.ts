// Ported from pocketbase/core/validators/validators.go

import { ValidationErrors, newError } from "../../internal/compat/validation.ts";

export const ErrUnsupportedValueType = newError("validation_unsupported_value_type", "Invalid or unsupported value type.");

export function joinValidationErrors(errorA: Error | null, errorB: Error | null): Error | null {
  const vErrA = errorA instanceof ValidationErrors ? errorA : null;
  const vErrB = errorB instanceof ValidationErrors ? errorB : null;

  if (vErrA && vErrB) {
    const merged = { ...vErrA.errors, ...vErrB.errors };
    if (Object.keys(merged).length > 0) {
      return new ValidationErrors(merged);
    }
  }

  if (vErrA && Object.keys(vErrA.errors).length > 0) {
    return vErrA;
  }

  if (vErrB && Object.keys(vErrB.errors).length > 0) {
    return vErrB;
  }

  return joinErrors(errorA, errorB);
}

export function cutStr(str: string, max: number): string {
  if (str.length > max) {
    return `${str.slice(0, max)}...`;
  }
  return str;
}

function joinErrors(errA: Error | null, errB: Error | null): Error | null {
  if (!errA && !errB) {
    return null;
  }
  if (!errA) {
    return errB;
  }
  if (!errB) {
    return errA;
  }
  return new JoinedError([errA, errB]);
}

class JoinedError extends Error {
  errors: Error[];

  constructor(errors: Error[]) {
    super(errors.map((err) => err.message ?? String(err)).join("\n"));
    this.errors = errors;
  }
}
