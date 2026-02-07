// Ported from pocketbase/tools/filesystem/internal/fileblob/fileblob.go
// Deviation: async driver methods use non-blocking fs/promises APIs where possible.
// Deviation: reader primitives remain sync for compatibility, but writer paths also expose writeAsync for non-blocking writes.

import type { Dirent, Stats } from "node:fs";
import { createHash } from "node:crypto";
import { closeSync, mkdirSync, openSync, readSync, statSync, write as writeFd, writeSync } from "node:fs";
import { mkdir, open, readdir, rename, rm, rmdir, stat, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import type {
  Attributes,
  Driver,
  DriverReader,
  DriverWriter,
  ListObject,
  ListOptions,
  ListPage,
  ReaderAttributes,
  WriterOptions,
} from "../../blob/driver.ts";
import { ErrNotFound } from "../../blob/driver.ts";
import { HexEscape, HexUnescape } from "../../blob/hex.ts";
import { attrsExt, errAttrsExt, getAttrsAsync, setAttrsAsync, type XAttrs } from "./attrs.ts";

const defaultPageSize = 1000;

type MetadataOption = "" | "skip";

export const MetadataInSidecar: MetadataOption = "";
export const MetadataDontWrite: MetadataOption = "skip";

export type Options = {
  Metadata: MetadataOption;
  DirFileMode: number;
  CreateDir: boolean;
  NoTempDir: boolean;
};

export function New(dir: string, opts?: Partial<Options>): Driver {
  const options: Options = {
    Metadata: opts?.Metadata ?? MetadataInSidecar,
    DirFileMode: opts?.DirFileMode ?? 0o777,
    CreateDir: opts?.CreateDir ?? false,
    NoTempDir: opts?.NoTempDir ?? false,
  };

  const absdir = resolve(dir);
  let info: Stats | null = null;

  try {
    info = statSync(absdir) as Stats;
  } catch (err) {
    if (options.CreateDir && (err as NodeJS.ErrnoException).code === "ENOENT") {
      mkdirSync(absdir, { recursive: true, mode: options.DirFileMode });
      info = statSync(absdir) as Stats;
    } else {
      throw err;
    }
  }

  if (!info?.isDirectory()) {
    throw new Error(`${absdir} is not a directory`);
  }

  return new FileDriver(absdir, options);
}

// NewAsync is a PocketBun-only async alternative to New().
export async function NewAsync(dir: string, opts?: Partial<Options>): Promise<Driver> {
  const options: Options = {
    Metadata: opts?.Metadata ?? MetadataInSidecar,
    DirFileMode: opts?.DirFileMode ?? 0o777,
    CreateDir: opts?.CreateDir ?? false,
    NoTempDir: opts?.NoTempDir ?? false,
  };

  const absdir = resolve(dir);
  let info: Stats | null = null;

  try {
    info = (await stat(absdir)) as Stats;
  } catch (err) {
    if (options.CreateDir && (err as NodeJS.ErrnoException).code === "ENOENT") {
      await mkdir(absdir, { recursive: true, mode: options.DirFileMode });
      info = (await stat(absdir)) as Stats;
    } else {
      throw err;
    }
  }

  if (!info?.isDirectory()) {
    throw new Error(`${absdir} is not a directory`);
  }

  return new FileDriver(absdir, options);
}

class FileDriver implements Driver {
  #opts: Options;
  #dir: string;

  constructor(dir: string, opts: Options) {
    this.#dir = dir;
    this.#opts = opts;
  }

  Close(): void {}

  NormalizeError(err: Error): Error {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return new AggregateError([err, ErrNotFound]);
    }
    return err;
  }

  async Attributes(_ctx: AbortSignal | null, key: string): Promise<Attributes> {
    const { info, attrs } = await this.#forKeyAsync(key);
    const modTime = info.mtime;
    const size = info.size;
    const modHex = Math.round(modTime.getTime() * 1e6).toString(16);
    const sizeHex = size.toString(16);
    return {
      CacheControl: attrs.CacheControl,
      ContentDisposition: attrs.ContentDisposition,
      ContentEncoding: attrs.ContentEncoding,
      ContentLanguage: attrs.ContentLanguage,
      ContentType: attrs.ContentType,
      Metadata: attrs.Metadata,
      CreateTime: new Date(0),
      ModTime: modTime,
      Size: size,
      MD5: attrs.MD5,
      ETag: `"${modHex}-${sizeHex}"`,
    };
  }

  async ListPaged(_ctx: AbortSignal | null, opts: ListOptions): Promise<ListPage> {
    const pageToken = opts.PageToken && opts.PageToken.length > 0 ? new TextDecoder().decode(opts.PageToken) : "";
    const pageSize = opts.PageSize > 0 ? opts.PageSize : defaultPageSize;

    const root = (() => {
      if (opts.Prefix) {
        const idx = opts.Prefix.lastIndexOf("/");
        if (idx > -1) {
          return join(this.#dir, opts.Prefix.slice(0, idx));
        }
      }
      return this.#dir;
    })();

    const files: Array<{ key: string; info: Stats; md5: Uint8Array | null }> = [];

    await walkDirAsync(root, async (path, entry) => {
      if (path.endsWith(attrsExt)) {
        return;
      }
      if (path === this.#dir) {
        return;
      }
      if (entry.isDirectory()) {
        return;
      }

      const relPath = trimDirPrefix(this.#dir, path);
      const key = unescapeKey(relPath);
      if (opts.Prefix && !key.startsWith(opts.Prefix)) {
        return;
      }

      let md5: Uint8Array | null = null;
      try {
        const xa = await getAttrsAsync(path);
        md5 = xa.MD5.length > 0 ? xa.MD5 : null;
      } catch {
        md5 = null;
      }

      const info = (await stat(path)) as Stats;
      files.push({ key, info, md5 });
    });

    const objects: ListObject[] = [];
    const dirKeys = new Set<string>();

    for (const file of files) {
      if (opts.Delimiter) {
        const keyWithoutPrefix = file.key.slice(opts.Prefix.length);
        const idx = keyWithoutPrefix.indexOf(opts.Delimiter);
        if (idx !== -1) {
          const prefix = opts.Prefix + keyWithoutPrefix.slice(0, idx + opts.Delimiter.length);
          dirKeys.add(prefix);
          continue;
        }
      }
      objects.push({
        Key: file.key,
        ModTime: file.info.mtime,
        Size: file.info.size,
        MD5: file.md5,
        IsDir: false,
      });
    }

    for (const prefix of dirKeys) {
      objects.push({
        Key: prefix,
        ModTime: new Date(0),
        Size: 0,
        MD5: null,
        IsDir: true,
      });
    }

    objects.sort((a, b) => (a.Key < b.Key ? -1 : a.Key > b.Key ? 1 : 0));

    let start = 0;
    if (pageToken) {
      start = objects.findIndex((obj) => obj.Key > pageToken);
      if (start === -1) {
        return { Objects: [], NextPageToken: new Uint8Array() } as ListPage;
      }
    }

    const pageObjects = objects.slice(start, start + pageSize);
    let nextPageToken = new Uint8Array();
    if (start + pageSize < objects.length) {
      nextPageToken = new TextEncoder().encode(pageObjects[pageObjects.length - 1]?.Key ?? "");
    }

    return {
      Objects: pageObjects,
      NextPageToken: nextPageToken,
      toJSON() {
        return {
          objects: pageObjects.map((obj) => ({
            key: obj.Key,
            modTime: obj.ModTime.toISOString().replace(".000Z", "Z"),
            size: obj.Size,
            md5: obj.MD5 ? Buffer.from(obj.MD5).toString("base64") : null,
            isDir: obj.IsDir,
          })),
          nextPageToken: nextPageToken.length > 0 ? Buffer.from(nextPageToken).toString("base64") : "",
        };
      },
    } as ListPage;
  }

  async NewRangeReader(_ctx: AbortSignal | null, key: string, offset: number, length: number): Promise<DriverReader> {
    const { path, info, attrs } = await this.#forKeyAsync(key);
    const fd = openSync(path, "r");
    return new FileRangeReader(fd, offset, length, {
      ContentType: attrs.ContentType,
      ModTime: info.mtime,
      Size: info.size,
    });
  }

  async NewTypedWriter(_ctx: AbortSignal | null, key: string, contentType: string, opts: WriterOptions): Promise<DriverWriter> {
    const path = this.#path(key);
    await mkdir(dirname(path), { recursive: true, mode: this.#opts.DirFileMode });
    const temp = createTemp(path, this.#opts.NoTempDir);

    if (this.#opts.Metadata === MetadataDontWrite) {
      return new FileWriter(temp.fd, temp.path, path, _ctx ?? null);
    }

    const metadata = Object.keys(opts.Metadata ?? {}).length > 0 ? opts.Metadata : {};
    const attrs: XAttrs = {
      CacheControl: opts.CacheControl,
      ContentDisposition: opts.ContentDisposition,
      ContentEncoding: opts.ContentEncoding,
      ContentLanguage: opts.ContentLanguage,
      ContentType: contentType,
      Metadata: metadata,
      MD5: new Uint8Array(),
    };

    return new FileWriterWithSidecar(temp.fd, temp.path, path, _ctx ?? null, attrs);
  }

  async Copy(ctx: AbortSignal | null, dstKey: string, srcKey: string): Promise<void> {
    const { path: srcPath, attrs } = await this.#forKeyAsync(srcKey);

    const wopts: WriterOptions = {
      CacheControl: attrs.CacheControl,
      ContentDisposition: attrs.ContentDisposition,
      ContentEncoding: attrs.ContentEncoding,
      ContentLanguage: attrs.ContentLanguage,
      ContentType: "",
      DisableContentTypeDetection: false,
      ContentMD5: new Uint8Array(),
      BufferSize: 0,
      MaxConcurrency: 0,
      Metadata: attrs.Metadata,
    };

    const controller = new AbortController();
    if (ctx) {
      if (ctx.aborted) {
        controller.abort(ctx.reason);
      } else {
        ctx.addEventListener("abort", () => controller.abort(ctx.reason), { once: true });
      }
    }

    const writer = await this.NewTypedWriter(controller.signal, dstKey, attrs.ContentType, wopts);
    const fh = await open(srcPath, "r");
    let closeStarted = false;
    try {
      const buffer = new Uint8Array(64 * 1024);
      for (;;) {
        const readResult = await fh.read(buffer, 0, buffer.length, null);
        const bytesRead = readResult.bytesRead ?? 0;
        if (bytesRead <= 0) {
          break;
        }
        let writeOffset = 0;
        while (writeOffset < bytesRead) {
          const chunk = buffer.subarray(writeOffset, bytesRead);
          const written = typeof writer.writeAsync === "function" ? await writer.writeAsync(chunk) : writer.write(chunk);
          if (written <= 0) {
            throw new Error("failed to write copied blob chunk");
          }
          writeOffset += written;
        }
      }
      closeStarted = true;
      await writer.close();
    } catch (err) {
      controller.abort(err);
      if (!closeStarted) {
        try {
          await writer.close();
        } catch {
          // ignore
        }
      }
      throw err;
    } finally {
      await fh.close();
    }
  }

  async Delete(_ctx: AbortSignal | null, key: string): Promise<void> {
    const path = this.#path(key);
    const info = await stat(path);
    if (info.isDirectory()) {
      await rmdir(path);
    } else {
      await unlink(path);
    }

    try {
      await unlink(path + attrsExt);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        throw err;
      }
    }
  }

  #path(key: string): string {
    const p = join(this.#dir, escapeKey(key));
    if (p.endsWith(attrsExt)) {
      throw errAttrsExt;
    }
    return p;
  }

  async #forKeyAsync(key: string): Promise<{ path: string; info: Stats; attrs: XAttrs }> {
    const path = this.#path(key);
    const info = (await stat(path)) as Stats;
    if (info.isDirectory()) {
      const err = new Error("not found") as NodeJS.ErrnoException;
      err.code = "ENOENT";
      throw err;
    }
    const attrs = await getAttrsAsync(path);
    return { path, info, attrs };
  }
}

class FileRangeReader implements DriverReader {
  #fd: number;
  #offset: number;
  #remaining: number | null;
  #attrs: ReaderAttributes;

  constructor(fd: number, offset: number, length: number, attrs: ReaderAttributes) {
    this.#fd = fd;
    this.#offset = offset;
    this.#remaining = length >= 0 ? length : null;
    this.#attrs = attrs;
  }

  read(size?: number): Uint8Array | null {
    if (this.#remaining !== null && this.#remaining <= 0) {
      return null;
    }
    const remaining = this.#remaining ?? Math.max(0, this.#attrs.Size - this.#offset);
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
    if (this.#remaining !== null) {
      this.#remaining -= bytesRead;
    }
    return bytesRead === buffer.length ? buffer : buffer.slice(0, bytesRead);
  }

  readAll(): Uint8Array {
    const chunks: Uint8Array[] = [];
    let total = 0;
    let chunk: Uint8Array | null;
    while ((chunk = this.read())) {
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

  close(): void {
    closeSync(this.#fd);
  }

  Attributes(): ReaderAttributes {
    return this.#attrs;
  }
}

class FileWriterWithSidecar implements DriverWriter {
  #fd: number;
  #tempPath: string;
  #path: string;
  #attrs: XAttrs;
  #hash = createHash("md5");
  #ctx: AbortSignal | null;

  constructor(fd: number, tempPath: string, path: string, ctx: AbortSignal | null, attrs: XAttrs) {
    this.#fd = fd;
    this.#tempPath = tempPath;
    this.#path = path;
    this.#ctx = ctx;
    this.#attrs = attrs;
  }

  write(data?: Uint8Array | null): number {
    if (!data || data.length === 0) {
      return 0;
    }
    const written = writeSync(this.#fd, data);
    if (written > 0) {
      this.#hash.update(data.slice(0, written));
    }
    return written;
  }

  async writeAsync(data?: Uint8Array | null): Promise<number> {
    if (!data || data.length === 0) {
      return 0;
    }
    const written = await writeFdAsync(this.#fd, data);
    if (written > 0) {
      this.#hash.update(data.slice(0, written));
    }
    return written;
  }

  async close(): Promise<void> {
    closeSync(this.#fd);
    try {
      if (this.#ctx?.aborted) {
        throw this.#ctx.reason ?? new Error("context canceled");
      }

      this.#attrs.MD5 = Uint8Array.from(this.#hash.digest());
      await setAttrsAsync(this.#path, this.#attrs);
      try {
        await rename(this.#tempPath, this.#path);
      } catch (err) {
        try {
          await rm(this.#path + attrsExt, { force: true });
        } catch {
          // ignore
        }
        throw err;
      }
    } finally {
      try {
        await rm(this.#tempPath, { force: true });
      } catch {
        // ignore
      }
    }
  }
}

class FileWriter implements DriverWriter {
  #fd: number;
  #tempPath: string;
  #path: string;
  #ctx: AbortSignal | null;

  constructor(fd: number, tempPath: string, path: string, ctx: AbortSignal | null) {
    this.#fd = fd;
    this.#tempPath = tempPath;
    this.#path = path;
    this.#ctx = ctx;
  }

  write(data?: Uint8Array | null): number {
    if (!data || data.length === 0) {
      return 0;
    }
    return writeSync(this.#fd, data);
  }

  async writeAsync(data?: Uint8Array | null): Promise<number> {
    if (!data || data.length === 0) {
      return 0;
    }
    return await writeFdAsync(this.#fd, data);
  }

  async close(): Promise<void> {
    closeSync(this.#fd);
    try {
      if (this.#ctx?.aborted) {
        throw this.#ctx.reason ?? new Error("context canceled");
      }
      await rename(this.#tempPath, this.#path);
    } finally {
      try {
        await rm(this.#tempPath, { force: true });
      } catch {
        // ignore
      }
    }
  }
}

function createTemp(path: string, noTempDir: boolean): { fd: number; path: string } {
  let attempt = 0;
  while (attempt < 10000) {
    const base = noTempDir ? path : join(tmpdir(), path.split(sep).pop() ?? "tmp");
    const name = `${base}.${Date.now().toString(16)}.${Math.floor(Math.random() * 1e9).toString(16)}.tmp`;
    try {
      const fd = openSync(name, "wx+", 0o666);
      return { fd, path: name };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "EEXIST") {
        attempt += 1;
        continue;
      }
      throw err;
    }
  }
  const error = new Error(`createtemp ${path}.*.tmp`) as NodeJS.ErrnoException;
  error.code = "EEXIST";
  throw error;
}

function writeFdAsync(fd: number, data: Uint8Array): Promise<number> {
  return new Promise((resolve, reject) => {
    writeFd(fd, data, 0, data.length, null, (err, bytesWritten) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(bytesWritten ?? 0);
    });
  });
}

function escapeKey(value: string): string {
  let escaped = HexEscape(value, (runes, i) => {
    const rune = runes[i] ?? "";
    const code = rune.codePointAt(0) ?? 0;
    switch (true) {
      case code < 32:
        return true;
      case sep !== "/" && rune === sep:
        return true;
      case i > 1 && rune === "/" && runes[i - 1] === "." && runes[i - 2] === ".":
        return true;
      case i > 0 && rune === "/" && runes[i - 1] === "/":
        return true;
      case rune === "/" && i === runes.length - 1:
        return true;
      case sep === "\\" &&
        (rune === ">" || rune === "<" || rune === ":" || rune === '"' || rune === "|" || rune === "?" || rune === "*"):
        return true;
      default:
        return false;
    }
  });

  if (sep !== "/") {
    escaped = escaped.split("/").join(sep);
  }
  return escaped;
}

function unescapeKey(value: string): string {
  let result = value;
  if (sep !== "/") {
    result = result.split(sep).join("/");
  }
  return HexUnescape(result);
}

async function walkDirAsync(root: string, cb: (path: string, entry: Dirent) => Promise<void> | void): Promise<void> {
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    let entries: Dirent[] = [];
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = join(current, entry.name);
      await cb(fullPath, entry);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      }
    }
  }
}

function trimDirPrefix(base: string, path: string): string {
  let prefixLen = base.length;
  if (base !== "/") {
    prefixLen += 1;
  }
  return path.slice(prefixLen);
}
