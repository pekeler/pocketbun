// Ported from pocketbase/tools/tokenizer/tokenizer_test.go

import { describe, expect, it } from "bun:test";
import { DefaultSeparators, Tokenizer, newFromBytes, newFromString, newTokenizer } from "./tokenizer.ts";

describe("tokenizer", () => {
  it("factories", () => {
    const expectedContent = "test";

    const scenarios = [
      { name: "Tokenizer()", tk: new Tokenizer(expectedContent) },
      { name: "newFromString()", tk: newFromString(expectedContent) },
      { name: "newFromBytes()", tk: newFromBytes(new TextEncoder().encode(expectedContent)) },
      { name: "newTokenizer()", tk: newTokenizer(expectedContent) },
    ];

    for (const scenario of scenarios) {
      const tokens = scenario.tk.scanAll();
      expect(tokens).toEqual([expectedContent]);

      // default separators should split on comma
      const commaTokens = new Tokenizer("a,b").scanAll();
      expect(commaTokens).toEqual(["a", "b"]);

      expect(DefaultSeparators).toEqual([","]);
    }
  });

  it("scan", () => {
    const tk = newFromString("abc, 123.456, (abc)");

    expect(tk.scan()).toBe("abc");
    expect(tk.scan()).toBe("123.456");
    expect(tk.scan()).toBe("(abc)");
    expect(tk.scan()).toBeNull();
  });

  it("scanAll", () => {
    const scenarios = [
      {
        name: "empty string",
        content: "",
        separators: DefaultSeparators,
        keepSeparator: false,
        keepEmptyTokens: false,
        ignoreParenthesis: false,
        expectError: false,
        expectTokens: [] as string[],
      },
      {
        name: "unbalanced parenthesis",
        content: "(a,b() c",
        separators: DefaultSeparators,
        keepSeparator: false,
        keepEmptyTokens: false,
        ignoreParenthesis: false,
        expectError: true,
        expectTokens: [] as string[],
      },
      {
        name: "unmatching quotes",
        content: "'asd\"",
        separators: DefaultSeparators,
        keepSeparator: false,
        keepEmptyTokens: false,
        ignoreParenthesis: false,
        expectError: true,
        expectTokens: [] as string[],
      },
      {
        name: "no separators",
        content: 'a, b, c, d, e 123, "abc"',
        separators: [] as string[],
        keepSeparator: false,
        keepEmptyTokens: false,
        ignoreParenthesis: false,
        expectError: false,
        expectTokens: ['a, b, c, d, e 123, "abc"'],
      },
      {
        name: "default separators",
        content: 'a, b , c  , d e  , "a,b,  c  " , ,, ,\t  (123, 456)\n',
        separators: DefaultSeparators,
        keepSeparator: false,
        keepEmptyTokens: false,
        ignoreParenthesis: false,
        expectError: false,
        expectTokens: ["a", "b", "c", "d e", '"a,b,  c  "', "(123, 456)"],
      },
      {
        name: "keep separators",
        content: 'a, b, c, d  e, "a,b,  c  ",\t(123, 456)',
        separators: [",", " "],
        keepSeparator: true,
        keepEmptyTokens: true,
        ignoreParenthesis: false,
        expectError: false,
        expectTokens: ["a,", " ", "b,", " ", "c,", " ", "d ", " ", "e,", " ", '"a,b,  c  ",', "(123, 456)"],
      },
      {
        name: "custom separators",
        content: 'a | b c  d &(e + f) &  "g & h" & & &',
        separators: ["|", "&"],
        keepSeparator: false,
        keepEmptyTokens: false,
        ignoreParenthesis: false,
        expectError: false,
        expectTokens: ["a", "b c  d", "(e + f)", '"g & h"'],
      },
      {
        name: "ignoring parenthesis",
        content: "a, b, (c,d)",
        separators: DefaultSeparators,
        keepSeparator: false,
        keepEmptyTokens: false,
        ignoreParenthesis: true,
        expectError: false,
        expectTokens: ["a", "b", "(c", "d)"],
      },
      {
        name: "keep empty tokens",
        content: "a, b, (c, d), ,, , e, , f",
        separators: DefaultSeparators,
        keepSeparator: false,
        keepEmptyTokens: true,
        ignoreParenthesis: false,
        expectError: false,
        expectTokens: ["a", "b", "(c, d)", "", "", "", "e", "", "f"],
      },
    ];

    for (const scenario of scenarios) {
      const tk = newFromString(scenario.content);
      tk.separators(...scenario.separators);
      tk.keepSeparator(scenario.keepSeparator);
      tk.keepEmptyTokens(scenario.keepEmptyTokens);
      tk.ignoreParenthesis(scenario.ignoreParenthesis);

      const result = tryCall(() => tk.scanAll());
      const hasErr = Boolean(result.error);
      expect(hasErr).toBe(scenario.expectError);

      if (hasErr) {
        continue;
      }

      const tokens = result.value ?? [];
      expect(tokens.length).toBe(scenario.expectTokens.length);

      for (const token of tokens) {
        expect(scenario.expectTokens.includes(token)).toBe(true);
      }
    }
  });

  it("trim cutset behavior", () => {
    const defaultTk = newFromString("\t test \n");
    expect(defaultTk.scanAll()).toEqual(["test"]);

    const customTk = newFromString("\nvalue\n");
    customTk.separators("\t", " ", "\r", ",");
    expect(customTk.scanAll()).toEqual(["value"]);
  });
});

function tryCall<T>(fn: () => T): { value: T | null; error: unknown } {
  try {
    return { value: fn(), error: null };
  } catch (error) {
    return { value: null, error };
  }
}
