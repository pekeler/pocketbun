// Ported from pocketbase/tools/picker/excerpt_modifier.go

import { toNumberValue } from "../../internal/compat/cast.ts";
import { existInSlice } from "../list/list.ts";
import { Modifiers, type Modifier } from "./modifiers.ts";

const whitespaceRegex = /\s+/g;

const excludeTags = [
  "head",
  "style",
  "script",
  "iframe",
  "embed",
  "applet",
  "object",
  "svg",
  "img",
  "picture",
  "dialog",
  "template",
  "button",
  "form",
  "textarea",
  "input",
  "select",
  "option",
];

const inlineTags = [
  "a",
  "abbr",
  "acronym",
  "b",
  "bdo",
  "big",
  "br",
  "button",
  "cite",
  "code",
  "em",
  "i",
  "label",
  "q",
  "small",
  "span",
  "strong",
  "strike",
  "sub",
  "sup",
  "time",
];

export class ExcerptModifier implements Modifier {
  max: number;
  withEllipsis: boolean;

  constructor(max: number, withEllipsis: boolean) {
    this.max = max;
    this.withEllipsis = withEllipsis;
  }

  Modify(value: unknown): unknown {
    if (typeof value !== "string") {
      return value;
    }

    let result = stripHtml(value, this.max);

    if (result.length > this.max) {
      const runes = Array.from(result);
      if (runes.length > this.max) {
        result = runes.slice(0, this.max).join("");
        result = result.trim();
        if (this.withEllipsis) {
          result += "...";
        }
      }
    }

    return result;
  }
}

export function newExcerptModifier(...args: string[]): ExcerptModifier {
  if (args.length === 0) {
    throw new Error("max argument is required - expected (max, withEllipsis?)");
  }

  if (args.length > 2) {
    throw new Error("too many arguments - expected (max, withEllipsis?)");
  }

  const max = Math.trunc(toNumberValue(args[0]));
  if (max === 0) {
    throw new Error("max argument must be > 0");
  }

  let withEllipsis = false;
  if (args.length > 1) {
    withEllipsis = parseBool(args[1] ?? "");
  }

  return new ExcerptModifier(max, withEllipsis);
}

Modifiers["excerpt"] = (...args: string[]) => newExcerptModifier(...args);

function stripHtml(value: string, max: number): string {
  let result = "";
  let hasPrevSpace = false;
  let index = 0;
  const ignoreStack: string[] = [];
  let reachedMax = false;

  const appendText = (text: string) => {
    if (text === "") {
      return;
    }

    let txt = text.replace(whitespaceRegex, " ");
    if (hasPrevSpace) {
      txt = txt.replace(/^ +/, "");
    }

    if (txt !== "") {
      hasPrevSpace = txt.endsWith(" ");
      result += txt;
      if (result.length > max + 2) {
        reachedMax = true;
      }
    }
  };

  while (index < value.length && !reachedMax) {
    const lt = value.indexOf("<", index);
    if (lt === -1) {
      if (ignoreStack.length === 0) {
        appendText(value.slice(index));
      }
      break;
    }

    if (ignoreStack.length === 0) {
      appendText(value.slice(index, lt));
    }
    if (reachedMax) {
      break;
    }

    const gt = value.indexOf(">", lt + 1);
    if (gt === -1) {
      appendText(value.slice(lt));
      break;
    }

    const rawTag = value.slice(lt + 1, gt);
    if (rawTag.startsWith("!--")) {
      const endComment = value.indexOf("-->", lt + 4);
      if (endComment === -1) {
        index = gt + 1;
        continue;
      }
      index = endComment + 3;
      continue;
    }

    let content = rawTag.trim();
    if (!content) {
      index = gt + 1;
      continue;
    }

    let closing = false;
    if (content.startsWith("/")) {
      closing = true;
      content = content.slice(1).trim();
    }

    let selfClosing = false;
    if (content.endsWith("/")) {
      selfClosing = true;
      content = content.slice(0, -1).trim();
    }

    const spaceIdx = content.search(/\s/);
    const tagName = (spaceIdx >= 0 ? content.slice(0, spaceIdx) : content).toLowerCase();
    if (!tagName) {
      index = gt + 1;
      continue;
    }

    if (ignoreStack.length > 0) {
      if (closing && ignoreStack[ignoreStack.length - 1] === tagName) {
        ignoreStack.pop();
      }
      index = gt + 1;
      continue;
    }

    if (existInSlice(tagName, excludeTags)) {
      if (!closing && !selfClosing) {
        ignoreStack.push(tagName);
      }
      index = gt + 1;
      continue;
    }

    const isBlock = !existInSlice(tagName, inlineTags);
    if (isBlock && !hasPrevSpace) {
      result += " ";
      hasPrevSpace = true;
    }

    index = gt + 1;
  }

  return result.trim();
}

function parseBool(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (["1", "t", "true", "y", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "f", "false", "n", "no", "off", ""].includes(normalized)) {
    return false;
  }
  return false;
}
