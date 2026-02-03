// Ported from pocketbase/tools/filesystem/internal/s3blob/s3blob.go
// Deviation: async APIs are used for HTTP I/O in Bun.

import {
  base64Encode,
  formatTime,
  type Attributes,
  ErrNotFound,
  type Driver,
  type DriverReader,
  type DriverWriter,
  type ListOptions,
  type ListPage,
  type ListObject,
  type ReaderAttributes,
  type WriterOptions,
} from "../../blob/driver.ts";
import { HexEscape, HexUnescape } from "../../blob/hex.ts";
import { BytesBody, type Body, ResponseError, S3, type HttpRequest, Uploader } from "./s3/s3.ts";

const defaultPageSize = 1000;

export async function New(s3Client: S3): Promise<Driver> {
  if (!s3Client.Bucket) {
    throw new Error("s3blob.New: missing bucket name");
  }

  if (!s3Client.Endpoint) {
    throw new Error("s3blob.New: missing endpoint");
  }

  if (!s3Client.Region) {
    throw new Error("s3blob.New: missing region");
  }

  return new DriverImpl(s3Client);
}

class DriverImpl implements Driver {
  #s3: S3;

  constructor(s3: S3) {
    this.#s3 = s3;
  }

  async Close(): Promise<void> {}

  NormalizeError(err: Error): Error {
    if (err === ErrNotFound) {
      return err;
    }

    if (err instanceof AggregateError) {
      if (err.errors.some((entry) => entry === ErrNotFound)) {
        return err;
      }
    }

    const responseError = findResponseError(err);
    if (responseError) {
      if (responseError.Status === 404) {
        return joinErrors(err, ErrNotFound);
      }
      switch (responseError.Code) {
        case "NoSuchBucket":
        case "NoSuchKey":
        case "NotFound":
          return joinErrors(err, ErrNotFound);
        default:
          break;
      }
    }

    return err;
  }

  async ListPaged(ctx: AbortSignal | null, opts: ListOptions): Promise<ListPage> {
    const pageSize = opts.PageSize || defaultPageSize;

    const listParams = {
      ContinuationToken: opts.PageToken?.length ? new TextDecoder().decode(opts.PageToken) : "",
      Delimiter: opts.Delimiter ? escapeKey(opts.Delimiter) : "",
      Prefix: opts.Prefix ? escapeKey(opts.Prefix) : "",
      EncodingType: "",
      StartAfter: "",
      MaxKeys: pageSize,
      FetchOwner: false,
    };

    const resp = await this.#s3.ListObjects(ctx, listParams);

    const pageObjects: ListObject[] = [];

    for (const obj of resp.Contents) {
      pageObjects.push({
        Key: unescapeKey(obj.Key),
        ModTime: obj.LastModified,
        Size: obj.Size,
        MD5: eTagToMD5(obj.ETag),
        IsDir: false,
      });
    }

    for (const prefix of resp.CommonPrefixes) {
      pageObjects.push({
        Key: unescapeKey(prefix.Prefix),
        ModTime: new Date("0001-01-01T00:00:00Z"),
        Size: 0,
        MD5: null,
        IsDir: true,
      });
    }

    if (resp.Contents.length > 0 && resp.CommonPrefixes.length > 0) {
      pageObjects.sort((a, b) => a.Key.localeCompare(b.Key));
    }

    const nextToken = resp.NextContinuationToken ? new TextEncoder().encode(resp.NextContinuationToken) : new Uint8Array();

    return {
      Objects: pageObjects,
      NextPageToken: nextToken,
      toJSON() {
        return {
          objects: this.Objects.map((obj) => ({
            key: obj.Key,
            modTime: formatTime(obj.ModTime),
            size: obj.Size,
            md5: base64Encode(obj.MD5),
            isDir: obj.IsDir,
          })),
          nextPageToken: base64Encode(this.NextPageToken),
        };
      },
    } as ListPage;
  }

  async Attributes(ctx: AbortSignal | null, key: string): Promise<Attributes> {
    const resp = await this.#s3.HeadObject(ctx, escapeKey(key));

    const metadata: Record<string, string> = {};
    for (const [k, v] of Object.entries(resp.Metadata)) {
      metadata[HexUnescape(urlUnescape(k))] = urlUnescape(v);
    }

    const attrs: Attributes = {
      CacheControl: resp.CacheControl,
      ContentDisposition: resp.ContentDisposition,
      ContentEncoding: resp.ContentEncoding,
      ContentLanguage: resp.ContentLanguage,
      ContentType: resp.ContentType,
      Metadata: metadata,
      CreateTime: new Date("0001-01-01T00:00:00Z"),
      ModTime: resp.LastModified,
      Size: resp.ContentLength,
      MD5: eTagToMD5(resp.ETag),
      ETag: resp.ETag,
    };

    return {
      ...attrs,
      toJSON() {
        return {
          cacheControl: attrs.CacheControl,
          contentDisposition: attrs.ContentDisposition,
          contentEncoding: attrs.ContentEncoding,
          contentLanguage: attrs.ContentLanguage,
          contentType: attrs.ContentType,
          metadata: attrs.Metadata,
          createTime: formatTime(attrs.CreateTime),
          modTime: formatTime(attrs.ModTime),
          size: attrs.Size,
          md5: base64Encode(attrs.MD5),
          etag: attrs.ETag,
        };
      },
    } as Attributes;
  }

