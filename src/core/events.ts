// Ported from pocketbase/core/events.go (partial: app + model/record/collection + collection request + realtime + file events).

import type { Mailer, Message } from "../tools/mailer/mailer.ts";
import type { ApiError } from "../tools/router/api_error.ts";
import type { Router } from "../tools/router/router.ts";
import type { SearchResult } from "../tools/search/types.ts";
import type { Client as RealtimeClient } from "../tools/subscriptions/client.ts";
import type { Message as RealtimeMessage } from "../tools/subscriptions/message.ts";
import type { App } from "./app.ts";
import type { Model as DbModel } from "./db_model.ts";
import type { RequestEvent } from "./event_request.ts";
import type { RequestInfo } from "./event_request.ts";
import type { FileField } from "./field_file.ts";
import type { Record as RecordModel } from "./record_model.ts";
import type { RecordProxy } from "./record_proxy.ts";
import type { Settings } from "./settings_model.ts";
import { Event } from "../tools/hook/event.ts";
import { Collection } from "./collection_model.ts";

export type HookTagger = {
  HookTags(): string[];
};

type Model = DbModel;

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

function syncStopSignal(target: Event, requestEvent: RequestEvent): void {
  const stopSignal = requestEvent.getStopSignal();
  if (stopSignal) {
    target.setStopSignal(stopSignal);
  }
}

export class BootstrapEvent extends Event {
  App: App;

  constructor(app: App) {
    super();
    this.App = app;
  }
}

export class TerminateEvent extends Event {
  App: App;
  IsRestart: boolean;

  constructor(app: App, isRestart = false) {
    super();
    this.App = app;
    this.IsRestart = isRestart;
  }
}

export class BackupEvent extends Event {
  App: App;
  Context: unknown;
  Name: string; // the name of the backup to create/restore.
  Exclude: string[]; // list of dir entries to exclude from the backup create/restore.

  constructor(app: App, ctx: unknown, name: string, exclude: string[]) {
    super();
    this.App = app;
    this.Context = ctx;
    this.Name = name;
    this.Exclude = exclude;
  }
}

export type ServeInstallerFunc = (
  app: App,
  systemSuperuser: RecordModel,
  baseURL: string,
) => Error | null | Promise<Error | null>;

export type UIExtension = {
  // Name is the name of the extension.
  // It is also used as the public path segment under /_/extensions/{name}/...
  Name: string;
  // Deviation: PocketBun models fs.FS-style roots as filesystem path wrappers.
  FS: string | { root: string };
};

export class ServeEvent extends Event {
  App: App;
  Router: Router<RequestEvent>;
  Server: ReturnType<typeof Bun.serve> | null = null;
  CertManager: unknown = null;
  Listener: unknown = null;
  InstallerFunc: ServeInstallerFunc | null = null;
  // @todo experimental
  UIExtensions: UIExtension[] = [];

  constructor(app: App, router: Router<RequestEvent>) {
    super();
    this.App = app;
    this.Router = router;
  }
}

export class SettingsReloadEvent extends Event {
  App: App;

  constructor(app: App) {
    super();
    this.App = app;
  }
}

export class SettingsListRequestEvent extends Event {
  RequestEvent: RequestEvent;
  Settings: Settings;

  get App(): App {
    return this.RequestEvent.app;
  }

  set App(app: App) {
    this.RequestEvent.app = app;
  }

  constructor(requestEvent: RequestEvent, settings: Settings) {
    super();
    this.RequestEvent = requestEvent;
    this.Settings = settings;
    syncStopSignal(this, requestEvent);
  }
}

export class SettingsUpdateRequestEvent extends Event {
  RequestEvent: RequestEvent;
  OldSettings: Settings;
  NewSettings: Settings;

  get App(): App {
    return this.RequestEvent.app;
  }

  set App(app: App) {
    this.RequestEvent.app = app;
  }

  constructor(requestEvent: RequestEvent, oldSettings: Settings, newSettings: Settings) {
    super();
    this.RequestEvent = requestEvent;
    this.OldSettings = oldSettings;
    this.NewSettings = newSettings;
    syncStopSignal(this, requestEvent);
  }
}

export class MailerEvent extends Event {
  App: App;
  Mailer: Mailer;
  Message: Message;

