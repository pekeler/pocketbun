// Ported from pocketbase/tools/subscriptions/broker.go

import type { Client } from "./client.ts";
import { toChunks } from "../list/list.ts";
import { Store } from "../store/store.ts";

// Broker defines a struct for managing subscriptions clients.
export class Broker {
  #store: Store<string, Client>;

  constructor() {
    this.#store = new Store<string, Client>();
  }

  // Clients returns a shallow copy of all registered clients indexed
  // with their connection id.
  Clients(): Record<string, Client> {
    return Object.fromEntries(this.#store.getAll());
  }

  // ChunkedClients splits the current clients into a chunked slice.
  ChunkedClients(chunkSize: number): Client[][] {
    return toChunks(this.#store.values(), chunkSize);
  }

  // TotalClients returns the total number of registered clients.
  TotalClients(): number {
    return this.#store.length();
  }

  // ClientById finds a registered client by its id.
  //
  // Returns non-nil error when client with clientId is not registered.
  ClientById(clientId: string): Client {
    const [client, ok] = this.#store.getOk(clientId);
    if (!ok || !client) {
      throw new Error(`no client associated with connection ID ${JSON.stringify(clientId)}`);
    }
    return client;
  }

  // Register adds a new client to the broker instance.
  Register(client: Client): void {
    this.#store.set(client.Id(), client);
  }

  // Unregister removes a single client by its id and marks it as discarded.
  //
  // If client with clientId doesn't exist, this method does nothing.
  Unregister(clientId: string): void {
    const client = this.#store.get(clientId);
    if (!client) {
      return;
    }
    client.Discard();
    this.#store.remove(clientId);
  }
}
