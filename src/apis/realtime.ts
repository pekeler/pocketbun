// Ported from pocketbase/apis/realtime.go

import type { SQLQueryBindings } from "bun:sqlite";
import type { App } from "../core/app.ts";
import type { Collection } from "../core/collection_model.ts";
import type { Model } from "../core/db_model.ts";
import type { RequestInfo } from "../core/event_request.ts";
import type { RecordProxy } from "../core/record_proxy.ts";
import type { RouterGroup } from "../tools/router/group.ts";
import type { Client } from "../tools/subscriptions/client.ts";
import type { MessageWriter } from "../tools/subscriptions/message.ts";
import { CollectionTypeAuth } from "../core/collection_model.ts";
import { RequestEvent, RequestInfoContextRealtime } from "../core/event_request.ts";
import { RealtimeConnectRequestEvent, RealtimeMessageEvent, RealtimeSubscribeRequestEvent } from "../core/events.ts";
import { LogsTableName } from "../core/log_model.ts";
import { RecordFieldResolver } from "../core/record_field_resolver.ts";
import { Record as RecordModel } from "../core/record_model.ts";
import {
  clusterEnabled,
  registerClusterRealtimeEventHandler,
  registerClusterRealtimePrepareHandler,
  registerClusterRealtimeSubscribeHandler,
  type ClusterRealtimeEvent,
} from "../internal/cluster/context.ts";
import { ValidationErrors, newError, required } from "../internal/compat/validation.ts";
import { Pick } from "../tools/picker/pick.ts";
import { FireAndForget } from "../tools/routine/routine.ts";
import { buildFilterExpr } from "../tools/search/filter.ts";
import { DefaultFilterExprLimit, FilterQueryParam } from "../tools/search/types.ts";
import { DefaultClient } from "../tools/subscriptions/client.ts";
import { Message } from "../tools/subscriptions/message.ts";
import { badRequest, forbidden, noContent, notFound } from "./api_errors.ts";
import { SkipSuccessActivityLog } from "./middlewares.ts";
import {
  checkForSuperuserOnlyRuleFields,
  execAfterSuccessTx,
  expandFetch,
  triggerRecordEnrichHooks,
} from "./record_helpers.ts";

// note: the chunk size is arbitrary chosen and may change in the future
const clientsChunkSize = 150;
// PocketBun deviation: Bun servers enforce a socket idle timeout (max 255s),
// so we emit SSE comment keepalives to keep long-lived realtime streams open.
const realtimeSSEKeepaliveIntervalMs = 25 * 1000;

// RealtimeClientAuthKey is the name of the realtime client store key that holds its auth state.
export const RealtimeClientAuthKey = "auth";

// RealtimeClientIPKey is the name of the realtime client store key that holds the IP of the connected client.
export const RealtimeClientIPKey = "pbRealtimeClientIP";

const expandQueryParam = "expand";
const fieldsQueryParam = "fields";
const clusterDeleteEventStorePrefix = "@clusterRealtimeDelete/";

// bindRealtimeApi registers the realtime api endpoints.
export function bindRealtimeApi(app: App, rg: RouterGroup<RequestEvent>): void {
  const sub = rg.group("/realtime");
  sub.get("", (event) => realtimeConnect(event)).Bind(SkipSuccessActivityLog());
  sub.post("", (event) => realtimeSetSubscriptions(event));

  bindRealtimeEvents(app);
}

