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
  const formatted = args.length > 0 ? format(message, ...args) : message;
  const wrapped = useAnsi && prefix ? `${prefix}${formatted}${reset}` : formatted;
  if (toStderr) {
    process.stderr.write(wrapped);
  } else {
    process.stdout.write(wrapped);
  }
}
