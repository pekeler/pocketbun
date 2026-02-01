// Ported from pocketbase/tools/search/filter.go

// Note: upstream relies on fexpr parsing; this port uses a local lexer/parser.
// Keep behavior aligned with upstream even if the parsing implementation differs.

import type { FieldResolver, ResolverResult } from "./field_resolver.ts";
import type { MultiMatchSubquery } from "./multi_match_subquery.ts";
import type { SqlExpr } from "./types.ts";
import { randomString } from "../security/random.ts";
import { resolveIdentifierMacro } from "./identifier_macros.ts";
import { tokenFunctions, type Token } from "./token_functions.ts";
import { ErrFilterExprLimit } from "./types.ts";

export type FilterData = string;

type AstNode =
  | { type: "binary"; op: "AND" | "OR"; left: AstNode; right: AstNode }
  | { type: "compare"; op: string; left: TokenNode; right: TokenNode }
  | { type: "token"; token: TokenNode };

type TokenNode =
  | { kind: "literal"; token: Token }
  | { kind: "identifier"; token: Token }
  | { kind: "call"; name: string; args: TokenNode[] };

type LexerToken =
  | { type: "identifier"; value: string }
  | { type: "number"; value: string }
  | { type: "string"; value: string }
  | { type: "boolean"; value: string }
  | { type: "null"; value: "null" }
  | { type: "operator"; value: string }
  | { type: "lparen"; value: "(" }
  | { type: "rparen"; value: ")" }
  | { type: "comma"; value: "," }
  | { type: "and"; value: "&&" }
  | { type: "or"; value: "||" };

export function buildFilterExpr(
  filter: FilterData,
  resolver: FieldResolver,
  maxExpressions: number,
  replacements: Array<Record<string, unknown>> = [],
): SqlExpr {
  const raw = replacePlaceholders(filter, replacements);
  const lexer = new Lexer(raw);
  const parser = new Parser(lexer);
  const ast = parser.parseExpression();
  parser.expectEnd();
  const builder = new Builder(resolver, maxExpressions);
  return builder.build(ast);
}

class Builder {
  #resolver: FieldResolver;
  #maxExpressions: number;

  constructor(resolver: FieldResolver, maxExpressions: number) {
    this.#resolver = resolver;
    this.#maxExpressions = maxExpressions;
  }

  build(node: AstNode): SqlExpr {
    switch (node.type) {
      case "binary": {
        const left = this.build(node.left);
        const right = this.build(node.right);
        return {
          sql: `(${left.sql} ${node.op} ${right.sql})`,
          params: [...left.params, ...right.params],
        };
      }
      case "compare": {
        if (this.#maxExpressions <= 0) {
          throw ErrFilterExprLimit;
        }
        this.#maxExpressions -= 1;
        const left = this.resolveToken(node.left);
        const right = this.resolveToken(node.right);
        return buildComparison(node.op, left, right);
      }
      case "token": {
        throw new Error("invalid filter expression");
      }
    }
  }

  resolveToken(node: TokenNode): ResolverResult {
    if (node.kind === "call") {
      const fn = tokenFunctions[node.name];
      if (!fn) {
        throw new Error(`unsupported function "${node.name}"`);
      }
      const args = node.args.map((arg) => toToken(arg));
      return fn((token) => this.resolveTokenToken(token), args);
    }

    return this.resolveTokenToken(node.token);
  }

  resolveTokenToken(token: Token): ResolverResult {
    if (token.type === "identifier") {
      const macroValue = resolveIdentifierMacro(token.value);
      if (macroValue !== undefined) {
        return literalToken(macroValue);
      }

      try {
        const result = this.#resolver.resolve(token.value);
        return {
          identifier: result.identifier,
          params: result.params,
          nullFallback: result.nullFallback ?? "auto",
          multiMatchSubquery: result.multiMatchSubquery,
          afterBuild: result.afterBuild,
        };
      } catch (error) {
        const normalized = normalizedIdentifiers[token.value.toLowerCase()];
        if (normalized) {
          return {
            identifier: normalized,
            params: [],
            nullFallback: "auto",
          };
        }
        throw error;
      }
    }

    if (token.type === "null") {
      return { identifier: "NULL", params: [], nullFallback: "auto" };
    }

    if (token.type === "number") {
      const value = Number(token.value);
      if (!Number.isFinite(value)) {
        throw new Error("invalid numeric literal");
      }
      return literalToken(value);
    }

    if (token.type === "boolean") {
      return {
        identifier: token.value === "true" ? "1" : "0",
        params: [],
        nullFallback: "auto",
      };
    }

    return literalToken(token.value);
  }
}

