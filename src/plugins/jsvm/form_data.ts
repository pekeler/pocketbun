// Ported from pocketbase/plugins/jsvm/form_data.go

import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { File, PathReader } from "../../tools/filesystem/file.ts";

export class FormData {
  #data: Map<string, unknown[]>;

  constructor() {
    this.#data = new Map();
  }

  Append(key: string, value: unknown): void {
    const values = this.#data.get(key) ?? [];
    values.push(value);
    this.#data.set(key, values);
  }

  append(key: string, value: unknown): void {
    this.Append(key, value);
  }

  Set(key: string, value: unknown): void {
    this.#data.set(key, [value]);
  }

  set(key: string, value: unknown): void {
    this.Set(key, value);
  }

  Delete(key: string): void {
    this.#data.delete(key);
  }

  delete(key: string): void {
    this.Delete(key);
  }

  Get(key: string): unknown {
    const values = this.#data.get(key);
    if (!values || values.length === 0) {
      return null;
    }
    return values[0] ?? null;
  }

  get(key: string): unknown {
    return this.Get(key);
  }

  GetAll(key: string): unknown[] | null {
    const values = this.#data.get(key);
    if (!values) {
      return null;
    }
    return values;
  }

  getAll(key: string): unknown[] | null {
    return this.GetAll(key);
  }

  Has(key: string): boolean {
    const values = this.#data.get(key);
    return Boolean(values && values.length > 0);
  }

  has(key: string): boolean {
    return this.Has(key);
  }

  Keys(): string[] {
    return Array.from(this.#data.keys());
  }

  keys(): string[] {
    return this.Keys();
  }

  Values(): unknown[] {
    const result: unknown[] = [];
    for (const values of this.#data.values()) {
      result.push(...values);
    }
    return result;
  }

  values(): unknown[] {
    return this.Values();
  }

  Entries(): unknown[][] {
    const result: unknown[][] = [];
    for (const [key, values] of this.#data.entries()) {
      for (const value of values) {
        result.push([key, value]);
      }
    }
    return result;
  }

  entries(): unknown[][] {
    return this.Entries();
  }

  toMultipart(): { body: Uint8Array; contentType: string } {
    const boundary = `----pb_hooks_${randomUUID()}`;
    const chunks: Uint8Array[] = [];

    const pushChunk = (chunk: string | Uint8Array): void => {
      if (typeof chunk === "string") {
        chunks.push(new TextEncoder().encode(chunk));
      } else {
        chunks.push(chunk);
      }
    };

    for (const [key, values] of this.#data.entries()) {
      for (const rawValue of values) {
        pushChunk(`--${boundary}\r\n`);

        if (rawValue instanceof File) {
          const filename = rawValue.OriginalName || rawValue.Name || "file";
          pushChunk(`Content-Disposition: form-data; name="${key}"; filename="${filename}"\r\n`);
          pushChunk("Content-Type: application/octet-stream\r\n\r\n");

          pushChunk(readFileBytesSync(rawValue));
          pushChunk("\r\n");
        } else {
          pushChunk(`Content-Disposition: form-data; name="${key}"\r\n\r\n`);
          pushChunk(String(rawValue));
          pushChunk("\r\n");
        }
      }
    }

    pushChunk(`--${boundary}--\r\n`);

    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const body = new Uint8Array(totalSize);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.length;
    }

    return {
      body,
      contentType: `multipart/form-data; boundary=${boundary}`,
    };
  }

  // toMultipartAsync is a PocketBun-only async alternative to toMultipart().
  async toMultipartAsync(): Promise<{ body: Uint8Array; contentType: string }> {
    const boundary = `----pb_hooks_${randomUUID()}`;
    const chunks: Uint8Array[] = [];

    const pushChunk = (chunk: string | Uint8Array): void => {
      if (typeof chunk === "string") {
        chunks.push(new TextEncoder().encode(chunk));
      } else {
        chunks.push(chunk);
      }
    };

    for (const [key, values] of this.#data.entries()) {
      for (const rawValue of values) {
        pushChunk(`--${boundary}\r\n`);

        if (rawValue instanceof File) {
          const filename = rawValue.OriginalName || rawValue.Name || "file";
          pushChunk(`Content-Disposition: form-data; name="${key}"; filename="${filename}"\r\n`);
          pushChunk("Content-Type: application/octet-stream\r\n\r\n");

          pushChunk(await readFileBytesAsync(rawValue));
          pushChunk("\r\n");
        } else {
          pushChunk(`Content-Disposition: form-data; name="${key}"\r\n\r\n`);
          pushChunk(String(rawValue));
          pushChunk("\r\n");
        }
      }
    }

    pushChunk(`--${boundary}--\r\n`);

    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const body = new Uint8Array(totalSize);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.length;
    }

    return {
      body,
      contentType: `multipart/form-data; boundary=${boundary}`,
    };
  }
}

function readFileBytesSync(file: File): Uint8Array {
  const reader = file.Reader?.Open();
  if (!reader) {
    return new Uint8Array();
  }
  try {
    return reader.readAll();
  } finally {
    reader.close();
  }
}

async function readFileBytesAsync(file: File): Promise<Uint8Array> {
  const reader = file.Reader;
  if (!reader) {
    return new Uint8Array();
  }

  if (reader instanceof PathReader) {
    // PocketBun async deviation: avoid sync disk reads in async hook paths.
    return await readFile(reader.Path);
  }

  const opened = reader.Open();
  try {
    return opened.readAll();
  } finally {
    opened.close();
  }
}
