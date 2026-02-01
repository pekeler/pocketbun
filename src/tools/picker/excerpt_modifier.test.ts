// Ported from pocketbase/tools/picker/excerpt_modifier_test.go

import { describe, expect, it } from "bun:test";
import { toNumberValue } from "../../internal/compat/cast.ts";
import { newExcerptModifier } from "./excerpt_modifier.ts";

const parseBool = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  if (["1", "t", "true", "y", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "f", "false", "n", "no", "off", ""].includes(normalized)) {
    return false;
  }
  return false;
};

describe("newExcerptModifier", () => {
  const scenarios = [
    {
      name: "no arguments",
      args: [] as string[],
      expectError: true,
    },
    {
      name: "too many arguments",
      args: ["12", "false", "something"],
      expectError: true,
    },
    {
      name: "non-numeric max argument",
      args: ["something"],
      expectError: true,
    },
    {
      name: "numeric max argument",
      args: ["12"],
      expectError: false,
    },
    {
      name: "non-bool withEllipsis argument",
      args: ["12", "something"],
      expectError: false,
    },
    {
      name: "truthy withEllipsis argument",
      args: ["12", "t"],
      expectError: false,
    },
  ];

  for (const scenario of scenarios) {
    it(scenario.name, () => {
      let modifier: ReturnType<typeof newExcerptModifier> | null = null;
      let err: Error | null = null;

      try {
        modifier = newExcerptModifier(...scenario.args);
      } catch (error) {
        err = error as Error;
      }

      const hasErr = err !== null;
      expect(hasErr).toBe(scenario.expectError);

      if (hasErr) {
        expect(modifier).toBeNull();
        return;
      }

      const argMax = scenario.args.length > 0 ? Math.trunc(toNumberValue(scenario.args[0])) : 0;
      const argWithEllipsis = scenario.args.length > 1 ? parseBool(scenario.args[1] ?? "") : false;

      expect(modifier?.max).toBe(argMax);
      expect(modifier?.withEllipsis).toBe(argWithEllipsis);
    });
  }
});

describe("ExcerptModifier.Modify", () => {
  const html =
    ' <script>var a = 123;</script>   <p>Hello</p><div id="test_id">t   est<b>12\n\t3</b><span>456</span></div><span>word <b>7</b> 89<span>!<b>?</b><b> a </b><b>b </b>c</span>#<h1>title</h1>';
  const plainText = "Hello t est12 3456 word 7 89!? a b c# title";

  const scenarios = [
    {
      name: "only max < len(plainText)",
      args: ["2"],
      value: html,
      expected: plainText.slice(0, 2),
    },
    {
      name: "only max = len(plainText)",
      args: [String(plainText.length)],
      value: html,
      expected: plainText,
    },
    {
      name: "only max > len(plainText)",
      args: [String(plainText.length + 5)],
      value: html,
      expected: plainText,
    },
    {
      name: "with ellipsis and max < len(plainText)",
      args: ["2", "t"],
      value: html,
      expected: `${plainText.slice(0, 2)}...`,
    },
    {
      name: "with ellipsis and max = len(plainText)",
      args: [String(plainText.length), "t"],
      value: html,
      expected: plainText,
    },
    {
      name: "with ellipsis and max > len(plainText)",
      args: [String(plainText.length + 5), "t"],
      value: html,
      expected: plainText,
    },
    {
      name: "mutibyte chars <= max",
      args: ["4", "t"],
      value: "аб\nв ",
      expected: "аб в",
    },
    {
      name: "mutibyte chars > max",
      args: ["3", "t"],
      value: "аб\nв ",
      expected: "аб...",
    },
  ];

  for (const scenario of scenarios) {
    it(scenario.name, () => {
      const modifier = newExcerptModifier(...scenario.args);
      const raw = modifier.Modify(scenario.value);
      expect(String(raw)).toBe(scenario.expected);
    });
  }
});
