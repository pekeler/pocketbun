// Ported from pocketbase/tools/filesystem/file.go

import { closeSync, openSync, readSync, statSync } from "node:fs";
import { open, readFile, stat } from "node:fs/promises";
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

type DisposableReadSeekCloser = ReadSeekCloser & Disposable;

// FileReader defines an interface for a file resource reader.
export interface FileReader {
  Open(): ReadSeekCloser;
}

// ReadFileReaderBytes returns the entire content of the provided FileReader.
export function ReadFileReaderBytes(reader: FileReader | null | undefined): Uint8Array {
  if (!reader) {
    return new Uint8Array();
  }

  using opened = reader.Open() as DisposableReadSeekCloser;
  return opened.readAll();
}

// ReadFileReaderBytesAsync is a PocketBun-only async alternative to ReadFileReaderBytes().
export async function ReadFileReaderBytesAsync(reader: FileReader | null | undefined): Promise<Uint8Array> {
  if (!reader) {
    return new Uint8Array();
  }

  if (reader instanceof PathReader) {
    // PocketBun async deviation: avoid sync disk reads for path-backed files.
    return await readFile(reader.Path);
  }

  return ReadFileReaderBytes(reader);
}

const mimeDetectionSampleSize = 4096;

function readFileReaderSampleBytes(reader: FileReader, maxBytes = mimeDetectionSampleSize): Uint8Array {
  if (reader instanceof PathReader) {
    const fd = openSync(reader.Path, "r");
    try {
      const raw = new Uint8Array(maxBytes);
      const read = readSync(fd, raw, 0, maxBytes, 0);
      return read > 0 ? raw.slice(0, read) : new Uint8Array();
    } finally {
      closeSync(fd);
    }
  }

  using opened = reader.Open() as DisposableReadSeekCloser;
  return opened.read(maxBytes) ?? new Uint8Array();
}

async function readFileReaderSampleBytesAsync(reader: FileReader, maxBytes = mimeDetectionSampleSize): Promise<Uint8Array> {
  if (reader instanceof PathReader) {
    await using handle = await open(reader.Path, "r");
    const raw = new Uint8Array(maxBytes);
    const result = await handle.read(raw, 0, maxBytes, 0);
    const read = result.bytesRead ?? 0;
    return read > 0 ? raw.slice(0, read) : new Uint8Array();
  }

  // Fallback for non-path readers that only expose sync Open()/read().
  return readFileReaderSampleBytes(reader, maxBytes);
}

// ReadFileReaderSampleBytes returns a small prefix of the provided FileReader content.
export function ReadFileReaderSampleBytes(
  reader: FileReader | null | undefined,
  maxBytes = mimeDetectionSampleSize,
): Uint8Array {
  if (!reader) {
    return new Uint8Array();
  }

  return readFileReaderSampleBytes(reader, maxBytes);
}

// ReadFileReaderSampleBytesAsync is a PocketBun-only async alternative to ReadFileReaderSampleBytes().
export async function ReadFileReaderSampleBytesAsync(
  reader: FileReader | null | undefined,
  maxBytes = mimeDetectionSampleSize,
): Promise<Uint8Array> {
  if (!reader) {
    return new Uint8Array();
  }

  return await readFileReaderSampleBytesAsync(reader, maxBytes);
}

// File defines a single file [io.ReadSeekCloser] resource.
//
// The file could be from a local path, multipart/form-data header, etc.
export class File {
  Reader: FileReader | null = null;
  Name = "";
  OriginalName = "";
  Size = 0;

  // AsMap implements [core.mapExtractor] and returns a value suitable
  // to be used in an API rule expression.
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

// NewFileFromPath creates a new File instance from the provided local file path.
export function NewFileFromPath(path: string): File {
  const info = statSync(path);

  const f = new File();
  f.Reader = new PathReader(path);
  f.Size = info.size;
  f.OriginalName = basename(path);
  f.Name = normalizeName(f.Reader, f.OriginalName);
  return f;
}

// NewFileFromPathWithOriginalName creates a new File instance from the
// provided local file path while preserving a separate uploaded original name.
export function NewFileFromPathWithOriginalName(path: string, originalName: string): File {
  const info = statSync(path);

  const f = new File();
  f.Reader = new PathReader(path);
  f.Size = info.size;
  f.OriginalName = originalName;
  f.Name = normalizeName(f.Reader, originalName);
  return f;
}

// NewFileFromPathAsync creates a new File instance from the provided local file path.
//
// Deviation: PocketBun-only async alternative that eagerly reads file content
// to avoid sync filesystem I/O in async runtime paths.
export async function NewFileFromPathAsync(path: string): Promise<File> {
  const info = await stat(path);

  const f = new File();
  f.Reader = new PathReader(path);
  f.Size = info.size;
  f.OriginalName = basename(path);
  f.Name = await normalizeNameAsync(f.Reader, f.OriginalName);
  return f;
}

// NewFileFromBytes creates a new File instance from the provided byte slice.
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

// NewFileFromMultipart creates a new File from the provided multipart header.
export function NewFileFromMultipart(header: MultipartFileHeader): File {
  const f = new File();
  f.Reader = new MultipartReader(header.buffer);
  f.Size = header.size;
  f.OriginalName = header.filename;
  f.Name = normalizeName(f.Reader, f.OriginalName);
  return f;
}

// NewFileFromURL creates a new File from the provided url by
// downloading the resource and load it as BytesReader.
//
// Example
//
//  const controller = new AbortController();
//  const file = await NewFileFromURL(controller.signal, "https://example.com/image.png");
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

// MultipartReader defines a FileReader from [multipart.FileHeader].
export class MultipartReader implements FileReader {
  #buffer: Uint8Array;

