// Ported from pocketbase/tools/filesystem/file.go

import { readFileSync, statSync } from "node:fs";
import { basename } from "node:path";
import { snakecase } from "../inflector/inflector.ts";
import { randomStringWithAlphabet } from "../security/random.ts";

export interface ReadSeekCloser {
  read(size?: number): Uint8Array | null;
  readAll(): Uint8Array;
  seek(offset: number, whence?: number): number;
  close(): void;
  size(): number;
}

export interface FileReader {
  Open(): ReadSeekCloser;
}

export class File {
  Reader: FileReader | null = null;
  Name = "";
  OriginalName = "";
  Size = 0;

  AsMap(): Record<string, unknown> {
    return {
      name: this.Name,
      originalName: this.OriginalName,
      size: this.Size,
    };
  }

  toJSON(): Record<string, unknown> {
    return this.AsMap();
  }
}

export type MultipartFileHeader = {
  filename: string;
  size: number;
  buffer: Uint8Array;
};

export function NewFileFromPath(path: string): File {
  const info = statSync(path);

  const f = new File();
  f.Reader = new PathReader(path);
  f.Size = info.size;
  f.OriginalName = basename(path);
  f.Name = normalizeName(f.Reader, f.OriginalName);
  return f;
}

export function NewFileFromBytes(bytes: Uint8Array | null | undefined, name: string): File {
  const size = bytes?.length ?? 0;
  if (size === 0) {
    throw new Error("cannot create an empty file");
  }

  const f = new File();
  f.Reader = new BytesReader(bytes ?? new Uint8Array());
  f.Size = size;
  f.OriginalName = name;
  f.Name = normalizeName(f.Reader, f.OriginalName);
  return f;
}

export function NewFileFromMultipart(header: MultipartFileHeader): File {
  const f = new File();
  f.Reader = new MultipartReader(header.buffer);
  f.Size = header.size;
  f.OriginalName = header.filename;
  f.Name = normalizeName(f.Reader, f.OriginalName);
  return f;
}

export async function NewFileFromURL(ctx: AbortSignal | null, url: string): Promise<File> {
  const res = await fetch(url, { signal: ctx ?? undefined });
  if (!res.ok) {
    throw new Error(`failed to download url ${url} (${res.status})`);
  }

  const data = new Uint8Array(await res.arrayBuffer());
  const rawName = basename(new URL(url).pathname);
  let originalName = rawName;
  try {
    originalName = decodeURIComponent(rawName);
  } catch {
    // Keep rawName if decoding fails.
  }
  return NewFileFromBytes(data, originalName);
}

export class MultipartReader implements FileReader {
  #buffer: Uint8Array;

  constructor(buffer: Uint8Array) {
    this.#buffer = buffer;
  }

  Open(): ReadSeekCloser {
    return new BufferReadSeekCloser(this.#buffer);
  }
}

export class PathReader implements FileReader {
  Path: string;

  constructor(path: string) {
    this.Path = path;
  }

  Open(): ReadSeekCloser {
    return new BufferReadSeekCloser(readFileSync(this.Path));
  }
}

export class BytesReader implements FileReader {
  Bytes: Uint8Array;

  constructor(bytes: Uint8Array) {
    this.Bytes = bytes;
  }

  Open(): ReadSeekCloser {
    return new BufferReadSeekCloser(this.Bytes);
  }
}

export type OpenFuncAsReader = () => ReadSeekCloser;

export function openFuncAsReader(fn: OpenFuncAsReader): FileReader {
  return {
    Open: fn,
  };
}

class BufferReadSeekCloser implements ReadSeekCloser {
  #buffer: Uint8Array;
  #offset: number;

  constructor(buffer: Uint8Array) {
    this.#buffer = buffer;
    this.#offset = 0;
  }

