// Ported from pocketbase/tools/filesystem/filesystem.go
// Deviation: CreateThumb is async because Bun image processing relies on async libraries.

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, posix } from "node:path";
import sharp from "sharp";
import { File, detectMimeTypeFromBytes, normalizeName, openFuncAsReader } from "./file.ts";

export class NotFoundError extends Error {
  constructor(message = "file not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export const ErrNotFound = new NotFoundError();

export type Attributes = {
  Size: number;
  ModTime: Date;
  ContentType: string;
  Metadata: Record<string, string>;
};

export type ListObject = {
  Key: string;
  ModTime: Date;
  Size: number;
};

export const metadataOriginalName = "original-filename";

export const ThumbSizeRegex = /^(\d+)x(\d+)(t|b|f)?$/;

const inlineServeContentTypes = new Set([
  "image/png",
  "image/jpg",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/x-icon",
  "image/bmp",
  "video/webm",
  "video/mp4",
  "video/3gpp",
  "video/quicktime",
  "video/x-ms-wmv",
  "audio/basic",
  "audio/aiff",
  "audio/mpeg",
  "audio/midi",
  "audio/mp3",
  "audio/wave",
  "audio/wav",
  "audio/x-wav",
  "audio/x-mpeg",
  "audio/x-m4a",
  "audio/aac",
  "application/pdf",
  "application/x-pdf",
]);

const manualExtensionContentTypes: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".css": "text/css",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
};

const forceAttachmentParam = "download";

export class System {
  #root: string;
  #ctx: unknown;

  constructor(root: string) {
    this.#root = root;
    this.#ctx = null;
  }

  static NewLocal(dirPath: string): System {
    mkdirSync(dirPath, { recursive: true });
    return new System(dirPath);
  }

  static NewS3(..._args: unknown[]): never {
    throw new Error("S3 filesystem support is not implemented in PocketBun yet.");
  }

  SetContext(ctx: unknown): void {
    this.#ctx = ctx;
    void this.#ctx;
  }

  Close(): void {}

  Exists(fileKey: string): boolean {
    const full = this.resolvePath(fileKey);
    return existsSync(full);
  }

  Attributes(fileKey: string): Attributes {
    const full = this.resolvePath(fileKey);
    if (!existsSync(full)) {
      throw new NotFoundError();
    }

    const stat = statSync(full);
    const attrs = this.readAttrs(full);

    return {
      Size: stat.size,
      ModTime: stat.mtime,
      ContentType: attrs.contentType,
      Metadata: attrs.metadata,
    };
  }

  GetReader(fileKey: string): SystemReader {
    const full = this.resolvePath(fileKey);
    if (!existsSync(full)) {
      throw new NotFoundError();
    }
    const attrs = this.Attributes(fileKey);
    return new SystemReader(readFileSync(full), attrs);
  }

  GetFile(fileKey: string): SystemReader {
    console.warn("Deprecated: Please replace GetFile with GetReader.");
    return this.GetReader(fileKey);
  }

  GetReuploadableFile(fileKey: string, preserveName: boolean): File {
    const attrs = this.Attributes(fileKey);
    const name = posix.basename(fileKey);
    const originalName = attrs.Metadata[metadataOriginalName] || name;

    const file = new File();
    file.Size = attrs.Size;
    file.OriginalName = originalName;
    file.Reader = openFuncAsReader(() => this.GetReader(fileKey));
    file.Name = preserveName ? name : normalizeName(file.Reader, file.OriginalName);

    return file;
  }

  Copy(srcKey: string, dstKey: string): void {
    const src = this.resolvePath(srcKey);
    const dst = this.resolvePath(dstKey);
    if (!existsSync(src)) {
      throw new NotFoundError();
    }

    mkdirSync(dirname(dst), { recursive: true });
    copyFileSync(src, dst);

    const srcAttrs = `${src}.attrs`;
    const dstAttrs = `${dst}.attrs`;
    if (existsSync(srcAttrs)) {
      copyFileSync(srcAttrs, dstAttrs);
    }
  }

  List(prefix: string): ListObject[] {
    const files = this.walkFiles(this.#root);
    const filtered = files.filter((file) => file.key.startsWith(prefix));
    return filtered.map((file) => ({
      Key: file.key,
      ModTime: file.mtime,
      Size: file.size,
    }));
  }

  Upload(content: Uint8Array, fileKey: string): void {
    const full = this.resolvePath(fileKey);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);

    const contentType = detectMimeTypeFromBytes(content);
    this.writeAttrs(full, contentType, null);
  }

  UploadFile(file: File, fileKey: string): void {
    if (!file.Reader) {
      throw new Error("missing file reader");
    }

    const reader = file.Reader.Open();
    const content = reader.readAll();
    reader.close();

    const contentType = detectMimeTypeFromBytes(content);
    const full = this.resolvePath(fileKey);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);

    let originalName = file.OriginalName;
    if (originalName.length > 255) {
      originalName = originalName.slice(0, 255);
    }
    this.writeAttrs(full, contentType, { [metadataOriginalName]: originalName });
  }