  async NewRangeReader(ctx: AbortSignal | null, key: string, offset: number, length: number): Promise<DriverReader> {
    const escapedKey = escapeKey(key);

    let byteRange = "";
    if (offset > 0 && length < 0) {
      byteRange = `bytes=${offset}-`;
    } else if (length === 0) {
      byteRange = `bytes=${offset}-${offset}`;
    } else if (length >= 0) {
      byteRange = `bytes=${offset}-${offset + length - 1}`;
    }

    const resp = await this.#s3.GetObject(ctx, escapedKey, (req) => {
      if (byteRange) {
        req.headers.set("Range", byteRange);
      }
    });

    let body: Body = resp.Body;
    if (length === 0) {
      body = new BytesBody(new Uint8Array());
    }

    const attrs: ReaderAttributes = {
      ContentType: resp.ContentType,
      ModTime: resp.LastModified,
      Size: getSize(resp.ContentLength, resp.ContentRange),
    };

    return {
      read(size?: number) {
        return body.read(size);
      },
      readAll() {
        return body.readAll();
      },
      close() {
        body.close();
      },
      Attributes() {
        return {
          ...attrs,
          toJSON() {
            return {
              contentType: attrs.ContentType,
              modTime: formatTime(attrs.ModTime),
              size: attrs.Size,
            };
          },
        } as ReaderAttributes;
      },
    } as DriverReader;
  }

  async NewTypedWriter(ctx: AbortSignal | null, key: string, contentType: string, opts: WriterOptions): Promise<DriverWriter> {
    const uploader = new Uploader();
    uploader.S3 = this.#s3;
    uploader.Key = escapeKey(key);

    if (opts.BufferSize) {
      uploader.MinPartSize = opts.BufferSize;
    }

    if (opts.MaxConcurrency) {
      uploader.MaxConcurrency = opts.MaxConcurrency;
    }

    const md: Record<string, string> = {};
    for (const [key, value] of Object.entries(opts.Metadata ?? {})) {
      const escapedKey = HexEscape(encodeURIComponent(key), (runes, i) => {
        const ch = runes[i] ?? "";
        return ch === "@" || ch === ":" || ch === "=";
      });
      md[escapedKey] = encodeURIComponent(value);
    }

    uploader.Metadata = md;

    const reqOptions: Array<(req: HttpRequest) => void> = [];
    reqOptions.push((req) => {
      req.headers.set("Content-Type", contentType);
      if (opts.CacheControl) {
        req.headers.set("Cache-Control", opts.CacheControl);
      }
      if (opts.ContentDisposition) {
        req.headers.set("Content-Disposition", opts.ContentDisposition);
      }
      if (opts.ContentEncoding) {
        req.headers.set("Content-Encoding", opts.ContentEncoding);
      }
      if (opts.ContentLanguage) {
        req.headers.set("Content-Language", opts.ContentLanguage);
      }
      if (opts.ContentMD5 && opts.ContentMD5.length > 0) {
        req.headers.set("Content-MD5", Buffer.from(opts.ContentMD5).toString("base64"));
      }
    });

    const chunks: Uint8Array[] = [];

    return {
      write(data?: Uint8Array | null): number {
        if (!data || data.length === 0) {
          return 0;
        }
        chunks.push(data);
        return data.length;
      },
      async close(): Promise<void> {
        const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const payload = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) {
          payload.set(chunk, offset);
          offset += chunk.length;
        }
        uploader.Payload = payload;
        await uploader.Upload(ctx, ...reqOptions);
      },
    } as DriverWriter;
  }

  async Copy(ctx: AbortSignal | null, dstKey: string, srcKey: string): Promise<void> {
    await this.#s3.CopyObject(ctx, escapeKey(srcKey), escapeKey(dstKey));
  }

  async Delete(ctx: AbortSignal | null, key: string): Promise<void> {
    await this.#s3.DeleteObject(ctx, escapeKey(key));
  }
}

function joinErrors(...errs: Error[]): AggregateError {
  return new AggregateError(errs);
}

function findResponseError(err: Error): ResponseError | null {
  if (err instanceof ResponseError) {
    return err;
  }
  if (err instanceof AggregateError) {
    for (const entry of err.errors) {
      if (entry instanceof ResponseError) {
        return entry;
      }
    }
  }
  const cause = (err as { cause?: unknown }).cause;
  if (cause instanceof ResponseError) {
    return cause;
  }
  return null;
}

function eTagToMD5(etag: string): Uint8Array | null {
  if (!etag) {
    return null;
  }

  if (etag.length < 2 || !etag.startsWith('"') || !etag.endsWith('"')) {
    return null;
  }

  const unquoted = etag.slice(1, -1);
  if (!unquoted) {
    return null;
  }

  const buffer = Buffer.from(unquoted, "hex");
  return buffer.length > 0 ? new Uint8Array(buffer) : null;
}

function getSize(contentLength: number, contentRange: string): number {
  let size = contentLength;
  if (contentRange) {
    const parts = contentRange.split("/");
    if (parts.length === 2) {
      const parsed = Number.parseInt(parts[1] ?? "", 10);
      if (Number.isFinite(parsed)) {
        size = parsed;
      }
    }
  }
  return size;
}

function escapeKey(key: string): string {
  return HexEscape(key, (runes, i) => {
    const rune = runes[i] ?? "";
    const code = rune.codePointAt(0) ?? 0;
    if (code < 32) {
      return true;
    }
    if (i > 1 && rune === "/" && runes[i - 1] === "." && runes[i - 2] === ".") {
      return true;
    }
    return false;
  });
}

function unescapeKey(key: string): string {
  return HexUnescape(key);
}

function urlUnescape(value: string): string {
  if (!value) {
    return value;
  }
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
