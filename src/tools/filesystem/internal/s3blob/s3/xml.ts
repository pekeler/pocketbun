// PocketBun-only: normalizes Bun.XML's compact shape for fixed S3 response schemas.

type XmlValue = Bun.XML.Value | Bun.XML.Value[] | undefined;

export function parseXmlRoot(raw: string): Bun.XML.Element {
  const value = Object.values(Bun.XML.parse(raw.trimStart()))[0];
  return xmlElement(value);
}

export function xmlChild(element: Bun.XML.Element, name: string): XmlValue {
  const exact = element[name];
  if (exact !== undefined) {
    return exact;
  }

  const namespacedName = Object.keys(element).find((key) => !key.startsWith("@") && key.endsWith(`:${name}`));
  return namespacedName ? element[namespacedName] : undefined;
}

export function xmlElement(value: XmlValue): Bun.XML.Element {
  const first = Array.isArray(value) ? value[0] : value;
  return first && typeof first === "object" ? first : {};
}

export function xmlValues(value: XmlValue): Bun.XML.Value[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

export function xmlText(value: XmlValue): string {
  const first = Array.isArray(value) ? value[0] : value;
  if (typeof first === "string") {
    return first.trim();
  }
  if (first && typeof first === "object") {
    const text = first["#text"];
    return typeof text === "string" ? text.trim() : "";
  }
  return "";
}
