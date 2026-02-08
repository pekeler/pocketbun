// Ported from pocketbase/tools/security/random_by_regex.go
// Note: implements a minimal regex parser for the subset used by PocketBase patterns.

import { randomFillSync } from "node:crypto";

const defaultMaxRepeat = 6;
const maxPatternCacheEntries = 128;
const randomPoolSize = 2048;
const randomUInt32Base = 0x1_0000_0000;

const anyCharNotNLPairs: Array<[number, number]> = [
  ["A".charCodeAt(0), "Z".charCodeAt(0)],
  ["a".charCodeAt(0), "z".charCodeAt(0)],
  ["0".charCodeAt(0), "9".charCodeAt(0)],
];
const anyCharNotNLSelector = buildRuneSelector(anyCharNotNLPairs);
const printableAsciiPairs: Array<[number, number]> = [[32, 126]];
const parsedPatternCache = new Map<string, AstNode>();
const randomPool = new Uint32Array(randomPoolSize);
let randomPoolIndex = randomPool.length;

type RuneSelector = {
  ranges: Array<[number, number]>;
  cumulative: number[];
  total: number;
};

type AstNode =
  | { type: "literal"; value: string }
  | { type: "charClass"; selector: RuneSelector }
  | { type: "any" }
  | { type: "concat"; parts: AstNode[] }
  | { type: "alternate"; options: AstNode[] }
  | { type: "repeat"; node: AstNode; min: number; max: number };

export function randomStringByRegex(pattern: string, ...flags: number[]): string {
  if (!pattern) {
    throw new Error("empty regex pattern");
  }
  if (flags.length > 0) {
    throw new Error("regex flags are not supported");
  }
  const ast = parsePattern(pattern);
  const writer: string[] = [];
  writeRandomString(ast, writer);
  return writer.join("");
}

function parsePattern(pattern: string): AstNode {
  const cached = parsedPatternCache.get(pattern);
  if (cached) {
    // Keep most recently used entries hot.
    parsedPatternCache.delete(pattern);
    parsedPatternCache.set(pattern, cached);
    return cached;
  }

  const parser = new Parser(pattern);
  const parsed = parser.parseExpression();

  if (parsedPatternCache.size >= maxPatternCacheEntries) {
    const oldest = parsedPatternCache.keys().next().value;
    if (typeof oldest === "string") {
      parsedPatternCache.delete(oldest);
    }
  }
  parsedPatternCache.set(pattern, parsed);
  return parsed;
}

function writeRandomString(node: AstNode, out: string[]): void {
  switch (node.type) {
    case "literal":
      out.push(node.value);
      return;
    case "charClass":
      out.push(String.fromCharCode(randomRuneFromSelector(node.selector)));
      return;
    case "any":
      out.push(String.fromCharCode(randomRuneFromSelector(anyCharNotNLSelector)));
      return;
    case "concat":
      for (const part of node.parts) {
        writeRandomString(part, out);
      }
      return;
    case "alternate": {
      const idx = randomNumber(node.options.length);
      writeRandomString(node.options[idx] ?? { type: "literal", value: "" }, out);
      return;
    }
    case "repeat": {
      let max = node.max;
      if (max < 0) {
        max = defaultMaxRepeat;
      }
      if (max < node.min) {
        max = node.min;
      }
      let count = node.min;
      if (max !== node.min) {
        count += randomNumber(max - node.min);
      }
      for (let i = 0; i < count; i += 1) {
        writeRandomString(node.node, out);
      }
      return;
    }
  }
}

function buildRuneSelector(ranges: Array<[number, number]>): RuneSelector {
  if (ranges.length === 0) {
    throw new Error("no runes to choose from");
  }

  const normalizedRanges: Array<[number, number]> = [];
  const cumulative = Array.from({ length: ranges.length }, () => 0);
  let total = 0;
  let index = 0;
  for (const [start, end] of ranges) {
    if (start > end) {
      throw new Error("invalid rune range");
    }
    normalizedRanges.push([start, end]);
    total += end - start + 1;
    cumulative[index] = total;
    index += 1;
  }

  return {
    ranges: normalizedRanges,
    cumulative,
    total,
  };
}