  constructor(buffer: Uint8Array) {
    this.#buffer = buffer;
  }

  // Open implements the [filesystem.FileReader] interface.
  Open(): ReadSeekCloser {
    return new BufferReadSeekCloser(this.#buffer);
  }
}

// PathReader defines a FileReader from a local file path.
export class PathReader implements FileReader {
  Path: string;

  constructor(path: string) {
    this.Path = path;
  }

  // Open implements the [filesystem.FileReader] interface.
  Open(): ReadSeekCloser {
    return new LocalFileReadSeekCloser(this.Path);
  }
}

// BytesReader defines a FileReader from bytes content.
export class BytesReader implements FileReader {
  Bytes: Uint8Array;

  constructor(bytes: Uint8Array) {
    this.Bytes = bytes;
  }

  // Open implements the [filesystem.FileReader] interface.
  Open(): ReadSeekCloser {
    return new BufferReadSeekCloser(this.Bytes);
  }
}

export type OpenFuncAsReader = () => ReadSeekCloser;

// openFuncAsReader defines a FileReader from a bare Open function.
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
    const end = size && size > 0 ? Math.min(this.#buffer.length, this.#offset + size) : this.#buffer.length;
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

  [Symbol.dispose](): void {
    this.close();
  }

  size(): number {
    return this.#buffer.length;
  }
}

class LocalFileReadSeekCloser implements ReadSeekCloser {
  #fd: number;
  #offset: number;
  #size: number;
  #closed = false;

  constructor(path: string) {
    this.#fd = openSync(path, "r");
    this.#size = statSync(path).size;
    this.#offset = 0;
  }

