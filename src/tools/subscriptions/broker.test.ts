// Ported from pocketbase/tools/subscriptions/broker_test.go

import { describe, it } from "bun:test";
import { Broker } from "./broker.ts";
import { DefaultClient } from "./client.ts";

describe("subscriptions broker", () => {
  it("NewBroker", () => {
    const broker = new Broker();
    if (!broker.Clients()) {
      throw new Error("Expected clients map to be initialized");
    }
  });

  it("Clients", () => {
    const broker = new Broker();
    if (Object.keys(broker.Clients()).length !== 0) {
      throw new Error("Expected no clients");
    }

    broker.Register(new DefaultClient());
    broker.Register(new DefaultClient());

    const clients = broker.Clients();
    for (const key of Object.keys(clients)) {
      delete clients[key];
    }

    if (Object.keys(broker.Clients()).length !== 2) {
      throw new Error("Expected 2 clients");
    }
  });

  it("ChunkedClients", () => {
    const broker = new Broker();
    const chunksEmpty = broker.ChunkedClients(2);
    if (chunksEmpty.length !== 0) {
      throw new Error(`Expected 0 chunks, got ${chunksEmpty.length}`);
    }

    broker.Register(new DefaultClient());
    broker.Register(new DefaultClient());
    broker.Register(new DefaultClient());

    const chunks = broker.ChunkedClients(2);
    if (chunks.length !== 2) {
      throw new Error(`Expected 2 chunks, got ${chunks.length}`);
    }
    if (chunks[0]?.length !== 2) {
      throw new Error(`Expected the first chunk to have 2 clients, got ${chunks[0]?.length ?? 0}`);
    }
    if (chunks[1]?.length !== 1) {
      throw new Error(`Expected the second chunk to have 1 client, got ${chunks[1]?.length ?? 0}`);
    }
  });

  it("TotalClients", () => {
    const broker = new Broker();
    if (broker.TotalClients() !== 0) {
      throw new Error("Expected no clients");
    }

    broker.Register(new DefaultClient());
    broker.Register(new DefaultClient());

    if (broker.TotalClients() !== 2) {
      throw new Error("Expected 2 clients");
    }
  });

  it("ClientById", () => {
    const broker = new Broker();
    const clientA = new DefaultClient();
    const clientB = new DefaultClient();
    broker.Register(clientA);
    broker.Register(clientB);

    const result = broker.ClientById(clientA.Id());
    if (result.Id() !== clientA.Id()) {
      throw new Error(`Expected client ${clientA.Id()}, got ${result.Id()}`);
    }

    let threw = false;
    try {
      broker.ClientById("missing");
    } catch {
      threw = true;
    }
    if (!threw) {
      throw new Error("Expected error for missing client");
    }
  });

  it("Register", () => {
    const broker = new Broker();
    const client = new DefaultClient();
    broker.Register(client);

    const result = broker.ClientById(client.Id());
    if (result.Id() !== client.Id()) {
      throw new Error(`Expected client ${client.Id()}, got ${result.Id()}`);
    }
  });

  it("Unregister", () => {
    const broker = new Broker();
    const clientA = new DefaultClient();
    const clientB = new DefaultClient();
    broker.Register(clientA);
    broker.Register(clientB);

    broker.ClientById(clientA.Id());
    broker.Unregister(clientA.Id());

    let threw = false;
    try {
      broker.ClientById(clientA.Id());
    } catch {
      threw = true;
    }
    if (!threw) {
      throw new Error("Expected clientA to be removed");
    }

    const still = broker.ClientById(clientB.Id());
    if (still.Id() !== clientB.Id()) {
      throw new Error(`Expected client ${clientB.Id()}, got ${still.Id()}`);
    }
  });
});