function randomRuneFromSelector(selector: RuneSelector): number {
  const { ranges, cumulative, total } = selector;
  const idx = randomNumber(total);
  for (let i = 0; i < cumulative.length; i += 1) {
    const boundary = cumulative[i];
    if (boundary !== undefined && idx < boundary) {
      const prev = i === 0 ? 0 : (cumulative[i - 1] ?? 0);
      const offset = idx - prev;
      const range = ranges[i] ?? [0, 0];
      return range[0] + offset;
    }
  }

  return ranges[0]?.[0] ?? 0;
}

function randomNumber(maxSoft: number): number {
  if (maxSoft <= 0) {
    return 0;
  }

  // Deviation for Bun performance: keep cryptographic randomness but reduce per-call
  // overhead by reading from a buffered crypto-filled uint32 pool.
  const max = Math.floor(maxSoft);
  if (max <= 1) {
    return 0;
  }
  const limit = Math.floor(randomUInt32Base / max) * max;
  while (true) {
    const value = nextRandomUint32();
    if (value < limit) {
      return value % max;
    }
  }
}

function nextRandomUint32(): number {
  if (randomPoolIndex >= randomPool.length) {
    randomFillSync(randomPool);
    randomPoolIndex = 0;
  }
  const value = randomPool[randomPoolIndex] ?? 0;
  randomPoolIndex += 1;
  return value;
}

class Parser {
  #pattern: string;
  #pos = 0;

  constructor(pattern: string) {
    this.#pattern = pattern;
  }

  parseExpression(): AstNode {
    const terms: AstNode[] = [];
    terms.push(this.parseTerm());
    while (this.peek() === "|") {
      this.consume();
      terms.push(this.parseTerm());
    }
    if (terms.length === 1) {
      return terms[0] ?? { type: "literal", value: "" };
    }
    return { type: "alternate", options: terms };
  }

  parseTerm(): AstNode {
    const parts: AstNode[] = [];
    while (!this.eof()) {
      const ch = this.peek();
      if (!ch || ch === ")" || ch === "|") {
        break;
      }
      parts.push(this.parseFactor());
    }
    if (parts.length === 1) {
      return parts[0] ?? { type: "literal", value: "" };
    }
    return { type: "concat", parts };
  }

  parseFactor(): AstNode {
    let atom = this.parseAtom();
    const ch = this.peek();
    if (!ch) {
      return atom;
    }
    if (ch === "*" || ch === "+" || ch === "?" || ch === "{") {
      const { min, max } = this.parseQuantifier();
      atom = { type: "repeat", node: atom, min, max };
    }
    return atom;
  }

  parseAtom(): AstNode {
    const ch = this.peek();
    if (!ch) {
      return { type: "literal", value: "" };
    }
    if (ch === ".") {
      this.consume();
      return { type: "any" };
    }
    if (ch === "(") {
      this.consume();
      const expr = this.parseExpression();
      if (this.peek() === ")") {
        this.consume();
      }
      return expr;
    }
    if (ch === "[") {
      return this.parseCharClass();
    }
    if (ch === "^" || ch === "$") {
      this.consume();
      return { type: "literal", value: "" };
    }
    if (ch === "\\") {
      this.consume();
      const next = this.consume() ?? "";
      return this.parseEscape(next);
    }
    this.consume();
    return { type: "literal", value: ch };
  }

  parseCharClass(): AstNode {
    this.consume(); // [
    const ranges: Array<[number, number]> = [];
    let negate = false;
    if (this.peek() === "^") {
      negate = true;
      this.consume();
    }
    while (!this.eof()) {
      const ch = this.peek();
      if (!ch) {
        break;
      }
      if (ch === "]") {
        this.consume();
        break;
      }
      const start = this.readClassChar();
      if (this.peek() === "-" && this.peek(1) !== "]") {
        this.consume();
        const end = this.readClassChar();
        ranges.push([start.charCodeAt(0), end.charCodeAt(0)]);
      } else {
        const code = start.charCodeAt(0);
        ranges.push([code, code]);
      }
    }
    if (negate) {
      const inverted = invertRanges(ranges, printableAsciiPairs);
      if (inverted.length === 0) {
        throw new Error("negated character class has no valid ranges");
      }
      return createCharClassNode(inverted);
    }
    return createCharClassNode(ranges);
  }