function realtimeConnect(event: RequestEvent): Response {
  // Note: Bun doesn't expose an equivalent to http.ResponseController.SetWriteDeadline,
  // so we rely on streaming + request abort signals to keep connections responsive.
  event.responseHeaders.set("Content-Type", "text/event-stream");
  event.responseHeaders.set("Cache-Control", "no-store");
  // https://github.com/pocketbase/pocketbase/discussions/480#discussioncomment-3657640
  // https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_buffering
  event.responseHeaders.set("X-Accel-Buffering", "no");

  const connectEvent = new RealtimeConnectRequestEvent(event);
  connectEvent.IdleTimeout = 5 * 60 * 1000;
  connectEvent.MaxTimeout = 30 * 60 * 1000;
  connectEvent.Client = new DefaultClient();

  // could be used as an optional cross-reference check in other API endpoints
  connectEvent.Client.Set(RealtimeClientIPKey, event.realIP());

  const stream = new ReadableStream<Uint8Array>({
    start: async (controller) => {
      const encoder = new TextEncoder();
      let closed = false;

      const closeStream = () => {
        if (closed) {
          return;
        }
        closed = true;
        try {
          controller.close();
        } catch {
          // ignore double close attempts
        }
      };

      const writer: MessageWriter = {
        write: (chunk) => {
          if (closed) {
            throw new Error("realtime stream is closed");
          }
          if (typeof chunk === "string") {
            controller.enqueue(encoder.encode(chunk));
          } else {
            controller.enqueue(chunk);
          }
        },
      };

      const signal = event.request.signal;
      if (signal.aborted) {
        closeStream();
        return;
      }

      const result = await event.app.OnRealtimeConnectRequest().Trigger(connectEvent, async (ce) => {
        const client = ce.Client ?? new DefaultClient();
        ce.Client = client;

        ce.App.SubscriptionsBroker().Register(client);
        try {
          ce.App.Logger().Debug("Realtime connection established", "clientId", client.Id());

          const connectMsgEvent = new RealtimeMessageEvent(ce.RequestEvent);
          connectMsgEvent.Client = client;
          connectMsgEvent.Message = new Message("PB_CONNECT", `{"clientId":"${client.Id()}"}`);

          const connectMsgErr = await ce.App.OnRealtimeMessageSend().Trigger(connectMsgEvent, (me) => {
            if (!me.Message || !me.Client) {
              return null;
            }
            return writeMessage(writer, me.Message, me.Client.Id());
          });

          if (connectMsgErr instanceof Error) {
            ce.App.Logger().Debug(
              "Realtime connection closed (failed to deliver PB_CONNECT)",
              "clientId",
              client.Id(),
              "error",
              connectMsgErr.message,
            );
            return null;
          }

          await waitForRealtimeMessages(ce, writer);
        } finally {
          ce.App.SubscriptionsBroker().Unregister(client.Id());
        }

        return null;
      });

      if (result instanceof Error) {
        event.app.Logger().Warn("Realtime connection failed.", "error", result);
      }

      closeStream();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: event.responseHeaders,
  });
}

class RealtimeSubscribeForm {
  clientId = "";
  subscriptions: string[] = [];

  get ClientId(): string {
    return this.clientId;
  }

  set ClientId(value: string) {
    this.clientId = value;
  }

  get Subscriptions(): string[] {
    return this.subscriptions;
  }

  set Subscriptions(value: string[]) {
    this.subscriptions = value;
  }
}

type ClusterRealtimeSubscribeRequest = {
  url: string;
  headers: Array<[string, string]>;
  remoteIP: string;
  authCollectionId: string;
  authRecordJson: string;
  subscriptions: string[];
};

type ClusterRealtimeSubscribeResponse = {
  status: number;
  statusText: string;
  headers: Array<[string, string]>;
  body: string;
};

function validateRealtimeSubscribeForm(form: RealtimeSubscribeForm): Error | null {
  const errors: Record<string, Error> = {};

  if (required(form.clientId)) {
    errors.clientId = newError("validation_required", "Cannot be blank.");
  } else if (form.clientId.length < 1 || form.clientId.length > 255) {
    errors.clientId = newError("validation_length_out_of_range", "The length must be between 1 and 255.");
  }

  if (form.subscriptions.length > 1000) {
    errors.subscriptions = newError("validation_length_too_long", "The length must be no more than 1000.");
  } else {
    const itemErrors: Record<string, Error> = {};
    for (let i = 0; i < form.subscriptions.length; i += 1) {
      const item = form.subscriptions[i] ?? "";
      if (item.length > 2500) {
        itemErrors[String(i)] = newError("validation_length_too_long", "The length must be no more than 2500.");
      }
    }
    if (Object.keys(itemErrors).length > 0) {
      errors.subscriptions = new ValidationErrors(itemErrors);
    }
  }

  return Object.keys(errors).length > 0 ? new ValidationErrors(errors) : null;
}

// note: in case of reconnect, clients will have to resubmit all subscriptions again
async function realtimeSetSubscriptions(event: RequestEvent): Promise<Response> {
  const form = new RealtimeSubscribeForm();

  try {
    await event.bindBody(form);
  } catch (error) {
    return badRequest(event, "", error as Error);
  }

  if (!Array.isArray(form.subscriptions)) {
    form.subscriptions = [];
  } else {
    form.subscriptions = form.subscriptions.map((item) => (typeof item === "string" ? item : String(item)));
  }

  if (typeof form.clientId !== "string") {
    form.clientId = "";
  }

  const validationErr = validateRealtimeSubscribeForm(form);
  if (validationErr) {
    return badRequest(event, "", validationErr);
  }

  let client: Client;
  try {
    client = event.app.SubscriptionsBroker().ClientById(form.ClientId);
  } catch (_error) {
    if (clusterEnabled()) {
      return routeClusterRealtimeSubscriptions(event, form);
    }
    return notFound(event, "Missing or invalid client id.");
  }

  return applyRealtimeSubscriptions(event, form, client);
}

async function applyRealtimeSubscriptions(event: RequestEvent, form: RealtimeSubscribeForm, client: Client): Promise<Response> {
  // for just in case to prevent someone changing a guest subscription
  //
  // note1: this is an extra precaution against clientId bruteforce attempts
  // for installations allowing longer realtime connections duration
  //
  // note2: custom registered clients (aka. those without IP in the store)
  // are excluded from the check for backward compatibility
  const clientIP = client.Get(RealtimeClientIPKey);
  if (typeof clientIP === "string" && clientIP !== "" && clientIP !== event.realIP()) {
    return badRequest(
      event,
      "Invalid realtime client.",
      new Error("the subscription request IP doesn't match with the realtime client IP"),
    );
  }

  const clientAuth = client.Get(RealtimeClientAuthKey) as RecordModel | null;
  if (clientAuth && !isSameAuth(clientAuth, event.auth)) {
    return forbidden(event, "The current and the previous request authorization don't match.");
  }

  const hookEvent = new RealtimeSubscribeRequestEvent(event);
  hookEvent.Client = client;
  hookEvent.Subscriptions = form.Subscriptions;

  const out = await event.app.OnRealtimeSubscribeRequest().Trigger(hookEvent, async (e) => {
    if (!e.Client) {
      return forbidden(event, "Missing subscription client.");
    }

    // update auth state
    e.Client.Set(RealtimeClientAuthKey, e.RequestEvent.auth ?? null);

    // unsubscribe from any previous existing subscriptions
    e.Client.Unsubscribe();

    // subscribe to the new subscriptions
    e.Client.Subscribe(...e.Subscriptions);

    e.App.Logger().Debug("Realtime subscriptions updated", "clientId", e.Client.Id(), "subscriptions", e.Subscriptions);

    return execAfterSuccessTx(true, e.App, () => noContent(event, 204));
  });

  if (out instanceof Response) {
    return out;
  }

  return badRequest(event, "", out as Error);
}

async function routeClusterRealtimeSubscriptions(event: RequestEvent, form: RealtimeSubscribeForm): Promise<Response> {
  const authRecordJson = event.auth ? encodeClusterRealtimeRecord(event.auth) : "";
  if (event.auth && !authRecordJson) {
    throw new Error("Failed to encode realtime subscription auth state");
  }
  const request: ClusterRealtimeSubscribeRequest = {
    url: event.request.url,
    headers: [...event.request.headers],
    remoteIP: event.realIP(),
    authCollectionId: event.auth?.collection().Id ?? "",
    authRecordJson: authRecordJson ?? "",
    subscriptions: form.Subscriptions,
  };
  const { routeClusterRealtimeSubscription } = await import("../internal/cluster/worker.ts");
  const result = await routeClusterRealtimeSubscription(form.ClientId, JSON.stringify(request));
  if (result === "absent") {
    return notFound(event, "Missing or invalid client id.");
  }

  const response = JSON.parse(result) as ClusterRealtimeSubscribeResponse;
  if (
    !response ||
    !Number.isSafeInteger(response.status) ||
    !Array.isArray(response.headers) ||
    typeof response.body !== "string"
  ) {
    throw new Error("Invalid cluster realtime subscription response");
  }
  return new Response(response.body || null, {
    status: response.status,
    statusText: typeof response.statusText === "string" ? response.statusText : "",
    headers: response.headers,
  });
}

// realtimeUpdateClientsAuth updates the auth state of all clients related to the provided authRecord.
//
// Realtime connections has short lifetime by design, but to minimize abuse
// if the new record has a different tokenKey (e.g. in case of password reset)
// the auth state of the related realtime connections is also cleared
// (aka. they remain active but unauthenticated, allowing to reauthenicate with the next subscription).
function realtimeUpdateClientsAuth(app: App, authRecord: RecordModel): Error | null {
  const chunks = app.SubscriptionsBroker().ChunkedClients(clientsChunkSize);

  for (const chunk of chunks) {
    for (const client of chunk) {
      const clientAuth = client.Get(RealtimeClientAuthKey) as RecordModel | null;
      if (clientAuth && clientAuth.Id === authRecord.Id && clientAuth.collection().name === authRecord.collection().name) {
        if (clientAuth.TokenKey() !== authRecord.TokenKey()) {
          client.Unset(RealtimeClientAuthKey);
        } else {
          client.Set(RealtimeClientAuthKey, authRecord);
        }
      }
    }
  }

  return null;
}

// realtimeUnsetClientsAuthByRecordModelOrProxy unsets the auth state of all clients that have the provided auth model.
function realtimeUnsetClientsAuthByRecordModelOrProxy(app: App, authModel: Model): Error | null {
  const pk = authModel.PK();
  if (typeof pk !== "string") {
    return null;
  }

  return realtimeUnsetClientsAuthByIdentity(app, authModel.TableName(), pk);
}

function realtimeUnsetClientsAuthByIdentity(app: App, collectionName: string, recordId: string): Error | null {
  const chunks = app.SubscriptionsBroker().ChunkedClients(clientsChunkSize);

  for (const chunk of chunks) {
    for (const client of chunk) {
      const clientAuth = client.Get(RealtimeClientAuthKey) as RecordModel | null;
      if (clientAuth && clientAuth.Id === recordId && clientAuth.collection().name === collectionName) {
        client.Unset(RealtimeClientAuthKey);
      }
    }
  }

  return null;
}

// realtimeUnsetClientsAuthByCollection unsets the auth state of all authenticated clients related to the collection.
function realtimeUnsetClientsAuthByCollection(app: App, collection: Collection): Error | null {
  return realtimeUnsetClientsAuthByCollectionName(app, collection.name);
}

function realtimeUnsetClientsAuthByCollectionName(app: App, collectionName: string): Error | null {
  const chunks = app.SubscriptionsBroker().ChunkedClients(clientsChunkSize);

  for (const chunk of chunks) {
    for (const client of chunk) {
      const clientAuth = client.Get(RealtimeClientAuthKey) as RecordModel | null;
      if (clientAuth && clientAuth.collection().name === collectionName) {
        client.Unset(RealtimeClientAuthKey);
      }
    }
  }

  return null;
}

function bindRealtimeEvents(app: App): void {
  if (clusterEnabled()) {
    registerClusterRealtimeEventHandler((event) => deliverClusterRealtimeEvent(app, event));
    registerClusterRealtimePrepareHandler((operation) => prepareClusterRealtimeDeleteLocally(app, operation));
    registerClusterRealtimeSubscribeHandler((operation) => deliverClusterRealtimeSubscriptionLocally(app, operation));
  }

  // reset the clients auth on collection secret change
  // (@todo with the future tracking of old collections data consider replacing with *AfterUpdateSuccess to account for transaction rollback)
  app.OnCollectionUpdate().Bind({
    Func: (e) => {
      const collection = e.Collection;
      if (!collection?.IsAuth()) {
        return e.Next();
      }

      let cached: Collection | null = null;
      try {
        cached = e.App.FindCachedCollectionByNameOrId(collection.Id);
      } catch {
        cached = null;
      }

      const result = e.Next();
      const handleNext = (nextErr: Error | null): Error | null => {
        if (nextErr) {
          return nextErr;
        }

        if (cached && cached.AuthToken.Secret !== collection.AuthToken.Secret) {
          const err = realtimeUnsetClientsAuthByCollection(e.App, collection);
          if (err) {
            app
              .Logger()
              .Warn(
                "Failed to remove client(s) associated to the changed auth collection",
                "collectionName",
                collection.Name,
                "error",
                err.message,
              );
          }
          publishClusterRealtimeEvent(e.App, { kind: "auth.collection", collectionName: collection.Name });
        }

        return null;
      };

      if (result instanceof Promise) {
        return result.then((err) => handleNext(err as Error | null));
      }
      return handleNext(result as Error | null);
    },
    Priority: -99,
  });

  // unset the clients auth on auth collection delete
  app.OnCollectionAfterDeleteSuccess().Bind({
    Func: (e) => {
      if (e.Collection?.IsAuth()) {
        const err = realtimeUnsetClientsAuthByCollection(e.App, e.Collection);
        if (err) {
          app
            .Logger()
            .Warn(
              "Failed to remove client(s) associated to the deleted auth collection",
              "collectionName",
              e.Collection.Name,
              "error",
              err.message,
            );
        }
        publishClusterRealtimeEvent(e.App, { kind: "auth.collection", collectionName: e.Collection.Name });
      }

      return e.Next();
    },
    Priority: -99,
  });

  // update the clients that has auth record association
  app.OnModelAfterUpdateSuccess().Bind({
    Func: (e) => {
      const authRecord = realtimeResolveRecord(e.App, e.Model as Model, CollectionTypeAuth);
      if (authRecord) {
        const err = realtimeUpdateClientsAuth(e.App, authRecord);
        if (err) {
          app
            .Logger()
            .Warn(
              "Failed to update client(s) associated to the updated auth record",
              "id",
              authRecord.Id,
              "collectionName",
              authRecord.collection().name,
              "error",
              err.message,
            );
        }
        const recordJson = encodeClusterRealtimeRecord(authRecord);
        if (recordJson) {
          publishClusterRealtimeEvent(e.App, {
            kind: "auth.record-update",
            collectionId: authRecord.collection().Id,
            recordJson,
          });
        }
      }

      return e.Next();
    },
    Priority: -99,
  });

  // remove the client(s) associated to the deleted auth model
  // (note: works also with custom model for backward compatibility)
  app.OnModelAfterDeleteSuccess().Bind({
    Func: (e) => {
      const collection = realtimeResolveRecordCollection(e.App, e.Model as Model);
      if (collection && collection.IsAuth()) {
        const err = realtimeUnsetClientsAuthByRecordModelOrProxy(e.App, e.Model as Model);
        if (err) {
          app
            .Logger()
            .Warn(
              "Failed to remove client(s) associated to the deleted auth model",
              "id",
              e.Model?.PK(),
              "collectionName",
              e.Model?.TableName(),
              "error",
              err.message,
            );
        }
        const recordId = e.Model?.PK();
        if (typeof recordId === "string") {
          publishClusterRealtimeEvent(e.App, {
            kind: "auth.record-delete",
            collectionName: collection.Name,
            recordId,
          });
        }
      }

      return e.Next();
    },
    Priority: -99,
  });

  app.OnModelAfterCreateSuccess().Bind({
    Func: (e) => {
      const record = realtimeResolveRecord(e.App, e.Model as Model, "");
      if (record) {
        const err = realtimeBroadcastRecord(e.App, "create", record, false);
        if (err) {
          app
            .Logger()
            .Debug(
              "Failed to broadcast record create",
              "id",
              record.Id,
              "collectionName",
              record.collection().name,
              "error",
              err.message,
            );
        }
        publishClusterRecordEvent(e.App, "create", record);
      }

      return e.Next();
    },
    Priority: -99,
  });

  app.OnModelAfterUpdateSuccess().Bind({
    Func: (e) => {
      const record = realtimeResolveRecord(e.App, e.Model as Model, "");
      if (record) {
        const err = realtimeBroadcastRecord(e.App, "update", record, false);
        if (err) {
          app
            .Logger()
            .Debug(
              "Failed to broadcast record update",
              "id",
              record.Id,
              "collectionName",
              record.collection().name,
              "error",
              err.message,
            );
        }
        publishClusterRecordEvent(e.App, "update", record);
      }

      return e.Next();
    },
    Priority: -99,
  });

  // delete: dry cache
  app.OnModelDelete().Bind({
    Func: (e) => {
      const record = realtimeResolveRecord(e.App, e.Model as Model, "");
      if (!record) {
        return e.Next();
      }

      // note: use the outside scoped app instance for the access checks so that the API rules
      // are performed out of the delete transaction ensuring that they would still work even if
      // a cascade-deleted record's API rule relies on an already deleted parent record
      const err = realtimeBroadcastRecord(e.App, "delete", record, true, app);
      if (err) {
        app
          .Logger()
          .Debug(
            "Failed to dry cache record delete",
            "id",
            record.Id,
            "collectionName",
            record.collection().name,
            "error",
            err.message,
          );
      }

      if (!clusterEnabled()) {
        return e.Next();
      }

      const recordJson = encodeClusterRealtimeRecord(record);
      if (!recordJson) {
        realtimeUnsetDryCacheKey(e.App, getDryCacheKey("delete", record));
        return new Error("Failed to encode record for cluster realtime delete preparation");
      }
      const eventId = crypto.randomUUID();
      return import("../internal/cluster/worker.ts")
        .then(({ prepareClusterRealtimeDelete }) => prepareClusterRealtimeDelete(eventId, record.collection().Id, recordJson))
        .then(() => {
          app.store().set(clusterDeleteStateKey(record), eventId);
          return e.Next();
        })
        .catch((error) => {
          realtimeUnsetDryCacheKey(e.App, getDryCacheKey("delete", record));
          return error instanceof Error ? error : new Error(String(error));
        });
    },
    Priority: 99, // execute as later as possible
  });

  // delete: broadcast
  app.OnModelAfterDeleteSuccess().Bind({
    Func: (e) => {
      // note: only ensure that it is a collection record
      // and don't use realtimeResolveRecord because in case of a
      // custom model it'll fail to resolve since the record is already deleted
      const collection = realtimeResolveRecordCollection(e.App, e.Model as Model);
      if (collection) {
        const model = e.Model as Model;
        const err = realtimeBroadcastDryCacheKey(e.App, getDryCacheKey("delete", model));
        if (err) {
          app
            .Logger()
            .Debug(
              "Failed to broadcast record delete",
              "id",
              e.Model?.PK(),
              "collectionName",
              collection.name,
              "error",
              err.message,
            );
        }
        const eventId = app.store().get(clusterDeleteStateKey(model));
        if (typeof eventId === "string") {
          app.store().remove(clusterDeleteStateKey(model));
          publishClusterRealtimeEvent(e.App, { kind: "delete.commit", eventId });
        }
      }

      return e.Next();
    },
    Priority: -99,
  });

  // delete: failure
  app.OnModelAfterDeleteError().Bind({
    Func: (e) => {
      const record = realtimeResolveRecord(e.App, e.Model as Model, "");
      if (record) {
        const model = e.Model as Model;
        const err = realtimeUnsetDryCacheKey(e.App, getDryCacheKey("delete", record));
        if (err) {
          app
            .Logger()
            .Debug(
              "Failed to cleanup after broadcast record delete failure",
              "id",
              record.Id,
              "collectionName",
              record.collection().name,
              "error",
              err.message,
            );
        }
        const eventId = app.store().get(clusterDeleteStateKey(model));
        if (typeof eventId === "string") {
          app.store().remove(clusterDeleteStateKey(model));
          publishClusterRealtimeEvent(e.App, { kind: "delete.abort", eventId });
        }
      }

      return e.Next();
    },
    Priority: -99,
  });
}

export function encodeClusterRealtimeRecord(record: RecordModel): string | null {
  try {
    return JSON.stringify(record.DBExport());
  } catch {
    return null;
  }
}

export function decodeClusterRealtimeRecord(app: App, collectionId: string, recordJson: string): RecordModel {
  const collection = app.FindCachedCollectionByNameOrId(collectionId);
  const data = JSON.parse(recordJson) as unknown;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Invalid cluster realtime record snapshot");
  }
  return RecordModel.fromRow(collection, data as Record<string, unknown>);
}

