// Ported from pocketbase/tests/validation_errors.go

import { ValidationErrors } from "../src/internal/compat/validation.ts";

export function testValidationErrors(rawErrors: Error | null, expectedErrors: string[]): void {
  let errs: ValidationErrors | null = null;

  if (rawErrors !== null) {
    if (!(rawErrors instanceof ValidationErrors)) {
      throw new Error(
        `Failed to parse errors, expected ValidationErrors, got ${rawErrors.constructor?.name ?? typeof rawErrors}`,
      );
    }
    errs = rawErrors;
  }

  const keys = errs ? Object.keys(errs.errors) : [];

  if (keys.length !== expectedErrors.length) {
    const message = errs ? errs.message : "";
    throw new Error(
      `Expected error keys ${JSON.stringify(expectedErrors)} got ${JSON.stringify(keys)}\n${message}`,
    );
  }

  for (const key of expectedErrors) {
    if (!errs || !(key in errs.errors)) {
      const message = errs ? errs.message : "";
      throw new Error(`Missing expected error key "${key}" in ${message}`);
    }
  }
}
