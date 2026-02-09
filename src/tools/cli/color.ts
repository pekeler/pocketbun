// PocketBun-only: CLI color helpers using Bun's built-in ANSI color support.

import { format } from "node:util";

const reset = "\u001b[0m";
const bgGreen = "\u001b[42m";
const useAnsi = Bun.enableANSIColors;
const colorCache = new Map<string, string>();

export function green(message: string, ...args: unknown[]): void {
  writeColor(ansiColor("green"), message, args, false);
}

export function yellow(message: string, ...args: unknown[]): void {
  writeColor(ansiColor("yellow"), message, args, false);
}

export function cyan(message: string, ...args: unknown[]): void {
  writeColor(ansiColor("cyan"), message, args, false);
}

export function hiBlack(message: string, ...args: unknown[]): void {
  writeColor(ansiColor("dimgray"), message, args, false);
}

export function red(message: string, ...args: unknown[]): void {
  writeColor(ansiColor("red"), message, args, true);
}

export function bgGreenFgBlack(message: string, ...args: unknown[]): void {
  const fg = ansiColor("black");
  const prefix = useAnsi ? `${bgGreen}${fg}` : "";
  writeColor(prefix, message, args, false);
}

function ansiColor(name: string): string {
  const cached = colorCache.get(name);
  if (cached != null) {
    return cached;
  }
  const raw = Bun.color(name, "ansi-256");
  const value = typeof raw === "string" ? raw : "";
  colorCache.set(name, value);
  return value;
}

function writeColor(prefix: string, message: string, args: unknown[], toStderr: boolean): void {
  const { message: normalizedMessage, args: normalizedArgs } = normalizeGoFormatSpecifiers(message, args);
  const formatted = normalizedArgs.length > 0 ? format(normalizedMessage, ...normalizedArgs) : normalizedMessage;
  const wrapped = useAnsi && prefix ? `${prefix}${formatted}${reset}` : formatted;
  if (toStderr) {
    process.stderr.write(wrapped);
  } else {
    process.stdout.write(wrapped);
  }
}

function normalizeGoFormatSpecifiers(message: string, args: unknown[]): { message: string; args: unknown[] } {
  if (args.length === 0 || !message.includes("%q")) {
    return { message, args };
  }

  let argIndex = 0;
  let normalizedMessage = "";
  const normalizedArgs: unknown[] = [];

  for (let i = 0; i < message.length; i += 1) {
    const ch = message[i];
    if (ch !== "%") {
      normalizedMessage += ch;
      continue;
    }

    const next = message[i + 1];
    if (next == null) {
      normalizedMessage += ch;
      continue;
    }

    if (next === "%") {
      normalizedMessage += "%%";
      i += 1;
      continue;
    }

    if (next === "q") {
      normalizedMessage += "%s";
      const value = argIndex < args.length ? args[argIndex] : undefined;
      normalizedArgs.push(quoteValue(value));
      argIndex += 1;
      i += 1;
      continue;
    }

    normalizedMessage += ch;
  }

  if (argIndex < args.length) {
    normalizedArgs.push(...args.slice(argIndex));
  }

  return { message: normalizedMessage, args: normalizedArgs };
}

function quoteValue(value: unknown): string {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  try {
    const json = JSON.stringify(value);
    if (typeof json === "string") {
      return json;
    }
  } catch {
    // ignore JSON serialization errors and fallback to String(value)
  }

  return JSON.stringify(String(value));
}
