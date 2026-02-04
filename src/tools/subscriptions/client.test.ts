// Ported from pocketbase/tools/subscriptions/client_test.go

import { describe, it } from "bun:test";
import { DefaultClient } from "./client.ts";
import { Message } from "./message.ts";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class TestMutex {
  lock(): void {}
  unlock(): void {}
}

describe("subscriptions client", () => {
  it("NewDefaultClient", () => {
    const client = new DefaultClient();

    if (!client.Channel()) {
      throw new Error("Expected channel to be initialized");
    }

    if (!client.Subscriptions()) {
      throw new Error("Expected subscriptions map to be initialized");
    }

    if (!client.Id()) {
      throw new Error("Expected unique id to be set");
    }
  });

  it("Id", () => {
    const clients = [new DefaultClient(), new DefaultClient(), new DefaultClient(), new DefaultClient()];
    const seen = new Set<string>();

    clients.forEach((client, index) => {
      const id = client.Id();
      if (seen.has(id)) {
        throw new Error(`(${index}) Expected unique id, got ${id}`);
      }
      seen.add(id);

      if (id.length !== 40) {
        throw new Error(`(${index}) Expected unique id to have 40 chars length, got ${id}`);
      }
    });
  });

  it("Channel", () => {
    const client = new DefaultClient();
    if (!client.Channel()) {
      throw new Error("Expected channel to be initialized");
    }
  });

  it("Subscriptions", () => {
    const client = new DefaultClient();

    if (Object.keys(client.Subscriptions()).length !== 0) {
      throw new Error("Expected subscriptions to be empty");
    }

    client.Subscribe("sub1", "sub11", "sub2");

    const scenarios = [
      { prefixes: [], expected: ["sub1", "sub11", "sub2"] },
      { prefixes: ["missing"], expected: [] },
      { prefixes: ["sub1"], expected: ["sub1", "sub11"] },
      { prefixes: ["sub2"], expected: ["sub2"] },
    ];

    for (const scenario of scenarios) {
      const subs = client.Subscriptions(...scenario.prefixes);
      const keys = Object.keys(subs);
      if (keys.length !== scenario.expected.length) {
        throw new Error(`Expected ${scenario.expected.length} subscriptions, got ${keys.length}`);
      }

      for (const expected of scenario.expected) {
        if (!subs[expected]) {
          throw new Error(`Missing subscription ${expected} in ${JSON.stringify(subs)}`);
        }
      }
    }
  });

  it("Subscribe", () => {
    const client = new DefaultClient();
    client.Subscribe("", "sub1", "sub2", "sub3");

    const subs = client.Subscriptions();
    if (Object.keys(subs).length !== 3) {
      throw new Error(`Expected 3 subscriptions, got ${JSON.stringify(subs)}`);
    }

    ["sub1", "sub2", "sub3"].forEach((sub, index) => {
      if (!client.HasSubscription(sub)) {
        throw new Error(`(${index}) Expected subscription ${sub}`);
      }
    });
  });

  it("SubscribeOptions", () => {
    const client = new DefaultClient();

    const sub1 = "test1";
    const sub2 = 'test2?options={"query":{"name":123},"headers":{"X-Token":456}}';

    client.Subscribe(sub1, sub2);

    const subs = client.Subscriptions();
    const scenarios = [
      { name: sub1, expected: '{"query":{},"headers":{}}' },
      { name: sub2, expected: '{"query":{"name":"123"},"headers":{"x_token":"456"}}' },
    ];

    for (const scenario of scenarios) {
      const options = subs[scenario.name];
      if (!options) {
        throw new Error(`Missing subscription ${scenario.name} in ${JSON.stringify(subs)}`);
      }

      const raw = JSON.stringify(options);
      if (raw !== scenario.expected) {
        throw new Error(`Expected options\n${scenario.expected}\ngot\n${raw}`);
      }
    }
  });

  it("Unsubscribe", () => {
    const client = new DefaultClient();
    client.Subscribe("sub1", "sub2", "sub3");

    client.Unsubscribe("sub1");

    if (client.HasSubscription("sub1")) {
      throw new Error("Expected sub1 to be removed");
    }

    client.Unsubscribe();
    if (Object.keys(client.Subscriptions()).length !== 0) {
      throw new Error(`Expected all subscriptions to be removed, got ${JSON.stringify(client.Subscriptions())}`);
    }
  });

  it("HasSubscription", () => {
    const client = new DefaultClient();

    if (client.HasSubscription("missing")) {
      throw new Error("Expected false, got true");
    }

    client.Subscribe("sub");
    if (!client.HasSubscription("sub")) {
      throw new Error("Expected true, got false");
    }
  });

  it("SetAndGet", () => {
    const client = new DefaultClient();
    client.Set("demo", 1);

    const result = client.Get("demo");
    if (result !== 1) {
      throw new Error(`Expected 1, got ${String(result)}`);
    }
  });

  it("Discard", () => {
    const client = new DefaultClient();
    if (client.IsDiscarded()) {
      throw new Error("Expected false, got true");
    }

    client.Discard();
    if (!client.IsDiscarded()) {
      throw new Error("Expected true, got false");
    }
  });

  it("Send", async () => {
    const mu = new TestMutex();
    const client = new DefaultClient();
    const received: string[] = [];

    const reader = (async () => {
      for await (const msg of client.Channel()) {
        mu.lock();
        try {
          received.push(msg.Name);
        } finally {
          mu.unlock();
        }
      }
    })();

    client.Send(new Message("m1"));
    client.Send(new Message("m2"));
    client.Discard();
    client.Send(new Message("m3"));
    client.Send(new Message("m4"));

    await delay(5);
    await reader;

    const expected = ["m1", "m2"];
    mu.lock();
    try {
      if (received.length !== expected.length) {
        throw new Error(`Expected ${expected.length} messages, got ${received.length}`);
      }
      for (const name of expected) {
        if (!received.includes(name)) {
          throw new Error(`Missing expected ${name} message, got ${JSON.stringify(received)}`);
        }
      }
    } finally {
      mu.unlock();
    }
  });
});
