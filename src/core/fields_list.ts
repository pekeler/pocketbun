// Ported from pocketbase/core/fields_list.go

import { Fields, type Field } from "./field.ts";

// NewFieldsList creates a new FieldsList instance with the provided fields.
export function NewFieldsList(...fields: Field[]): FieldsList {
  const list = new FieldsList();
  list.Add(...fields);
  return list;
}

// FieldsList defines a Collection slice of fields.
export class FieldsList extends Array<Field> {
  // Clone creates a deep clone of the current list.
  Clone(): FieldsList {
    const raw = JSON.stringify(this);
    return FieldsList.fromJSON(raw);
  }

  // FieldNames returns a slice with the name of all list fields.
  FieldNames(): string[] {
    return this.map((field) => field.GetName());
  }

  // AsMap returns a map with all registered list field.
  // The returned map is indexed with each field name.
  AsMap(): Record<string, Field> {
    const result: Record<string, Field> = {};
    for (const field of this) {
      result[field.GetName()] = field;
    }
    return result;
  }

  // GetById returns a single field by its id.
  GetById(fieldId: string): Field | null {
    for (const field of this) {
      if (field.GetId() === fieldId) {
        return field;
      }
    }
    return null;
  }

  // GetByName returns a single field by its name.
  GetByName(fieldName: string): Field | null {
    for (const field of this) {
      if (field.GetName() === fieldName) {
        return field;
      }
    }
    return null;
  }

  // RemoveById removes a single field by its id.
  //
  // This method does nothing if field with the specified id doesn't exist.
  RemoveById(fieldId: string): void {
    for (let i = 0; i < this.length; i += 1) {
      if (this[i]?.GetId() === fieldId) {
        this.splice(i, 1);
        return;
      }
    }
  }

  // RemoveByName removes a single field by its name.
  //
  // This method does nothing if field with the specified name doesn't exist.
  RemoveByName(fieldName: string): void {
    for (let i = 0; i < this.length; i += 1) {
      if (this[i]?.GetName() === fieldName) {
        this.splice(i, 1);
        return;
      }
    }
  }

  // Add adds one or more fields to the current list.
  //
  // By default this method will try to REPLACE existing fields with
  // the new ones by their id or by their name if the new field doesn't have an explicit id.
  //
  // If no matching existing field is found, it will APPEND the field to the end of the list.
  //
  // In all cases, if any of the new fields don't have an explicit id it will auto generate a default one for them
  // (the id value doesn't really matter and it is mostly used as a stable identifier in case of a field rename).
  Add(...fields: Field[]): void {
    for (const field of fields) {
      this.add(-1, field);
    }
  }

  // AddAt is the same as Add but insert/move the fields at the specific position.
  //
  // If pos < 0, then this method acts the same as calling Add.
  //
  // If pos > FieldsList total items, then the specified fields are inserted/moved at the end of the list.
  AddAt(pos: number, ...fields: Field[]): void {
    const total = this.length;
    for (let i = 0; i < fields.length; i += 1) {
      const field = fields[i];
      if (!field) {
        continue;
      }
      if (pos < 0) {
        this.add(-1, field);
      } else if (pos > total) {
        this.add(total + i, field);
      } else {
        this.add(pos + i, field);
      }
    }
  }

  // AddMarshaledJSON parses the provided raw json data and adds the
  // found fields into the current list (following the same rule as the Add method).
  //
  // The rawJSON argument could be one of:
  //   - serialized array of field objects
  //   - single field object.
  //
  // Example:
  //
  //	l.AddMarshaledJSON([]byte{`{"type":"text", name: "test"}`})
  //	l.AddMarshaledJSON([]byte{`[{"type":"text", name: "test1"}, {"type":"text", name: "test2"}]`})
  AddMarshaledJSON(rawJSON: string | Uint8Array | null | undefined): void {
    const extracted = marshaledJSONtoFieldsList(rawJSON);
    this.Add(...extracted);
  }

  // AddMarshaledJSONAt is the same as AddMarshaledJSON but insert/move the fields at the specific position.
  //
  // If pos < 0, then this method acts the same as calling AddMarshaledJSON.
  //
  // If pos > FieldsList total items, then the specified fields are inserted/moved at the end of the list.
  AddMarshaledJSONAt(pos: number, rawJSON: string | Uint8Array | null | undefined): void {
    const extracted = marshaledJSONtoFieldsList(rawJSON);
    this.AddAt(pos, ...extracted);
  }

  // String returns the string representation of the current list.
  String(): string {
    return JSON.stringify(this);
  }

