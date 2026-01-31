// Ported from pocketbase/core/events.go (partial: model/record/collection + collection request events).

import type { App } from "./app.ts";
import type { Collection } from "./collection.ts";
import type { Record as RecordModel } from "./record.ts";
import type { RecordProxy } from "./record_proxy.ts";
import type { RequestEvent } from "./event_request.ts";
import { Event } from "../tools/hook/event.ts";
import type { SearchResult } from "../tools/search/types.ts";

export type HookTagger = {
  HookTags(): string[];
};

type Model = RecordModel | Collection | RecordProxy;

class BaseModelEventData {
  Model: Model | null = null;

  Tags(): string[] {
    if (!this.Model) {
      return [];
    }
    const tagger = this.Model as unknown as HookTagger;
    if (typeof tagger.HookTags === "function") {
      return tagger.HookTags();
    }
    const model = this.Model as unknown as { TableName?: () => string };
    if (typeof model.TableName === "function") {
      return [model.TableName()];
    }
    return [];
  }
}

class BaseRecordEventData {
  Record: RecordModel | null = null;

  Tags(): string[] {
    if (!this.Record) {
      return [];
    }
    return this.Record.HookTags();
  }
}

class BaseCollectionEventData {
  Collection: Collection | null = null;

  Tags(): string[] {
    if (!this.Collection) {
      return [];
    }
    const tags: string[] = [];
    if (this.Collection.id) {
      tags.push(this.Collection.id);
    }
    if (this.Collection.name) {
      tags.push(this.Collection.name);
    }
    return tags;
  }
}

export const ModelEventTypeCreate = "create";
export const ModelEventTypeUpdate = "update";
export const ModelEventTypeDelete = "delete";
export const ModelEventTypeValidate = "validate";

export class ModelEvent extends Event {
  App: App;
  Context: unknown;
  Type: string;
  Model: Model | null;
  #base: BaseModelEventData;

  constructor(app: App, model: Model | null, type: string, context: unknown = null) {
    super();
    this.App = app;
    this.Context = context;
    this.Type = type;
    this.Model = model;
    this.#base = new BaseModelEventData();
    this.#base.Model = model;
  }

  Tags(): string[] {
    return this.#base.Tags();
  }
}

export class ModelErrorEvent extends Event {
  Error: Error;
  ModelEvent: ModelEvent;

  constructor(modelEvent: ModelEvent, error: Error) {
    super();
    this.ModelEvent = modelEvent;
    this.Error = error;
  }

  Tags(): string[] {
    return this.ModelEvent.Tags();
  }
}

export class RecordEvent extends Event {
  App: App;
  Context: unknown;
  Type: string;
  Record: RecordModel | null;
  #base: BaseRecordEventData;

  constructor(app: App, record: RecordModel | null, type: string, context: unknown = null) {
    super();
    this.App = app;
    this.Context = context;
    this.Type = type;
    this.Record = record;
    this.#base = new BaseRecordEventData();
    this.#base.Record = record;
  }

  Tags(): string[] {
    return this.#base.Tags();
  }
}

export class RecordErrorEvent extends Event {
  Error: Error;
  RecordEvent: RecordEvent;

  constructor(recordEvent: RecordEvent, error: Error) {
    super();
    this.RecordEvent = recordEvent;
    this.Error = error;
  }

  Tags(): string[] {
    return this.RecordEvent.Tags();
  }
}

export class CollectionEvent extends Event {
  App: App;
  Context: unknown;
  Type: string;
  Collection: Collection | null;
  #base: BaseCollectionEventData;

  constructor(app: App, collection: Collection | null, type: string, context: unknown = null) {
    super();
    this.App = app;
    this.Context = context;
    this.Type = type;
    this.Collection = collection;
    this.#base = new BaseCollectionEventData();
    this.#base.Collection = collection;
  }

  Tags(): string[] {
    return this.#base.Tags();
  }
}

export class CollectionErrorEvent extends Event {
  Error: Error;
  CollectionEvent: CollectionEvent;

  constructor(collectionEvent: CollectionEvent, error: Error) {
    super();
    this.CollectionEvent = collectionEvent;
    this.Error = error;
  }

  Tags(): string[] {
    return this.CollectionEvent.Tags();
  }
}

export function syncModelEventWithRecordEvent(modelEvent: ModelEvent, recordEvent: RecordEvent): void {
  modelEvent.App = recordEvent.App;
  modelEvent.Context = recordEvent.Context;
  modelEvent.Type = recordEvent.Type;
}

export function syncRecordEventWithModelEvent(recordEvent: RecordEvent, modelEvent: ModelEvent): void {
  recordEvent.App = modelEvent.App;
  recordEvent.Context = modelEvent.Context;
  recordEvent.Type = modelEvent.Type;
}

export function newRecordEventFromModelEvent(
  modelEvent: ModelEvent,
): { event: RecordEvent | null; ok: boolean } {
  const model = modelEvent.Model;
  let record: RecordModel | null = null;
  if (model && (model as RecordModel).collection) {
    record = model as RecordModel;
  } else if (model && typeof (model as RecordProxy).ProxyRecord === "function") {
    try {
      record = (model as RecordProxy).ProxyRecord();
    } catch {
      record = null;
    }
  }
  if (!record) {
    return { event: null, ok: false };
  }
  return {
    event: new RecordEvent(modelEvent.App, record, modelEvent.Type, modelEvent.Context),
    ok: true,
  };
}

