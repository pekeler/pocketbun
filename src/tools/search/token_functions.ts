// Ported from pocketbase/tools/search/token_functions.go

import { NullFallbackDisabled, NullFallbackEnforced, type ResolverResult } from "./field_resolver.ts";

export type TokenFunction = (resolveToken: (token: Token) => ResolverResult, args: Token[]) => ResolverResult;

export type Token = {
  type: "identifier" | "number" | "string" | "boolean" | "null";
  value: string;
};

export const tokenFunctions: Record<string, TokenFunction> = {
  geoDistance: (resolveToken, args) => {
    if (args.length !== 4) {
      throw new Error(`[geoDistance] expected 4 arguments, got ${args.length}`);
    }
    const resolved = args.map((arg, index) => {
      if (arg.type !== "identifier" && arg.type !== "number") {
        throw new Error(`[geoDistance] argument ${index} must be an identifier or number`);
      }
      return resolveToken(arg);
    });

    const [lonA, latA, lonB, latB] = resolved;
    if (!lonA || !latA || !lonB || !latB) {
      throw new Error("[geoDistance] failed to resolve arguments");
    }
    const identifier =
      "(6371 * acos(" +
      `cos(radians(${latA.identifier})) * cos(radians(${latB.identifier})) * ` +
      `cos(radians(${lonB.identifier}) - radians(${lonA.identifier})) + ` +
      `sin(radians(${latA.identifier})) * sin(radians(${latB.identifier}))` +
      "))";

    return {
      identifier,
      params: mergeParams(latA.params, latB.params, lonB.params, lonA.params, latA.params, latB.params),
      nullFallback: NullFallbackDisabled,
    };
  },
  strftime: (resolveToken, args) => {
    const totalArgs = args.length;
    if (totalArgs < 1) {
      throw new Error(`[strftime] expected at least 1 arguments, got ${totalArgs}`);
    }
    if (totalArgs > 10) {
      throw new Error(`[strftime] too many arguments (max allowed 10, got ${totalArgs})`);
    }

    if (args[0]?.type !== "string") {
      throw new Error("[strftime] expects the first argument to be a format string");
    }

    const formatResult = resolveToken(args[0]);
    if (totalArgs === 1) {
      return {
        identifier: `strftime(${formatResult.identifier})`,
        params: formatResult.params,
        nullFallback: NullFallbackEnforced,
      };
    }

    const timeValue = args[1];
    if (!timeValue || (timeValue.type !== "string" && timeValue.type !== "identifier" && timeValue.type !== "number")) {
      throw new Error("[strftime] expects the second argument to be of a valid time-value type");
    }

    const timeValueResult = resolveToken(timeValue);
    const modifiers = args.slice(2);
    const resolvedModifiers = modifiers.map((arg, index) => {
      if (arg.type !== "string") {
        throw new Error(`[strftime] invalid modifier argument ${index} - can be only string`);
      }
      return resolveToken(arg);
    });

    const identifiers = [
      formatResult.identifier,
      timeValueResult.identifier,
      ...resolvedModifiers.map((item) => item.identifier),
    ];

    const result: ResolverResult = {
      identifier: `strftime(${identifiers.join(",")})`,
      params: mergeParams(formatResult.params, timeValueResult.params, ...resolvedModifiers.map((item) => item.params)),
      nullFallback: NullFallbackEnforced,
    };

    if (timeValueResult.multiMatchSubquery) {
      identifiers[1] = timeValueResult.multiMatchSubquery.valueIdentifier;
      result.multiMatchSubquery = timeValueResult.multiMatchSubquery;
      result.multiMatchSubquery.valueIdentifier = `strftime(${identifiers.join(",")})`;
      result.multiMatchSubquery.params.push(...result.params);
    }

    return result;
  },
};

function mergeParams(...params: unknown[][]): unknown[] {
  return params.flatMap((item) => item);
}
