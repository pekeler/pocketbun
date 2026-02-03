// Ported from pocketbase/tools/filesystem/blob/bucket.go
// Deviation: async driver operations are awaited; no RWMutex since Bun runs JS on a single thread.

import {
  ErrClosed,
  type Attributes as DriverAttributes,
  type Driver,
  type ListObject,
  type ListOptions,
  type ListPage,
  type WriterOptions,
} from "./driver.ts";
import { ErrEOF, isNotFoundError, wrapError } from "./errors.ts";
import { Reader } from "./reader.ts";
import { Writer } from "./writer.ts";

export const FirstPageToken = new TextEncoder().encode("first page");

export class Bucket {
  readonly drv: Driver;
  #closed = false;

  constructor(drv: Driver) {
    this.drv = drv;
  }

  List(opts?: ListOptions): ListIterator {
    const options = opts ?? { Prefix: "", Delimiter: "", PageSize: 0, PageToken: new Uint8Array() };
    const dopts: ListOptions = {
      Prefix: options.Prefix,
      Delimiter: options.Delimiter,
      PageSize: 0,
      PageToken: new Uint8Array(),
    };
    return new ListIterator(this, dopts);
  }

  async ListPage(
    ctx: AbortSignal | null,
    pageToken: Uint8Array,
    pageSize: number,
    opts?: ListOptions,
  ): Promise<{ Objects: ListObject[]; NextPageToken: Uint8Array }> {
    const options = opts ?? { Prefix: "", Delimiter: "", PageSize: 0, PageToken: new Uint8Array() };
    if (pageSize <= 0) {
      throw new Error(`pageSize must be > 0 (${pageSize})`);
    }

    if (!pageToken || pageToken.length === 0) {
      throw ErrEOF;
    }

    let token = pageToken;
    if (bytesEqual(pageToken, FirstPageToken)) {
      token = new Uint8Array();
    }

    if (this.#closed) {
      throw ErrClosed;
    }

    const dopts: ListOptions = {
      Prefix: options.Prefix,
      Delimiter: options.Delimiter,
      PageToken: token,
      PageSize: pageSize,
    };

    const results: ListObject[] = [];
    while (results.length < pageSize) {
      let page: ListPage;
      try {
        page = await this.drv.ListPaged(ctx, dopts);
      } catch (err) {
        const wrapped = wrapError(this.drv, err as Error, "");
        if (wrapped) {
          throw wrapped;
        }
        throw err;
      }
      for (const obj of page.Objects) {
        results.push({
          Key: obj.Key,
          ModTime: obj.ModTime,
          Size: obj.Size,
          MD5: obj.MD5,
          IsDir: obj.IsDir,
        });
      }

      dopts.PageSize = pageSize - results.length;
      dopts.PageToken = page.NextPageToken;
      if (!dopts.PageToken || dopts.PageToken.length === 0) {
        dopts.PageToken = new Uint8Array();
        break;
      }
    }

    return { Objects: results, NextPageToken: dopts.PageToken };
  }

  async Attributes(ctx: AbortSignal | null, key: string): Promise<DriverAttributes> {
    if (!isValidUtf8(key)) {
      throw new Error(`Attributes key must be a valid UTF-8 string: ${JSON.stringify(key)}`);
    }

    if (this.#closed) {
      throw ErrClosed;
    }

    let attrs: DriverAttributes;
    try {
      attrs = await this.drv.Attributes(ctx, key);
    } catch (err) {
      const wrapped = wrapError(this.drv, err as Error, key);
      if (wrapped) {
        throw wrapped;
      }
      throw err;
    }

    let metadata: Record<string, string> | undefined;
    if (Object.keys(attrs.Metadata).length > 0) {
      metadata = {};
      for (const [k, v] of Object.entries(attrs.Metadata)) {
        metadata[k.toLowerCase()] = v;
      }
    }

    return {
      CacheControl: attrs.CacheControl,
      ContentDisposition: attrs.ContentDisposition,
      ContentEncoding: attrs.ContentEncoding,
      ContentLanguage: attrs.ContentLanguage,
      ContentType: attrs.ContentType,
      Metadata: metadata ?? {},
      CreateTime: attrs.CreateTime,
      ModTime: attrs.ModTime,
      Size: attrs.Size,
      MD5: attrs.MD5,
      ETag: attrs.ETag,
    };
  }

