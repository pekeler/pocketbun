// Ported from pocketbase/apis/record_auth_with_oauth2_redirect_test.go

import { describe, it } from "bun:test";
import { setTimeout as delay } from "node:timers/promises";
import type { TestApp } from "../../tests/test_app.ts";
import type { Client } from "../tools/subscriptions/client.ts";
import type { Message } from "../tools/subscriptions/message.ts";
import { runApiScenario, type ApiScenario } from "../../tests/api.ts";
import { DefaultClient } from "../tools/subscriptions/client.ts";

type ClientStubs = {
  c1: Client;
  c2: Client;
  c3: Client;
  c4: Client;
  c5: Client;
};
type ExpectedMessages = Record<string, string[]>;

const oauth2Topic = "@oauth2";

const clientStubs: ClientStubs[] = [];

for (let i = 0; i < 10; i += 1) {
  const c1 = new DefaultClient();

  const c2 = new DefaultClient();
  c2.Subscribe(oauth2Topic);

  const c3 = new DefaultClient();
  c3.Subscribe("test1", oauth2Topic);

  const c4 = new DefaultClient();
  c4.Subscribe("test1", "test2");

  const c5 = new DefaultClient();
  c5.Subscribe(oauth2Topic);
  c5.Discard();

  clientStubs.push({
    c1,
    c2,
    c3,
    c4,
    c5,
  });
}

const mustStub = (index: number): ClientStubs => {
  const item = clientStubs[index];
  if (!item) {
    throw new Error(`Missing client stub ${index}`);
  }
  return item;
};

const stub0 = mustStub(0);
const stub1 = mustStub(1);
const stub2 = mustStub(2);
const stub3 = mustStub(3);
const stub4 = mustStub(4);
const stub5 = mustStub(5);
const stub6 = mustStub(6);
const stub7 = mustStub(7);
const stub8 = mustStub(8);
const stub9 = mustStub(9);

const checkFailureRedirect = (res: Response) => {
  const location = res.headers.get("Location") ?? "";
  if (!location.includes("/oauth2-redirect-failure")) {
    throw new Error(`Expected failure redirect, got ${JSON.stringify(location)}`);
  }
};

const checkSuccessRedirect = (res: Response) => {
  const location = res.headers.get("Location") ?? "";
  if (!location.includes("/oauth2-redirect-success")) {
    throw new Error(`Expected success redirect, got ${JSON.stringify(location)}`);
  }
};

const checkClientMessages = (clientId: string, msg: Message, expectedMessages: ExpectedMessages, errors: string[]) => {
  const expected = expectedMessages[clientId] ?? [];
  if (expected.length === 0) {
    errors.push(`Unexpected client ${JSON.stringify(clientId)} message: ${msg.Name}`);
    return;
  }

  if (msg.Name !== oauth2Topic) {
    errors.push(`Expected ${oauth2Topic} msg.Name, got ${JSON.stringify(msg.Name)}`);
    return;
  }

  const text = new TextDecoder().decode(msg.Data);
  for (const snippet of expected) {
    if (!text.includes(snippet)) {
      errors.push(`Failed to find ${JSON.stringify(snippet)} in ${text}`);
      return;
    }
  }
};

const watchClients = async (clients: ClientStubs, expectedMessages: ExpectedMessages, errors: string[], stop: () => void) => {
  const watchers = Object.entries(clients).map(async ([clientId, client]) => {
    for await (const msg of client.Channel()) {
      checkClientMessages(clientId, msg, expectedMessages, errors);
    }
  });

  await delay(100);
  stop();
  await Promise.all(watchers);
};