function publishClusterRecordEvent(app: App, action: "create" | "update", record: RecordModel): void {
  if (!clusterEnabled()) {
    return;
  }
  const recordJson = encodeClusterRealtimeRecord(record);
  if (!recordJson) {
    app.Logger().Debug("Failed to encode cluster realtime record", "id", record.Id, "action", action);
    return;
  }
  publishClusterRealtimeEvent(app, {
    kind: "record",
    eventId: crypto.randomUUID(),
    action,
    collectionId: record.collection().Id,
    recordJson,
  });
}

function publishClusterRealtimeEvent(app: App, event: ClusterRealtimeEvent): void {
  if (!clusterEnabled()) {
    return;
  }
  FireAndForget(async () => {
    try {
      const { broadcastClusterRealtimeEvent } = await import("../internal/cluster/worker.ts");
      await broadcastClusterRealtimeEvent(event);
    } catch (error) {
      app.Logger().Debug("Failed to publish cluster realtime event", "kind", event.kind, "error", String(error));
    }
  });
}

async function deliverClusterRealtimeEvent(app: App, event: ClusterRealtimeEvent): Promise<void> {
  switch (event.kind) {
    case "record": {
      const record = decodeClusterRealtimeRecord(app, event.collectionId, event.recordJson);
      const err = realtimeBroadcastRecord(app, event.action, record, false);
      if (err) {
        throw err;
      }
      return;
    }
    case "delete.commit": {
      const err = realtimeBroadcastDryCacheKey(app, clusterDeleteCacheKey(event.eventId));
      if (err) {
        throw err;
      }
      return;
    }
    case "delete.abort": {
      const err = realtimeUnsetDryCacheKey(app, clusterDeleteCacheKey(event.eventId));
      if (err) {
        throw err;
      }
      return;
    }
    case "auth.record-update": {
      const err = realtimeUpdateClientsAuth(app, decodeClusterRealtimeRecord(app, event.collectionId, event.recordJson));
      if (err) {
        throw err;
      }
      return;
    }
    case "auth.record-delete": {
      const err = realtimeUnsetClientsAuthByIdentity(app, event.collectionName, event.recordId);
      if (err) {
        throw err;
      }
      return;
    }
    case "auth.collection": {
      const err = realtimeUnsetClientsAuthByCollectionName(app, event.collectionName);
      if (err) {
        throw err;
      }
    }
  }
}

