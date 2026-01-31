// Ported from pocketbase/tools/inflector/inflector.go

const columnifyRemoveRegex = /[^\w.*\-_@#]+/g;
const snakecaseSplitRegex = /[\W_]+/g;

export function ucFirst(value: string): string {
  if (!value) {
    return "";
  }
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

export function columnify(value: string): string {
  return value.replace(columnifyRemoveRegex, "");
}

export function sentenize(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const result = ucFirst(trimmed);
  const lastChar = result.slice(-1);
  if (lastChar === "." || lastChar === "?" || lastChar === "!") {
    return result;
  }
  return `${result}.`;
}

export function sanitize(value: string, removePattern: string): string {
  const regex = new RegExp(removePattern);
  return value.replace(regex, "");
}

export function snakecase(value: string): string {
  const parts = value.split(snakecaseSplitRegex);
  const result: string[] = [];

  for (const part of parts) {
    if (!part) {
      continue;
    }
    let segment = "";
    for (let i = 0; i < part.length; i += 1) {
      const char = part[i] ?? "";
      const prev = i > 0 ? (part[i - 1] ?? "") : "";
      const isUpper = char !== char.toLowerCase();
      const prevIsUpper = prev !== prev.toLowerCase();
      if (i > 0 && isUpper && !prevIsUpper) {
        segment += "_";
      }
      segment += char;
    }
    result.push(segment);
  }

  return result.join("_").toLowerCase();
}

export function camelize(value: string): string {
  let result = "";
  let prevSpecial = false;

  for (const char of value) {
    const isAlphaNum = /[A-Za-z0-9]/.test(char);
    if (!isAlphaNum) {
      prevSpecial = true;
      continue;
    }

    if (prevSpecial || result.length === 0) {
      result += char.toUpperCase();
      prevSpecial = false;
    } else {
      result += char;
    }
  }

  return result;
}
