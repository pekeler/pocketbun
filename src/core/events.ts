// Ported from pocketbase/core/events.go (collection-related events only).

import type { Collection } from "./collection.ts";
import type { RequestEvent } from "./event_request.ts";
import { Event } from "../tools/hook/event.ts";
import type { SearchResult } from "../tools/search/types.ts";

type BaseCollectionEventData = {
  Collection: Collection | null;
  Tags: () => string[];
};

export function newBaseCollectionEventData(collection: Collection | null): BaseCollectionEventData {
  return {
    Collection: collection,
    Tags: () => {
      if (!collection) {
        return [];
      }
      const tags: string[] = [];
      if (collection.id) {
        tags.push(collection.id);
      }
      if (collection.name) {
        tags.push(collection.name);
      }
      return tags;
    },
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