  UploadMultipart(header: { filename: string; size: number; buffer: Uint8Array }, fileKey: string) {
    const contentType = detectMimeTypeFromBytes(header.buffer);
    const full = this.resolvePath(fileKey);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, header.buffer);

    let originalName = header.filename;
    if (originalName.length > 255) {
      originalName = originalName.slice(0, 255);
    }
    this.writeAttrs(full, contentType, { [metadataOriginalName]: originalName });
  }

  Delete(fileKey: string): void {
    const full = this.resolvePath(fileKey);
    if (!existsSync(full)) {
      throw new NotFoundError();
    }
    rmSync(full, { force: true, recursive: true });
    const attrs = `${full}.attrs`;
    if (existsSync(attrs)) {
      rmSync(attrs, { force: true });
    }
  }

  DeletePrefix(prefix: string): Error[] {
    const failed: Error[] = [];
    if (prefix === "") {
      failed.push(new Error("prefix mustn't be empty"));
      return failed;
    }

    const objects = this.List(prefix);
    for (const obj of objects) {
      try {
        this.Delete(obj.Key);
      } catch (error) {
        failed.push(error as Error);
      }
    }

    if (prefix.endsWith("/")) {
      const dir = this.resolvePath(prefix);
      if (existsSync(dir)) {
        rmSync(dir, { recursive: true, force: true });
      }
    }

    return failed;
  }

  IsEmptyDir(dir: string): boolean {
    let prefix = dir;
    if (prefix !== "" && !prefix.endsWith("/")) {
      prefix += "/";
    }
    const objects = this.List(prefix);
    return objects.length === 0;
  }

  Serve(
    res: { statusCode?: number; setHeader: (k: string, v: string) => void; getHeader: (k: string) => string | undefined; end: (body?: Uint8Array) => void },
    req: { headers?: Record<string, string | string[]>; url?: string },
    fileKey: string,
    name: string,
  ): Error | null {
    let reader: SystemReader;
    try {
      reader = this.GetReader(fileKey);
    } catch (error) {
      return error as Error;
    }

    const body = reader.readAll();
    const size = body.length;
    const realContentType = reader.ContentType();

    const url = new URL(req.url ?? "/", "http://localhost");
    const forceAttachment = url.searchParams.get(forceAttachmentParam) === "1";

    let disposition = "attachment";
    if (!forceAttachment && inlineServeContentTypes.has(realContentType)) {
      disposition = "inline";
    }

    let extContentType = realContentType;
    const ext = posix.extname(name);
    if (ext in manualExtensionContentTypes) {
      extContentType = manualExtensionContentTypes[ext] ?? extContentType;
    }

    setHeaderIfMissing(res, "Content-Disposition", `${disposition}; filename=${name}`);
    setHeaderIfMissing(res, "Content-Type", extContentType);
    setHeaderIfMissing(
      res,
      "Content-Security-Policy",
      "default-src 'none'; media-src 'self'; style-src 'unsafe-inline'; sandbox",
    );
    setHeaderIfMissing(res, "Cache-Control", "max-age=2592000, stale-while-revalidate=86400");

    let statusCode = 200;
    let responseBody = body;

    const rangeHeader = req.headers?.Range ?? req.headers?.range;
    const rangeValue = Array.isArray(rangeHeader) ? rangeHeader[0] : rangeHeader;
    if (rangeValue && rangeValue.startsWith("bytes=")) {
      const ranges = rangeValue.slice(6).split(",").map((part) => part.trim());
      if (ranges.length > 1) {
        statusCode = 206;
        res.setHeader("Content-Type", `multipart/byteranges; boundary=BOUNDARY`);
        responseBody = new Uint8Array();
      } else {
        const rangeSpec = ranges[0] ?? "";
        const [startRaw, endRaw] = rangeSpec.split("-").map((part) => part.trim());
        const start = startRaw === "" ? 0 : Number(startRaw);
        const end = endRaw === "" ? size - 1 : Number(endRaw);
        const safeStart = Number.isFinite(start) ? start : 0;
        const safeEnd = Number.isFinite(end) ? end : size - 1;
        responseBody = body.slice(safeStart, safeEnd + 1);
        statusCode = 206;
        res.setHeader("Content-Range", `bytes ${safeStart}-${safeEnd}/${size}`);
      }
    }

    res.statusCode = statusCode;
    res.setHeader("Content-Length", String(responseBody.length));
    res.end(responseBody);

    return null;
  }

  async CreateThumb(
    originalKey: string,
    thumbKey: string,
    thumbSize: string,
  ): Promise<Error | null> {
    const sizeParts = ThumbSizeRegex.exec(thumbSize);
    if (!sizeParts) {
      return new Error("thumb size must be in WxH, WxHt, WxHb or WxHf format");
    }

    const width = Number(sizeParts[1]);
    const height = Number(sizeParts[2]);
    const resizeType = sizeParts[3] ?? "";
    if (width === 0 && height === 0) {
      return new Error("thumb width and height cannot be zero at the same time");
    }

    const originalPath = this.resolvePath(originalKey);
    if (!existsSync(originalPath)) {
      return new NotFoundError();
    }

    const attrs = this.readAttrs(originalPath);
    const originalContentType = attrs.contentType;
    if (originalContentType === "image/svg+xml") {
      return new Error("failed to decode image");
    }

    try {
      let transformer = sharp(originalPath, { failOn: "none" }).rotate();
      if (width === 0 || height === 0) {
        const targetWidth = width === 0 ? undefined : width;
        const targetHeight = height === 0 ? undefined : height;
        transformer = transformer.resize(targetWidth, targetHeight, { fit: "inside" });
      } else {
        const fit = resizeType === "f" ? "inside" : "cover";
        const position =
          resizeType === "t" ? "north" : resizeType === "b" ? "south" : "centre";
        transformer = transformer.resize(width, height, { fit, position });
      }

      let outputContentType = originalContentType;
      let outputFormat: "jpeg" | "png" | "gif" | "tiff";
      switch (originalContentType) {
        case "image/jpeg":
        case "image/jpg":
          outputFormat = "jpeg";
          outputContentType = "image/jpeg";
          break;
        case "image/gif":
          outputFormat = "gif";
          outputContentType = "image/gif";
          break;
        case "image/tiff":
          outputFormat = "tiff";
          outputContentType = "image/tiff";
          break;
        case "image/bmp":
          // Sharp doesn't output BMP, so fallback to PNG.
          outputFormat = "png";
          outputContentType = "image/png";
          break;
        default:
          outputFormat = "png";
          outputContentType = "image/png";
          break;
      }

      const outputBytes = await transformer.toFormat(outputFormat).toBuffer();
      const thumbPath = this.resolvePath(thumbKey);
      mkdirSync(dirname(thumbPath), { recursive: true });
      writeFileSync(thumbPath, outputBytes);
      this.writeAttrs(thumbPath, outputContentType, null);
    } catch (error) {
      return error as Error;
    }

    return null;
  }

  private resolvePath(fileKey: string): string {
    const cleaned = fileKey.replace(/^\//, "");
    return join(this.#root, cleaned);
  }

  private walkFiles(root: string): { key: string; size: number; mtime: Date }[] {
    const results: { key: string; size: number; mtime: Date }[] = [];
    const stack = [root];

    while (stack.length > 0) {
      const current = stack.pop() ?? root;
      const entries = readdirSync(current, { withFileTypes: true });
      for (const entry of entries) {
        const full = join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(full);
          continue;
        }
        if (entry.isFile()) {
          if (full.endsWith(".attrs")) {
            continue;
          }
          const stat = statSync(full);
          const rel = posix
            .join(...full.slice(this.#root.length + 1).split("/"))
            .replace(/\\/g, "/");
          results.push({ key: rel, size: stat.size, mtime: stat.mtime });
        }
      }
    }

    return results;
  }

  private readAttrs(filePath: string): { contentType: string; metadata: Record<string, string> } {
    const attrsPath = `${filePath}.attrs`;
    if (!existsSync(attrsPath)) {
      return { contentType: "application/octet-stream", metadata: {} };
    }

    try {
      const raw = JSON.parse(readFileSync(attrsPath, "utf8")) as Record<string, unknown>;
      const contentType =
        typeof raw["user.content_type"] === "string"
          ? (raw["user.content_type"] as string)
          : "application/octet-stream";
      const metadataRaw = raw["user.metadata"];
      const metadata: Record<string, string> = {};
      if (metadataRaw && typeof metadataRaw === "object") {
        for (const [key, value] of Object.entries(metadataRaw as Record<string, unknown>)) {
          if (typeof value === "string") {
            metadata[key] = value;
          }
        }
      }
      return { contentType, metadata };
    } catch {
      return { contentType: "application/octet-stream", metadata: {} };
    }
  }

  private writeAttrs(
    filePath: string,
    contentType: string,
    metadata: Record<string, string> | null,
  ): void {
    const attrs = {
      "user.cache_control": "",
      "user.content_disposition": "",
      "user.content_encoding": "",
      "user.content_language": "",
      "user.content_type": contentType,
      "user.metadata": metadata,
    };
    writeFileSync(`${filePath}.attrs`, JSON.stringify(attrs));
  }

}

export function NewLocal(dirPath: string): System {
  return System.NewLocal(dirPath);
}

export function NewS3(...args: unknown[]): never {
  return System.NewS3(...args);
}

export class SystemReader {
  #buffer: Uint8Array;
  #attrs: Attributes;
  #offset: number;

  constructor(buffer: Uint8Array, attrs: Attributes) {
    this.#buffer = buffer;
    this.#attrs = attrs;
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

  ContentType(): string {
    return this.#attrs.ContentType;
  }

  ModTime(): Date {
    return this.#attrs.ModTime;
  }

  Size(): number {
    return this.#attrs.Size;
  }

  size(): number {
    return this.#attrs.Size;
  }
}

function setHeaderIfMissing(
  res: { getHeader: (k: string) => string | undefined; setHeader: (k: string, v: string) => void },
  key: string,
  value: string,
) {
  if (res.getHeader(key) == null) {
    res.setHeader(key, value);
  }
}
