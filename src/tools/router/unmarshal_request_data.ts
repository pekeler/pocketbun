// Ported from pocketbase/tools/router/unmarshal_request_data.go
// Note: only map[string]any unmarshaling is implemented (struct binding is pending).

export const JSONPayloadKey = "@jsonPayload";

export function unmarshalRequestData(data: Record<string, string[]>, dest: Record<string, unknown>): Error | null {
  if (!data || Object.keys(data).length === 0) {
    return null;
  }

  for (const [key, values] of Object.entries(data)) {
    if (key === JSONPayloadKey) {
      continue;
    }
    if (!values || values.length === 0) {
      continue;
    }

    if (values.length === 1) {
      dest[key] = inferValue(values[0] ?? "");
    } else {
      dest[key] = values.map((value) => inferValue(value ?? ""));
    }
  }

  const payloads = data[JSONPayloadKey] ?? [];
  for (const payload of payloads) {
    if (payload === "") {
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch (error) {
      return error as Error;
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return new Error("invalid json payload");
    }
    Object.assign(dest, parsed as Record<string, unknown>);
  }

  return null;
}

const inferNumberCharsRegex = /^[\\-\\.\\d]+$/;

// In order to support more seamlessly both json and multipart/form-data requests,
// the following normalization rules are applied for plain multipart string values:
//   - "true" is converted to the json "true"
//   - "false" is converted to the json "false"
//   - numeric strings are converted to json number ONLY if the resulted
//     minimal number string representation is the same as the provided raw string
//     (aka. scientific notations, "Infinity", "0.0", "0001", etc. are kept as string)
//   - any other string (empty string too) is left as it is
function inferValue(raw: string): unknown {
  switch (raw) {
    case "":
      return raw;
    case "true":
      return true;
    case "false":
      return false;
    default: {
      const first = raw[0] ?? "";
      if (raw.length > 0 && (first === "-" || (first >= "0" && first <= "9")) && inferNumberCharsRegex.test(raw)) {
        const value = Number.parseFloat(raw);
        if (Number.isFinite(value) && String(value) === raw) {
          return value;
        }
      }
      return raw;
    }
  }
}