  toJSON(): Record<string, unknown>[] {
    const wrapper: Record<string, unknown>[] = [];
    for (const field of this) {
      const raw = JSON.parse(JSON.stringify(field)) as Record<string, unknown>;
      const normalized: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(raw)) {
        if (!key) {
          continue;
        }
        if (key === "type") {
          continue;
        }
        const lowerKey = key[0]!.toLowerCase() + key.slice(1);
        if (key[0]!.toLowerCase() !== key[0]!) {
          normalized[lowerKey] = value;
        } else if (!(lowerKey in normalized)) {
          normalized[lowerKey] = value;
        }
      }

      normalized.type = field.Type();
      wrapper.push(normalized);
    }
    return wrapper;
  }

  static fromJSON(rawJSON: string | Uint8Array): FieldsList {
    const list = new FieldsList();
    list.unmarshalJSON(rawJSON);
    return list;
  }

  unmarshalJSON(rawJSON: string | Uint8Array): void {
    const fields = parseFieldsJSON(rawJSON);
    this.splice(0, this.length);
    for (const field of fields) {
      this.add(-1, field);
    }
  }

  private add(pos: number, newField: Field): void {
    let replaceByName = false;
    let replaceInPlace = false;

    if (pos < 0) {
      replaceInPlace = true;
      pos = this.length;
    } else if (pos > this.length) {
      pos = this.length;
    }

    let newFieldId = newField.GetId();
    if (newFieldId === "") {
      replaceByName = true;
      const baseId = newField.Type() + crc32Checksum(newField.GetName());
      newFieldId = baseId;
      for (let i = 2; i < 1000; i += 1) {
        if (!this.GetById(newFieldId)) {
          break;
        }
        newFieldId = baseId + String(i);
      }
      newField.SetId(newFieldId);
    }

    for (let i = 0; i < this.length; i += 1) {
      const field = this[i];
      if (!field) {
        continue;
      }
      if (replaceByName) {
        const name = newField.GetName();
        if (name && field.GetName() === name) {
          newField.SetId(field.GetId());
          if (replaceInPlace) {
            this[i] = newField;
            return;
          }
          this.splice(i, 1);
          if (pos > this.length) {
            pos = this.length;
          }
          break;
        }
      } else if (field.GetId() === newFieldId) {
        if (replaceInPlace) {
          this[i] = newField;
          return;
        }
        this.splice(i, 1);
        if (pos > this.length) {
          pos = this.length;
        }
        break;
      }
    }

    this.splice(pos, 0, newField);
  }
}

function marshaledJSONtoFieldsList(rawJSON: string | Uint8Array | null | undefined): FieldsList {
  const list = new FieldsList();
  if (rawJSON == null) {
    return list;
  }
  const text = typeof rawJSON === "string" ? rawJSON : new TextDecoder().decode(rawJSON);
  if (text.length === 0) {
    return list;
  }
  list.unmarshalJSON(text);
  return list;
}

function parseFieldsJSON(rawJSON: string | Uint8Array): Field[] {
  const text = typeof rawJSON === "string" ? rawJSON : new TextDecoder().decode(rawJSON);

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    try {
      parsed = JSON.parse(`[${text}]`);
    } catch (inner) {
      throw new Error("failed to unmarshal the provided JSON - expects array of objects or just single object", {
        cause: inner ?? error,
      });
    }
  }

  const entries = Array.isArray(parsed) ? parsed : null;
  if (!entries) {
    throw new Error("failed to unmarshal the provided JSON - expects array of objects or just single object");
  }

  return entries.map((item) => fieldFromRaw(item));
}

function fieldFromRaw(raw: unknown): Field {
  if (!raw || typeof raw !== "object") {
    throw new Error("missing or unknown field type");
  }
  const record = raw as Record<string, unknown>;
  const type = record.type;
  if (typeof type !== "string") {
    throw new Error("missing or unknown field type");
  }
  const factory = Fields[type];
  if (!factory) {
    throw new Error(`missing or unknown field type in ${JSON.stringify(raw)}`);
  }
  const field = factory();
  const { type: _type, ...rest } = record;
  const mapped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rest)) {
    mapped[key] = value;
    if (key.length > 0) {
      const upperKey = key[0]?.toUpperCase() + key.slice(1);
      mapped[upperKey] = value;
    }
  }
  Object.assign(field as unknown as Record<string, unknown>, mapped);
  return field;
}

function crc32Checksum(value: string): string {
  let crc = 0xffffffff;
  for (let i = 0; i < value.length; i += 1) {
    crc ^= value.charCodeAt(i);
    for (let j = 0; j < 8; j += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  const result = ~crc >>> 0;
  return String(result);
}
