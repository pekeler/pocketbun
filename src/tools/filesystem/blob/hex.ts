// Ported from pocketbase/tools/filesystem/blob/hex.go

// HexEscape returns s, with all runes for which shouldEscape returns true
// escaped to "__0xXXX__", where XXX is the hex representation of the rune
// value. For example, " " would escape to "__0x20__".
export function HexEscape(s: string, shouldEscape: (runes: string[], index: number) => boolean): string {
  const runes = Array.from(s);
  const toEscape: number[] = [];
  for (let i = 0; i < runes.length; i += 1) {
    if (shouldEscape(runes, i)) {
      toEscape.push(i);
    }
  }
  if (toEscape.length === 0) {
    return s;
  }

  const escaped: string[] = Array.from({ length: runes.length + 13 * toEscape.length }, () => "");
  let n = 0;
  let j = 0;
  for (let i = 0; i < runes.length; i += 1) {
    if (n < toEscape.length && i === toEscape[n]) {
      const codePoint = runes[i]?.codePointAt(0) ?? 0;
      const replacement = `__0x${codePoint.toString(16)}__`;
      for (const ch of replacement) {
        escaped[j] = ch;
        j += 1;
      }
      n += 1;
    } else {
      escaped[j] = runes[i] ?? "";
      j += 1;
    }
  }

  return escaped.slice(0, j).join("");
}

function unescape(runes: string[], index: number): [boolean, string, number] {
  let i = index;
  if (runes[i] !== "_") {
    return [false, "", 0];
  }
  i += 1;
  if (i >= runes.length || runes[i] !== "_") {
    return [false, "", 0];
  }
  i += 1;
  if (i >= runes.length || runes[i] !== "0") {
    return [false, "", 0];
  }
  i += 1;
  if (i >= runes.length || runes[i] !== "x") {
    return [false, "", 0];
  }
  i += 1;

  const digits: string[] = [];
  for (; i < runes.length && runes[i] !== "_"; i += 1) {
    digits.push(runes[i] ?? "");
  }

  if (i >= runes.length || runes[i] !== "_") {
    return [false, "", 0];
  }
  i += 1;
  if (i >= runes.length || runes[i] !== "_") {
    return [false, "", 0];
  }

  const value = Number.parseInt(digits.join(""), 16);
  if (!Number.isFinite(value)) {
    return [false, "", 0];
  }

  return [true, String.fromCodePoint(value), i];
}

// HexUnescape reverses HexEscape.
export function HexUnescape(s: string): string {
  const runes = Array.from(s);
  let unescaped: string[] | null = null;

  for (let i = 0; i < runes.length; i += 1) {
    const [ok, rune, newIndex] = unescape(runes, i);
    if (ok) {
      if (!unescaped) {
        unescaped = runes.slice(0, i);
      }
      unescaped.push(rune);
      i = newIndex;
      continue;
    }
    if (unescaped) {
      unescaped.push(runes[i] ?? "");
    }
  }

  if (!unescaped) {
    return s;
  }

  return unescaped.join("");
}