  constructor(app: App, mailer: Mailer, message: Message) {
    super();
    this.App = app;
    this.Mailer = mailer;
    this.Message = message;
  }
}

export class MailerRecordEvent extends Event {
  App: App;
  Mailer: Mailer;
  Message: Message;
  Record: RecordModel | null;
  Meta: Record<string, unknown> | null;
  #base: BaseRecordEventData;

  constructor(app: App, mailer: Mailer, message: Message, record: RecordModel | null, meta: Record<string, unknown> | null) {
    super();
    this.App = app;
    this.Mailer = mailer;
    this.Message = message;
    this.Record = record;
    this.Meta = meta;
    this.#base = new BaseRecordEventData();
    this.#base.Record = record;
  }

  Tags(): string[] {
    return this.#base.Tags();
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
  // PocketBun-only internal marker used by the model->record bridge to
  // allow async-only validators in async validation pipelines.
  AllowAsync = false;
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

  get App(): App {
    return this.ModelEvent.App;
  }

  set App(app: App) {
    this.ModelEvent.App = app;
  }

  get Context(): unknown {
    return this.ModelEvent.Context;
  }

  set Context(context: unknown) {
    this.ModelEvent.Context = context;
  }

  get Type(): string {
    return this.ModelEvent.Type;
  }

  set Type(type: string) {
    this.ModelEvent.Type = type;
  }

  get Model(): Model | null {
    return this.ModelEvent.Model;
  }

  set Model(model: Model | null) {
    this.ModelEvent.Model = model;
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
  // PocketBun-only internal marker copied from ModelEvent.AllowAsync.
  AllowAsync = false;
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

  get App(): App {
    return this.RecordEvent.App;
  }

  set App(app: App) {
    this.RecordEvent.App = app;
  }

  get Context(): unknown {
    return this.RecordEvent.Context;
  }

  set Context(context: unknown) {
    this.RecordEvent.Context = context;
  }

  get Type(): string {
    return this.RecordEvent.Type;
  }

  set Type(type: string) {
    this.RecordEvent.Type = type;
  }

  get Record(): RecordModel | null {
    return this.RecordEvent.Record;
  }

  set Record(record: RecordModel | null) {
    this.RecordEvent.Record = record;
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

  get App(): App {
    return this.CollectionEvent.App;
  }

  set App(app: App) {
    this.CollectionEvent.App = app;
  }

  get Context(): unknown {
    return this.CollectionEvent.Context;
  }

  set Context(context: unknown) {
    this.CollectionEvent.Context = context;
  }

  get Type(): string {
    return this.CollectionEvent.Type;
  }

  set Type(type: string) {
    this.CollectionEvent.Type = type;
  }

  get Collection(): Collection | null {
    return this.CollectionEvent.Collection;
  }

  set Collection(collection: Collection | null) {
    this.CollectionEvent.Collection = collection;
  }

  Tags(): string[] {
    return this.CollectionEvent.Tags();
  }
}

export function syncModelEventWithRecordEvent(modelEvent: ModelEvent, recordEvent: RecordEvent): void {
  modelEvent.App = recordEvent.App;
  modelEvent.Context = recordEvent.Context;
  modelEvent.Type = recordEvent.Type;
  modelEvent.AllowAsync = recordEvent.AllowAsync;
}

export function syncRecordEventWithModelEvent(recordEvent: RecordEvent, modelEvent: ModelEvent): void {
  recordEvent.App = modelEvent.App;
  recordEvent.Context = modelEvent.Context;
  recordEvent.Type = modelEvent.Type;
  recordEvent.AllowAsync = modelEvent.AllowAsync;
}

export function newRecordEventFromModelEvent(modelEvent: ModelEvent): {
  event: RecordEvent | null;
  ok: boolean;
} {
  const model = modelEvent.Model;
  let record: RecordModel | null = null;
  if (model && typeof (model as RecordModel).collection === "function") {
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
    event: Object.assign(new RecordEvent(modelEvent.App, record, modelEvent.Type, modelEvent.Context), {
      AllowAsync: modelEvent.AllowAsync,
    }),
    ok: true,
  };
}

export function newRecordErrorEventFromModelErrorEvent(modelErrorEvent: ModelErrorEvent): {
  event: RecordErrorEvent | null;
  ok: boolean;
} {
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

export function syncCollectionEventWithModelEvent(collectionEvent: CollectionEvent, modelEvent: ModelEvent): void {
  collectionEvent.App = modelEvent.App;
  collectionEvent.Context = modelEvent.Context;
  collectionEvent.Type = modelEvent.Type;
  if (modelEvent.Model instanceof Collection) {
    collectionEvent.Collection = modelEvent.Model as Collection;
  }
}

export function newCollectionEventFromModelEvent(modelEvent: ModelEvent): {
  event: CollectionEvent | null;
  ok: boolean;
} {
  const collection = modelEvent.Model instanceof Collection ? modelEvent.Model : null;
  if (!collection) {
    return { event: null, ok: false };
  }
  return {
    event: new CollectionEvent(modelEvent.App, collection, modelEvent.Type, modelEvent.Context),
    ok: true,
  };
}

export function newCollectionErrorEventFromModelErrorEvent(modelErrorEvent: ModelErrorEvent): {
  event: CollectionErrorEvent | null;
  ok: boolean;
} {
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

// -------------------------------------------------------------------
// File API events data
// -------------------------------------------------------------------

export class FileTokenRequestEvent extends Event {
  RequestEvent: RequestEvent;
  Record: RecordModel | null;
  Token: string;
  Tags: () => string[];

  get App(): App {
    return this.RequestEvent.app;
  }

  set App(app: App) {
    this.RequestEvent.app = app;
  }

  constructor(requestEvent: RequestEvent, record: RecordModel | null) {
    super();
    this.RequestEvent = requestEvent;
    this.Record = record;
    this.Token = "";
    const base = new BaseRecordEventData();
    base.Record = record;
    this.Tags = () => base.Tags();
    syncStopSignal(this, requestEvent);
  }
}

export class FileDownloadRequestEvent extends Event {
  RequestEvent: RequestEvent;
  Collection: Collection;
  Record: RecordModel;
  FileField: FileField;
  ServedPath: string;
  ServedName: string;
  ThumbError: Error | null;
  Tags: () => string[];

  get App(): App {
    return this.RequestEvent.app;
  }

  set App(app: App) {
    this.RequestEvent.app = app;
  }

  constructor(
    requestEvent: RequestEvent,
    collection: Collection,
    record: RecordModel,
    fileField: FileField,
    servedPath: string,
    servedName: string,
  ) {
    super();
    this.RequestEvent = requestEvent;
    this.Collection = collection;
    this.Record = record;
    this.FileField = fileField;
    this.ServedPath = servedPath;
    this.ServedName = servedName;
    this.ThumbError = null;
    const base = newBaseCollectionEventData(collection);
    this.Tags = base.Tags;
    syncStopSignal(this, requestEvent);
  }
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

  get App(): App {
    return this.RequestEvent.app;
  }

  set App(app: App) {
    this.RequestEvent.app = app;
  }

  constructor(requestEvent: RequestEvent, collections: Collection[], result: SearchResult<unknown> | null) {
    super();
    this.RequestEvent = requestEvent;
    this.Collections = collections;
    this.Result = result;
    syncStopSignal(this, requestEvent);
  }
}

export class CollectionsImportRequestEvent extends Event {
  RequestEvent: RequestEvent;
  CollectionsData: Array<Record<string, unknown>>;
  DeleteMissing: boolean;

  get App(): App {
    return this.RequestEvent.app;
  }

  set App(app: App) {
    this.RequestEvent.app = app;
  }

  constructor(requestEvent: RequestEvent, collectionsData: Array<Record<string, unknown>>, deleteMissing: boolean) {
    super();
    this.RequestEvent = requestEvent;
    this.CollectionsData = collectionsData;
    this.DeleteMissing = deleteMissing;
    syncStopSignal(this, requestEvent);
  }
}

export class CollectionRequestEvent extends Event {
  RequestEvent: RequestEvent;
  Collection: Collection;
  Tags: () => string[];

  get App(): App {
    return this.RequestEvent.app;
  }

  set App(app: App) {
    this.RequestEvent.app = app;
  }

  constructor(requestEvent: RequestEvent, collection: Collection) {
    super();
    this.RequestEvent = requestEvent;
    this.Collection = collection;
    const base = newBaseCollectionEventData(collection);
    this.Tags = base.Tags;
    syncStopSignal(this, requestEvent);
  }
}

// -------------------------------------------------------------------
// Realtime API events data
// -------------------------------------------------------------------

export class RealtimeConnectRequestEvent extends Event {
  RequestEvent: RequestEvent;
  Client: RealtimeClient | null;
  IdleTimeout: number;

  get App(): App {
    return this.RequestEvent.app;
  }

  set App(app: App) {
    this.RequestEvent.app = app;
  }

  constructor(requestEvent: RequestEvent) {
    super();
    this.RequestEvent = requestEvent;
    this.Client = null;
    this.IdleTimeout = 0;
    syncStopSignal(this, requestEvent);
  }
}

export class RealtimeMessageEvent extends Event {
  RequestEvent: RequestEvent;
  Client: RealtimeClient | null;
  Message: RealtimeMessage | null;

  get App(): App {
    return this.RequestEvent.app;
  }

  set App(app: App) {
    this.RequestEvent.app = app;
  }

  constructor(requestEvent: RequestEvent) {
    super();
    this.RequestEvent = requestEvent;
    this.Client = null;
    this.Message = null;
    syncStopSignal(this, requestEvent);
  }
}

export class RealtimeSubscribeRequestEvent extends Event {
  RequestEvent: RequestEvent;
  Client: RealtimeClient | null;
  Subscriptions: string[];

  get App(): App {
    return this.RequestEvent.app;
  }

  set App(app: App) {
    this.RequestEvent.app = app;
  }

  constructor(requestEvent: RequestEvent) {
    super();
    this.RequestEvent = requestEvent;
    this.Client = null;
    this.Subscriptions = [];
    syncStopSignal(this, requestEvent);
  }
}

export class RecordsListRequestEvent extends Event {
  RequestEvent: RequestEvent;
  Collection: Collection;
  Records: RecordModel[];
  Result: SearchResult<RecordModel> | null;
  Tags: () => string[];

  get App(): App {
    return this.RequestEvent.app;
  }

  set App(app: App) {
    this.RequestEvent.app = app;
  }

  BadRequestError(message: string, errData: unknown = null): ApiError {
    return this.RequestEvent.BadRequestError(message, errData);
  }

  constructor(requestEvent: RequestEvent, collection: Collection) {
    super();
    this.RequestEvent = requestEvent;
    this.Collection = collection;
    this.Records = [];
    this.Result = null;
    const base = newBaseCollectionEventData(collection);
    this.Tags = base.Tags;
    syncStopSignal(this, requestEvent);
  }
}

export class RecordRequestEvent extends Event {
  RequestEvent: RequestEvent;
  Collection: Collection;
  Record: RecordModel | null;
  Tags: () => string[];

  get App(): App {
    return this.RequestEvent.app;
  }

  set App(app: App) {
    this.RequestEvent.app = app;
  }

  BadRequestError(message: string, errData: unknown = null): ApiError {
    return this.RequestEvent.BadRequestError(message, errData);
  }

  constructor(requestEvent: RequestEvent, collection: Collection, record: RecordModel | null) {
    super();
    this.RequestEvent = requestEvent;
    this.Collection = collection;
    this.Record = record;
    const base = newBaseCollectionEventData(collection);
    this.Tags = base.Tags;
    syncStopSignal(this, requestEvent);
  }
}

export class RecordEnrichEvent extends Event {
  App: App;
  RequestInfo: RequestInfo | null;
  Record: RecordModel | null;
  #base: BaseRecordEventData;

  constructor(app: App, requestInfo: RequestInfo | null, record: RecordModel | null) {
    super();
    this.App = app;
    this.RequestInfo = requestInfo;
    this.Record = record;
    this.#base = new BaseRecordEventData();
    this.#base.Record = record;
  }

  Tags(): string[] {
    return this.#base.Tags();
  }
}

export class RecordCreateOTPRequestEvent extends Event {
  RequestEvent: RequestEvent;
  Collection: Collection;
  Record: RecordModel | null;
  Password: string;
  Tags: () => string[];

  get App(): App {
    return this.RequestEvent.app;
  }

  set App(app: App) {
    this.RequestEvent.app = app;
  }

  constructor(requestEvent: RequestEvent, collection: Collection, record: RecordModel | null) {
    super();
    this.RequestEvent = requestEvent;
    this.Collection = collection;
    this.Record = record;
    this.Password = "";
    const base = newBaseCollectionEventData(collection);
    this.Tags = base.Tags;
    syncStopSignal(this, requestEvent);
  }
}

export class RecordAuthWithOTPRequestEvent extends Event {
  RequestEvent: RequestEvent;
  Collection: Collection;
  Record: RecordModel | null;
  OTP: unknown;
  Tags: () => string[];

  get App(): App {
    return this.RequestEvent.app;
  }

  set App(app: App) {
    this.RequestEvent.app = app;
  }

  constructor(requestEvent: RequestEvent, collection: Collection, record: RecordModel | null) {
    super();
    this.RequestEvent = requestEvent;
    this.Collection = collection;
    this.Record = record;
    this.OTP = null;
    const base = newBaseCollectionEventData(collection);
    this.Tags = base.Tags;
    syncStopSignal(this, requestEvent);
  }
}

export class RecordAuthRequestEvent extends Event {
  RequestEvent: RequestEvent;
  Collection: Collection;
  Record: RecordModel | null;
  Token: string;
  Meta: unknown;
  AuthMethod: string;
  Tags: () => string[];

  get App(): App {
    return this.RequestEvent.app;
  }

  set App(app: App) {
    this.RequestEvent.app = app;
  }

  constructor(requestEvent: RequestEvent, collection: Collection, record: RecordModel | null) {
    super();
    this.RequestEvent = requestEvent;
    this.Collection = collection;
    this.Record = record;
    this.Token = "";
    this.Meta = null;
    this.AuthMethod = "";
    const base = newBaseCollectionEventData(collection);
    this.Tags = base.Tags;
    syncStopSignal(this, requestEvent);
  }
}

export class RecordAuthWithPasswordRequestEvent extends Event {
  RequestEvent: RequestEvent;
  Collection: Collection;
  Record: RecordModel | null;
  Identity: string;
  IdentityField: string;
  Password: string;
  Tags: () => string[];

  get App(): App {
    return this.RequestEvent.app;
  }

  set App(app: App) {
    this.RequestEvent.app = app;
  }

  constructor(requestEvent: RequestEvent, collection: Collection, record: RecordModel | null) {
    super();
    this.RequestEvent = requestEvent;
    this.Collection = collection;
    this.Record = record;
    this.Identity = "";
    this.IdentityField = "";
    this.Password = "";
    const base = newBaseCollectionEventData(collection);
    this.Tags = base.Tags;
    syncStopSignal(this, requestEvent);
  }
}

export class RecordAuthWithOAuth2RequestEvent extends Event {
  RequestEvent: RequestEvent;
  Collection: Collection;
  ProviderName: string;
  ProviderClient: unknown;
  Record: RecordModel | null;
  OAuth2User: unknown;
  CreateData: Record<string, unknown>;
  IsNewRecord: boolean;
  Tags: () => string[];

  get App(): App {
    return this.RequestEvent.app;
  }

  set App(app: App) {
    this.RequestEvent.app = app;
  }

  constructor(requestEvent: RequestEvent, collection: Collection, record: RecordModel | null) {
    super();
    this.RequestEvent = requestEvent;
    this.Collection = collection;
    this.ProviderName = "";
    this.ProviderClient = null;
    this.Record = record;
    this.OAuth2User = null;
    this.CreateData = {};
    this.IsNewRecord = false;
    const base = newBaseCollectionEventData(collection);
    this.Tags = base.Tags;
    syncStopSignal(this, requestEvent);
  }
}

export class RecordAuthRefreshRequestEvent extends Event {
  RequestEvent: RequestEvent;
  Collection: Collection;
  Record: RecordModel | null;
  Tags: () => string[];

  get App(): App {
    return this.RequestEvent.app;
  }

  set App(app: App) {
    this.RequestEvent.app = app;
  }

  constructor(requestEvent: RequestEvent, collection: Collection, record: RecordModel | null) {
    super();
    this.RequestEvent = requestEvent;
    this.Collection = collection;
    this.Record = record;
    const base = newBaseCollectionEventData(collection);
    this.Tags = base.Tags;
    syncStopSignal(this, requestEvent);
  }
}

export class RecordRequestPasswordResetRequestEvent extends Event {
  RequestEvent: RequestEvent;
  Collection: Collection;
  Record: RecordModel | null;
  Tags: () => string[];

  get App(): App {
    return this.RequestEvent.app;
  }

  set App(app: App) {
    this.RequestEvent.app = app;
  }

  constructor(requestEvent: RequestEvent, collection: Collection, record: RecordModel | null) {
    super();
    this.RequestEvent = requestEvent;
    this.Collection = collection;
    this.Record = record;
    const base = newBaseCollectionEventData(collection);
    this.Tags = base.Tags;
    syncStopSignal(this, requestEvent);
  }
}

export class RecordConfirmPasswordResetRequestEvent extends Event {
  RequestEvent: RequestEvent;
  Collection: Collection;
  Record: RecordModel | null;
  Tags: () => string[];

  get App(): App {
    return this.RequestEvent.app;
  }

  set App(app: App) {
    this.RequestEvent.app = app;
  }

  constructor(requestEvent: RequestEvent, collection: Collection, record: RecordModel | null) {
    super();
    this.RequestEvent = requestEvent;
    this.Collection = collection;
    this.Record = record;
    const base = newBaseCollectionEventData(collection);
    this.Tags = base.Tags;
    syncStopSignal(this, requestEvent);
  }
}

export class RecordRequestVerificationRequestEvent extends Event {
  RequestEvent: RequestEvent;
  Collection: Collection;
  Record: RecordModel | null;
  Tags: () => string[];

  get App(): App {
    return this.RequestEvent.app;
  }

  set App(app: App) {
    this.RequestEvent.app = app;
  }

  constructor(requestEvent: RequestEvent, collection: Collection, record: RecordModel | null) {
    super();
    this.RequestEvent = requestEvent;
    this.Collection = collection;
    this.Record = record;
    const base = newBaseCollectionEventData(collection);
    this.Tags = base.Tags;
    syncStopSignal(this, requestEvent);
  }
}

export class RecordConfirmVerificationRequestEvent extends Event {
  RequestEvent: RequestEvent;
  Collection: Collection;
  Record: RecordModel | null;
  Tags: () => string[];

  get App(): App {
    return this.RequestEvent.app;
  }

  set App(app: App) {
    this.RequestEvent.app = app;
  }

  constructor(requestEvent: RequestEvent, collection: Collection, record: RecordModel | null) {
    super();
    this.RequestEvent = requestEvent;
    this.Collection = collection;
    this.Record = record;
    const base = newBaseCollectionEventData(collection);
    this.Tags = base.Tags;
    syncStopSignal(this, requestEvent);
  }
}

export class RecordRequestEmailChangeRequestEvent extends Event {
  RequestEvent: RequestEvent;
  Collection: Collection;
  Record: RecordModel | null;
  NewEmail: string;
  Tags: () => string[];

  get App(): App {
    return this.RequestEvent.app;
  }

  set App(app: App) {
    this.RequestEvent.app = app;
  }

  constructor(requestEvent: RequestEvent, collection: Collection, record: RecordModel | null) {
    super();
    this.RequestEvent = requestEvent;
    this.Collection = collection;
    this.Record = record;
    this.NewEmail = "";
    const base = newBaseCollectionEventData(collection);
    this.Tags = base.Tags;
    syncStopSignal(this, requestEvent);
  }
}

export class RecordConfirmEmailChangeRequestEvent extends Event {
  RequestEvent: RequestEvent;
  Collection: Collection;
  Record: RecordModel | null;
  NewEmail: string;
  Tags: () => string[];

  get App(): App {
    return this.RequestEvent.app;
  }

  set App(app: App) {
    this.RequestEvent.app = app;
  }

  constructor(requestEvent: RequestEvent, collection: Collection, record: RecordModel | null) {
    super();
    this.RequestEvent = requestEvent;
    this.Collection = collection;
    this.Record = record;
    this.NewEmail = "";
    const base = newBaseCollectionEventData(collection);
    this.Tags = base.Tags;
    syncStopSignal(this, requestEvent);
  }
}