function toToken(node: TokenNode): Token {
  if (node.kind === "call") {
    throw new Error("nested function calls are not supported");
  }
  return node.token;
}

function literalToken(value: unknown): ResolverResult {
  return {
    identifier: "?",
    params: [value],
    nullFallback: "auto",
  };
}

function buildComparison(op: string, left: ResolverResult, right: ResolverResult): SqlExpr {
  return buildComparisonInternal(op, left, right, true);
}

function buildComparisonInternal(op: string, left: ResolverResult, right: ResolverResult, allowMultiMatch: boolean): SqlExpr {
  const anyMatch = op.startsWith("?");
  const normalized = normalizeOperator(op);
  let expr: SqlExpr;
  switch (normalized) {
    case "=":
      expr = resolveEqualExpr(true, left, right);
      break;
    case "!=":
      expr = resolveEqualExpr(false, left, right);
      break;
    case ">":
    case ">=":
    case "<":
    case "<=":
      expr = {
        sql: `${left.identifier} ${normalized} ${right.identifier}`,
        params: mergeParams(left.params, right.params),
      };
      break;
    case "~":
    case "!~": {
      const likeOp = normalized === "~" ? "LIKE" : "NOT LIKE";
      if (right.params.length === 0) {
        expr = {
          sql: `${left.identifier} ${likeOp} ('%' || ${right.identifier} || '%') ESCAPE '\\'`,
          params: left.params,
        };
      } else {
        const wrapped = wrapLikeParams(right.params);
        expr = {
          sql: `${left.identifier} ${likeOp} ${right.identifier} ESCAPE '\\'`,
          params: mergeParams(left.params, wrapped),
        };
      }
      break;
    }
    default:
      throw new Error(`unsupported operator "${op}"`);
  }

  if (left.afterBuild) {
    expr = left.afterBuild(expr);
  }
  if (right.afterBuild) {
    expr = right.afterBuild(expr);
  }
  if (allowMultiMatch && !anyMatch) {
    expr = applyMultiMatch(expr, normalized, left, right);
  }
  return expr;
}

function normalizeOperator(op: string): string {
  if (op.startsWith("?")) {
    return op.slice(1);
  }
  return op;
}

function resolveEqualExpr(equal: boolean, left: ResolverResult, right: ResolverResult): SqlExpr {
  const leftFallback = left.nullFallback ?? "auto";
  const rightFallback = right.nullFallback ?? "auto";

  let equalOp = "=";
  let nullEqualOp = "IS";
  let concatOp = "OR";
  let nullExpr = "IS NULL";
  if (!equal) {
    equalOp = "IS NOT";
    nullEqualOp = equalOp;
    concatOp = "AND";
    nullExpr = "IS NOT NULL";
  }

  if (leftFallback === "disabled" || rightFallback === "disabled") {
    return {
      sql: `${left.identifier} ${nullEqualOp} ${right.identifier}`,
      params: mergeParams(left.params, right.params),
    };
  }

  const isLeftEmpty =
    isEmptyIdentifier(left) || (leftFallback === "auto" && left.params.length === 1 && hasEmptyParamValue(left));
  const isRightEmpty =
    isEmptyIdentifier(right) || (rightFallback === "auto" && right.params.length === 1 && hasEmptyParamValue(right));

  if (isLeftEmpty && isRightEmpty) {
    return { sql: `'' ${equalOp} ''`, params: [] };
  }

  if (isKnownNonEmptyIdentifier(left) || isKnownNonEmptyIdentifier(right)) {
    const leftIdentifier = isLeftEmpty ? "''" : left.identifier;
    const rightIdentifier = isRightEmpty ? "''" : right.identifier;
    return {
      sql: `${leftIdentifier} ${equalOp} ${rightIdentifier}`,
      params: mergeParams(isLeftEmpty ? [] : left.params, isRightEmpty ? [] : right.params),
    };
  }

  if (isLeftEmpty) {
    return {
      sql: `('' ${equalOp} ${right.identifier} ${concatOp} ${right.identifier} ${nullExpr})`,
      params: repeatParams(right.params, 2),
    };
  }

  if (isRightEmpty) {
    return {
      sql: `(${left.identifier} ${equalOp} '' ${concatOp} ${left.identifier} ${nullExpr})`,
      params: repeatParams(left.params, 2),
    };
  }

  return {
    sql: `COALESCE(${left.identifier}, '') ${equalOp} COALESCE(${right.identifier}, '')`,
    params: mergeParams(left.params, right.params),
  };
}

