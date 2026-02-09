// Ported from pocketbase/core/event_request_test.go.

import { describe, expect, it } from "bun:test";
import { newTestApp } from "../tests/app.ts";
import { CollectionNameSuperusers } from "./collection_model.ts";
import { RequestEvent, RequestEventKeyInfoContext } from "./event_request.ts";
import { NewRecord } from "./record_model.ts";

function buildHeaders(input: Record<string, string[]>): Headers {
  const headers = new Headers();
  for (const [key, values] of Object.entries(input)) {
    for (const value of values) {
      headers.append(key, value);
    }
  }
  return headers;
}

describe("RequestEvent", () => {
  it("realIP", async () => {
    const baseHeaders: Record<string, string[]> = {
      "CF-Connecting-IP": ["1.2.3.4", "1.1.1.1"],
      "Fly-Client-IP": ["1.2.3.4", "1.1.1.2"],
      "X-Real-IP": ["1.2.3.4", "1.1.1.3,1.1.1.4"],
      "X-Forwarded-For": ["1.2.3.4", "invalid,1.1.1.5,1.1.1.6,invalid"],
    };

    const scenarios = [
      {
        name: "no trusted headers",
        headers: baseHeaders,
        trustedHeaders: [] as string[],
        useLeftmostIP: false,
        expected: "127.0.0.1",
      },
      {
        name: "non-matching trusted header",
        headers: baseHeaders,
        trustedHeaders: ["header1", "header2"],
        useLeftmostIP: false,
        expected: "127.0.0.1",
      },
      {
        name: "trusted X-Real-IP (rightmost)",
        headers: baseHeaders,
        trustedHeaders: ["header1", "x-real-ip", "x-forwarded-for"],
        useLeftmostIP: false,
        expected: "1.1.1.4",
      },
      {
        name: "trusted X-Real-IP (leftmost)",
        headers: baseHeaders,
        trustedHeaders: ["header1", "x-real-ip", "x-forwarded-for"],
        useLeftmostIP: true,
        expected: "1.1.1.3",
      },
      {
        name: "trusted X-Forwarded-For (rightmost)",
        headers: baseHeaders,
        trustedHeaders: ["header1", "x-forwarded-for"],
        useLeftmostIP: false,
        expected: "1.1.1.6",
      },
      {
        name: "trusted X-Forwarded-For (leftmost)",
        headers: baseHeaders,
        trustedHeaders: ["header1", "x-forwarded-for"],
        useLeftmostIP: true,
        expected: "1.1.1.5",
      },
    ];

    for (const scenario of scenarios) {
      const { app, cleanup } = await newTestApp();
      try {
        app.settings().trustedProxy.headers = scenario.trustedHeaders;
        app.settings().trustedProxy.useLeftmostIP = scenario.useLeftmostIP;

        const request = new Request("http://example.com/", {
          headers: buildHeaders(scenario.headers),
        });

        const event = new RequestEvent({
          app,
          request,
          remoteAddress: "127.0.0.1:80",
          rawHeaders: scenario.headers,
        });

        const result = event.realIP();
        expect(result, scenario.name).toBe(scenario.expected);
      } finally {
        await cleanup();
      }
    }
  });

  it("hasSuperuserAuth", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const user = app.FindAuthRecordByEmail("users", "test@example.com");
      const superuser = app.FindAuthRecordByEmail(CollectionNameSuperusers, "test@example.com");

      const scenarios = [
        { name: "nil record", record: null, expected: false },
        { name: "regular user record", record: user, expected: false },
        { name: "superuser record", record: superuser, expected: true },
      ];

      for (const scenario of scenarios) {
        const event = new RequestEvent({
          app,
          request: new Request("http://example.com/"),
        });
        event.auth = scenario.record;

        const result = event.hasSuperuserAuth();
        expect(result, scenario.name).toBe(scenario.expected);
      }
    } finally {
      await cleanup();
    }
  });

  it("requestInfo", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const userCol = app.findCollectionByNameOrId("users");
      expect(userCol).toBeTruthy();
      if (!userCol) {
        return;
      }

      const user1 = NewRecord(userCol);
      user1.id = "user1";
      user1.SetEmail("test1@example.com");

      const user2 = NewRecord(userCol);
      user2.id = "user2";
      user2.SetEmail("test2@example.com");

      const testBody = '{"a":123,"b":"test"}';

      const headers = new Headers();
      headers.set("content-type", "application/json");
      headers.set("x-test", "test");

      const request = new Request("http://example.com/test?q1=123&q2=456", {
        method: "POST",
        headers,
        body: testBody,
      });

      const event = new RequestEvent({
        app,
        request,
      });
      event.Set(RequestEventKeyInfoContext, "test");
      event.auth = user1;

      const info = await event.requestInfo();
      const raw = JSON.stringify(info);
      const expected = {
        query: { q1: "123", q2: "456" },
        headers: { content_type: "application/json", x_test: "test" },
        body: { a: 123, b: "test" },
        auth: {
          avatar: "",
          collectionId: "_pb_users_auth_",
          collectionName: "users",
          created: "",
          emailVisibility: false,
          file: [],
          id: "user1",
          name: "",
          rel: "",
          updated: "",
          username: "",
          verified: false,
        },
        method: "POST",
        context: "test",
      };
      expect(JSON.parse(raw)).toEqual(expected);

      event.Set(RequestEventKeyInfoContext, "test2");
      event.auth = user2;

      const info2 = await event.requestInfo();
      const raw2 = JSON.stringify(info2);
      const expected2 = {
        query: { q1: "123", q2: "456" },
        headers: { content_type: "application/json", x_test: "test" },
        body: { a: 123, b: "test" },
        auth: {
          avatar: "",
          collectionId: "_pb_users_auth_",
          collectionName: "users",
          created: "",
          emailVisibility: false,
          file: [],
          id: "user2",
          name: "",
          rel: "",
          updated: "",
          username: "",
          verified: false,
        },
        method: "POST",
        context: "test2",
      };
      expect(JSON.parse(raw2)).toEqual(expected2);
    } finally {
      await cleanup();
    }
  });

  it("setRequestInfo preloads cached request info", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const userCol = app.findCollectionByNameOrId("users");
      expect(userCol).toBeTruthy();
      if (!userCol) {
        return;
      }

      const user = NewRecord(userCol);
      user.id = "user_set_request_info";
      user.SetEmail("set-request-info@example.com");

      const request = new Request("http://example.com/test?q=from-url", {
        method: "POST",
        headers: { "content-type": "multipart/form-data; boundary=test" },
        body: "--test--",
      });

      const event = new RequestEvent({ app, request });
      event.Set(RequestEventKeyInfoContext, "test-context");
      event.auth = user;

      event.setRequestInfo({
        query: { q: "from-fallback" },
        headers: { content_type: "multipart/form-data; boundary=test" },
        body: { title: "fallback-title" },
        auth: null,
        method: "POST",
        context: "fallback-context",
      });

      const info = await event.requestInfo();
      expect(info.query).toEqual({ q: "from-fallback" });
      expect(info.headers).toEqual({ content_type: "multipart/form-data; boundary=test" });
      expect(info.body).toEqual({ title: "fallback-title" });
      expect(info.auth?.Id).toBe("user_set_request_info");
      expect(info.context).toBe("test-context");
    } finally {
      await cleanup();
    }
  });
});
