// Ported from pocketbase/tools/filesystem/internal/s3blob/s3/list_objects.go

import type { HttpRequest, S3 } from "./s3.ts";
import { newRequest } from "./s3.ts";
import { parseXmlRoot, xmlChild, xmlElement, xmlText, xmlValues } from "./xml.ts";

export type ListParams = {
  ContinuationToken: string;
  Delimiter: string;
  Prefix: string;
  EncodingType: string;
  StartAfter: string;
  MaxKeys: number;
  FetchOwner: boolean;
};

export type ListObjectCommonPrefix = {
  Prefix: string;
};

export type ListObjectContent = {
  Key: string;
  LastModified: Date;
  Size: number;
  ETag: string;
};

export type ListObjectsResponse = {
  EncodingType: string;
  Name: string;
  Prefix: string;
  Delimiter: string;
  ContinuationToken: string;
  NextContinuationToken: string;
  StartAfter: string;
  CommonPrefixes: ListObjectCommonPrefix[];
  Contents: ListObjectContent[];
  KeyCount: number;
  MaxKeys: number;
  IsTruncated: boolean;
  toJSON?: () => Record<string, unknown>;
};

export async function listObjects(
  s3: S3,
  ctx: AbortSignal | null,
  params: ListParams,
  ...optReqFuncs: Array<(req: HttpRequest) => void>
): Promise<ListObjectsResponse> {
  const query = encodeListParams(params);
  const url = s3.URL(`?${query}`);
  const req = newRequest(ctx, "GET", url, null);

  for (const fn of optReqFuncs) {
    if (fn) {
      fn(req);
    }
  }

  const resp = await s3.SignAndSend(req);
  const body = new TextDecoder().decode(resp.body.readAll());
  resp.body.close();

  return parseListObjectsResponse(body);
}

function encodeListParams(params: ListParams): string {
  const entries: Array<[string, string]> = [["list-type", "2"]];

  if (params.ContinuationToken) {
    entries.push(["continuation-token", params.ContinuationToken]);
  }
  if (params.Delimiter) {
    entries.push(["delimiter", params.Delimiter]);
  }
  if (params.Prefix) {
    entries.push(["prefix", params.Prefix]);
  }
  if (params.EncodingType) {
    entries.push(["encoding-type", params.EncodingType]);
  }
  if (params.FetchOwner) {
    entries.push(["fetch-owner", "true"]);
  }
  if (params.MaxKeys > 0) {
    entries.push(["max-keys", String(params.MaxKeys)]);
  }
  if (params.StartAfter) {
    entries.push(["start-after", params.StartAfter]);
  }

  entries.sort((a, b) => a[0].localeCompare(b[0]));
  const query = new URLSearchParams();
  for (const [key, value] of entries) {
    query.append(key, value);
  }
  return query.toString();
}

function parseListObjectsResponse(raw: string): ListObjectsResponse {
  const root = parseXmlRoot(raw);
  const response: ListObjectsResponse = {
    EncodingType: xmlText(xmlChild(root, "EncodingType")),
    Name: xmlText(xmlChild(root, "Name")),
    Prefix: xmlText(xmlChild(root, "Prefix")),
    Delimiter: xmlText(xmlChild(root, "Delimiter")),
    ContinuationToken: xmlText(xmlChild(root, "ContinuationToken")),
    NextContinuationToken: xmlText(xmlChild(root, "NextContinuationToken")),
    StartAfter: xmlText(xmlChild(root, "StartAfter")),
    CommonPrefixes: [],
    Contents: [],
    KeyCount: Number.parseInt(xmlText(xmlChild(root, "KeyCount")) || "0", 10),
    MaxKeys: Number.parseInt(xmlText(xmlChild(root, "MaxKeys")) || "0", 10),
    IsTruncated: xmlText(xmlChild(root, "IsTruncated")).toLowerCase() === "true",
  };

  for (const value of xmlValues(xmlChild(root, "Contents"))) {
    const content = xmlElement(value);
    const lastModified = xmlText(xmlChild(content, "LastModified"));
    const sizeRaw = xmlText(xmlChild(content, "Size"));
    response.Contents.push({
      Key: xmlText(xmlChild(content, "Key")),
      LastModified: lastModified ? new Date(lastModified) : new Date(0),
      Size: sizeRaw ? Number.parseInt(sizeRaw, 10) : 0,
      ETag: xmlText(xmlChild(content, "ETag")),
    });
  }

  for (const value of xmlValues(xmlChild(root, "CommonPrefixes"))) {
    response.CommonPrefixes.push({ Prefix: xmlText(xmlChild(xmlElement(value), "Prefix")) });
  }

  return {
    ...response,
    toJSON() {
      return {
        encodingType: response.EncodingType,
        name: response.Name,
        prefix: response.Prefix,
        delimiter: response.Delimiter,
        continuationToken: response.ContinuationToken,
        nextContinuationToken: response.NextContinuationToken,
        startAfter: response.StartAfter,
        commonPrefixes: response.CommonPrefixes.map((prefix) => ({ prefix: prefix.Prefix })),
        contents: response.Contents.map((content) => ({
          key: content.Key,
          lastModified: formatTime(content.LastModified),
          size: content.Size,
          etag: content.ETag,
        })),
        keyCount: response.KeyCount,
        maxKeys: response.MaxKeys,
        isTruncated: response.IsTruncated,
      };
    },
  } as ListObjectsResponse;
}

function formatTime(value: Date): string {
  return value.toISOString().replace(".000Z", "Z");
}
