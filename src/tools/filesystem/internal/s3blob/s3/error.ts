// Ported from pocketbase/tools/filesystem/internal/s3blob/s3/error.go

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
  return {
    Code: extractXmlTag(raw, "Code"),
    Message: extractXmlTag(raw, "Message"),
    RequestId: extractXmlTag(raw, "RequestId"),
    Resource: extractXmlTag(raw, "Resource"),
  };
}

function extractXmlTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`);
  const match = regex.exec(xml);
  return match?.[1]?.trim() ?? "";
}
