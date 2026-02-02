// Ported from pocketbase/plugins/jsvm/mapper_test.go

import { describe, expect, it } from "bun:test";
import { FieldMapper } from "./mapper.ts";

describe("jsvm FieldMapper", () => {
  it("maps Go names to JS names", () => {
    const mapper = new FieldMapper();

    const scenarios: Array<[string, string]> = [
      ["", ""],
      ["test", "test"],
      ["Test", "test"],
      ["miXeD", "miXeD"],
      ["MiXeD", "miXeD"],
      ["ResolveRequestAsJSON", "resolveRequestAsJSON"],
      ["Variable_with_underscore", "variable_with_underscore"],
      ["ALLCAPS", "allcaps"],
      ["ALL_CAPS_WITH_UNDERSCORE", "all_caps_with_underscore"],
      ["OIDCMap", "oidcMap"],
      ["MD5", "md5"],
      ["OAuth2", "oauth2"],
    ];

    for (const [input, expected] of scenarios) {
      const fieldName = mapper.FieldName(null, { Name: input });
      const methodName = mapper.MethodName(null, { Name: input });
      expect(fieldName).toBe(expected);
      expect(methodName).toBe(expected);
    }
  });
});
