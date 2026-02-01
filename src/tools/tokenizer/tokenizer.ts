// Ported from pocketbase/tools/tokenizer/tokenizer.go

const eof = "\0";

// DefaultSeparators is a list with the default token separator characters.
export const DefaultSeparators = [","];

const whitespaceChars = ["\t", "\n", "\v", "\f", "\r", " ", "\u0085", "\u00A0"];

// Tokenizer defines a struct that parses a reader into tokens while
// respecting quotes and parenthesis boundaries.
export class Tokenizer {
  #input: string;
  #index = 0;
  #trimCutset = "";
  #separators: string[] = [];
  #keepSeparator = false;
  #keepEmptyTokens = false;
  #ignoreParenthesis = false;

  constructor(input: string) {
    this.#input = input;
    this.separators(...DefaultSeparators);
  }

  separators(...separators: string[]): void {
    this.#separators = separators;
    this.rebuildTrimCutset();
  }

  keepSeparator(state: boolean): void {
    this.#keepSeparator = state;
  }

  keepEmptyTokens(state: boolean): void {
    this.#keepEmptyTokens = state;
  }

  ignoreParenthesis(state: boolean): void {
    this.#ignoreParenthesis = state;
  }

  scan(): string | null {
    const ch = this.read();
    if (ch === eof) {
      return null;
    }
    this.unread();

    const token = this.readToken();
    if (!this.#keepEmptyTokens && token === "") {
      return this.scan();
    }

    return token;
  }

  scanAll(): string[] {
    const tokens: string[] = [];
    for (;;) {
      const token = this.scan();
      if (token === null) {
        break;
      }
      tokens.push(token);
    }
    return tokens;
  }

  // readToken reads a single token from the buffer and returns it.
  private readToken(): string {
    let buf = "";
    let parenthesis = 0;
    let quoteCh = "";
    let prevCh = "";

    for (;;) {
      const ch = this.read();
      if (ch === eof) {
        break;
      }

      if (!this.isEscapeRune(prevCh)) {
        if (!this.#ignoreParenthesis && ch === "(" && quoteCh === "") {
          parenthesis += 1;
        } else if (!this.#ignoreParenthesis && ch === ")" && parenthesis > 0 && quoteCh === "") {
          parenthesis -= 1;
        } else if (this.isQuoteRune(ch)) {
          switch (quoteCh) {
            case ch:
              quoteCh = "";
              break;
            case "":
              quoteCh = ch;
              break;
          }
        }
      }

      if (this.isSeparatorRune(ch) && parenthesis === 0 && quoteCh === "") {
        if (this.#keepSeparator) {
          buf += ch;
        }
        break;
      }

      prevCh = ch;
      buf += ch;
    }

    if (parenthesis > 0 || quoteCh !== "") {
      throw new Error(`unbalanced parenthesis or quoted expression: ${JSON.stringify(buf)}`);
    }

    return trimByCutset(buf, this.#trimCutset);
  }

  // read reads the next rune from the buffered reader.
  // Returns the `rune(0)` if an error or `io.EOF` occurs.
  private read(): string {
    if (this.#index >= this.#input.length) {
      return eof;
    }

    const ch = this.#input[this.#index] ?? "";
    this.#index += 1;
    return ch;
  }

  // unread places the previously read rune back on the reader.
  private unread(): void {
    if (this.#index > 0) {
      this.#index -= 1;
    }
  }

  // rebuildTrimCutset rebuilds the tokenizer trimCutset based on its separator runes.
  private rebuildTrimCutset(): void {
    let cutset = "";
    for (const ch of whitespaceChars) {
      if (this.isSeparatorRune(ch)) {
        continue;
      }
      cutset += ch;
    }
    this.#trimCutset = cutset;
  }

  private isSeparatorRune(ch: string): boolean {
    return this.#separators.includes(ch);
  }

  // isQuoteRune checks if a rune is a quote.
  private isQuoteRune(ch: string): boolean {
    return ch === "'" || ch === '"' || ch === "`";
  }

  // isEscapeRune checks if a rune is an escape character.
  private isEscapeRune(ch: string): boolean {
    return ch === "\\";
  }
}

export function newFromString(value: string): Tokenizer {
  return new Tokenizer(value);
}

export function newFromBytes(value: Uint8Array): Tokenizer {
  return new Tokenizer(new TextDecoder().decode(value));
}

export function newTokenizer(value: string): Tokenizer {
  return new Tokenizer(value);
}

function trimByCutset(value: string, cutset: string): string {
  if (value === "") {
    return "";
  }

  let start = 0;
  let end = value.length;

  while (start < end && cutset.includes(value[start] ?? "")) {
    start += 1;
  }

  while (end > start && cutset.includes(value[end - 1] ?? "")) {
    end -= 1;
  }

  return value.slice(start, end);
}