const beforeTestFunc = (clients: ClientStubs, expectedMessages: ExpectedMessages) => async (app: TestApp) => {
  for (const client of Object.values(clients)) {
    app.SubscriptionsBroker().Register(client);
  }

  const errors: string[] = [];
  const stop = () => {
    for (const client of Object.values(clients)) {
      client.Discard();
    }
  };

  const watcher = watchClients(clients, expectedMessages, errors, stop);

  app.store().set("oauth2RedirectErrors", errors);
  app.store().set("oauth2RedirectWatcher", watcher);
  app.store().set("oauth2RedirectStop", stop);
};

const afterTestFunc = async (app: TestApp) => {
  const stop = app.store().get("oauth2RedirectStop") as (() => void) | undefined;
  if (stop) {
    stop();
  }

  const watcher = app.store().get("oauth2RedirectWatcher") as Promise<void> | undefined;
  if (watcher) {
    await watcher;
  }

  const errors = app.store().get("oauth2RedirectErrors") as string[] | undefined;
  if (errors && errors.length > 0) {
    throw new Error(errors.join("\n"));
  }
};

const scenarios: ApiScenario[] = [
  {
    name: "no state query param",
    method: "GET",
    url: "/api/oauth2-redirect?code=123",
    beforeTest: beforeTestFunc(stub0, {}),
    expectedStatus: 307,
    expectedEvents: { "*": 0 },
    afterTest: async (app, res) => {
      await afterTestFunc(app);
      checkFailureRedirect(res);
    },
  },
  {
    name: "invalid or missing client",
    method: "GET",
    url: "/api/oauth2-redirect?code=123&state=missing",
    beforeTest: beforeTestFunc(stub1, {}),
    expectedStatus: 307,
    expectedEvents: { "*": 0 },
    afterTest: async (app, res) => {
      await afterTestFunc(app);
      checkFailureRedirect(res);
    },
  },
  {
    name: "no code query param",
    method: "GET",
    url: `/api/oauth2-redirect?state=${stub2.c3.Id()}`,
    beforeTest: beforeTestFunc(stub2, {
      c3: [`"state":"${stub2.c3.Id()}"`, `"code":""`],
    }),
    expectedStatus: 307,
    expectedEvents: { "*": 0 },
    afterTest: async (app, res) => {
      await afterTestFunc(app);
      checkFailureRedirect(res);
      if (stub2.c3.HasSubscription(oauth2Topic)) {
        throw new Error("Expected oauth2 subscription to be removed");
      }
    },
  },
  {
    name: "error query param",
    method: "GET",
    url: `/api/oauth2-redirect?error=example&code=123&state=${stub3.c3.Id()}`,
    beforeTest: beforeTestFunc(stub3, {
      c3: [`"state":"${stub3.c3.Id()}"`, `"code":"123"`, `"error":"example"`],
    }),
    expectedStatus: 307,
    expectedEvents: { "*": 0 },
    afterTest: async (app, res) => {
      await afterTestFunc(app);
      checkFailureRedirect(res);
      if (stub3.c3.HasSubscription(oauth2Topic)) {
        throw new Error("Expected oauth2 subscription to be removed");
      }
    },
  },
  {
    name: "discarded client with @oauth2 subscription",
    method: "GET",
    url: `/api/oauth2-redirect?code=123&state=${stub4.c5.Id()}`,
    beforeTest: beforeTestFunc(stub4, {}),
    expectedStatus: 307,
    expectedEvents: { "*": 0 },
    afterTest: async (app, res) => {
      await afterTestFunc(app);
      checkFailureRedirect(res);
    },
  },
  {
    name: "client without @oauth2 subscription",
    method: "GET",
    url: `/api/oauth2-redirect?code=123&state=${stub4.c4.Id()}`,
    beforeTest: beforeTestFunc(stub5, {}),
    expectedStatus: 307,
    expectedEvents: { "*": 0 },
    afterTest: async (app, res) => {
      await afterTestFunc(app);
      checkFailureRedirect(res);
    },
  },
  {
    name: "client with @oauth2 subscription",
    method: "GET",
    url: `/api/oauth2-redirect?code=123&state=${stub6.c3.Id()}`,
    beforeTest: beforeTestFunc(stub6, {
      c3: [`"state":"${stub6.c3.Id()}"`, `"code":"123"`],
    }),
    expectedStatus: 307,
    expectedEvents: { "*": 0 },
    afterTest: async (app, res) => {
      await afterTestFunc(app);
      checkSuccessRedirect(res);
      if (stub6.c3.HasSubscription(oauth2Topic)) {
        throw new Error("Expected oauth2 subscription to be removed");
      }
    },
  },
  {
    name: "client with @oauth2 subscription (POST form)",
    method: "POST",
    url: "/api/oauth2-redirect",
    body: new URLSearchParams({
      code: "123",
      state: stub7.c3.Id(),
    }).toString(),
    headers: { "content-type": "application/x-www-form-urlencoded" },
    beforeTest: beforeTestFunc(stub7, {
      c3: [`"state":"${stub7.c3.Id()}"`, `"code":"123"`],
    }),
    expectedStatus: 303,
    expectedEvents: { "*": 0 },
    afterTest: async (app, res) => {
      await afterTestFunc(app);
      checkSuccessRedirect(res);
      if (stub7.c3.HasSubscription(oauth2Topic)) {
        throw new Error("Expected oauth2 subscription to be removed");
      }
    },
  },
  {
    name: "apple user's name json (nameKey error)",
    method: "POST",
    url: "/api/oauth2-redirect",
    body: new URLSearchParams({
      code: "a".repeat(986),
      state: stub8.c3.Id(),
      user: JSON.stringify({
        name: {
          firstName: "aaa",
          lastName: "b".repeat(200),
        },
      }),
    }).toString(),
    headers: { "content-type": "application/x-www-form-urlencoded" },
    beforeTest: beforeTestFunc(stub8, {
      c3: [`"state":"${stub8.c3.Id()}"`, `"code":"${"a".repeat(986)}"`],
    }),
    expectedStatus: 303,
    expectedEvents: { "*": 0 },
    afterTest: async (app, res) => {
      await afterTestFunc(app);
      checkSuccessRedirect(res);
      if (stub8.c3.HasSubscription(oauth2Topic)) {
        throw new Error("Expected oauth2 subscription to be removed");
      }
      const storedName = app.store().get(`@redirect_name_${"a".repeat(986)}`);
      if (storedName != null) {
        throw new Error(`Didn't expect stored name, got ${JSON.stringify(storedName)}`);
      }
    },
  },
  {
    name: "apple user's name json",
    method: "POST",
    url: "/api/oauth2-redirect",
    body: new URLSearchParams({
      code: "a".repeat(985),
      state: stub9.c3.Id(),
      user: JSON.stringify({
        name: {
          firstName: "aaa",
          lastName: "b".repeat(200),
        },
      }),
    }).toString(),
    headers: { "content-type": "application/x-www-form-urlencoded" },
    beforeTest: beforeTestFunc(stub9, {
      c3: [`"state":"${stub9.c3.Id()}"`, `"code":"${"a".repeat(985)}"`],
    }),
    expectedStatus: 303,
    expectedEvents: { "*": 0 },
    afterTest: async (app, res) => {
      await afterTestFunc(app);
      checkSuccessRedirect(res);
      if (stub9.c3.HasSubscription(oauth2Topic)) {
        throw new Error("Expected oauth2 subscription to be removed");
      }
      const storedName = app.store().get(`@redirect_name_${"a".repeat(985)}`);
      const expectedName = `aaa ${"b".repeat(146)}`;
      if (storedName !== expectedName) {
        throw new Error(`Expected stored name ${JSON.stringify(expectedName)} got ${JSON.stringify(storedName)}`);
      }
    },
  },
];

describe("record auth with oauth2 redirect", () => {
  it("scenarios", async () => {
    for (const scenario of scenarios) {
      await runApiScenario(scenario);
    }
  });
});
