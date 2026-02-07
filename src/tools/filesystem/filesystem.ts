// Ported from pocketbase/tools/filesystem/filesystem.go
// Deviation: System methods are async because Bun blob drivers use async I/O.
// Deviation: GetReuploadableFile buffers file contents to provide a sync FileReader.
// Deviation: CreateThumb is async because Bun image processing relies on async libraries.

import { mkdirSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { posix } from "node:path";
import sharp from "sharp";
import { Bucket, NewBucket } from "./blob/bucket.ts";
import { ErrNotFound, NotFoundError, type Attributes as BlobAttributes, type WriterOptions } from "./blob/driver.ts";
import { ErrEOF, isNotFoundError } from "./blob/errors.ts";
import { BytesReader, File, PathReader, type FileReader, detectMimeTypeFromBytes, normalizeName } from "./file.ts";
import { New as NewFileBlob, NewAsync as NewFileBlobAsync } from "./internal/fileblob/fileblob.ts";
import { S3 } from "./internal/s3blob/s3/s3.ts";
import { New as NewS3Blob } from "./internal/s3blob/s3blob.ts";

export { ErrNotFound, NotFoundError };

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

// manualExtensionContentTypes is a map of file extensions to content types.
const manualExtensionContentTypes: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".css": "text/css",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
};

// forceAttachmentParam is the name of the request query parameter to
// force "Content-Disposition: attachment" header.
const forceAttachmentParam = "download";

export class System {
  #bucket: Bucket;
  #ctx: AbortSignal | null;

  constructor(bucket: Bucket) {
    this.#bucket = bucket;
    this.#ctx = null;
  }

  static NewLocal(dirPath: string): System {
    mkdirSync(dirPath, { recursive: true });
    const drv = NewFileBlob(dirPath, { NoTempDir: true });
    return new System(NewBucket(drv));
  }

  // NewLocalAsync is a PocketBun-only async alternative to NewLocal().
  static async NewLocalAsync(dirPath: string): Promise<System> {
    await mkdir(dirPath, { recursive: true });
    const drv = await NewFileBlobAsync(dirPath, { NoTempDir: true });
    return new System(NewBucket(drv));
  }

  static NewS3(
    bucketName: string,
    region: string,
    endpoint: string,
    accessKey: string,
    secret: string,
    s3ForcePathStyle: boolean,
  ): System {
    const client = Object.assign(new S3(), {
      Bucket: bucketName,
      Region: region,
      Endpoint: endpoint,
      AccessKey: accessKey,
      SecretKey: secret,
      UsePathStyle: s3ForcePathStyle,
    });

    const drv = NewS3Blob(client);
    return new System(NewBucket(drv));
  }

  // SetContext assigns the specified context to the current filesystem.
  SetContext(ctx: unknown): void {
    this.#ctx = toAbortSignal(ctx);
  }

  // Close releases any resources used for the related filesystem.
  async Close(): Promise<void> {
    await this.#bucket.Close();
  }

  // Exists checks if file with fileKey path exists or not.
  async Exists(fileKey: string): Promise<boolean> {
    try {
      return await this.#bucket.Exists(this.#ctx, fileKey);
    } catch (error) {
      if (isNotFoundError(error)) {
        return false;
      }
      throw error;
    }
  }

  // Attributes returns the attributes for the file with fileKey path.
  //
  // If the file doesn't exist it returns ErrNotFound.
  async Attributes(fileKey: string): Promise<Attributes> {
    let attrs: BlobAttributes;
    try {
      attrs = await this.#bucket.Attributes(this.#ctx, fileKey);
    } catch (error) {
      throw mapFsError(error);
    }

    return {
      Size: attrs.Size,
      ModTime: attrs.ModTime,
      ContentType: attrs.ContentType,
      Metadata: attrs.Metadata,
    };
  }

  // GetReader returns a file content reader for the given fileKey.
  //
  // NB! Make sure to call Close() on the file after you are done working with it.
  //
  // If the file doesn't exist returns ErrNotFound.
  async GetReader(fileKey: string): Promise<SystemReader> {
    let reader: Awaited<ReturnType<Bucket["NewReader"]>> | null = null;
    try {
      reader = await this.#bucket.NewReader(this.#ctx, fileKey);
      const content = await reader.readAll();
      const attrs: Attributes = {
        Size: reader.Size(),
        ModTime: reader.ModTime(),
        ContentType: reader.ContentType(),
        Metadata: {},
      };
      return new SystemReader(content, attrs);
    } catch (error) {
      throw mapFsError(error);
    } finally {
      reader?.close();
    }
  }

