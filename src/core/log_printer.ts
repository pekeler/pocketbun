// Ported from pocketbase/core/log_printer.go

import { format } from "node:util";
import type { Log } from "../tools/logger/log.ts";
import { toStringValue } from "../internal/compat/cast.ts";
import * as slog from "../internal/compat/slog.ts";
import { Store } from "../tools/store/store.ts";
import { JSONMap } from "../tools/types/json_map.ts";

type ColorAttr = number;

type Color = {
  Sprint: (value: string) => string;
  Sprintf: (template: string, ...args: unknown[]) => string;
};

const Bold: ColorAttr = 1;
const FgHiBlack: ColorAttr = 90;
const FgWhite: ColorAttr = 37;
const FgYellow: ColorAttr = 33;
const FgRed: ColorAttr = 31;
const FgCyan: ColorAttr = 36;
const FgHiRed: ColorAttr = 91;

const cachedColors = new Store<string, Color>(null);

// getColor returns a cached color wrapper (if not already).
function getColor(...attrs: ColorAttr[]): Color {
  const cacheKey = attrs.join(",");
  const cached = cachedColors.get(cacheKey);
  if (cached) {
    return cached;
  }

  const color: Color = {
    Sprint: (value: string) => wrapColor(value, attrs),
    Sprintf: (template: string, ...args: unknown[]) => wrapColor(format(template, ...args), attrs),
  };

  cachedColors.set(cacheKey, color);
  return color;
}

function wrapColor(value: string, attrs: ColorAttr[]): string {
  if (attrs.length === 0) {
    return value;
  }
  return `\u001b[${attrs.join(";")}m${value}\u001b[0m`;
}

// printLog prints the provided log to stderr.
// (note: defined as mutable to allow overriding in tests like the Go version).
export const printLog = {
  fn: (log: Log) => {
    let output = "";

    switch (Number(log.Level)) {
      case Number(slog.LevelDebug):
        output += getColor(Bold, FgHiBlack).Sprint("DEBUG ");
        output += getColor(FgWhite).Sprint(log.Message);
        break;
      case Number(slog.LevelInfo):
        output += getColor(Bold, FgWhite).Sprint("INFO ");
        output += getColor(FgWhite).Sprint(log.Message);
        break;
      case Number(slog.LevelWarn):
        output += getColor(Bold, FgYellow).Sprint("WARN ");
        output += getColor(FgYellow).Sprint(log.Message);
        break;
      case Number(slog.LevelError):
        output += getColor(Bold, FgRed).Sprint("ERROR ");
        output += getColor(FgRed).Sprint(log.Message);
        break;
      default:
        output += getColor(Bold, FgCyan).Sprintf("[%d] ", Number(log.Level));
        output += getColor(FgCyan).Sprint(log.Message);
        break;
    }

    output += "\n";

    const data = log.Data instanceof JSONMap ? log.Data.toJSON() : ((log.Data ?? {}) as Record<string, unknown>);
    if (toStringValue(data.type) === "request") {
      let padding = 0;
      const keys = ["error", "details"];
      for (const key of keys) {
        const value = data[key];
        if (value != null) {
          output += getColor(FgHiRed).Sprintf("%s└─ %s", " ".repeat(padding), format("%o", value));
          output += "\n";
          padding += 3;
        }
      }
    } else if (Object.keys(data).length > 0) {
      output += getColor(FgHiBlack).Sprintf("└─ %s", format("%o", data));
      output += "\n";
    }

    process.stderr.write(output);
  },
};
