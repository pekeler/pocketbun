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

  add(ms: number): DateTime {
    if (!this.#date) {
      return this;
    }
    this.#date = new Date(this.#date.getTime() + ms);
    return this;
  }

  // Add returns a new DateTime based on the current DateTime + the specified duration.
  Add(ms: number): DateTime {
    return this.add(ms);
  }

  sub(other: DateTime): number {
    return this.time().getTime() - other.time().getTime();
  }

  addDate(years: number, months: number, days: number): DateTime {
    if (!this.#date) {
      return this;
    }
    const d = new Date(this.#date.getTime());
    d.setUTCFullYear(d.getUTCFullYear() + years);
    d.setUTCMonth(d.getUTCMonth() + months);
    d.setUTCDate(d.getUTCDate() + days);
    this.#date = d;
    return this;
  }

  after(other: DateTime): boolean {
    return this.time().getTime() > other.time().getTime();
  }

  before(other: DateTime): boolean {
    return this.time().getTime() < other.time().getTime();
  }

  compare(other: DateTime): number {
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
    if (!(other instanceof DateTime)) {
      return false;
    }
    return this.time().getTime() === other.time().getTime();
  }

  // Equal reports whether the current DateTime and u represent the same time instant.
  // Two DateTime can be equal even if they are in different locations.
  // For example, 6:00 +0200 and 4:00 UTC are Equal.
  Equal(other: unknown): boolean {
    return this.equal(other);
  }

  unix(): number {
    return Math.floor(this.time().getTime() / 1000);
  }

  isZero(): boolean {
    return !this.#date || Number.isNaN(this.#date.getTime()) || this.#date.getTime() === 0;
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

  toJSON(): string {
    return this.toString();
  }

  valueOf(): string {
    return this.toString();
  }

  scan(value: unknown): void {
    if (value instanceof Date) {
      this.#date = new Date(value.getTime());
      return;
    }
    if (value instanceof DateTime) {
      this.#date = value.isZero() ? null : value.time();
      return;
    }
    if (typeof value === "string") {
      if (value === "") {
        this.#date = null;
        return;
      }
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        this.#date = parsed;
        return;
      }
      const normalized = value.replace(" ", "T");
      const fallback = new Date(normalized);
      this.#date = Number.isNaN(fallback.getTime()) ? null : fallback;
      return;
    }
    if (typeof value === "number") {
      this.#date = new Date(value);
      return;
    }
    if (typeof value === "bigint") {
      this.#date = new Date(Number(value));
      return;
    }
    if (value == null) {
      this.#date = null;
      return;
    }
    const str = toStringValue(value);
    if (!str) {
      this.#date = null;
      return;
    }
    const parsed = new Date(str);
    this.#date = Number.isNaN(parsed.getTime()) ? null : parsed;
  }
}
