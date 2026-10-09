// Ported from pocketbase/apis/middlewares_cors_test.go.
// Additional middleware cases pin the regex fallback used after exact matching.

import { expect, it } from "bun:test";
import { BaseApp } from "../core/base.ts";
import { RequestEvent } from "../core/event_request.ts";
import { CORS, exactWildcardMatch } from "./middlewares_cors.ts";

const scenarios: [string, string, boolean][] = [
  ["", "", false],
  ["http://example.com", "", false],
  ["", "http://example.com", false],
  ["http://example.com", "https://example.com", false],
  ["abc://example.com", "abc://example.com", true],
  ["https://example.com", "https://example.com", true],
  ["https://a.example.com", "https://example.com", false],
  ["https://example.com", "https://a.example.com", false],
  ["https://example.com", "https://*.example.com", false],
  ["https://a.example.com", "https://*.example.com", true],
  ["https://a.example.com", "https://a.*.example.com", false],
  ["https://a.b.example.com", "https://a.*.example.com", true],
  ["https://a.b.example.com", "https://a2.*.example.com", false],
  ["https://a.b.example.com", "https://a.*", false],
  ["https://a.b.example", "https://a.*", false],
  ["https://a.b", "https://a.*", true],
];

it.each(scenarios)("exactWildcardMatch(%s, %s) = %s", (domain, pattern, expected) => {
  expect(exactWildcardMatch(domain, pattern)).toBe(expected);
});

it.each([
  ["https://a.b.example.com", "https://a2.*.example.com", false],
  ["https://a.b.example.com", "https://a.*.example.com", true],
  ["https://a.b.example.com", "https://*.example.com", true],
  ["https://ab.example.com", "https://a?.example.com", true],
  ["https://abc.example.com", "https://a?.example.com", false],
  ["https://example.com", "https://*.example.com", false],
] as [string, string, boolean][])("CORS origin %s with pattern %s", async (origin, pattern, allowed) => {
  const event = new RequestEvent({
    app: new BaseApp(),
    request: new Request("http://localhost/api/health", { headers: { Origin: origin } }),
  });
  await CORS({ AllowOrigins: [pattern] }).Func(event);
  expect(event.responseHeaders.get("Access-Control-Allow-Origin")).toBe(allowed ? origin : null);
});