function hasEmptyParamValue(result: ResolverResult): boolean {
  return result.params.some((value) => value === null || value === "");
}

function isKnownNonEmptyIdentifier(result: ResolverResult): boolean {
  if (result.nullFallback === "enforced") {
    return false;
  }

  switch (result.identifier.toLowerCase()) {
    case "1":
    case "0":
    case "false":
    case "true":
      return true;
    default:
      break;
  }

  return result.params.length > 0 && !hasEmptyParamValue(result) && !isEmptyIdentifier(result);
}

function isEmptyIdentifier(result: ResolverResult): boolean {
  switch (result.identifier.toLowerCase()) {
    case "":
    case "null":
    case "''":
    case '""':
    case "``":
      return true;
    default:
      return false;
  }
}

function mergeParams(...params: unknown[][]): unknown[] {
  return params.flatMap((item) => item);
}

function applyMultiMatch(expr: SqlExpr, op: string, left: ResolverResult, right: ResolverResult): SqlExpr {
  if (left.multiMatchSubquery && right.multiMatchSubquery) {
    const mm = buildManyVsMany(op, left, right);
    return andExpr(expr, mm);
  }

  if (left.multiMatchSubquery) {
    const mm = buildManyVsOne(op, right, left.multiMatchSubquery, left.nullFallback, false);
    return andExpr(expr, mm);
  }

  if (right.multiMatchSubquery) {
    const mm = buildManyVsOne(op, left, right.multiMatchSubquery, right.nullFallback, true);
    return andExpr(expr, mm);
  }

  return expr;
}

function buildManyVsMany(op: string, left: ResolverResult, right: ResolverResult): SqlExpr {
  const leftSub = left.multiMatchSubquery?.build() ?? { sql: "0=1", params: [] };
  const rightSub = right.multiMatchSubquery?.build() ?? { sql: "0=1", params: [] };

  const lAlias = `__ml${randomString(8)}`;
  const rAlias = `__mr${randomString(8)}`;

  const whereExpr = buildComparisonInternal(
    op,
    {
      nullFallback: left.nullFallback,
      identifier: `[[${lAlias}.multiMatchValue]]`,
      params: [],
    },
    {
      nullFallback: right.nullFallback,
      identifier: `[[${rAlias}.multiMatchValue]]`,
      params: [],
      afterBuild: notExpr,
    },
    false,
  );

  const sql = `NOT EXISTS (SELECT 1 FROM (${leftSub.sql}) {{${lAlias}}} LEFT JOIN (${rightSub.sql}) {{${rAlias}}} WHERE ${whereExpr.sql})`;
  return { sql, params: [...leftSub.params, ...rightSub.params, ...whereExpr.params] };
}

function buildManyVsOne(
  op: string,
  otherOperand: ResolverResult,
  subQuery: MultiMatchSubquery,
  nullFallback: ResolverResult["nullFallback"],
  inverse: boolean,
): SqlExpr {
  const alias = `__sm${randomString(8)}`;

  const r1: ResolverResult = {
    nullFallback,
    identifier: `[[${alias}.multiMatchValue]]`,
    params: [],
    afterBuild: notExpr,
  };

  const r2: ResolverResult = {
    identifier: otherOperand.identifier,
    params: otherOperand.params,
    nullFallback: otherOperand.nullFallback ?? "auto",
  };

  const whereExpr = inverse ? buildComparisonInternal(op, r2, r1, false) : buildComparisonInternal(op, r1, r2, false);

  const sub = subQuery.build();
  const sql = `NOT EXISTS (SELECT 1 FROM (${sub.sql}) {{${alias}}} WHERE ${whereExpr.sql})`;
  return { sql, params: [...sub.params, ...whereExpr.params] };
}

function andExpr(left: SqlExpr, right: SqlExpr): SqlExpr {
  return {
    sql: `(${left.sql} AND ${right.sql})`,
    params: [...left.params, ...right.params],
  };
}