  read(size?: number): Uint8Array | null {
    if (this.#closed || this.#offset >= this.#size) {
      return null;
    }

    const remaining = this.#size - this.#offset;
    const toRead = size && size > 0 ? Math.min(size, remaining) : remaining;
    if (toRead <= 0) {
      return null;
    }

    const buffer = new Uint8Array(toRead);
    const bytesRead = readSync(this.#fd, buffer, 0, toRead, this.#offset);
    if (bytesRead <= 0) {
      return null;
    }

    this.#offset += bytesRead;
    return bytesRead === buffer.length ? buffer : buffer.slice(0, bytesRead);
  }

  readAll(): Uint8Array {
    const chunks: Uint8Array[] = [];
    let total = 0;

    for (;;) {
      const chunk = this.read(64 * 1024);
      if (!chunk || chunk.length === 0) {
        break;
      }
      chunks.push(chunk);
      total += chunk.length;
    }

    const merged = new Uint8Array(total);
    let offset = 0;
    for (const part of chunks) {
      merged.set(part, offset);
      offset += part.length;
    }

    return merged;
  }

  seek(offset: number, whence = 0): number {
    if (whence === 1) {
      this.#offset += offset;
    } else if (whence === 2) {
      this.#offset = this.#size + offset;
    } else {
      this.#offset = offset;
    }

    if (this.#offset < 0) {
      this.#offset = 0;
    }
    if (this.#offset > this.#size) {
      this.#offset = this.#size;
    }

    return this.#offset;
  }

  close(): void {
    if (this.#closed) {
      return;
    }
    this.#closed = true;
    closeSync(this.#fd);
  }

  [Symbol.dispose](): void {
    this.close();
  }

  size(): number {
    return this.#size;
  }
}

const extInvalidCharsRegex = /[^\w.*\-+=#]+/g;
const randomAlphabet = "abcdefghijklmnopqrstuvwxyz0123456789";

export function normalizeName(fr: FileReader, name: string): string {
  // cut the name even if it is not multibyte safe to avoid operating on too large strings
  // ---
  const originalLength = name.length;
  if (originalLength > 300) {
    name = name.slice(originalLength - 300);
  }

  // extension
  // ---
  const originalExt = extractExtension(name);
  let cleanExt = `.${originalExt.replace(extInvalidCharsRegex, "").replace(/^\.+|\.+$/g, "")}`;
  if (cleanExt === ".") {
    // try to detect the extension from the file content
    cleanExt = detectExtension(fr) ?? ".";
  }
  if (cleanExt === ".") {
    cleanExt = ".";
  }
  if (cleanExt.length > 20) {
    // keep only the last 20 characters (it is multibyte safe after the regex replace)
    cleanExt = `.${cleanExt.slice(cleanExt.length - 20).replace(/^\.+|\.+$/g, "")}`;
  }

  // name
  //
  // note: leading dot is trimmed to prevent various subtle issues with files
  // sync programs as they sometimes have special handling for "invisible" files
  // ---
  let baseName = name;
  if (originalExt && baseName.endsWith(originalExt)) {
    baseName = baseName.slice(0, -originalExt.length);
  }
  baseName = baseName.replace(/^\.+|\.+$/g, "");
  let cleanName = snakecase(baseName);

  if (cleanName.length < 3) {
    // the name is too short so we concatenate an additional random part
    cleanName += randomStringWithAlphabet(10, randomAlphabet);
  } else if (cleanName.length > 100) {
    // keep only the first 100 characters (it is multibyte safe after Snakecase)
    cleanName = cleanName.slice(0, 100);
  }

  return `${cleanName}_${randomStringWithAlphabet(10, randomAlphabet)}${cleanExt}`; // ensure that there is always a random part
}

// normalizeNameAsync is a PocketBun-only async alternative to normalizeName().
export async function normalizeNameAsync(fr: FileReader, name: string): Promise<string> {
  // cut the name even if it is not multibyte safe to avoid operating on too large strings
  // ---
  const originalLength = name.length;
  if (originalLength > 300) {
    name = name.slice(originalLength - 300);
  }

  // extension
  // ---
  const originalExt = extractExtension(name);
  let cleanExt = `.${originalExt.replace(extInvalidCharsRegex, "").replace(/^\.+|\.+$/g, "")}`;
  if (cleanExt === ".") {
    // try to detect the extension from the file content
    cleanExt = (await detectExtensionAsync(fr)) ?? ".";
  }
  if (cleanExt === ".") {
    cleanExt = ".";
  }
  if (cleanExt.length > 20) {
    // keep only the last 20 characters (it is multibyte safe after the regex replace)
    cleanExt = `.${cleanExt.slice(cleanExt.length - 20).replace(/^\.+|\.+$/g, "")}`;
  }

  // name
  //
  // note: leading dot is trimmed to prevent various subtle issues with files
  // sync programs as they sometimes have special handling for "invisible" files
  // ---
  let baseName = name;
  if (originalExt && baseName.endsWith(originalExt)) {
    baseName = baseName.slice(0, -originalExt.length);
  }
  baseName = baseName.replace(/^\.+|\.+$/g, "");
  let cleanName = snakecase(baseName);

  if (cleanName.length < 3) {
    // the name is too short so we concatenate an additional random part
    cleanName += randomStringWithAlphabet(10, randomAlphabet);
  } else if (cleanName.length > 100) {
    // keep only the first 100 characters (it is multibyte safe after Snakecase)
    cleanName = cleanName.slice(0, 100);
  }

  return `${cleanName}_${randomStringWithAlphabet(10, randomAlphabet)}${cleanExt}`; // ensure that there is always a random part
}

// extractExtension extracts the extension (with leading dot) from name.
//
// This differ from filepath.Ext() by supporting double extensions (eg. ".tar.gz").
//
// Returns an empty string if no match is found.
//
// Example:
// extractExtension("test.txt")      // .txt
// extractExtension("test.tar.gz")   // .tar.gz
// extractExtension("test.a.tar.gz") // .tar.gz
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

// detectExtension tries to detect the extension from file mime type.
export function detectExtension(fr: FileReader): string | null {
  const raw = readFileReaderSampleBytes(fr);

  const mime = detectMimeTypeFromBytes(raw);
  return mimeToExtension(mime);
}

// detectExtensionAsync is a PocketBun-only async alternative to detectExtension().
export async function detectExtensionAsync(fr: FileReader): Promise<string | null> {
  const raw = await readFileReaderSampleBytesAsync(fr);

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

  if (raw.length >= 4 && raw[0] === 0x50 && raw[1] === 0x4b) {
    const sig1 = raw[2];
    const sig2 = raw[3];
    if ((sig1 === 0x03 || sig1 === 0x05 || sig1 === 0x07) && (sig2 === 0x04 || sig2 === 0x06 || sig2 === 0x08)) {
      return "application/zip";
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
