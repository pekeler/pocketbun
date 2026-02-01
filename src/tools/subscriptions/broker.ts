// Ported from pocketbase/tools/subscriptions/broker.go

import type { Client } from "./client.ts";
import { toChunks } from "../list/list.ts";
import { Store } from "../store/store.ts";

export class Broker {
  #store: Store<string, Client>;

  constructor() {
    this.#store = new Store<string, Client>();
  }

  Clients(): Record<string, Client> {
    return Object.fromEntries(this.#store.getAll());
  }

  ChunkedClients(chunkSize: number): Client[][] {
    return toChunks(this.#store.values(), chunkSize);
  }

  TotalClients(): number {
    return this.#store.length();
  }

  ClientById(clientId: string): Client {
    const [client, ok] = this.#store.getOk(clientId);
    if (!ok || !client) {
      throw new Error(`no client associated with connection ID ${JSON.stringify(clientId)}`);
    }
    return client;
  }

  Register(client: Client): void {
    this.#store.set(client.Id(), client);
  }

  Unregister(clientId: string): void {
    const client = this.#store.get(clientId);
    if (!client) {
      return;
    }
    client.Discard();
    this.#store.remove(clientId);
  }
}
