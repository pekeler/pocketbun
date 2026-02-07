// Ported from pocketbase/tools/filesystem/blob/driver.go.

export class NotFoundError extends Error {
  constructor(message = "resource not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ClosedError extends Error {
  constructor(message = "bucket or blob is closed") {
    super(message);
    this.name = "ClosedError";
  }
}

export const ErrNotFound = new NotFoundError();
export const ErrClosed = new ClosedError();

export type ReaderAttributes = {
  ContentType: string;
  ModTime: Date;
  Size: number;
};

export type Attributes = {
  CacheControl: string;
  ContentDisposition: string;
  ContentEncoding: string;
  ContentLanguage: string;
  ContentType: string;
  Metadata: Record<string, string>;
  CreateTime: Date;
  ModTime: Date;
  Size: number;
  MD5: Uint8Array | null;
  ETag: string;
};

export type ListObject = {
  Key: string;
  ModTime: Date;
  Size: number;
  MD5: Uint8Array | null;
  IsDir: boolean;
};

export type ListPage = {
  Objects: ListObject[];
  NextPageToken: Uint8Array;
};

export type ListOptions = {
  Prefix: string;
  Delimiter: string;
  PageSize: number;
  PageToken: Uint8Array;
};

export type WriterOptions = {
  BufferSize: number;
  MaxConcurrency: number;
  CacheControl: string;
  ContentDisposition: string;
  ContentEncoding: string;
  ContentLanguage: string;
  ContentType: string;
  DisableContentTypeDetection: boolean;
  ContentMD5: Uint8Array;
  Metadata: Record<string, string>;
};

export interface DriverReader {
  read(size?: number): Uint8Array | null;
  readAll(): Uint8Array;
  close(): void;
  Attributes(): ReaderAttributes;
}

export interface DriverWriter {
  write(data?: Uint8Array | null): number;
  // PocketBun-only async alternative to write().
  writeAsync?(data?: Uint8Array | null): Promise<number>;
  close(): Promise<void> | void;
}

export interface Driver {
  NormalizeError(err: Error): Error;
  Attributes(ctx: AbortSignal | null, key: string): Promise<Attributes>;
  ListPaged(ctx: AbortSignal | null, opts: ListOptions): Promise<ListPage>;
  NewRangeReader(ctx: AbortSignal | null, key: string, offset: number, length: number): Promise<DriverReader>;
  NewTypedWriter(ctx: AbortSignal | null, key: string, contentType: string, opts: WriterOptions): Promise<DriverWriter>;
  Copy(ctx: AbortSignal | null, dstKey: string, srcKey: string): Promise<void>;
  Delete(ctx: AbortSignal | null, key: string): Promise<void>;
  Close(): Promise<void> | void;
}

export function formatTime(value: Date): string {
  return value.toISOString().replace(".000Z", "Z");
}

export function base64Encode(data: Uint8Array | null): string | null {
  if (!data) {
    return null;
  }
  return Buffer.from(data).toString("base64");
}
