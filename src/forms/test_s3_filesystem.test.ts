// Ported from pocketbase/forms/test_s3_filesystem_test.go

import { describe, it } from "bun:test";
import { ValidationErrors } from "../internal/compat/validation.ts";
import { newTestApp } from "../tests/app.ts";
import { NewTestS3Filesystem } from "./test_s3_filesystem.ts";

function assertValidationErrors(result: Error | null, expected: string[]): void {
  let errs: ValidationErrors | null = null;
  if (result) {
    if (!(result instanceof ValidationErrors)) {
      throw new Error(`Failed to parse errors ${result}`);
    }
    errs = result;
  }

  const keys = errs ? Object.keys(errs.errors) : [];
  if (keys.length > expected.length) {
    throw new Error(`Expected error keys ${JSON.stringify(expected)}, got ${JSON.stringify(keys)}`);
  }

  for (const key of expected) {
    if (!errs || !(key in errs.errors)) {
      throw new Error(`Missing expected error key "${key}" in ${errs?.message ?? ""}`);
    }
  }
}

describe("TestS3Filesystem", () => {
  it("Validate", async () => {
    const scenarios = [
      { name: "empty filesystem", filesystem: "", expectedErrors: ["filesystem"] },
      { name: "invalid filesystem", filesystem: "something", expectedErrors: ["filesystem"] },
      { name: "backups filesystem", filesystem: "backups", expectedErrors: [] },
      { name: "storage filesystem", filesystem: "storage", expectedErrors: [] },
    ];

    for (const scenario of scenarios) {
      const { app, cleanup } = await newTestApp();
      try {
        const form = NewTestS3Filesystem(app);
        form.Filesystem = scenario.filesystem;

        const result = form.Validate();
        assertValidationErrors(result, scenario.expectedErrors);
      } finally {
        await cleanup();
      }
    }
  });

  it("Submit failure", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      {
        const form = NewTestS3Filesystem(app);
        form.Filesystem = "";

        const result = form.Submit();
        if (!result) {
          throw new Error("Expected error, got nil");
        }
        if (!(result instanceof ValidationErrors)) {
          throw new Error(`Expected ValidationErrors, got ${result}`);
        }
      }

      {
        const form = NewTestS3Filesystem(app);
        form.Filesystem = "storage";

        const result = form.Submit();
        if (!result) {
          throw new Error("Expected error, got nil");
        }
        if (result instanceof ValidationErrors) {
          throw new Error(`Didn't expect ValidationErrors, got ${result.message}`);
        }
      }
    } finally {
      await cleanup();
    }
  });
});