  read(size?: number): Uint8Array | null {
    if (this.#offset >= this.#buffer.length) {
      return null;
    }
    const end =
      size && size > 0 ? Math.min(this.#buffer.length, this.#offset + size) : this.#buffer.length;
    const chunk = this.#buffer.slice(this.#offset, end);
    this.#offset = end;
    return chunk;
  }

  readAll(): Uint8Array {
    return this.read() ?? new Uint8Array();
  }

  seek(offset: number, whence = 0): number {
    if (whence === 1) {
      this.#offset += offset;
    } else if (whence === 2) {
      this.#offset = this.#buffer.length + offset;
    } else {
      this.#offset = offset;
    }
    if (this.#offset < 0) {
      this.#offset = 0;
    }
    if (this.#offset > this.#buffer.length) {
      this.#offset = this.#buffer.length;
    }
    return this.#offset;
  }

  close(): void {}

  size(): number {
    return this.#buffer.length;
  }
}

const extInvalidCharsRegex = /[^\w.*\-+=#]+/g;
const randomAlphabet = "abcdefghijklmnopqrstuvwxyz0123456789";

export function normalizeName(fr: FileReader, name: string): string {
  const originalLength = name.length;
  if (originalLength > 300) {
    name = name.slice(originalLength - 300);
  }

  const originalExt = extractExtension(name);
  let cleanExt = `.${originalExt.replace(extInvalidCharsRegex, "").replace(/^\.+|\.+$/g, "")}`;
  if (cleanExt === ".") {
    cleanExt = detectExtension(fr) ?? ".";
  }
  if (cleanExt === ".") {
    cleanExt = ".";
  }
  if (cleanExt.length > 20) {
    cleanExt = `.${cleanExt.slice(cleanExt.length - 20).replace(/^\.+|\.+$/g, "")}`;
  }

  let baseName = name;
  if (originalExt && baseName.endsWith(originalExt)) {
    baseName = baseName.slice(0, -originalExt.length);
  }
  baseName = baseName.replace(/^\.+|\.+$/g, "");
  let cleanName = snakecase(baseName);

  if (cleanName.length < 3) {
    cleanName += randomStringWithAlphabet(10, randomAlphabet);
  } else if (cleanName.length > 100) {
    cleanName = cleanName.slice(0, 100);
  }

  return `${cleanName}_${randomStringWithAlphabet(10, randomAlphabet)}${cleanExt}`;
}

export function extractExtension(name: string): string {
  const primaryDot = name.lastIndexOf(".");
  if (primaryDot === -1) {
    return "";
  }
  const secondaryDot = name.lastIndexOf(".", primaryDot - 1);
  if (secondaryDot >= 0) {
    return name.slice(secondaryDot);
  }
  return name.slice(primaryDot);
}

export function detectExtension(fr: FileReader): string | null {
  const reader = fr.Open();
  const raw = reader.readAll();
  reader.close();

  const mime = detectMimeTypeFromBytes(raw);
  return mimeToExtension(mime);
}

export function detectMimeTypeFromBytes(raw: Uint8Array): string {
  if (raw.length >= 8) {
    const pngSig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    let isPng = true;
    for (let i = 0; i < pngSig.length; i += 1) {
      if (raw[i] !== pngSig[i]) {
        isPng = false;
        break;
      }
    }
    if (isPng) {
      return "image/png";
    }
  }

  if (raw.length >= 3 && raw[0] === 0xff && raw[1] === 0xd8 && raw[2] === 0xff) {
    return "image/jpeg";
  }

  if (raw.length >= 6) {
    const header = new TextDecoder().decode(raw.slice(0, 6));
    if (header === "GIF87a" || header === "GIF89a") {
      return "image/gif";
    }
  }

  if (raw.length >= 12) {
    const riff = new TextDecoder().decode(raw.slice(0, 4));
    const webp = new TextDecoder().decode(raw.slice(8, 12));
    if (riff === "RIFF" && webp === "WEBP") {
      return "image/webp";
    }
  }

  const textSample = new TextDecoder().decode(raw.slice(0, Math.min(raw.length, 1024)));
  if (textSample.includes("<svg")) {
    return "image/svg+xml";
  }

  let isText = true;
  for (const byte of raw) {
    if (byte === 0) {
      isText = false;
      break;
    }
    if (byte < 9 || (byte > 13 && byte < 32)) {
      isText = false;
      break;
    }
  }
  if (isText) {
    return "text/plain; charset=utf-8";
  }

  return "application/octet-stream";
}

export function mimeToExtension(mime: string): string | null {
  const base = mime.split(";")[0]?.trim();
  switch (base) {
    case "image/png":
      return ".png";
    case "image/jpeg":
      return ".jpg";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    case "image/svg+xml":
      return ".svg";
    case "text/plain":
    case "text/plain; charset=utf-8":
      return ".txt";
    default:
      return null;
  }
}
