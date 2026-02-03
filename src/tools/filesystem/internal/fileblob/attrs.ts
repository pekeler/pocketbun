// Ported from pocketbase/tools/filesystem/internal/fileblob/attrs.go

import { readFileSync, writeFileSync } from "node:fs";

export const attrsExt = ".attrs";
export const errAttrsExt = new Error(`file extension "${attrsExt}" is reserved`);

export type XAttrs = {
  CacheControl: string;
  ContentDisposition: string;
  ContentEncoding: string;
  ContentLanguage: string;
  ContentType: string;
  Metadata: Record<string, string>;
  MD5: Uint8Array;
};

export function setAttrs(path: string, attrs: XAttrs): void {
  const raw = JSON.stringify({
    ...attrs,
    MD5: attrs.MD5.length > 0 ? Buffer.from(attrs.MD5).toString("base64") : "",
  });
  writeFileSync(path + attrsExt, raw);
}

export function getAttrs(path: string): XAttrs {
  try {
    const raw = readFileSync(path + attrsExt, "utf8");
    const parsed = JSON.parse(raw) as Partial<XAttrs> & { MD5?: string };
    return {
      CacheControl: parsed.CacheControl ?? "",
      ContentDisposition: parsed.ContentDisposition ?? "",
      ContentEncoding: parsed.ContentEncoding ?? "",
      ContentLanguage: parsed.ContentLanguage ?? "",
      ContentType: parsed.ContentType ?? "application/octet-stream",
      Metadata: parsed.Metadata ?? {},
      MD5: parsed.MD5 ? Uint8Array.from(Buffer.from(parsed.MD5, "base64")) : new Uint8Array(),
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        CacheControl: "",
        ContentDisposition: "",
        ContentEncoding: "",
        ContentLanguage: "",
        ContentType: "application/octet-stream",
        Metadata: {},
        MD5: new Uint8Array(),
      };
    }
    throw err;
  }
}