function prepareClusterRealtimeDeleteLocally(
  app: App,
  operation: Extract<import("../internal/cluster/protocol.ts").CoordinatorOperation, { kind: "realtime.prepare" }>,
): string {
  const record = decodeClusterRealtimeRecord(app, operation.collectionId, operation.recordJson);
  const err = realtimeBroadcastRecord(app, "delete", record, true, app, clusterDeleteCacheKey(operation.eventId));
  if (err) {
    throw err;
  }
  setTimeout(() => {
    realtimeUnsetDryCacheKey(app, clusterDeleteCacheKey(operation.eventId));
  }, 30_000);
  return "prepared";
}

async function deliverClusterRealtimeSubscriptionLocally(
  app: App,
  operation: Extract<import("../internal/cluster/protocol.ts").CoordinatorOperation, { kind: "realtime.subscribe" }>,
): Promise<string> {
  let client: Client;
  try {
    client = app.SubscriptionsBroker().ClientById(operation.clientId);
  } catch {
    return "absent";
  }

  const data = JSON.parse(operation.requestJson) as ClusterRealtimeSubscribeRequest;
  if (
    !data ||
    !Array.isArray(data.headers) ||
    !Array.isArray(data.subscriptions) ||
    data.subscriptions.some((item) => typeof item !== "string")
  ) {
    throw new Error("Invalid cluster realtime subscription request");
  }
  const request = new Request(data.url, {
    method: "POST",
    headers: data.headers,
    body: JSON.stringify({ clientId: operation.clientId, subscriptions: data.subscriptions }),
  });
  const event = new RequestEvent({
    app,
    request,
    remoteAddress: `${data.remoteIP}:0`,
    pattern: "/api/realtime",
  });
  if (data.authRecordJson) {
    event.auth = decodeClusterRealtimeRecord(app, data.authCollectionId, data.authRecordJson);
  }
  const form = new RealtimeSubscribeForm();
  form.ClientId = operation.clientId;
  form.Subscriptions = data.subscriptions;
  const response = await applyRealtimeSubscriptions(event, form, client);
  const encoded: ClusterRealtimeSubscribeResponse = {
    status: response.status,
    statusText: response.statusText,
    headers: [...response.headers],
    body: response.body ? await response.text() : "",
  };
  return JSON.stringify(encoded);
}