function notExpr(expr: SqlExpr): SqlExpr {
  return { sql: `NOT (${expr.sql})`, params: expr.params };
}

function repeatParams(params: unknown[], times: number): unknown[] {
  if (times <= 0 || params.length === 0) {
    return [];
  }
  const result: unknown[] = [];
  for (let i = 0; i < times; i += 1) {
    result.push(...params);
  }
  return result;
}

function wrapLikeParams(params: unknown[]): unknown[] {
  return params.map((value) => {
    const stringValue = coerceToString(value);
    if (!containsUnescaped(stringValue, "%")) {
      const escaped = escapeUnescaped(stringValue, ["%", "_", "\\"]);
      return `%${escaped}%`;
    }
    return stringValue;
  });
}

function containsUnescaped(value: string, char: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const current = value[i];
    if (current !== char) {
      continue;
    }
    if (i === 0 || value[i - 1] !== "\\") {
      return true;
    }
  }
  return false;
}

function escapeUnescaped(value: string, chars: string[]): string {
  let result = "";
  for (let i = value.length - 1; i >= 0; i -= 1) {
    const current = value[i] ?? "";
    if (chars.includes(current)) {
      const prev = value[i - 1] ?? "";
      if (prev !== "\\") {
        result = `\\${current}${result}`;
        continue;
      }
    }
    result = `${current}${result}`;
  }
  return result;
}

function coerceToString(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return "";
  }
}

function replacePlaceholders(raw: string, replacements: Array<Record<string, unknown>>): string {
  let result = raw;
  for (const replacement of replacements) {
    for (const [key, value] of Object.entries(replacement)) {
      const placeholder = `{:${key}}`;
      const serialized = serializePlaceholder(value);
      result = result.split(placeholder).join(serialized);
    }
  }
  return result;
}

function serializePlaceholder(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }
  if (typeof value === "boolean" || typeof value === "number") {
    return String(value);
  }
  const serialized = coerceToString(value);
  return JSON.stringify(serialized) ?? '""';
}

const normalizedIdentifiers: Record<string, string> = {
  null: "NULL",
  true: "1",
  false: "0",
};

class Parser {
  #lexer: Lexer;
  #current: LexerToken | null;

  constructor(lexer: Lexer) {
    this.#lexer = lexer;
    this.#current = this.#lexer.next();
  }

  parseExpression(): AstNode {
    return this.parseOr();
  }

  parseOr(): AstNode {
    let node = this.parseAnd();
    while (this.#current?.type === "or") {
      this.consume();
      const right = this.parseAnd();
      node = { type: "binary", op: "OR", left: node, right };
    }
    return node;
  }

  parseAnd(): AstNode {
    let node = this.parseComparison();
    while (this.#current?.type === "and") {
      this.consume();
      const right = this.parseComparison();
      node = { type: "binary", op: "AND", left: node, right };
    }
    return node;
  }

  parseComparison(): AstNode {
    const left = this.parseGroupOrToken();
    if (left.type === "token" && this.#current?.type === "operator") {
      const op = this.#current.value;
      this.consume();
      const right = this.parseToken();
      return { type: "compare", op, left: left.token, right };
    }
    return left;
  }

  parseGroupOrToken(): AstNode {
    const current = this.#current;
    if (current?.type === "lparen") {
      this.consume();
      const expr = this.parseExpression();
      const next = this.#current;
      if (!next || next.type !== "rparen") {
        throw new Error("invalid filter expression");
      }
      this.consume();
      return expr;
    }
    return { type: "token", token: this.parseToken() };
  }

  parseToken(): TokenNode {
    const token = this.#current;
    if (!token) {
      throw new Error("invalid filter expression");
    }

    if (token.type === "identifier") {
      const name = token.value;
      this.consume();
      const current = this.#current;
      if (current?.type === "lparen") {
        this.consume();
        const args: TokenNode[] = [];
        let next = this.#current;
        if (!next || next.type !== "rparen") {
          while (true) {
            args.push(this.parseToken());
            next = this.#current;
            if (next?.type === "comma") {
              this.consume();
              continue;
            }
            break;
          }
        }
        next = this.#current;
        if (!next || next.type !== "rparen") {
          throw new Error("invalid function call");
        }
        this.consume();
        return { kind: "call", name, args };
      }
      return { kind: "identifier", token: { type: "identifier", value: name } };
    }

    if (token.type === "string") {
      this.consume();
      return { kind: "literal", token: { type: "string", value: token.value } };
    }

    if (token.type === "number") {
      this.consume();
      return { kind: "literal", token: { type: "number", value: token.value } };
    }

    if (token.type === "boolean") {
      this.consume();
      return { kind: "literal", token: { type: "boolean", value: token.value } };
    }

    if (token.type === "null") {
      this.consume();
      return { kind: "literal", token: { type: "null", value: "null" } };
    }

    throw new Error("invalid filter expression");
  }

