// Ported from pocketbase/tools/filesystem/internal/s3blob/s3/uploader.go
// Deviation: multipart uploads are processed sequentially in Bun.

import type { Body, HttpRequest, S3 } from "./s3.ts";
import { metadataPrefix, newRequest } from "./s3.ts";

export class Uploader {
  S3: S3 | null = null;
  Payload: Uint8Array | string | Body | null = null;
  Key = "";
  Metadata: Record<string, string> = {};
  MaxConcurrency = 0;
  MinPartSize = 0;

  private uploadId = "";
  private uploadedParts: Array<{ ETag: string; PartNumber: number }> = [];
  private used = false;

  async Upload(ctx: AbortSignal | null, ...optReqFuncs: Array<(req: HttpRequest) => void>): Promise<void> {
    if (this.used) {
      throw new Error("the Uploader has been already used");
    }

    this.validateAndNormalize();

    const payload = readAllPayload(this.Payload);
    if (payload.length < this.MinPartSize) {
      await this.singleUpload(ctx, payload, optReqFuncs);
      return;
    }

    await this.multipartInit(ctx, optReqFuncs);

    try {
      await this.multipartUpload(ctx, payload, optReqFuncs);
    } catch (err) {
      await this.multipartAbort(ctx, optReqFuncs);
      throw err;
    }

    try {
      await this.multipartComplete(ctx, optReqFuncs);
    } catch (err) {
      await this.multipartAbort(ctx, optReqFuncs);
      throw err;
    }
  }

  private validateAndNormalize(): void {
    if (!this.S3) {
      throw new Error("Uploader.S3 must be a non-empty and properly initialized S3 client instance");
    }
    if (!this.Key) {
      throw new Error("Uploader.Key is required");
    }
    if (!this.Payload) {
      throw new Error("Uploader.Payload must be a non-nill");
    }
    if (this.MaxConcurrency <= 0) {
      this.MaxConcurrency = 5;
    }
    if (this.MinPartSize <= 0) {
      this.MinPartSize = 6 << 20;
    }
  }

  private async singleUpload(
    ctx: AbortSignal | null,
    part: Uint8Array,
    optReqFuncs: Array<(req: HttpRequest) => void>,
  ): Promise<void> {
    if (this.used) {
      throw new Error("the Uploader has been already used");
    }

    const req = newRequest(ctx, "PUT", this.S3!.URL(this.Key), part);
    req.headers.set("Content-Length", String(part.length));

    for (const [key, value] of Object.entries(this.Metadata)) {
      req.headers.set(metadataPrefix + key, value);
    }

    for (const fn of optReqFuncs) {
      if (fn) {
        fn(req);
      }
    }

    const resp = await this.S3!.SignAndSend(req);
    resp.body.close();
  }

  private async multipartInit(ctx: AbortSignal | null, optReqFuncs: Array<(req: HttpRequest) => void>): Promise<void> {
    if (this.used) {
      throw new Error("the Uploader has been already used");
    }

    const req = newRequest(ctx, "POST", this.S3!.URL(`${this.Key}?uploads`), null);
    for (const [key, value] of Object.entries(this.Metadata)) {
      req.headers.set(metadataPrefix + key, value);
    }

    for (const fn of optReqFuncs) {
      if (fn) {
        fn(req);
      }
    }

    const resp = await this.S3!.SignAndSend(req);
    const body = new TextDecoder().decode(resp.body.readAll());
    resp.body.close();

    const uploadId = extractXmlTag(body, "UploadId");
    if (!uploadId) {
      throw new Error("missing UploadId in multipart init response");
    }

    this.uploadId = uploadId;
  }

  private async multipartAbort(ctx: AbortSignal | null, optReqFuncs: Array<(req: HttpRequest) => void>): Promise<void> {
    this.used = true;

    const query = new URLSearchParams({ uploadId: this.uploadId }).toString();
    const req = newRequest(ctx, "DELETE", this.S3!.URL(`${this.Key}?${query}`), null);

    for (const fn of optReqFuncs) {
      if (fn) {
        fn(req);
      }
    }

    const resp = await this.S3!.SignAndSend(req);
    resp.body.close();
  }

  private async multipartUpload(
    ctx: AbortSignal | null,
    payload: Uint8Array,
    optReqFuncs: Array<(req: HttpRequest) => void>,
  ): Promise<void> {
    let partNumber = 1;
    for (let offset = 0; offset < payload.length; offset += this.MinPartSize) {
      const part = payload.slice(offset, offset + this.MinPartSize);
      await this.uploadPart(ctx, part, partNumber, optReqFuncs);
      partNumber += 1;
    }
  }

  private async uploadPart(
    ctx: AbortSignal | null,
    part: Uint8Array,
    partNumber: number,
    optReqFuncs: Array<(req: HttpRequest) => void>,
  ): Promise<void> {
    const query = new URLSearchParams({ partNumber: String(partNumber), uploadId: this.uploadId }).toString();
    const req = newRequest(ctx, "PUT", this.S3!.URL(`${this.Key}?${query}`), part);
    req.headers.set("Content-Length", String(part.length));

    for (const fn of optReqFuncs) {
      if (fn) {
        fn(req);
      }
    }

    const resp = await this.S3!.SignAndSend(req);
    const etag = resp.headers.get("Etag") ?? resp.headers.get("ETag") ?? "";
    resp.body.close();

    this.uploadedParts.push({ ETag: etag, PartNumber: partNumber });
  }

  private async multipartComplete(ctx: AbortSignal | null, optReqFuncs: Array<(req: HttpRequest) => void>): Promise<void> {
    this.used = true;

    this.uploadedParts.sort((a, b) => a.PartNumber - b.PartNumber);

    const partsXml = this.uploadedParts
      .map((part) => `<Part><ETag>${part.ETag}</ETag><PartNumber>${part.PartNumber}</PartNumber></Part>`)
      .join("");
    const body = `<?xml version="1.0" encoding="UTF-8"?><CompleteMultipartUpload>${partsXml}</CompleteMultipartUpload>`;

    const query = new URLSearchParams({ uploadId: this.uploadId }).toString();
    const req = newRequest(ctx, "POST", this.S3!.URL(`${this.Key}?${query}`), new TextEncoder().encode(body));

    for (const fn of optReqFuncs) {
      if (fn) {
        fn(req);
      }
    }

    const resp = await this.S3!.SignAndSend(req);
    resp.body.close();
  }
}

function readAllPayload(payload: Uint8Array | string | Body | null): Uint8Array {
  if (!payload) {
    return new Uint8Array();
  }

  if (payload instanceof Uint8Array) {
    return payload;
  }

  if (typeof payload === "string") {
    return new TextEncoder().encode(payload);
  }

  if (typeof payload.readAll === "function") {
    return payload.readAll();
  }

  return new Uint8Array();
}

function extractXmlTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`);
  const match = regex.exec(xml);
  return match?.[1]?.trim() ?? "";
}