function clusterDeleteCacheKey(eventId: string): string {
  return `@clusterDelete/${eventId}`;
}

function clusterDeleteStateKey(model: Model): string {
  return clusterDeleteEventStorePrefix + getDryCacheKey("delete", model);
}

// resolveRecord converts *if possible* the provided model interface to a Record.
// This is usually helpful if the provided model is a custom Record model struct.
function realtimeResolveRecord(app: App, model: Model, optCollectionType: string): RecordModel | null {
  let record: RecordModel | null = null;
  if (model instanceof RecordModel) {
    record = model;
  } else if (isRecordProxy(model)) {
    try {
      record = model.ProxyRecord();
    } catch {
      record = null;
    }
  }

  if (record) {
    if (!optCollectionType || record.collection().type === optCollectionType) {
      return record;
    }
    return null;
  }

  const tableName = model.TableName();

  // skip Log model checks
  if (tableName === LogsTableName) {
    return null;
  }

  // check if it is custom Record model struct
  let collection: ReturnType<App["FindCachedCollectionByNameOrId"]> | null = null;
  try {
    collection = app.FindCachedCollectionByNameOrId(tableName);
  } catch {
    collection = null;
  }
  if (collection && (!optCollectionType || collection.type === optCollectionType)) {
    const pk = model.PK();
    if (typeof pk === "string") {
      try {
        return app.FindRecordById(collection, pk);
      } catch {
        return null;
      }
    }
  }

  return record;
}