  async Exists(ctx: AbortSignal | null, key: string): Promise<boolean> {
    try {
      await this.Attributes(ctx, key);
      return true;
    } catch (err) {
      if (isNotFoundError(err)) {
        return false;
      }
      throw err;
    }
  }

  async NewReader(ctx: AbortSignal | null, key: string): Promise<Reader> {
    return this.NewRangeReader(ctx, key, 0, -1);
  }

  async NewRangeReader(ctx: AbortSignal | null, key: string, offset: number, length: number): Promise<Reader> {
    return this.#newRangeReader(ctx, key, offset, length);
  }

  async #newRangeReader(ctx: AbortSignal | null, key: string, offset: number, length: number): Promise<Reader> {
    if (this.#closed) {
      throw ErrClosed;
    }

    if (offset < 0) {
      throw new Error(`NewRangeReader offset must be non-negative (${offset})`);
    }

    if (!isValidUtf8(key)) {
      throw new Error(`NewRangeReader key must be a valid UTF-8 string: ${JSON.stringify(key)}`);
    }

    try {
      const dr = await this.drv.NewRangeReader(ctx, key, offset, length);
      return new Reader(ctx, this.drv, dr, key, offset, length);
    } catch (err) {
      const wrapped = wrapError(this.drv, err as Error, key);
      if (wrapped) {
        throw wrapped;
      }
      throw err;
    }
  }

  async NewWriter(ctx: AbortSignal | null, key: string, opts?: WriterOptions): Promise<Writer> {
    if (!isValidUtf8(key)) {
      throw new Error(`NewWriter key must be a valid UTF-8 string: ${JSON.stringify(key)}`);
    }

    const options = opts ?? {
      BufferSize: 0,
      MaxConcurrency: 0,
      CacheControl: "",
      ContentDisposition: "",
      ContentEncoding: "",
      ContentLanguage: "",
      ContentType: "",
      DisableContentTypeDetection: false,
      ContentMD5: new Uint8Array(),
      Metadata: {},
    };

    const dopts: WriterOptions = {
      CacheControl: options.CacheControl,
      ContentDisposition: options.ContentDisposition,
      ContentEncoding: options.ContentEncoding,
      ContentLanguage: options.ContentLanguage,
      ContentMD5: options.ContentMD5,
      BufferSize: options.BufferSize,
      MaxConcurrency: options.MaxConcurrency,
      DisableContentTypeDetection: options.DisableContentTypeDetection,
      ContentType: "",
      Metadata: {},
    };

    if (options.Metadata && Object.keys(options.Metadata).length > 0) {
      const md: Record<string, string> = {};
      for (const [keyName, value] of Object.entries(options.Metadata)) {
        if (keyName === "") {
          throw new Error("WriterOptions.Metadata keys may not be empty strings");
        }
        if (!isValidUtf8(keyName)) {
          throw new Error(`WriterOptions.Metadata keys must be valid UTF-8 strings: ${JSON.stringify(keyName)}`);
        }
        if (!isValidUtf8(value)) {
          throw new Error(`WriterOptions.Metadata values must be valid UTF-8 strings: ${JSON.stringify(value)}`);
        }
        const lower = keyName.toLowerCase();
        if (lower in md) {
          throw new Error(`WriterOptions.Metadata has a duplicate case-insensitive metadata key: ${JSON.stringify(lower)}`);
        }
        md[lower] = value;
      }
      dopts.Metadata = md;
    }

    if (this.#closed) {
      throw ErrClosed;
    }

    const controller = new AbortController();
    if (ctx) {
      if (ctx.aborted) {
        controller.abort();
      } else {
        ctx.addEventListener("abort", () => controller.abort(), { once: true });
      }
    }

    if (options.ContentType !== "" || options.DisableContentTypeDetection) {
      let contentType = "";
      if (options.ContentType !== "") {
        contentType = normalizeContentType(options.ContentType);
      }
      const writer = await this.drv.NewTypedWriter(controller.signal, key, contentType, dopts);
      return new Writer(this.drv, key, () => controller.abort(), options.ContentMD5, writer, null, null);
    }

    return new Writer(this.drv, key, () => controller.abort(), options.ContentMD5, null, controller.signal, dopts);
  }

  async Copy(ctx: AbortSignal | null, dstKey: string, srcKey: string): Promise<void> {
    if (!isValidUtf8(srcKey)) {
      throw new Error(`Copy srcKey must be a valid UTF-8 string: ${JSON.stringify(srcKey)}`);
    }
    if (!isValidUtf8(dstKey)) {
      throw new Error(`Copy dstKey must be a valid UTF-8 string: ${JSON.stringify(dstKey)}`);
    }
    if (this.#closed) {
      throw ErrClosed;
    }

    try {
      await this.drv.Copy(ctx, dstKey, srcKey);
    } catch (err) {
      const wrapped = wrapError(this.drv, err as Error, `${srcKey} -> ${dstKey}`);
      if (wrapped) {
        throw wrapped;
      }
      throw err;
    }
  }

  async Delete(ctx: AbortSignal | null, key: string): Promise<void> {
    if (!isValidUtf8(key)) {
      throw new Error(`Delete key must be a valid UTF-8 string: ${JSON.stringify(key)}`);
    }
    if (this.#closed) {
      throw ErrClosed;
    }

    try {
      await this.drv.Delete(ctx, key);
    } catch (err) {
      const wrapped = wrapError(this.drv, err as Error, key);
      if (wrapped) {
        throw wrapped;
      }
      throw err;
    }
  }

  async Close(): Promise<void> {
    const prev = this.#closed;
    this.#closed = true;
    if (prev) {
      throw ErrClosed;
    }
    try {
      await this.drv.Close();
    } catch (err) {
      const wrapped = wrapError(this.drv, err as Error, "");
      if (wrapped) {
        throw wrapped;
      }
      throw err;
    }
  }

  isClosed(): boolean {
    return this.#closed;
  }
}

