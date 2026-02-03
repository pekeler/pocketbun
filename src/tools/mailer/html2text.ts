// Ported from pocketbase/tools/mailer/html2text.go
// Deviation: uses a lightweight tokenizer instead of Go's html parser.

import { existInSlice } from "../list/list.ts";

const whitespaceRegex = /\s+/g;

const tagsToSkip = [
  "style",
  "script",
  "iframe",
  "applet",
  "object",
  "svg",
  "img",
  "button",
  "form",
  "textarea",
  "input",
  "select",
  "option",
  "template",
];

const inlineTags = ["a", "span", "small", "strike", "strong", "sub", "sup", "em", "b", "u", "i"];

const voidTags = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

class StringBuilder {
  #parts: string[] = [];

  write(value: string): void {
    if (value) {
      this.#parts.push(value);
    }
  }

  toString(): string {
    return this.#parts.join("");
  }

  reset(): void {
    this.#parts = [];
  }
}

// Very rudimentary auto HTML to Text mail body converter.
//
// Caveats:
// - This method doesn't check for correctness of the HTML document.
// - Links will be converted to "[text](url)" format.
// - List items (<li>) are prefixed with "- ".
// - Indentation is stripped (both tabs and spaces).
// - Trailing spaces are preserved.
// - Multiple consequence newlines are collapsed as one unless multiple <br> tags are used.
export function html2Text(htmlDocument: string): [string, Error | null] {
  try {
    const builder = new StringBuilder();
    const linkStack: Array<{ href: string; builder: StringBuilder }> = [];
    const skipStack: string[] = [];
    let canAddNewLine = false;

    const tokens = tokenizeHTML(htmlDocument);

    for (const token of tokens) {
      if (token.type === "comment" || token.type === "doctype") {
        continue;
      }

      if (token.type === "end") {
        const tagName = token.name;
        if (skipStack.length > 0) {
          if (skipStack[skipStack.length - 1] === tagName) {
            skipStack.pop();
          }
          continue;
        }

        if (tagName === "a" && linkStack.length > 0) {
          const linkFrame = linkStack.pop()!;
          const linkText = linkFrame.builder.toString().trim() || "LINK";
          builder.write("[");
          builder.write(linkText);
          builder.write("]");

          if (linkFrame.href) {
            builder.write("(");
            builder.write(linkFrame.href);
            builder.write(")");
          }

          linkFrame.builder.reset();
        }
        continue;
      }

      if (token.type === "start") {
        const tagName = token.name;
        const isVoid = token.selfClosing || voidTags.has(tagName);

        if (skipStack.length > 0) {
          if (!isVoid && existInSlice(tagName, tagsToSkip)) {
            skipStack.push(tagName);
          }
          continue;
        }

        if (existInSlice(tagName, tagsToSkip)) {
          if (!isVoid) {
            skipStack.push(tagName);
          }
          continue;
        }

        const linkFrame = linkStack[linkStack.length - 1];
        const activeBuilder = linkFrame ? linkFrame.builder : builder;

        if (tagName === "br") {
          activeBuilder.write("\r\n");
          canAddNewLine = false;
        } else if (canAddNewLine && !existInSlice(tagName, inlineTags)) {
          activeBuilder.write("\r\n");
          canAddNewLine = false;
        }

        if (tagName === "li") {
          activeBuilder.write("- ");
        }

        if (tagName === "a") {
          const href = token.attrs.href ?? "";
          linkStack.push({ href, builder: new StringBuilder() });
        }

        continue;
      }

      if (token.type === "text") {
        if (skipStack.length > 0) {
          continue;
        }

        let txt = token.value.replace(whitespaceRegex, " ");
        if (!canAddNewLine) {
          txt = txt.replace(/^ +/, "");
        }

        if (txt) {
          const linkFrame = linkStack[linkStack.length - 1];
          const activeBuilder = linkFrame ? linkFrame.builder : builder;
          activeBuilder.write(txt);
          canAddNewLine = true;
        }
      }
    }

    while (linkStack.length > 0) {
      const linkFrame = linkStack.pop()!;
      const linkText = linkFrame.builder.toString().trim() || "LINK";
      builder.write("[");
      builder.write(linkText);
      builder.write("]");
      if (linkFrame.href) {
        builder.write("(");
        builder.write(linkFrame.href);
        builder.write(")");
      }
      linkFrame.builder.reset();
    }

    return [builder.toString().trim(), null];
  } catch (error) {
    return ["", error as Error];
  }
}

type Token =
  | { type: "text"; value: string }
  | { type: "comment" }
  | { type: "doctype" }
  | { type: "start"; name: string; attrs: Record<string, string>; selfClosing: boolean }
  | { type: "end"; name: string };

function tokenizeHTML(input: string): Token[] {
  const tokens: Token[] = [];
  const regex = /<!--([\s\S]*?)-->|<!DOCTYPE[^>]*>|<\/?[^>]+>|[^<]+/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(input)) !== null) {
    const value = match[0];
    if (value.startsWith("<!--")) {
      tokens.push({ type: "comment" });
      continue;
    }
    if (value.toLowerCase().startsWith("<!doctype")) {
      tokens.push({ type: "doctype" });
      continue;
    }
    if (value.startsWith("</")) {
      const name = parseTagName(value);
      if (name) {
        tokens.push({ type: "end", name });
      }
      continue;
    }
    if (value.startsWith("<")) {
      const name = parseTagName(value);
      if (name) {
        tokens.push({
          type: "start",
          name,
          attrs: parseAttributes(value),
          selfClosing: /\/\s*>$/.test(value),
        });
      }
      continue;
    }

    tokens.push({ type: "text", value });
  }

  return tokens;
}

function parseTagName(value: string): string {
  const match = value.match(/^<\/?\s*([a-zA-Z0-9:-]+)/);
  const name = match?.[1];
  return name ? name.toLowerCase() : "";
}

function parseAttributes(value: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRegex = /([a-zA-Z0-9:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match: RegExpExecArray | null;

  while ((match = attrRegex.exec(value)) !== null) {
    const key = match?.[1];
    if (!key) {
      continue;
    }
    const raw = match[3] ?? match[4] ?? match[5] ?? "";
    attrs[key.toLowerCase()] = raw;
  }

  return attrs;
}