// realtimeResolveRecordCollection extracts *if possible* the Collection model from the provided model interface.
// This is usually helpful if the provided model is a custom Record model struct.
function realtimeResolveRecordCollection(app: App, model: Model): Collection | null {
  if (model instanceof RecordModel) {
    return model.collection();
  }
  if (isRecordProxy(model)) {
    return model.ProxyRecord().collection();
  }

  try {
    return app.FindCachedCollectionByNameOrId(model.TableName());
  } catch {
    return null;
  }
}

// recordData represents the broadcasted record subscrition message data.
type RecordDataPayload = {
  record: unknown;
  action: string;
};

// Note: the optAccessCheckApp is there in case you want the access check
// to be performed against different db app context (e.g. out of a transaction).
// If set, it is expected that optAccessCheckApp instance is used for read-only operations to avoid deadlocks.
// If not set, it fallbacks to app.
function realtimeBroadcastRecord(
  app: App,
  action: string,
  record: RecordModel,
  dryCache: boolean,
  optAccessCheckApp?: App,
  dryCacheKeyOverride?: string,
): Error | null {
  const collection = record.collection();
  if (!collection) {
    return new Error("[broadcastRecord] Record collection not set");
  }

  const chunks = app.SubscriptionsBroker().ChunkedClients(clientsChunkSize);
  if (chunks.length === 0) {
    return null; // no subscribers
  }

  const subscriptionRuleMap: Record<string, string | null> = {
    [`${collection.name}/${record.Id}?`]: collection.viewRule,
    [`${collection.id}/${record.Id}?`]: collection.viewRule,
    [`${collection.name}/*?`]: collection.listRule,
    [`${collection.id}/*?`]: collection.listRule,

    // @deprecated: the same as the wildcard topic but kept for backward compatibility
    [`${collection.name}?`]: collection.listRule,
    [`${collection.id}?`]: collection.listRule,
  };

  const dryCacheKey = dryCacheKeyOverride ?? getDryCacheKey(action, record);

  const accessCheckApp = optAccessCheckApp ?? app;

  for (const chunk of chunks) {
    let clientAuth: RecordModel | null = null;

    for (const client of chunk) {
      // note: not executed concurrently to avoid races and to ensure
      // that the access checks are applied for the current record db state
      for (const [prefix, rule] of Object.entries(subscriptionRuleMap)) {
        const subs = client.Subscriptions(prefix);
        if (Object.keys(subs).length === 0) {
          continue;
        }

        clientAuth = (client.Get(RealtimeClientAuthKey) as RecordModel | null) ?? null;

        for (const [sub, options] of Object.entries(subs)) {
          // mock request data
          const requestInfo: RequestInfo = {
            context: RequestInfoContextRealtime,
            method: "GET",
            query: options.query,
            headers: options.headers,
            body: {},
            auth: clientAuth,
          };

          if (!realtimeCanAccessRecord(accessCheckApp, record, requestInfo, rule)) {
            continue;
          }

          // create a clean record copy without expand and unknown fields because we don't know yet
          // which exact fields the client subscription requested or has permissions to access
          const cleanRecord = record.Fresh();

          // -------------------------------------------
          // @todo consider with the refactoring whether
          // the default enriching used by the regular APIs
          // can be reused here too to avoid eventual future
          // discrepencies in the record event data
          //
          // https://github.com/pocketbase/pocketbase/issues/7721
          // -------------------------------------------

          // enable hidden fields for superuser subscribers
          if (requestInfo.auth?.isSuperuser()) {
            cleanRecord.Unhide(...collection.Fields.FieldNames());
          }

          // trigger the enrich hooks
          const enrichErr = triggerRecordEnrichHooks(app, requestInfo, [cleanRecord], () => {
            // apply expand
            const rawExpand = options.query[expandQueryParam] ?? "";
            if (rawExpand !== "") {
              const expandErrs = app.ExpandRecord(cleanRecord, rawExpand.split(","), expandFetch(app, requestInfo));
              if (Object.keys(expandErrs).length > 0) {
                app
                  .Logger()
                  .Debug(
                    "[broadcastRecord] expand errors",
                    "id",
                    cleanRecord.Id,
                    "collectionName",
                    cleanRecord.collection().name,
                    "sub",
                    sub,
                    "expand",
                    rawExpand,
                    "errors",
                    expandErrs,
                  );
              }
            }

            // ignore the auth record email visibility checks
            // for auth owner, superuser or manager
            if (collection.IsAuth()) {
              if (
                isSameAuth(clientAuth, cleanRecord) ||
                realtimeCanAccessRecord(accessCheckApp, cleanRecord, requestInfo, collection.ManageRule)
              ) {
                cleanRecord.IgnoreEmailVisibility(true);
              }
            }

            return null;
          });

          if (enrichErr) {
            app
              .Logger()
              .Debug(
                "[broadcastRecord] record enrich error",
                "id",
                cleanRecord.Id,
                "collectionName",
                cleanRecord.collection().name,
                "sub",
                sub,
                "error",
                enrichErr,
              );
            continue;
          }

          const data: RecordDataPayload = {
            action,
            record: cleanRecord,
          };

          // check fields
          const rawFields = options.query[fieldsQueryParam] ?? "";
          if (rawFields !== "") {
            try {
              data.record = Pick(cleanRecord, rawFields);
            } catch (error) {
              app
                .Logger()
                .Debug(
                  "[broadcastRecord] pick fields error",
                  "id",
                  cleanRecord.Id,
                  "collectionName",
                  cleanRecord.collection().name,
                  "sub",
                  sub,
                  "fields",
                  rawFields,
                  "error",
                  (error as Error).message,
                );
            }
          }

          let dataText = "";
          try {
            dataText = JSON.stringify(data);
          } catch (error) {
            app
              .Logger()
              .Debug(
                "[broadcastRecord] data marshal error",
                "id",
                cleanRecord.Id,
                "collectionName",
                cleanRecord.collection().name,
                "error",
                (error as Error).message,
              );
            continue;
          }

          const msg = new Message(sub, dataText);

          if (dryCache) {
            const stored = client.Get(dryCacheKey);
            if (Array.isArray(stored)) {
              stored.push(msg);
              client.Set(dryCacheKey, stored);
            } else {
              client.Set(dryCacheKey, [msg]);
            }
          } else {
            FireAndForget(() => {
              client.Send(msg);
            });
          }
        }
      }
    }
  }

  return null;
}