export class ListIterator {
  #b: Bucket;
  #opts: ListOptions;
  #page: ListPage | null = null;
  #nextIdx = 0;

  constructor(bucket: Bucket, opts: ListOptions) {
    this.#b = bucket;
    this.#opts = opts;
  }

  async Next(ctx: AbortSignal | null): Promise<ListObject> {
    if (this.#page) {
      if (this.#nextIdx < this.#page.Objects.length) {
        const obj = this.#page.Objects[this.#nextIdx];
        if (!obj) {
          throw ErrEOF;
        }
        this.#nextIdx += 1;
        return {
          Key: obj.Key,
          ModTime: obj.ModTime,
          Size: obj.Size,
          MD5: obj.MD5,
          IsDir: obj.IsDir,
        };
      }

      if (this.#page.NextPageToken.length === 0) {
        throw ErrEOF;
      }

      this.#opts.PageToken = this.#page.NextPageToken;
    }

    if (this.#b.isClosed()) {
      throw ErrClosed;
    }

    let page: ListPage;
    try {
      page = await this.#b.drv.ListPaged(ctx, this.#opts);
    } catch (err) {
      const wrapped = wrapError(this.#b.drv, err as Error, "");
      if (wrapped) {
        throw wrapped;
      }
      throw err;
    }
    this.#page = page;
    this.#nextIdx = 0;
    return this.Next(ctx);
  }
}

export function NewBucket(drv: Driver): Bucket {
  return new Bucket(drv);
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

function isValidUtf8(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      if (i + 1 >= value.length) {
        return false;
      }
      const next = value.charCodeAt(i + 1);
      if (next < 0xdc00 || next > 0xdfff) {
        return false;
      }
      i += 1;
      continue;
    }
    if (code >= 0xdc00 && code <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function normalizeContentType(value: string): string {
  const parts = value
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
  const mediaType = parts.shift() ?? "";
  if (!mediaType || !mediaType.includes("/")) {
    throw new Error(`invalid ContentType ${JSON.stringify(value)}`);
  }
  if (parts.length === 0) {
    return mediaType;
  }
  const params = parts.map((part) => {
    const [rawKey, paramValue] = part.split("=");
    const key = rawKey ?? "";
    if (!paramValue) {
      return key.toLowerCase();
    }
    return `${key.toLowerCase()}=${paramValue}`;
  });
  return `${mediaType}; ${params.join("; ")}`;
}
