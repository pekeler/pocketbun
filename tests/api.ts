// Ported from pocketbase/tests/api.go.

import { setTimeout as delay } from "node:timers/promises";
import { buildServeHandler } from "../src/apis/serve.ts";
import { newTestApp, type TestApp } from "./test_app.ts";

type BodyInput = string | Uint8Array | ArrayBuffer | null;

// ApiScenario defines a single api request test case/scenario.
export type ApiScenario = {
  name?: string;
  method: string;
  url: string;
  body?: BodyInput | null;
  headers?: Record<string, string>;
  delayMs?: number;
  timeoutMs?: number;
  disableTestAppCleanup?: boolean;
  expectedStatus: number;
  expectedContent?: string[];
  notExpectedContent?: string[];
  expectedEvents?: Record<string, number>;
  testAppFactory?: () => Promise<{ app: TestApp; cleanup: () => Promise<void> }>;
  beforeTest?: (app: TestApp) => void | Promise<void>;
  afterTest?: (app: TestApp, res: Response) => void | Promise<void>;
};

export async function runApiScenario(scenario: ApiScenario): Promise<void> {
  const factory = scenario.testAppFactory ?? newTestApp;
  const { app, cleanup } = await factory();

  try {
    if (scenario.beforeTest) {
      await scenario.beforeTest(app);
    }

    app.resetEventCalls();

    const handler = buildServeHandler(app);
    const headers = new Headers();
    headers.set("content-type", "application/json");
    if (scenario.headers) {
      for (const [key, value] of Object.entries(scenario.headers)) {
        headers.set(key, value);
      }
    }

    const controller = scenario.timeoutMs && scenario.timeoutMs > 0 ? new AbortController() : null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    if (controller && scenario.timeoutMs) {
      timeoutHandle = setTimeout(() => controller.abort(), scenario.timeoutMs);
    }

    const method = scenario.method.toUpperCase();
    const init: RequestInit = { method, headers, signal: controller?.signal };
    if (scenario.body != null && method !== "GET" && method !== "HEAD") {
      init.body = scenario.body;
    }

    const requestUrl = new URL(scenario.url, "http://localhost").toString();
    const response = await handler(new Request(requestUrl, init));

    if (response.status !== scenario.expectedStatus) {
      throw new Error(`Expected status ${scenario.expectedStatus}, got ${response.status}`);
    }

    if (scenario.delayMs && scenario.delayMs > 0) {
      await delay(scenario.delayMs);
    }

    let bodyText = "";
    try {
      bodyText = await response.text();
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
    const expectedContent = scenario.expectedContent ?? [];
    const notExpectedContent = scenario.notExpectedContent ?? [];

    if (expectedContent.length === 0 && notExpectedContent.length === 0) {
      if (bodyText.length !== 0) {
        throw new Error(`Expected empty body, got ${bodyText}`);
      }
    } else {
      const normalizedBody = normalizeBody(bodyText);

      for (const item of expectedContent) {
        if (!normalizedBody.includes(item)) {
          throw new Error(`Cannot find ${item} in response body ${normalizedBody}`);
        }
      }

      for (const item of notExpectedContent) {
        if (normalizedBody.includes(item)) {
          throw new Error(`Did not expect ${item} in response body ${normalizedBody}`);
        }
      }
    }

    const expectedEvents = scenario.expectedEvents ?? {};
    const remainingEvents: Record<string, number> = { ...app.eventCalls };

    let noOtherEvents = false;
    for (const [eventName, expectedCount] of Object.entries(expectedEvents)) {
      if (eventName === "*" && expectedCount <= 0) {
        noOtherEvents = true;
        continue;
      }

      const actualCount = remainingEvents[eventName] ?? 0;
      if (actualCount !== expectedCount) {
        throw new Error(`Expected event ${eventName} to be called ${expectedCount}, got ${actualCount}`);
      }

      delete remainingEvents[eventName];
    }

    if (noOtherEvents && Object.keys(remainingEvents).length > 0) {
      throw new Error(`Missing expected remaining events: ${JSON.stringify(remainingEvents)}`);
    }

    if (scenario.afterTest) {
      await scenario.afterTest(app, response);
    }
  } finally {
    if (!scenario.disableTestAppCleanup) {
      await cleanup();
    }
  }
}

function normalizeBody(body: string): string {
  if (body.trim() === "") {
    return body;
  }

  try {
    return JSON.stringify(JSON.parse(body));
  } catch {
    return body;
  }
}