  // Deprecated: Please use GetReader(fileKey) instead.
  async GetFile(fileKey: string): Promise<SystemReader> {
    console.warn("Deprecated: Please replace GetFile with GetReader.");
    return this.GetReader(fileKey);
  }

  // GetReuploadableFile constructs a new reuploadable File value
  // from the associated fileKey blob.Reader.
  //
  // If preserveName is false then the returned File.Name will have
  // a new randomly generated suffix, otherwise it will reuse the original one.
  //
  // This method could be useful in case you want to clone an existing
  // Record file and assign it to a new Record (e.g. in a Record duplicate action).
  //
  // If you simply want to copy an existing file to a new location you
  // could check the Copy(srcKey, dstKey) method.
  async GetReuploadableFile(fileKey: string, preserveName: boolean): Promise<File> {
    const attrs = await this.Attributes(fileKey);
    const name = posix.basename(fileKey);
    const originalName = attrs.Metadata[metadataOriginalName] || name;

    const reader = await this.GetReader(fileKey);
    const content = reader.readAll();

    const file = new File();
    file.Size = attrs.Size;
    file.OriginalName = originalName;
    file.Reader = new BytesReader(content);
    file.Name = preserveName ? name : normalizeName(file.Reader, file.OriginalName);

    return file;
  }

  // Copy copies the file stored at srcKey to dstKey.
  //
  // If srcKey file doesn't exist, it returns ErrNotFound.
  //
  // If dstKey file already exists, it is overwritten.
  async Copy(srcKey: string, dstKey: string): Promise<void> {
    try {
      await this.#bucket.Copy(this.#ctx, dstKey, srcKey);
    } catch (error) {
      throw mapFsError(error);
    }
  }

