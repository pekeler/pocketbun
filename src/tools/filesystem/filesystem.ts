// Ported from pocketbase/tools/filesystem/filesystem.go
// Deviation: System methods are async because Bun blob drivers use async I/O.
// Deviation: GetReuploadableFile buffers file contents to provide a sync FileReader.
// Deviation: CreateThumb is async because Bun image processing relies on async libraries.

import { mkdirSync } from "node:fs";
import { mkdir, open } from "node:fs/promises";
import { posix } from "node:path";
import sharp from "sharp";
import { Bucket, NewBucket } from "./blob/bucket.ts";
import { ErrNotFound, NotFoundError, type Attributes as BlobAttributes, type WriterOptions } from "./blob/driver.ts";
import { ErrEOF, isNotFoundError } from "./blob/errors.ts";
import { BytesReader, File, PathReader, ReadFileReaderBytesAsync, detectMimeTypeFromBytes, normalizeName } from "./file.ts";
import { New as NewFileBlob, NewAsync as NewFileBlobAsync, TryResolveLocalPath } from "./internal/fileblob/fileblob.ts";
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

type ServePlan = {
  statusCode: number;
  headers: Headers;
  reader: Awaited<ReturnType<Bucket["NewReader"]>> | null;
  body: Blob | null;
  startOffset: number;
  length: number;
  cleanup: () => Promise<void>;
};

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

  // GetReaderAsync returns a non-buffering async file content reader for the given fileKey.
  //
  // Deviation: PocketBun-only async alternative that avoids eager in-memory buffering.
  //
  // NB! Make sure to call close() on the returned result after use.
  //
  // If the file doesn't exist returns ErrNotFound.
  async GetReaderAsync(fileKey: string): Promise<SystemAsyncReader> {
    try {
      const reader = await this.#bucket.NewReader(this.#ctx, fileKey);
      return new SystemAsyncReader(reader);
    } catch (error) {
      throw mapFsError(error);
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

    let originalName = file.OriginalName;
    if (originalName.length > 255) {
      originalName = originalName.slice(0, 255);
    }

    if (file.Reader instanceof PathReader) {
      const sample = await readPathSample(file.Reader.Path);
      const writer = await this.#bucket.NewWriter(
        this.#ctx,
        fileKey,
        makeWriterOptions(detectMimeTypeFromBytes(sample), { [metadataOriginalName]: originalName }),
      );
      await streamPathToWriterAndClose(file.Reader.Path, writer);
      return;
    }

    const content = await ReadFileReaderBytesAsync(file.Reader);
    const writer = await this.#bucket.NewWriter(
      this.#ctx,
      fileKey,
      makeWriterOptions(detectMimeTypeFromBytes(content), { [metadataOriginalName]: originalName }),
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
      write?: (body: Uint8Array) => void;
      end: (body?: Uint8Array) => void;
    },
    req: { headers?: Record<string, string | string[]>; url?: string },
    fileKey: string,
    name: string,
  ): Promise<Error | null> {
    const initialHeaders = new Headers();
    for (const key of ["Content-Disposition", "Content-Type", "Content-Security-Policy", "Cache-Control"]) {
      const value = res.getHeader(key);
      if (value != null) {
        initialHeaders.set(key, value);
      }
    }

    const plan = await this.prepareServePlan(initialHeaders, req, fileKey, name);
    if (plan instanceof Error) {
      return plan;
    }
    try {
      res.statusCode = plan.statusCode;
      for (const [key, value] of plan.headers.entries()) {
        res.setHeader(key, value);
      }

      if (plan.body) {
        res.end(new Uint8Array(await plan.body.arrayBuffer()));
        return null;
      }

      if (!plan.reader) {
        res.end();
        return null;
      }

      await writeReaderToResponse(plan.reader, res, plan.startOffset, plan.length);
      return null;
    } finally {
      await plan.cleanup();
    }
  }

  // ServeResponse streams the file at fileKey location to a web Response body.
  //
  // Deviation: PocketBun-only helper used by Bun response handlers to avoid
  // buffering the full served file in an intermediate in-memory stream.
  async ServeResponse(
    initialHeaders: Headers,
    req: { headers?: Record<string, string | string[]>; url?: string },
    fileKey: string,
    name: string,
    onClose?: () => void | Promise<void>,
  ): Promise<Response | Error> {
    const plan = await this.prepareServePlan(initialHeaders, req, fileKey, name, onClose);
    if (plan instanceof Error) {
      return plan;
    }

    if (plan.body) {
      try {
        return new Response(plan.body, { status: plan.statusCode, headers: plan.headers });
      } finally {
        await plan.cleanup();
      }
    }

    if (!plan.reader) {
      try {
        return new Response(null, { status: plan.statusCode, headers: plan.headers });
      } finally {
        await plan.cleanup();
      }
    }

    plan.reader.seek(plan.startOffset, 0);
    let remaining = plan.length;
    let cleanedUp = false;

    const cleanup = async () => {
      if (cleanedUp) {
        return;
      }
      cleanedUp = true;
      await plan.cleanup();
    };

    const stream = new ReadableStream<Uint8Array>({
      pull: async (controller) => {
        try {
          if (remaining <= 0) {
            controller.close();
            await cleanup();
            return;
          }

          const chunk = await plan.reader!.read(Math.min(64 * 1024, remaining));
          if (!chunk || chunk.length === 0) {
            controller.close();
            await cleanup();
            return;
          }

          const out = chunk.length > remaining ? chunk.subarray(0, remaining) : chunk;
          remaining -= out.length;
          controller.enqueue(out);

          if (remaining <= 0) {
            controller.close();
            await cleanup();
          }
        } catch (error) {
          controller.error(error);
          await cleanup();
        }
      },
      cancel: async () => {
        await cleanup();
      },
    });

    return new Response(stream, { status: plan.statusCode, headers: plan.headers });
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

  private async prepareServePlan(
    initialHeaders: Headers,
    req: { headers?: Record<string, string | string[]>; url?: string },
    fileKey: string,
    name: string,
    onClose?: () => void | Promise<void>,
  ): Promise<ServePlan | Error> {
    let reader: Awaited<ReturnType<Bucket["NewReader"]>> | null = null;
    let body: Blob | null = null;
    let localPath: string | null = null;
    try {
      localPath = await TryResolveLocalPath(this.#bucket.drv, fileKey);
    } catch (error) {
      return mapFsError(error);
    }

    let cleanedUp = false;
    const cleanup = async () => {
      if (cleanedUp) {
        return;
      }
      cleanedUp = true;
      reader?.close();
      if (onClose) {
        await onClose();
      }
    };

    let attrs: BlobAttributes;
    try {
      attrs = await this.#bucket.Attributes(this.#ctx, fileKey);
    } catch (error) {
      return mapFsError(error);
    }

    const size = attrs.Size;
    const headers = new Headers(initialHeaders);
    const realContentType = attrs.ContentType;

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

    setHeaderIfMissingHeaders(headers, "Content-Disposition", `${disposition}; filename=${name}`);
    setHeaderIfMissingHeaders(headers, "Content-Type", extContentType);
    setHeaderIfMissingHeaders(
      headers,
      "Content-Security-Policy",
      "default-src 'none'; media-src 'self'; style-src 'unsafe-inline'; sandbox",
    );
    setHeaderIfMissingHeaders(headers, "Cache-Control", "max-age=2592000, stale-while-revalidate=86400");

    const rangeHeader = req.headers?.Range ?? req.headers?.range;
    const rangeValue = Array.isArray(rangeHeader) ? rangeHeader[0] : rangeHeader;
    if (rangeValue && rangeValue.startsWith("bytes=")) {
      const ranges = rangeValue
        .slice(6)
        .split(",")
        .map((part) => part.trim());
      if (ranges.length > 1) {
        headers.set("Content-Type", "multipart/byteranges; boundary=BOUNDARY");
        headers.set("Content-Length", "0");
        await cleanup();
        return {
          statusCode: 206,
          headers,
          reader: null,
          body: null,
          startOffset: 0,
          length: 0,
          cleanup: async () => {},
        };
      }

      const rangeSpec = ranges[0] ?? "";
      const [startRaw, endRaw] = rangeSpec.split("-").map((part) => part.trim());
      const start = startRaw === "" ? 0 : Number(startRaw);
      const end = endRaw === "" ? size - 1 : Number(endRaw);
      const safeStart = normalizeRangeStart(start, size);
      const safeEnd = normalizeRangeEnd(end, size, safeStart);
      const rangeLength = safeEnd >= safeStart ? safeEnd - safeStart + 1 : 0;
      headers.set("Content-Range", `bytes ${safeStart}-${safeEnd}/${size}`);
      headers.set("Content-Length", String(rangeLength));

      if (localPath) {
        body = rangeLength > 0 ? Bun.file(localPath).slice(safeStart, safeStart + rangeLength) : null;
        await cleanup();
        return {
          statusCode: 206,
          headers,
          reader: null,
          body,
          startOffset: safeStart,
          length: rangeLength,
          cleanup: async () => {},
        };
      }

      try {
        reader = await this.#bucket.NewReader(this.#ctx, fileKey);
      } catch (error) {
        return mapFsError(error);
      }
      return {
        statusCode: 206,
        headers,
        reader,
        body: null,
        startOffset: safeStart,
        length: rangeLength,
        cleanup,
      };
    }

    headers.set("Content-Length", String(size));

    if (localPath) {
      body = size > 0 ? Bun.file(localPath) : null;
      await cleanup();
      return {
        statusCode: 200,
        headers,
        reader: null,
        body,
        startOffset: 0,
        length: size,
        cleanup: async () => {},
      };
    }

    try {
      reader = await this.#bucket.NewReader(this.#ctx, fileKey);
    } catch (error) {
      return mapFsError(error);
    }
    return {
      statusCode: 200,
      headers,
      reader,
      body: null,
      startOffset: 0,
      length: size,
      cleanup,
    };
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

// NewS3 initializes a new S3 filesystem instance.
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

// SystemAsyncReader is a non-buffering async file reader wrapper.
//
// Deviation: PocketBun-only async alternative to SystemReader.
export class SystemAsyncReader {
  #reader: Awaited<ReturnType<Bucket["NewReader"]>>;

  constructor(reader: Awaited<ReturnType<Bucket["NewReader"]>>) {
    this.#reader = reader;
  }

  async read(size?: number): Promise<Uint8Array | null> {
    return await this.#reader.read(size);
  }

  async readAll(): Promise<Uint8Array> {
    return await this.#reader.readAll();
  }

  seek(offset: number, whence = 0): number {
    return this.#reader.seek(offset, whence);
  }

  close(): void {
    this.#reader.close();
  }

  ContentType(): string {
    return this.#reader.ContentType();
  }

  ModTime(): Date {
    return this.#reader.ModTime();
  }

  Size(): number {
    return this.#reader.Size();
  }

  size(): number {
    return this.#reader.Size();
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
    await writeChunkFully(writer, data);
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

async function streamPathToWriterAndClose(
  path: string,
  writer: { write: (data?: Uint8Array | null) => Promise<number>; close: () => Promise<void> },
): Promise<void> {
  const inFile = await open(path, "r");
  let writeErr: Error | null = null;
  try {
    const buffer = new Uint8Array(64 * 1024);
    for (;;) {
      const readResult = await inFile.read(buffer, 0, buffer.length, null);
      const bytesRead = readResult.bytesRead ?? 0;
      if (bytesRead <= 0) {
        break;
      }
      await writeChunkFully(writer, buffer.subarray(0, bytesRead));
    }
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
  } finally {
    await inFile.close();
  }

  if (writeErr) {
    throw writeErr;
  }
}

async function writeChunkFully(
  writer: { write: (data?: Uint8Array | null) => Promise<number> },
  data: Uint8Array,
): Promise<void> {
  let offset = 0;
  while (offset < data.length) {
    const written = await writer.write(data.subarray(offset));
    if (written <= 0) {
      throw new Error("failed to write file chunk");
    }
    offset += written;
  }
}

async function readPathSample(path: string, maxBytes = 4096): Promise<Uint8Array> {
  const inFile = await open(path, "r");
  try {
    const sample = new Uint8Array(maxBytes);
    const result = await inFile.read(sample, 0, sample.length, 0);
    const bytesRead = result.bytesRead ?? 0;
    return bytesRead > 0 ? sample.subarray(0, bytesRead) : new Uint8Array();
  } finally {
    await inFile.close();
  }
}

async function writeReaderToResponse(
  reader: Awaited<ReturnType<Bucket["NewReader"]>>,
  res: { write?: (body: Uint8Array) => void; end: (body?: Uint8Array) => void },
  startOffset: number,
  length: number,
): Promise<void> {
  reader.seek(startOffset, 0);

  if (length <= 0) {
    res.end();
    return;
  }

  if (typeof res.write !== "function") {
    const body = await readReaderRange(reader, length);
    res.end(body);
    return;
  }

  let remaining = length;
  while (remaining > 0) {
    const chunk = await reader.read(Math.min(64 * 1024, remaining));
    if (!chunk || chunk.length === 0) {
      break;
    }
    const out = chunk.length > remaining ? chunk.subarray(0, remaining) : chunk;
    res.write(out);
    remaining -= out.length;
  }
  res.end();
}

async function readReaderRange(reader: Awaited<ReturnType<Bucket["NewReader"]>>, length: number): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let total = 0;
  let remaining = length;
  while (remaining > 0) {
    const chunk = await reader.read(Math.min(64 * 1024, remaining));
    if (!chunk || chunk.length === 0) {
      break;
    }
    const out = chunk.length > remaining ? chunk.subarray(0, remaining) : chunk;
    chunks.push(out);
    total += out.length;
    remaining -= out.length;
  }

  if (chunks.length === 0) {
    return new Uint8Array();
  }
  if (chunks.length === 1) {
    return chunks[0] ?? new Uint8Array();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.length;
  }
  return body;
}

function normalizeRangeStart(start: number, size: number): number {
  if (!Number.isFinite(start)) {
    return 0;
  }
  if (start < 0) {
    return 0;
  }
  if (size <= 0) {
    return 0;
  }
  return Math.min(start, size - 1);
}

function normalizeRangeEnd(end: number, size: number, safeStart: number): number {
  if (size <= 0) {
    return -1;
  }
  if (!Number.isFinite(end)) {
    return size - 1;
  }
  if (end < safeStart) {
    return safeStart;
  }
  return Math.min(end, size - 1);
}

function setHeaderIfMissingHeaders(headers: Headers, key: string, value: string) {
  if (!headers.has(key)) {
    headers.set(key, value);
  }
}