// realtimeBroadcastDryCacheKey broadcasts the dry cached key related messages.
function realtimeBroadcastDryCacheKey(app: App, key: string): Error | null {
  const chunks = app.SubscriptionsBroker().ChunkedClients(clientsChunkSize);
  if (chunks.length === 0) {
    return null; // no subscribers
  }

  for (const chunk of chunks) {
    for (const client of chunk) {
      const messages = client.Get(key);
      if (!Array.isArray(messages)) {
        continue;
      }

      client.Unset(key);

      const target = client;

      FireAndForget(() => {
        for (const msg of messages) {
          target.Send(msg as Message);
        }
      });
    }
  }

  return null;
}

// realtimeUnsetDryCacheKey removes the dry cached key related messages.
function realtimeUnsetDryCacheKey(app: App, key: string): Error | null {
  const chunks = app.SubscriptionsBroker().ChunkedClients(clientsChunkSize);
  if (chunks.length === 0) {
    return null; // no subscribers
  }

  for (const chunk of chunks) {
    for (const client of chunk) {
      if (client.Get(key) != null) {
        client.Unset(key);
      }
    }
  }

  return null;
}

function getDryCacheKey(action: string, model: Model): string {
  const pk = model.PK();
  const pkStr = typeof pk === "string" ? pk : String(pk);
  return `${action}/${model.TableName()}/${pkStr}`;
}

function isSameAuth(authA: RecordModel | null, authB: RecordModel | null): boolean {
  if (!authA) {
    return authB === null;
  }
  if (!authB) {
    return false;
  }
  return authA.Id === authB.Id && authA.collection().id === authB.collection().id;
}

