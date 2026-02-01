// Ported from pocketbase/core/event_request_batch.go

import type { App } from "./app.ts";
import type { RequestEvent } from "./event_request.ts";
import { ErrRequired, ValidationErrors, newError, required } from "../internal/compat/validation.ts";
import { Event } from "../tools/hook/event.ts";

export class BatchRequestEvent extends Event {
  RequestEvent: RequestEvent;
  Batch: InternalRequest[];

  get App(): App {
    return this.RequestEvent.app;
  }

  set App(app: App) {
    this.RequestEvent.app = app;
  }

  constructor(requestEvent: RequestEvent, batch: InternalRequest[]) {
    super();
    this.RequestEvent = requestEvent;
    this.Batch = batch;
    const stopSignal = requestEvent.getStopSignal();
    if (stopSignal) {
      this.setStopSignal(stopSignal);
    }
  }
}

type InternalRequestInit = Partial<InternalRequest> & Record<string, unknown>;

export class InternalRequest {
  // note: for uploading files the value must be either File or File[]
  Body: Record<string, unknown>;
  Headers: Record<string, string>;
  Method: string;
  URL: string;

  constructor(data: InternalRequestInit = {}) {
    this.Body = {};
    this.Headers = {};
    this.Method = "";
    this.URL = "";

    const body = (data.body ?? data.Body) as unknown;
    if (body && typeof body === "object" && !Array.isArray(body)) {
      this.Body = body as Record<string, unknown>;
    }

    const headers = (data.headers ?? data.Headers) as unknown;
    if (headers && typeof headers === "object" && !Array.isArray(headers)) {
      const normalized: Record<string, string> = {};
      for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
        if (typeof value === "string") {
          normalized[key] = value;
        }
      }
      this.Headers = normalized;
    }

    const method = data.method ?? data.Method;
    if (typeof method === "string") {
      this.Method = method;
    }

    const url = data.url ?? data.URL;
    if (typeof url === "string") {
      this.URL = url;
    }
  }

  Validate(): Error | null {
    const errors: Record<string, Error> = {};

    if (required(this.Method)) {
      errors.method = ErrRequired;
    } else if (!isAllowedMethod(this.Method)) {
      errors.method = newError("validation_in_invalid", "Invalid value.");
    }

    if (required(this.URL)) {
      errors.url = ErrRequired;
    } else if (this.URL.length > 2000) {
      errors.url = newError("validation_length_too_long", "The length must be no more than 2000.");
    }

    return Object.keys(errors).length > 0 ? new ValidationErrors(errors) : null;
  }
}

const allowedMethods = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

function isAllowedMethod(method: string): boolean {
  return allowedMethods.has(method);
}
