// Ported from pocketbase/tools/types/datetime.go

import { toStringValue } from "../../internal/compat/cast.ts";

// DefaultDateLayout specifies the default app date strings layout.
export const DefaultDateLayout = "2006-01-02 15:04:05.000Z";

export function nowDateTime(): DateTime {
  return new DateTime(new Date());
}

// NowDateTime returns new DateTime instance with the current local time.
export function NowDateTime(): DateTime {
  return nowDateTime();
}

export function parseDateTime(value: unknown): DateTime {
  const dt = new DateTime();
  dt.scan(value);
  return dt;
}

// ParseDateTime creates a new DateTime from the provided value
// (could be [cast.ToTime] supported string, [time.Time], etc.).
export function ParseDateTime(value: unknown): DateTime {
  return parseDateTime(value);
}

function parseDateString(raw: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  if (/^-?\d+$/.test(trimmed)) {
    const seconds = Number(trimmed);
    if (Number.isFinite(seconds)) {
      return new Date(seconds * 1000);
    }
  }

  let normalized = trimmed;
  const hasTimezone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(normalized);
  if (/^\d{4}-\d{2}-\d{2} /.test(normalized)) {
    normalized = normalized.replace(" ", "T");
  }
  if (!hasTimezone && /^\d{4}-\d{2}-\d{2}T/.test(normalized)) {
    normalized = `${normalized}Z`;
  }

  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  const fallback = new Date(trimmed);
  if (!Number.isNaN(fallback.getTime())) {
    return fallback;
  }

  return null;
}

// DateTime represents a [time.Time] instance in UTC that is wrapped
// and serialized using the app default date layout.
export class DateTime {
  #date: Date | null;

  constructor(date: Date | null = null) {
    this.#date = date && !Number.isNaN(date.getTime()) ? new Date(date.getTime()) : null;
  }

  time(): Date {
    return this.#date ? new Date(this.#date.getTime()) : new Date(0);
  }

  Time(): Date {
    return this.time();
  }

  add(ms: number): DateTime {
    return this.Add(ms);
  }

  // Add returns a new DateTime based on the current DateTime + the specified duration.
  Add(ms: number): DateTime {
    if (!this.#date) {
      return new DateTime(null);
    }
    return new DateTime(new Date(this.#date.getTime() + ms));
  }

  sub(other: DateTime): number {
    return this.Sub(other);
  }

  // Sub returns the milliseconds diff by subtracting the specified DateTime from the current one.
  Sub(other: DateTime): number {
    return this.time().getTime() - other.time().getTime();
  }

  addDate(years: number, months: number, days: number): DateTime {
    return this.AddDate(years, months, days);
  }

  AddDate(years: number, months: number, days: number): DateTime {
    if (!this.#date) {
      return new DateTime(null);
    }
    const d = new Date(this.#date.getTime());
    d.setUTCFullYear(d.getUTCFullYear() + years);
    d.setUTCMonth(d.getUTCMonth() + months);
    d.setUTCDate(d.getUTCDate() + days);
    return new DateTime(d);
  }

  after(other: DateTime): boolean {
    return this.After(other);
  }

  // After reports whether the current DateTime instance is after u.
  After(other: DateTime): boolean {
    return this.time().getTime() > other.time().getTime();
  }

  before(other: DateTime): boolean {
    return this.Before(other);
  }

  // Before reports whether the current DateTime instance is before u.
  Before(other: DateTime): boolean {
    return this.time().getTime() < other.time().getTime();
  }

  compare(other: DateTime): number {
    return this.Compare(other);
  }

  // Compare compares the current DateTime instance with u.
  // If the current instance is before u, it returns -1.
  // If the current instance is after u, it returns +1.
  // If they're the same, it returns 0.
  Compare(other: DateTime): number {
    const diff = this.time().getTime() - other.time().getTime();
    if (diff < 0) {
      return -1;
    }
    if (diff > 0) {
      return 1;
    }
    return 0;
  }

  equal(other: unknown): boolean {
    return this.Equal(other);
  }

  // Equal reports whether the current DateTime and u represent the same time instant.
  // Two DateTime can be equal even if they are in different locations.
  // For example, 6:00 +0200 and 4:00 UTC are Equal.
  Equal(other: unknown): boolean {
    if (!(other instanceof DateTime)) {
      return false;
    }
    return this.time().getTime() === other.time().getTime();
  }

  unix(): number {
    return this.Unix();
  }

  // Unix returns the current DateTime as a Unix time, aka.
  // the number of seconds elapsed since January 1, 1970 UTC.
  Unix(): number {
    if (this.isZero()) {
      return -62135596800;
    }
    return Math.floor(this.time().getTime() / 1000);
  }

  isZero(): boolean {
    return !this.#date || Number.isNaN(this.#date.getTime());
  }

  // IsZero checks whether the current DateTime instance has zero time value.
  IsZero(): boolean {
    return this.isZero();
  }

  toString(): string {
    if (this.isZero()) {
      return "";
    }
    const iso = this.time().toISOString();
    return iso.replace("T", " ");
  }

  // string is a lowercase alias for String to match JS hook bindings.
  string(): string {
    return this.toString();
  }

  // String serializes the current DateTime instance into a formatted
  // UTC date string.
  //
  // The zero value is serialized to an empty string.
  String(): string {
    return this.toString();
  }

  MarshalJSON(): string {
    return JSON.stringify(this.String());
  }

  UnmarshalJSON(raw: Uint8Array | string | null | undefined): Error | null {
    try {
      if (raw == null) {
        this.#date = null;
        return null;
      }
      const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
      const parsed = JSON.parse(text);
      if (typeof parsed !== "string") {
        this.#date = null;
        return null;
      }
      return this.Scan(parsed);
    } catch (error) {
      this.#date = null;
      return error as Error;
    }
  }

  Value(): string {
    return this.String();
  }

  toJSON(): string {
    return this.toString();
  }

  valueOf(): string {
    return this.toString();
  }

  Scan(value: unknown): Error | null {
    if (value instanceof Date) {
      this.#date = new Date(value.getTime());
      return null;
    }
    if (value instanceof DateTime) {
      this.#date = value.isZero() ? null : value.time();
      return null;
    }
    if (typeof value === "string") {
      this.#date = parseDateString(value);
      return null;
    }
    if (typeof value === "number") {
      const parsed = parseDateString(String(value));
      this.#date = parsed;
      return null;
    }
    if (typeof value === "bigint") {
      this.#date = new Date(Number(value) * 1000);
      return null;
    }
    if (value == null) {
      this.#date = null;
      return null;
    }
    const str = toStringValue(value);
    this.#date = str ? parseDateString(str) : null;
    return null;
  }

  scan(value: unknown): void {
    void this.Scan(value);
  }
}