// realtimeCanAccessRecord checks if the subscription client has access to the specified record model.
function realtimeCanAccessRecord(app: App, record: RecordModel, requestInfo: RequestInfo, accessRule: string | null): boolean {
  // check the access rule
  // ---
  const [ok] = app.CanAccessRecord(record, requestInfo, accessRule);
  if (!ok) {
    return false;
  }

  // check the subscription client-side filter (if any)
  // ---
  const filter = requestInfo.query[FilterQueryParam];
  if (!filter) {
    return true; // no further checks needed
  }

  const ruleError = checkForSuperuserOnlyRuleFields(requestInfo);
  if (ruleError) {
    return false;
  }

  let sql = `select (1) from {{${record.collection().name}}}`;
  const params: SQLQueryBindings[] = [];
  sql = appendWhere(sql, `[[${record.collection().name}.id]] = ?`);
  params.push(record.Id);

  const resolver = new RecordFieldResolver(app, record.collection(), requestInfo, false);
  let expr;
  try {
    expr = buildFilterExpr(filter, resolver, DefaultFilterExprLimit);
  } catch {
    return false;
  }

  if (expr.sql) {
    sql = appendWhere(sql, expr.sql);
    params.push(...(expr.params as SQLQueryBindings[]));
  }

  const updated = resolver.updateQuery({ select: sql, params });
  sql = updated.select;
  params.splice(0, params.length, ...((updated.params ?? []) as SQLQueryBindings[]));

  const row = app
    .db()
    .query(sql)
    .get(...params);

  return Boolean(row);
}

function appendWhere(baseSql: string, clause: string): string {
  if (!clause) {
    return baseSql;
  }
  if (/\bwhere\b/i.test(baseSql)) {
    return `${baseSql} AND ${clause}`;
  }
  return `${baseSql} WHERE ${clause}`;
}

function isRecordProxy(model: Model): model is RecordProxy {
  return typeof (model as RecordProxy | null)?.ProxyRecord === "function";
}

async function waitForRealtimeMessages(event: RealtimeConnectRequestEvent, writer: MessageWriter): Promise<void> {
  const client = event.Client;
  if (!client) {
    return;
  }

  const iterator = client.Channel()[Symbol.asyncIterator]();

  const keepaliveTimer = setInterval(() => {
    const keepaliveErr = writeKeepalive(writer);
    if (keepaliveErr) {
      event.App.Logger().Debug(
        "Realtime connection closed (failed to deliver keepalive)",
        "clientId",
        client.Id(),
        "error",
        keepaliveErr.message,
      );
      client.Discard();
    }
  }, realtimeSSEKeepaliveIntervalMs);
  const maxDeadline = Date.now() + event.MaxTimeout;

  try {
    while (true) {
      const winner = await waitForRealtimeMessage(
        iterator,
        event.RequestEvent.request.signal,
        event.IdleTimeout,
        Math.max(0, maxDeadline - Date.now()),
      );

      if (winner.type === "idle") {
        event.App.Logger().Debug("Realtime connection closed (idle timeout)", "clientId", client.Id());
        return;
      }

      if (winner.type === "max") {
        event.App.Logger().Debug("Realtime connection closed (max timeout)", "clientId", client.Id());
        return;
      }

      if (winner.type === "abort") {
        event.App.Logger().Debug("Realtime connection closed (cancelled request)", "clientId", client.Id());
        return;
      }

      if (winner.result.done) {
        event.App.Logger().Debug("Realtime connection closed (closed channel)", "clientId", client.Id());
        return;
      }

      const msgEvent = new RealtimeMessageEvent(event.RequestEvent);
      msgEvent.Client = client;
      msgEvent.Message = winner.result.value as Message;

      const msgErr = await event.App.OnRealtimeMessageSend().Trigger(msgEvent, (me) => {
        if (!me.Message || !me.Client) {
          return null;
        }
        return writeMessage(writer, me.Message, me.Client.Id());
      });

      if (msgErr instanceof Error) {
        event.App.Logger().Debug(
          "Realtime connection closed (failed to deliver message)",
          "clientId",
          client.Id(),
          "error",
          msgErr.message,
        );
        return;
      }
    }
  } finally {
    clearInterval(keepaliveTimer);
  }
}

type RealtimeMessageWait =
  | { type: "abort" }
  | { type: "idle" }
  | { type: "max" }
  | { type: "message"; result: IteratorResult<Message> };

// Unlike Promise.race(), this removes the losing abort listener and timers after every message.
// Keeping races against the connection-lifetime promises would retain one Promise reaction per message.
function waitForRealtimeMessage(
  iterator: AsyncIterator<Message>,
  signal: AbortSignal,
  idleTimeout: number,
  maxTimeout: number,
): Promise<RealtimeMessageWait> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (value: RealtimeMessageWait) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(idleTimer);
      clearTimeout(maxTimer);
      signal.removeEventListener("abort", onAbort);
      resolve(value);
    };
    const fail = (error: unknown) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(idleTimer);
      clearTimeout(maxTimer);
      signal.removeEventListener("abort", onAbort);
      reject(error);
    };
    const onAbort = () => finish({ type: "abort" });
    const idleTimer = setTimeout(() => finish({ type: "idle" }), idleTimeout);
    const maxTimer = setTimeout(() => finish({ type: "max" }), maxTimeout);

    if (signal.aborted) {
      finish({ type: "abort" });
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
    void iterator.next().then((result) => finish({ type: "message", result }), fail);
  });
}

function writeMessage(writer: MessageWriter, message: Message, clientId: string): Error | null {
  try {
    message.WriteSSE(writer, clientId);
    return null;
  } catch (error) {
    return error as Error;
  }
}

function writeKeepalive(writer: MessageWriter): Error | null {
  try {
    writer.write(":\n\n");
    return null;
  } catch (error) {
    return error as Error;
  }
}
