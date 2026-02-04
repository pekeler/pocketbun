// Ported from pocketbase/tools/search/token_functions_test.go.

import type { SQLQueryBindings } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { DbxDatabase } from "../dbx/database.ts";
import { NullFallbackDisabled, NullFallbackEnforced, type ResolverResult } from "./field_resolver.ts";
import { tokenFunctions, type Token } from "./token_functions.ts";

const numberToken = (value: number): Token => ({ type: "number", value: String(value) });
const stringToken = (value: string): Token => ({ type: "string", value });
const booleanToken = (value: boolean): Token => ({ type: "boolean", value: value ? "true" : "false" });

const resolveLiteral = (token: Token): ResolverResult => {
  if (token.type === "number") {
    return { identifier: "?", params: [Number(token.value)], nullFallback: NullFallbackDisabled };
  }
  if (token.type === "boolean") {
    return { identifier: "?", params: [token.value === "true"], nullFallback: NullFallbackDisabled };
  }
  return { identifier: "?", params: [token.value], nullFallback: NullFallbackDisabled };
};

describe("token functions", () => {
  it("geoDistance", () => {
    const fn = tokenFunctions.geoDistance;
    if (!fn) {
      throw new Error("Expected geoDistance token function to be registered.");
    }

    const scenarios = [
      { name: "no args", args: [] as Token[], expectErr: true },
      { name: "< 4 args", args: [numberToken(1), numberToken(2), numberToken(3)], expectErr: true },
      {
        name: "> 4 args",
        args: [numberToken(1), numberToken(2), numberToken(3), numberToken(4), numberToken(5)],
        expectErr: true,
      },
      {
        name: "unsupported argument type",
        args: [stringToken("1"), numberToken(2), numberToken(3), numberToken(4)],
        expectErr: true,
      },
      {
        name: "resolver error",
        args: [numberToken(1), numberToken(2), numberToken(3), numberToken(4)],
        resolver: () => {
          throw new Error("test");
        },
        expectErr: true,
      },
      {
        name: "valid args",
        args: [numberToken(1), numberToken(2), numberToken(3), numberToken(4)],
        expectErr: false,
        expectIdentifier:
          "(6371 * acos(cos(radians(?)) * cos(radians(?)) * cos(radians(?) - radians(?)) + sin(radians(?)) * sin(radians(?))))",
        expectParams: [2, 4, 3, 1, 2, 4],
      },
    ];

    for (const scenario of scenarios) {
      let result: ResolverResult | null = null;
      let err: unknown = null;
      try {
        const resolver = scenario.resolver ?? resolveLiteral;
        result = fn(resolver, scenario.args);
      } catch (error) {
        err = error;
      }

      const hasErr = err != null;
      expect(hasErr).toBe(scenario.expectErr);

      if (hasErr || !result) {
        continue;
      }

      expect(result.nullFallback).toBe(NullFallbackDisabled);
      if (scenario.expectIdentifier) {
        expect(result.identifier).toBe(scenario.expectIdentifier);
      }
      if (scenario.expectParams) {
        expect(result.params).toEqual(scenario.expectParams);
      }
    }
  });

  it("geoDistance exec", () => {
    const fn = tokenFunctions.geoDistance;
    if (!fn) {
      throw new Error("Expected geoDistance token function to be registered.");
    }
    const result = fn(resolveLiteral, [
      numberToken(23.23033854945808),
      numberToken(42.713146090563384),
      numberToken(23.44920680886216),
      numberToken(42.7078484153991),
    ]);

    const db = new DbxDatabase(":memory:");
    try {
      const row = db.query(`select ${result.identifier} as value`).get(...(result.params as SQLQueryBindings[])) as
        | { value: number }
        | undefined;
      const distance = row?.value ?? 0;
      const formatted = distance.toFixed(2);
      expect(formatted).toBe("17.89");
    } finally {
      db.close();
    }
  });

  it("strftime", () => {
    const fn = tokenFunctions.strftime;
    if (!fn) {
      throw new Error("Expected strftime token function to be registered.");
    }

    const scenarios = [
      { name: "no args", args: [] as Token[], expectErr: true },
      {
        name: "invalid format arg",
        args: [numberToken(1)],
        expectErr: true,
      },
      {
        name: "valid format only",
        args: [stringToken("abc")],
        expectErr: false,
        expectIdentifier: "strftime(?)",
        expectParams: ["abc"],
      },
      {
        name: "invalid time arg",
        args: [stringToken("1"), booleanToken(true)],
        expectErr: true,
      },
      {
        name: "valid format + time",
        args: [stringToken("1"), stringToken("2")],
        expectErr: false,
        expectIdentifier: "strftime(?,?)",
        expectParams: ["1", "2"],
      },
      {
        name: "invalid modifier arg",
        args: [stringToken("1"), stringToken("2"), stringToken("3"), numberToken(4)],
        expectErr: true,
      },
      {
        name: "valid modifiers",
        args: [stringToken("1"), stringToken("2"), stringToken("3"), stringToken("4")],
        expectErr: false,
        expectIdentifier: "strftime(?,?,?,?)",
        expectParams: ["1", "2", "3", "4"],
      },
      {
        name: "= 10 args limit",
        args: [
          stringToken("1"),
          stringToken("2"),
          stringToken("3"),
          stringToken("4"),
          stringToken("5"),
          stringToken("6"),
          stringToken("7"),
          stringToken("8"),
          stringToken("9"),
          stringToken("10"),
        ],
        expectErr: false,
        expectIdentifier: "strftime(?,?,?,?,?,?,?,?,?,?)",
        expectParams: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
      },
      {
        name: "> 10 args limit",
        args: [
          stringToken("1"),
          stringToken("2"),
          stringToken("3"),
          stringToken("4"),
          stringToken("5"),
          stringToken("6"),
          stringToken("7"),
          stringToken("8"),
          stringToken("9"),
          stringToken("10"),
          stringToken("11"),
        ],
        expectErr: true,
      },
      {
        name: "resolver error",
        args: [stringToken("1"), stringToken("2"), stringToken("3")],
        resolver: () => {
          throw new Error("test");
        },
        expectErr: true,
      },
    ];

    for (const scenario of scenarios) {
      let result: ResolverResult | null = null;
      let err: unknown = null;
      try {
        const resolver = scenario.resolver ?? resolveLiteral;
        result = fn(resolver, scenario.args);
      } catch (error) {
        err = error;
      }

      const hasErr = err != null;
      expect(hasErr).toBe(scenario.expectErr);

      if (hasErr || !result) {
        continue;
      }

      expect(result.nullFallback).toBe(NullFallbackEnforced);
      if (scenario.expectIdentifier) {
        expect(result.identifier).toBe(scenario.expectIdentifier);
      }
      if (scenario.expectParams) {
        expect(result.params).toEqual(scenario.expectParams);
      }
    }
  });

  it("strftime exec", () => {
    const fn = tokenFunctions.strftime;
    if (!fn) {
      throw new Error("Expected strftime token function to be registered.");
    }
    const result = fn(resolveLiteral, [
      stringToken("%Y-%m"),
      stringToken("2026-01-02 01:02:03.456Z"),
      stringToken("+1 years"),
      stringToken("+5 months"),
    ]);

    const db = new DbxDatabase(":memory:");
    try {
      const row = db.query(`select ${result.identifier} as value`).get(...(result.params as SQLQueryBindings[])) as
        | { value: string }
        | undefined;
      expect(row?.value).toBe("2027-06");
    } finally {
      db.close();
    }
  });
});
