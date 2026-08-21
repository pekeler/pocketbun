// Ported from pocketbase/tools/filesystem/internal/s3blob/s3/error.go

import { parseXmlRoot, xmlChild, xmlText } from "./xml.ts";

export class ResponseError extends Error {
  Code = "";
  Message = "";
  RequestId = "";
  Resource = "";
  Raw: Uint8Array = new Uint8Array();
  Status = 0;

  constructor() {
    super("S3ResponseError");
    this.name = "ResponseError";
  }

  override toString(): string {
    return this.Error();
  }

  Error(): string {
    let result = `${this.Status} `;
    result += this.Code !== "" ? this.Code : "S3ResponseError";

    if (this.Message !== "") {
      result += `: ${this.Message}`;
    }

    if (this.Raw.length > 0) {
      result += `\n(RAW: ${new TextDecoder().decode(this.Raw)})`;
    }

    return result;
  }

  toJSON(): Record<string, unknown> {
    return {
      code: this.Code,
      message: this.Message,
      requestId: this.RequestId,
      resource: this.Resource,
      status: this.Status,
    };
  }
}

export function parseResponseErrorXml(raw: string): { Code: string; Message: string; RequestId: string; Resource: string } {
  const root = parseXmlRoot(raw);
  return {
    Code: xmlText(xmlChild(root, "Code")),
    Message: xmlText(xmlChild(root, "Message")),
    RequestId: xmlText(xmlChild(root, "RequestId")),
    Resource: xmlText(xmlChild(root, "Resource")),
  };
}
