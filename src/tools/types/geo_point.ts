// Ported from pocketbase/tools/types/geo_point.go

import { JSONRaw } from "./json_raw.ts";

// GeoPoint defines a struct for storing geo coordinates as serialized json object
// (e.g. {lon:0,lat:0}).
//
// Note: using object notation and not a plain array to avoid the confusion
// as there doesn't seem to be a fixed standard for the coordinates order.
export class GeoPoint {
  Lon: number;
  Lat: number;

  constructor(lon = 0, lat = 0) {
    this.Lon = lon;
    this.Lat = lat;
  }

  // String returns the string representation of the current GeoPoint instance.
  String(): string {
    return JSON.stringify(this.toJSON());
  }

  toString(): string {
    return this.String();
  }

  // AsMap implements [core.mapExtractor] and returns a value suitable
  // to be used in an API rule expression.
  AsMap(): Record<string, number> {
    return {
      lon: this.Lon,
      lat: this.Lat,
    };
  }

  // Value implements the [driver.Valuer] interface.
  Value(): string {
    return this.String();
  }

  toJSON(): { lon: number; lat: number } {
    return {
      lon: this.Lon,
      lat: this.Lat,
    };
  }

  // Scan implements [sql.Scanner] interface to scan the provided value
  // into the current GeoPoint instance.
  //
  // The value argument could be nil (no-op), another GeoPoint instance,
  // map or serialized json object with lat-lon props.
  Scan(value: unknown): Error | null {
    try {
      if (value == null) {
        return null;
      }

      if (value instanceof GeoPoint) {
        this.Lon = value.Lon;
        this.Lat = value.Lat;
        return null;
      }

      if (value instanceof JSONRaw) {
        const raw = value.toString();
        if (!raw || raw === "null") {
          return null;
        }
        return this.scanFromJSON(raw);
      }

      if (typeof value === "string") {
        if (!value) {
          return null;
        }
        return this.scanFromJSON(value);
      }

      if (value instanceof Uint8Array) {
        if (value.length === 0) {
          return null;
        }
        const raw = new TextDecoder().decode(value);
        return this.scanFromJSON(raw);
      }

      if (typeof value === "object") {
        return this.scanFromObject(value);
      }

      return this.scanFromJSON(JSON.stringify(value));
    } catch (error) {
      return new Error(`[GeoPoint] unable to scan value ${String(value)}: ${(error as Error).message}`);
    }
  }

  private scanFromJSON(raw: string): Error | null {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return new Error(`[GeoPoint] unable to scan value ${raw}: ${(error as Error).message}`);
    }

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return this.scanFromObject(parsed);
    }

    return new Error("[GeoPoint] unable to scan value: invalid json payload");
  }

  private scanFromObject(value: unknown): Error | null {
    const obj = value as Record<string, unknown>;
    const hasLon = Object.prototype.hasOwnProperty.call(obj, "lon");
    const hasLat = Object.prototype.hasOwnProperty.call(obj, "lat");

    if (!hasLon && !hasLat) {
      return null;
    }

    const lon = hasLon ? obj.lon : this.Lon;
    const lat = hasLat ? obj.lat : this.Lat;

    if (hasLon && typeof lon !== "number") {
      return new Error("[GeoPoint] unable to scan value: invalid lon type");
    }
    if (hasLat && typeof lat !== "number") {
      return new Error("[GeoPoint] unable to scan value: invalid lat type");
    }

    this.Lon = typeof lon === "number" ? lon : this.Lon;
    this.Lat = typeof lat === "number" ? lat : this.Lat;
    return null;
  }
}