export function newRecordErrorEventFromModelErrorEvent(
  modelErrorEvent: ModelErrorEvent,
): { event: RecordErrorEvent | null; ok: boolean } {
  const { event, ok } = newRecordEventFromModelEvent(modelErrorEvent.ModelEvent);
  if (!ok || !event) {
    return { event: null, ok: false };
  }
  return { event: new RecordErrorEvent(event, modelErrorEvent.Error), ok: true };
}

export function syncModelErrorEventWithRecordErrorEvent(
  modelErrorEvent: ModelErrorEvent,
  recordErrorEvent: RecordErrorEvent,
): void {
  syncModelEventWithRecordEvent(modelErrorEvent.ModelEvent, recordErrorEvent.RecordEvent);
  modelErrorEvent.Error = recordErrorEvent.Error;
}

export function syncRecordErrorEventWithModelErrorEvent(
  recordErrorEvent: RecordErrorEvent,
  modelErrorEvent: ModelErrorEvent,
): void {
  syncRecordEventWithModelEvent(recordErrorEvent.RecordEvent, modelErrorEvent.ModelEvent);
  recordErrorEvent.Error = modelErrorEvent.Error;
}

export function syncModelEventWithCollectionEvent(modelEvent: ModelEvent, collectionEvent: CollectionEvent): void {
  modelEvent.App = collectionEvent.App;
  modelEvent.Context = collectionEvent.Context;
  modelEvent.Type = collectionEvent.Type;
  modelEvent.Model = collectionEvent.Collection;
}

export function syncCollectionEventWithModelEvent(
  collectionEvent: CollectionEvent,
  modelEvent: ModelEvent,
): void {
  collectionEvent.App = modelEvent.App;
  collectionEvent.Context = modelEvent.Context;
  collectionEvent.Type = modelEvent.Type;
  if (modelEvent.Model && (modelEvent.Model as Collection).TableName) {
    collectionEvent.Collection = modelEvent.Model as Collection;
  }
}

export function newCollectionEventFromModelEvent(
  modelEvent: ModelEvent,
): { event: CollectionEvent | null; ok: boolean } {
  const collection = modelEvent.Model as Collection | null;
  if (!collection || typeof collection.TableName !== "function") {
    return { event: null, ok: false };
  }
  return {
    event: new CollectionEvent(modelEvent.App, collection, modelEvent.Type, modelEvent.Context),
    ok: true,
  };
}

export function newCollectionErrorEventFromModelErrorEvent(
  modelErrorEvent: ModelErrorEvent,
): { event: CollectionErrorEvent | null; ok: boolean } {
  const { event, ok } = newCollectionEventFromModelEvent(modelErrorEvent.ModelEvent);
  if (!ok || !event) {
    return { event: null, ok: false };
  }
  return { event: new CollectionErrorEvent(event, modelErrorEvent.Error), ok: true };
}

export function syncModelErrorEventWithCollectionErrorEvent(
  modelErrorEvent: ModelErrorEvent,
  collectionErrorEvent: CollectionErrorEvent,
): void {
  syncModelEventWithCollectionEvent(modelErrorEvent.ModelEvent, collectionErrorEvent.CollectionEvent);
  modelErrorEvent.Error = collectionErrorEvent.Error;
}

export function syncCollectionErrorEventWithModelErrorEvent(
  collectionErrorEvent: CollectionErrorEvent,
  modelErrorEvent: ModelErrorEvent,
): void {
  syncCollectionEventWithModelEvent(collectionErrorEvent.CollectionEvent, modelErrorEvent.ModelEvent);
  collectionErrorEvent.Error = modelErrorEvent.Error;
}

export function newBaseCollectionEventData(collection: Collection | null): {
  Collection: Collection | null;
  Tags: () => string[];
} {
  const base = new BaseCollectionEventData();
  base.Collection = collection;
  return {
    Collection: collection,
    Tags: () => base.Tags(),
  };
}

export class CollectionsListRequestEvent extends Event {
  RequestEvent: RequestEvent;
  Collections: Collection[];
  Result: SearchResult<unknown> | null;

  constructor(
    requestEvent: RequestEvent,
    collections: Collection[],
    result: SearchResult<unknown> | null,
  ) {
    super();
    this.RequestEvent = requestEvent;
    this.Collections = collections;
    this.Result = result;
  }
}

export class CollectionsImportRequestEvent extends Event {
  RequestEvent: RequestEvent;
  CollectionsData: Array<Record<string, unknown>>;
  DeleteMissing: boolean;

  constructor(
    requestEvent: RequestEvent,
    collectionsData: Array<Record<string, unknown>>,
    deleteMissing: boolean,
  ) {
    super();
    this.RequestEvent = requestEvent;
    this.CollectionsData = collectionsData;
    this.DeleteMissing = deleteMissing;
  }
}

export class CollectionRequestEvent extends Event {
  RequestEvent: RequestEvent;
  Collection: Collection;
  Tags: () => string[];

  constructor(requestEvent: RequestEvent, collection: Collection) {
    super();
    this.RequestEvent = requestEvent;
    this.Collection = collection;
    const base = newBaseCollectionEventData(collection);
    this.Tags = base.Tags;
  }
}
