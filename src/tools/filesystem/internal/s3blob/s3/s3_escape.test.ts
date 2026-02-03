// Ported from pocketbase/tools/filesystem/internal/s3blob/s3/s3_escape_test.go

import { describe, it } from "bun:test";
import { escapePath, escapeQuery } from "./s3.ts";

describe("s3 escape", () => {
  it("escapePath", () => {
    const escaped = escapePath(
      "/ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.~ !@#$%^&*()+={}[]?><\\|,`'\"/@sub1/@sub2/a/b/c/1/2/3",
    );

    const expected =
      "/ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.~%20%21%40%23%24%25%5E%26%2A%28%29%2B%3D%7B%7D%5B%5D%3F%3E%3C%5C%7C%2C%60%27%22/%40sub1/%40sub2/a/b/c/1/2/3";

    if (escaped !== expected) {
      throw new Error(`Expected\n${expected}\ngot\n${escaped}`);
    }
  });

  it("escapeQuery", () => {
    const values = new URLSearchParams();
    values.append("abc", "123");
    values.append(
      "/ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.~ !@#$%^&*()+={}[]?><\\|,`'\"",
      "/ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.~ !@#$%^&*()+={}[]?><\\|,`'\"",
    );

    const escaped = escapeQuery(values);

    const expected =
      "%2FABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.~%20%21%40%23%24%25%5E%26%2A%28%29%2B%3D%7B%7D%5B%5D%3F%3E%3C%5C%7C%2C%60%27%22=%2FABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.~%20%21%40%23%24%25%5E%26%2A%28%29%2B%3D%7B%7D%5B%5D%3F%3E%3C%5C%7C%2C%60%27%22&abc=123";

    if (escaped !== expected) {
      throw new Error(`Expected\n${expected}\ngot\n${escaped}`);
    }
  });
});