  readClassChar(): string {
    const ch = this.consume() ?? "";
    if (ch === "\\") {
      const next = this.consume() ?? "";
      const node = this.parseEscape(next);
      if (node.type === "charClass") {
        const first = node.selector.ranges[0] ?? [0, 0];
        return String.fromCharCode(first[0]);
      }
      if (node.type === "literal") {
        return node.value;
      }
    }
    return ch;
  }

  parseEscape(ch: string): AstNode {
    switch (ch) {
      case "d":
        return createCharClassNode([[48, 57]]);
      case "w":
        return createCharClassNode([
          [48, 57],
          [65, 90],
          [95, 95],
          [97, 122],
        ]);
      case "s":
        return createCharClassNode([
          [9, 13],
          [32, 32],
        ]);
      default:
        return { type: "literal", value: ch };
    }
  }

  parseQuantifier(): { min: number; max: number } {
    const ch = this.peek();
    if (ch === "*") {
      this.consume();
      return { min: 0, max: -1 };
    }
    if (ch === "+") {
      this.consume();
      return { min: 1, max: -1 };
    }
    if (ch === "?") {
      this.consume();
      return { min: 0, max: 1 };
    }
    if (ch === "{") {
      this.consume();
      const min = this.readNumber();
      let max = min;
      if (this.peek() === ",") {
        this.consume();
        if (this.peek() === "}") {
          max = -1;
        } else {
          max = this.readNumber();
        }
      }
      if (this.peek() === "}") {
        this.consume();
      }
      return { min, max };
    }
    return { min: 1, max: 1 };
  }

  readNumber(): number {
    let num = "";
    while (!this.eof()) {
      const ch = this.peek();
      if (!ch || ch < "0" || ch > "9") {
        break;
      }
      num += ch;
      this.consume();
    }
    return num ? Number(num) : 0;
  }

  peek(offset = 0): string | null {
    return this.#pattern[this.#pos + offset] ?? null;
  }

  consume(): string | null {
    if (this.eof()) {
      return null;
    }
    const ch = this.#pattern[this.#pos] ?? "";
    this.#pos += 1;
    return ch;
  }

  eof(): boolean {
    return this.#pos >= this.#pattern.length;
  }
}

function createCharClassNode(ranges: Array<[number, number]>): AstNode {
  return { type: "charClass", selector: buildRuneSelector(ranges) };
}

function invertRanges(ranges: Array<[number, number]>, base: Array<[number, number]>): Array<[number, number]> {
  if (ranges.length === 0) {
    return base.map((pair) => [...pair] as [number, number]);
  }

  const sorted = ranges
    .map((pair) => [Math.min(pair[0], pair[1]), Math.max(pair[0], pair[1])] as [number, number])
    .sort((a, b) => a[0] - b[0]);

  const merged: Array<[number, number]> = [];
  for (const [start, end] of sorted) {
    const last = merged[merged.length - 1];
    if (!last || start > last[1] + 1) {
      merged.push([start, end]);
    } else if (end > last[1]) {
      last[1] = end;
    }
  }

  const result: Array<[number, number]> = [];
  for (const [baseStart, baseEnd] of base) {
    let cursor = baseStart;
    for (const [start, end] of merged) {
      if (end < cursor) {
        continue;
      }
      if (start > baseEnd) {
        break;
      }
      if (start > cursor) {
        result.push([cursor, Math.min(start - 1, baseEnd)]);
      }
      cursor = Math.max(cursor, end + 1);
      if (cursor > baseEnd) {
        break;
      }
    }
    if (cursor <= baseEnd) {
      result.push([cursor, baseEnd]);
    }
  }

  return result;
}