  // List returns a flat list with info for all files under the specified prefix.
  async List(prefix: string): Promise<ListObject[]> {
    const files: ListObject[] = [];
    const iter = this.#bucket.List({
      Prefix: prefix,
      Delimiter: "",
      PageSize: 0,
      PageToken: new Uint8Array(),
    });

    for (;;) {
      try {
        const obj = await iter.Next(this.#ctx);
        files.push({
          Key: obj.Key,
          ModTime: obj.ModTime,
          Size: obj.Size,
        });
      } catch (error) {
        if (error === ErrEOF) {
          break;
        }
        throw error;
      }
    }

    return files;
  }

  // Upload writes content into the fileKey location.
  async Upload(content: Uint8Array, fileKey: string): Promise<void> {
    const contentType = detectMimeTypeFromBytes(content);
    const writer = await this.#bucket.NewWriter(this.#ctx, fileKey, makeWriterOptions(contentType));
    await writeAllAndClose(writer, content);
  }

  // UploadFile uploads the provided File to the fileKey location.
  async UploadFile(file: File, fileKey: string): Promise<void> {
    if (!file.Reader) {
      throw new Error("missing file reader");
    }

    const content = await readFileContent(file.Reader);

    const contentType = detectMimeTypeFromBytes(content);
    let originalName = file.OriginalName;
    if (originalName.length > 255) {
      originalName = originalName.slice(0, 255);
    }

    const writer = await this.#bucket.NewWriter(
      this.#ctx,
      fileKey,
      makeWriterOptions(contentType, { [metadataOriginalName]: originalName }),
    );
    await writeAllAndClose(writer, content);
  }

  // UploadMultipart uploads the provided multipart file to the fileKey location.
  async UploadMultipart(header: { filename: string; size: number; buffer: Uint8Array }, fileKey: string): Promise<void> {
    const contentType = detectMimeTypeFromBytes(header.buffer);
    let originalName = header.filename;
    if (originalName.length > 255) {
      originalName = originalName.slice(0, 255);
    }

    const writer = await this.#bucket.NewWriter(
      this.#ctx,
      fileKey,
      makeWriterOptions(contentType, { [metadataOriginalName]: originalName }),
    );
    await writeAllAndClose(writer, header.buffer);
  }

  // Delete deletes stored file at fileKey location.
  //
  // If the file doesn't exist returns ErrNotFound.
  async Delete(fileKey: string): Promise<void> {
    try {
      await this.#bucket.Delete(this.#ctx, fileKey);
    } catch (error) {
      throw mapFsError(error);
    }
  }

  // DeletePrefix deletes everything starting with the specified prefix.
  //
  // The prefix could be subpath (ex. "/a/b/") or filename prefix (ex. "/a/b/file_").
  async DeletePrefix(prefix: string): Promise<Error[]> {
    const failed: Error[] = [];
    if (prefix === "") {
      failed.push(new Error("prefix mustn't be empty"));
      return failed;
    }

    const dirs = new Set<string>();
    const isPrefixDir = prefix.endsWith("/");
    if (isPrefixDir) {
      dirs.add(prefix.replace(/\/+$/g, ""));
    }

    const iter = this.#bucket.List({
      Prefix: prefix,
      Delimiter: "",
      PageSize: 0,
      PageToken: new Uint8Array(),
    });

    for (;;) {
      try {
        const obj = await iter.Next(this.#ctx);
        try {
          await this.Delete(obj.Key);
          if (isPrefixDir) {
            const slashIdx = obj.Key.lastIndexOf("/");
            if (slashIdx > -1) {
              dirs.add(obj.Key.slice(0, slashIdx));
            }
          }
        } catch (error) {
          failed.push(error as Error);
        }
      } catch (error) {
        if (error === ErrEOF) {
          break;
        }
        failed.push(error as Error);
        break;
      }
    }

    if (isPrefixDir && dirs.size > 0) {
      const dirList = Array.from(dirs).sort((a, b) => b.split("/").length - a.split("/").length);
      for (const dir of dirList) {
        if (!dir) {
          continue;
        }
        try {
          await this.Delete(dir);
        } catch {
          // optional cleanup
        }
      }
    }

    return failed;
  }

  // Checks if the provided dir prefix doesn't have any files.
  //
  // A trailing slash will be appended to a non-empty dir string argument
  // to ensure that the checked prefix is a "directory".
  //
  // Returns "false" in case the has at least one file, otherwise - "true".
  async IsEmptyDir(dir: string): Promise<boolean> {
    let prefix = dir;
    if (prefix !== "" && !prefix.endsWith("/")) {
      prefix += "/";
    }

    const iter = this.#bucket.List({
      Prefix: prefix,
      Delimiter: "",
      PageSize: 0,
      PageToken: new Uint8Array(),
    });

    try {
      await iter.Next(this.#ctx);
      return false;
    } catch (error) {
      return error === ErrEOF;
    }
  }

  // Serve serves the file at fileKey location to an HTTP response.
  //
  // If the `download` query parameter is used the file will be always served for
  // download no matter of its type (aka. with "Content-Disposition: attachment").
  //
  // Internally this method uses [http.ServeContent] so Range requests,
  // If-Match, If-Unmodified-Since, etc. headers are handled transparently.
  async Serve(
    res: {
      statusCode?: number;
      setHeader: (k: string, v: string) => void;
      getHeader: (k: string) => string | undefined;
      end: (body?: Uint8Array) => void;
    },
    req: { headers?: Record<string, string | string[]>; url?: string },
    fileKey: string,
    name: string,
  ): Promise<Error | null> {
    let reader: SystemReader | null = null;
    try {
      reader = await this.GetReader(fileKey);
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
      const ranges = rangeValue
        .slice(6)
        .split(",")
        .map((part) => part.trim());
      if (ranges.length > 1) {
        statusCode = 206;
        res.setHeader("Content-Type", "multipart/byteranges; boundary=BOUNDARY");
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

  // CreateThumb creates a new thumb image for the file at originalKey location.
  // The new thumb file is stored at thumbKey location.
  //
  // thumbSize is in the format:
  // - 0xH  (eg. 0x100)    - resize to H height preserving the aspect ratio
  // - Wx0  (eg. 300x0)    - resize to W width preserving the aspect ratio
  // - WxH  (eg. 300x100)  - resize and crop to WxH viewbox (from center)
  // - WxHt (eg. 300x100t) - resize and crop to WxH viewbox (from top)
  // - WxHb (eg. 300x100b) - resize and crop to WxH viewbox (from bottom)
  // - WxHf (eg. 300x100f) - fit inside a WxH viewbox (without cropping)
  async CreateThumb(originalKey: string, thumbKey: string, thumbSize: string): Promise<Error | null> {
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

    let reader: Awaited<ReturnType<Bucket["NewReader"]>> | null = null;
    try {
      reader = await this.#bucket.NewReader(this.#ctx, originalKey);
    } catch (error) {
      return mapFsError(error);
    }

    try {
      const originalContentType = reader.ContentType();
      if (originalContentType === "image/svg+xml") {
        return new Error("failed to decode image");
      }

      const originalBytes = await reader.readAll();

      let transformer = sharp(originalBytes, { failOn: "none" }).rotate();
      if (width === 0 || height === 0) {
        const targetWidth = width === 0 ? undefined : width;
        const targetHeight = height === 0 ? undefined : height;
        transformer = transformer.resize(targetWidth, targetHeight, { fit: "inside" });
      } else {
        const fit = resizeType === "f" ? "inside" : "cover";
        const position = resizeType === "t" ? "north" : resizeType === "b" ? "south" : "centre";
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
      const writer = await this.#bucket.NewWriter(this.#ctx, thumbKey, makeWriterOptions(outputContentType));
      await writeAllAndClose(writer, outputBytes);
      return null;
    } catch (error) {
      return error as Error;
    } finally {
      reader?.close();
    }
  }
}

// NewLocal initializes a new local filesystem instance.
//
// NB! Make sure to call `Close()` after you are done working with it.
export function NewLocal(dirPath: string): System {
  return System.NewLocal(dirPath);
}

// NewLocalAsync initializes a new local filesystem instance asynchronously.
//
// NB! Make sure to call `Close()` after you are done working with it.
export async function NewLocalAsync(dirPath: string): Promise<System> {
  return await System.NewLocalAsync(dirPath);
}

// NewS3 initializes an S3 filesystem instance.
//
// NB! Make sure to call `Close()` after you are done working with it.
export function NewS3(
  bucketName: string,
  region: string,
  endpoint: string,
  accessKey: string,
  secret: string,
  s3ForcePathStyle: boolean,
): System {
  return System.NewS3(bucketName, region, endpoint, accessKey, secret, s3ForcePathStyle);
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

function toAbortSignal(ctx: unknown): AbortSignal | null {
  if (ctx instanceof AbortSignal) {
    return ctx;
  }
  if (!ctx || typeof ctx !== "object") {
    return null;
  }
  const candidate = ctx as { aborted?: unknown; addEventListener?: unknown };
  if (typeof candidate.aborted === "boolean" && typeof candidate.addEventListener === "function") {
    return ctx as AbortSignal;
  }
  return null;
}

function mapFsError(error: unknown): Error {
  if (isNotFoundError(error)) {
    return ErrNotFound;
  }
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
}

async function readFileContent(reader: FileReader): Promise<Uint8Array> {
  if (reader instanceof PathReader) {
    // PocketBun async deviation: keep upload paths non-blocking for disk-backed files.
    return await readFile(reader.Path);
  }

  const opened = reader.Open();
  try {
    return opened.readAll();
  } finally {
    opened.close();
  }
}

function makeWriterOptions(contentType: string, metadata: Record<string, string> = {}): WriterOptions {
  return {
    BufferSize: 0,
    MaxConcurrency: 0,
    CacheControl: "",
    ContentDisposition: "",
    ContentEncoding: "",
    ContentLanguage: "",
    ContentType: contentType,
    DisableContentTypeDetection: false,
    ContentMD5: new Uint8Array(),
    Metadata: metadata,
  };
}

async function writeAllAndClose(
  writer: { write: (data?: Uint8Array | null) => Promise<number>; close: () => Promise<void> },
  data: Uint8Array,
) {
  let writeErr: Error | null = null;
  try {
    await writer.write(data);
  } catch (error) {
    writeErr = error as Error;
  }

  try {
    await writer.close();
  } catch (error) {
    const closeErr = error as Error;
    if (writeErr) {
      throw new AggregateError([writeErr, closeErr], `${writeErr.message}; ${closeErr.message}`);
    }
    throw closeErr;
  }

  if (writeErr) {
    throw writeErr;
  }
}

// note: expects key to be in a canonical form (eg. "accept-encoding" should be "Accept-Encoding").
function setHeaderIfMissing(
  res: { getHeader: (k: string) => string | undefined; setHeader: (k: string, v: string) => void },
  key: string,
  value: string,
) {
  if (res.getHeader(key) == null) {
    res.setHeader(key, value);
  }
}
