// Ported from pocketbase/tools/inflector/singularize.go

import { Store } from "../store/store.ts";

const compiledPatterns = new Store<string, RegExp | null>(null, null);

const singularRules: Array<{ pattern: string; replacement: string }> = [
  { pattern: "(?i)([nrlm]ese|deer|fish|sheep|measles|ois|pox|media|ss)$", replacement: "${1}" },
  { pattern: "(?i)^(sea[- ]bass)$", replacement: "${1}" },
  { pattern: "(?i)(s)tatuses$", replacement: "${1}tatus" },
  { pattern: "(?i)(f)eet$", replacement: "${1}oot" },
  { pattern: "(?i)(t)eeth$", replacement: "${1}ooth" },
  { pattern: "(?i)^(.*)(menu)s$", replacement: "${1}${2}" },
  { pattern: "(?i)(quiz)zes$", replacement: "${1}" },
  { pattern: "(?i)(matr)ices$", replacement: "${1}ix" },
  { pattern: "(?i)(vert|ind)ices$", replacement: "${1}ex" },
  { pattern: "(?i)^(ox)en", replacement: "${1}" },
  { pattern: "(?i)(alias)es$", replacement: "${1}" },
  { pattern: "(?i)(alumn|bacill|cact|foc|fung|nucle|radi|stimul|syllab|termin|viri?)i$", replacement: "${1}us" },
  { pattern: "(?i)([ftw]ax)es", replacement: "${1}" },
  { pattern: "(?i)(cris|ax|test)es$", replacement: "${1}is" },
  { pattern: "(?i)(shoe)s$", replacement: "${1}" },
  { pattern: "(?i)(o)es$", replacement: "${1}" },
  { pattern: "(?i)ouses$", replacement: "ouse" },
  { pattern: "(?i)([^a])uses$", replacement: "${1}us" },
  { pattern: "(?i)([m|l])ice$", replacement: "${1}ouse" },
  { pattern: "(?i)(x|ch|ss|sh)es$", replacement: "${1}" },
  { pattern: "(?i)(m)ovies$", replacement: "${1}ovie" },
  { pattern: "(?i)(s)eries$", replacement: "${1}eries" },
  { pattern: "(?i)([^aeiouy]|qu)ies$", replacement: "${1}y" },
  { pattern: "(?i)([lr])ves$", replacement: "${1}f" },
  { pattern: "(?i)(tive)s$", replacement: "${1}" },
  { pattern: "(?i)(hive)s$", replacement: "${1}" },
  { pattern: "(?i)(drive)s$", replacement: "${1}" },
  { pattern: "(?i)([^fo])ves$", replacement: "${1}fe" },
  { pattern: "(?i)(^analy)ses$", replacement: "${1}sis" },
  { pattern: "(?i)(analy|diagno|^ba|(p)arenthe|(p)rogno|(s)ynop|(t)he)ses$", replacement: "${1}${2}sis" },
  { pattern: "(?i)([ti])a$", replacement: "${1}um" },
  { pattern: "(?i)(p)eople$", replacement: "${1}erson" },
  { pattern: "(?i)(m)en$", replacement: "${1}an" },
  { pattern: "(?i)(c)hildren$", replacement: "${1}hild" },
  { pattern: "(?i)(n)ews$", replacement: "${1}ews" },
  { pattern: "(?i)(n)etherlands$", replacement: "${1}etherlands" },
  { pattern: "(?i)eaus$", replacement: "eau" },
  { pattern: "(?i)(currenc)ies$", replacement: "${1}y" },
  { pattern: "(?i)^(.*us)$", replacement: "${1}" },
  { pattern: "(?i)s$", replacement: "" },
];

export function singularize(word: string): string {
  if (word === "") {
    return "";
  }

  for (const rule of singularRules) {
    const re = compiledPatterns.getOrSet(rule.pattern, () => {
      try {
        const parsed = parsePattern(rule.pattern);
        return new RegExp(parsed.source, parsed.flags);
      } catch {
        return null;
      }
    });

    if (!re) {
      continue;
    }

    if (re.test(word)) {
      return word.replace(re, normalizeReplacement(rule.replacement));
    }
  }

  return word;
}

function parsePattern(pattern: string): { source: string; flags: string } {
  if (pattern.startsWith("(?i)")) {
    return { source: pattern.slice(4), flags: "i" };
  }
  return { source: pattern, flags: "" };
}

function normalizeReplacement(replacement: string): string {
  return replacement.replace(/\$\{(\d+)\}/g, (_match, group) => `$${group}`);
}
