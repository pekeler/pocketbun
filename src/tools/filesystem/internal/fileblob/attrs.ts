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
    "user.cache_control": attrs.CacheControl,
    "user.content_disposition": attrs.ContentDisposition,
    "user.content_encoding": attrs.ContentEncoding,
    "user.content_language": attrs.ContentLanguage,
    "user.content_type": attrs.ContentType,
    "user.metadata": Object.keys(attrs.Metadata).length > 0 ? attrs.Metadata : null,
    md5: attrs.MD5.length > 0 ? Buffer.from(attrs.MD5).toString("base64") : "",
  });
  writeFileSync(path + attrsExt, raw);
}

export function getAttrs(path: string): XAttrs {
  try {
    const raw = readFileSync(path + attrsExt, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const getString = (key: string): string => (typeof parsed[key] === "string" ? (parsed[key] as string) : "");
    const getMetadata = (key: string): Record<string, string> => {
      const value = parsed[key];
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
      }
      const entries = Object.entries(value as Record<string, unknown>);
      const out: Record<string, string> = {};
      for (const [k, v] of entries) {
        if (typeof v === "string") {
          out[k] = v;
        }
      }
      return out;
    };
    const md5Value = parsed.md5 ?? parsed.MD5;
    const md5 =
      typeof md5Value === "string" && md5Value.length > 0 ? Uint8Array.from(Buffer.from(md5Value, "base64")) : new Uint8Array();
    const metadata = getMetadata("user.metadata");
    const fallbackMetadata = getMetadata("Metadata");
    return {
      CacheControl: getString("user.cache_control") || getString("CacheControl"),
      ContentDisposition: getString("user.content_disposition") || getString("ContentDisposition"),
      ContentEncoding: getString("user.content_encoding") || getString("ContentEncoding"),
      ContentLanguage: getString("user.content_language") || getString("ContentLanguage"),
      ContentType: getString("user.content_type") || getString("ContentType") || "application/octet-stream",
      Metadata: Object.keys(metadata).length > 0 ? metadata : fallbackMetadata,
      MD5: md5,
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