  expectEnd(): void {
    if (this.#current) {
      throw new Error("invalid filter expression");
    }
  }

  consume(): void {
    this.#current = this.#lexer.next();
  }
}

class Lexer {
  #input: string;
  #pos = 0;

  constructor(input: string) {
    this.#input = input;
  }

  next(): LexerToken | null {
    this.skipWhitespace();
    if (this.#pos >= this.#input.length) {
      return null;
    }

    const char = this.#input[this.#pos] ?? "";

    if (char === "(") {
      this.#pos += 1;
      return { type: "lparen", value: "(" };
    }

    if (char === ")") {
      this.#pos += 1;
      return { type: "rparen", value: ")" };
    }

    if (char === ",") {
      this.#pos += 1;
      return { type: "comma", value: "," };
    }

    const two = this.#input.slice(this.#pos, this.#pos + 2);
    if (two === "&&") {
      this.#pos += 2;
      return { type: "and", value: "&&" };
    }
    if (two === "||") {
      this.#pos += 2;
      return { type: "or", value: "||" };
    }

    const op = readOperator(this.#input, this.#pos);
    if (op) {
      this.#pos += op.length;
      return { type: "operator", value: op };
    }

    if (char === "'" || char === '"') {
      return this.readString(char);
    }

    if (isDigit(char) || (char === "-" && isDigit(this.#input[this.#pos + 1] ?? ""))) {
      return this.readNumber();
    }

    if (isIdentifierStart(char)) {
      return this.readIdentifier();
    }

    throw new Error("invalid filter expression");
  }

  readString(quote: string): LexerToken {
    this.#pos += 1;
    let result = "";
    while (this.#pos < this.#input.length) {
      const char = this.#input[this.#pos] ?? "";
      if (char === "\\") {
        const next = this.#input[this.#pos + 1] ?? "";
        result += next;
        this.#pos += 2;
        continue;
      }
      if (char === quote) {
        this.#pos += 1;
        return { type: "string", value: result };
      }
      result += char;
      this.#pos += 1;
    }
    throw new Error("invalid string literal");
  }

  readNumber(): LexerToken {
    let result = "";
    while (this.#pos < this.#input.length) {
      const char = this.#input[this.#pos] ?? "";
      if (!isDigit(char) && char !== ".") {
        break;
      }
      result += char;
      this.#pos += 1;
    }
    return { type: "number", value: result };
  }

  readIdentifier(): LexerToken {
    let result = "";
    while (this.#pos < this.#input.length) {
      const char = this.#input[this.#pos] ?? "";
      if (!isIdentifierPart(char)) {
        break;
      }
      result += char;
      this.#pos += 1;
    }

    if (result === "true" || result === "false") {
      return { type: "boolean", value: result };
    }
    if (result === "null") {
      return { type: "null", value: "null" };
    }
    return { type: "identifier", value: result };
  }

  skipWhitespace(): void {
    while (this.#pos < this.#input.length) {
      const char = this.#input[this.#pos] ?? "";
      if (!/\s/.test(char)) {
        return;
      }
      this.#pos += 1;
    }
  }
}

function readOperator(input: string, position: number): string | null {
  const candidates = ["?!=", ">=", "<=", "!~", "!=", "?<=", "?>=", "?!~", "?=", "?>", "?<", "?~", "=", ">", "<", "~"];
  for (const candidate of candidates) {
    if (input.startsWith(candidate, position)) {
      return candidate;
    }
  }
  return null;
}

function isDigit(char: string): boolean {
  return char >= "0" && char <= "9";
}

function isIdentifierStart(char: string): boolean {
  return /[A-Za-z_@]/.test(char);
}

function isIdentifierPart(char: string): boolean {
  return /[A-Za-z0-9_.:@]/.test(char);
}
