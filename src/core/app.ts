// Ported from pocketbase/core/app.go

import type { Database, SQLQueryBindings } from "bun:sqlite";
import type { Cron } from "../tools/cron/cron.ts";
import type { System } from "../tools/filesystem/filesystem.ts";
import type { Hook } from "../tools/hook/hook.ts";
import type { TaggedHook } from "../tools/hook/tagged.ts";
import type { Mailer } from "../tools/mailer/mailer.ts";
import type { SqlExpr } from "../tools/search/types.ts";
import type { Broker } from "../tools/subscriptions/broker.ts";
import type { AuthOrigin } from "./auth_origin_model.ts";
import type { Collection } from "./collection.ts";
import type { TableInfoRow } from "./db_table.ts";
import type { RequestInfo } from "./event_request.ts";
import type {
  CollectionRequestEvent,
  CollectionsImportRequestEvent,
  CollectionsListRequestEvent,
  CollectionEvent,
  CollectionErrorEvent,
  MailerEvent,
  MailerRecordEvent,
  ModelErrorEvent,
  ModelEvent,
  RecordAuthRefreshRequestEvent,
  RecordAuthRequestEvent,
  RecordAuthWithOAuth2RequestEvent,
  RecordAuthWithOTPRequestEvent,
  RecordAuthWithPasswordRequestEvent,
  RecordConfirmEmailChangeRequestEvent,
  RecordConfirmPasswordResetRequestEvent,
  RecordConfirmVerificationRequestEvent,
  RecordCreateOTPRequestEvent,
  RecordEnrichEvent,
  RecordErrorEvent,
  RecordEvent,
  RecordRequestEvent,
  RecordRequestEmailChangeRequestEvent,
  RecordRequestPasswordResetRequestEvent,
  RecordRequestVerificationRequestEvent,
  RecordsListRequestEvent,
} from "./events.ts";
import type { ExternalAuth } from "./external_auth_model.ts";
import type { FieldsList } from "./fields_list.ts";
import type { MFA } from "./mfa_model.ts";
import type { OTP } from "./otp_model.ts";
import type { Record as RecordModel } from "./record.ts";
import type { RecordProxy } from "./record_proxy.ts";
import type { RecordQueryFilter } from "./record_query.ts";
import type { RecordQuery } from "./record_query.ts";
import type { ExpandFetchFunc } from "./record_query_expand.ts";
import type { Settings } from "./settings.ts";
import type { Store } from "./store.ts";

export type Logger = {
  Warn: (message: string, ...args: unknown[]) => void;
  Error: (message: string, ...args: unknown[]) => void;
};

export interface App {
  dataDir(): string;
  encryptionEnv(): string;
  settings(): Settings;
  store(): Store<string, unknown>;
  Cron(): Cron;
  IsDev(): boolean;
  SubscriptionsBroker(): Broker;
  isBootstrapped(): boolean;
  bootstrap(): void;
  resetBootstrapState(): void;
  db(): Database;
  auxDb(): Database;
  TxInfo(): { OnComplete: (fn: (txErr: Error | null) => Error | null) => void } | null;
  auxHasTable(name: string): boolean;
  reloadSettings(): void;
  runSystemMigrations(): void;
  runAppMigrations(): void;
  runAllMigrations(): void;
  NewMailClient(): Mailer;
  NewFilesystem(): System;
  Save(model: RecordModel | Collection | RecordProxy): Error | null;
  SaveNoValidate(model: RecordModel | Collection | RecordProxy): Error | null;
  SaveWithContext(ctx: unknown, model: RecordModel | Collection | RecordProxy): Error | null;
  SaveNoValidateWithContext(ctx: unknown, model: RecordModel | Collection | RecordProxy): Error | null;
  Delete(model: RecordModel | Collection | RecordProxy): Error | null;
  DeleteWithContext(ctx: unknown, model: RecordModel | Collection | RecordProxy): Error | null;
  Validate(model: RecordModel | Collection | RecordProxy): Error | null;
  TruncateCollection(collection: Collection): Error | null;
  ImportCollections(toImport: Array<Record<string, unknown>>, deleteMissing: boolean): Error | null;
  RunInTransaction(fn: (txApp: App) => Error | null): Error | null;
  IsTransactional(): boolean;
  UnsafeWithoutHooks(): App;
  Logger(): Logger;
  RecordQuery(collectionModelOrIdentifier: Collection | string | null | undefined): RecordQuery;
  findAuthRecordByToken(token: string, validTypes?: string[]): RecordModel;
  findCollectionById(id: string): Collection | null;
  findCollectionByNameOrId(identifier: string): Collection | null;
  FindAllCollections(...collectionTypes: string[]): Collection[];
  HasTable(name: string): boolean;
  IsCollectionNameUnique(name: string, excludeId?: string): boolean;
  findRecordById(collection: Collection, id: string, rule?: SqlExpr | null): RecordModel | null;
  FindRecordById(
    collectionModelOrIdentifier: Collection | string,
    id: string,
    ...filters: Array<RecordQueryFilter | null | undefined>
  ): RecordModel;
  FindRecordsByIds(
    collectionModelOrIdentifier: Collection | string,
    ids: string[],
    ...filters: Array<RecordQueryFilter | null | undefined>
  ): RecordModel[];
  FindAllRecords(
    collectionModelOrIdentifier: Collection | string,
    ...exprs: Array<SqlExpr | Record<string, unknown> | null | undefined>
  ): RecordModel[];
  FindFirstRecordByData(collectionModelOrIdentifier: Collection | string, key: string, value: unknown): RecordModel;
  FindRecordsByFilter(
    collectionModelOrIdentifier: Collection | string,
    filter: string,
    sort: string,
    limit: number,
    offset: number,
    ...params: Array<Record<string, unknown>>
  ): RecordModel[];
  FindFirstRecordByFilter(
    collectionModelOrIdentifier: Collection | string,
    filter: string,
    ...params: Array<Record<string, unknown>>
  ): RecordModel;
  CountRecords(
    collectionModelOrIdentifier: Collection | string,
    ...exprs: Array<SqlExpr | Record<string, unknown> | null | undefined>
  ): number;
  ExpandRecord(record: RecordModel, expands: string[], optFetchFunc?: ExpandFetchFunc | null): Record<string, Error>;
  ExpandRecords(records: RecordModel[], expands: string[], optFetchFunc?: ExpandFetchFunc | null): Record<string, Error>;
  CanAccessRecord(record: RecordModel, requestInfo: RequestInfo, accessRule: string | null): [boolean, Error | null];
  FindAuthRecordByToken(token: string, ...validTypes: string[]): RecordModel;
  FindAuthRecordByEmail(collectionModelOrIdentifier: Collection | string, email: string): RecordModel;
  FindAllExternalAuthsByRecord(authRecord: RecordModel): ExternalAuth[];
  FindAllExternalAuthsByCollection(collection: Collection): ExternalAuth[];
  FindFirstExternalAuthByExpr(expr: SqlExpr | Record<string, unknown>): ExternalAuth;
  FindAllOTPsByRecord(authRecord: RecordModel): OTP[];
  FindAllOTPsByCollection(collection: Collection): OTP[];
  FindOTPById(id: string): OTP;
  DeleteAllOTPsByRecord(authRecord: RecordModel): Error | null;
  DeleteExpiredOTPs(): Error | null;
  FindAllMFAsByRecord(authRecord: RecordModel): MFA[];
  FindAllMFAsByCollection(collection: Collection): MFA[];
  FindMFAById(id: string): MFA;
  DeleteAllMFAsByRecord(authRecord: RecordModel): Error | null;
  DeleteExpiredMFAs(): Error | null;
  FindAllAuthOriginsByRecord(authRecord: RecordModel): AuthOrigin[];
  FindAllAuthOriginsByCollection(collection: Collection): AuthOrigin[];
  FindAuthOriginById(id: string): AuthOrigin;
  FindAuthOriginByRecordAndFingerprint(authRecord: RecordModel, fingerprint: string): AuthOrigin;
  DeleteAllAuthOriginsByRecord(authRecord: RecordModel): Error | null;
  findFirstRecordByFilter(
    collectionOrIdentifier: Collection | string,
    filter: string,
    ...params: SQLQueryBindings[]
  ): RecordModel | null;
  OnCollectionsListRequest(): Hook<CollectionsListRequestEvent>;
  OnCollectionViewRequest(): Hook<CollectionRequestEvent>;
  OnCollectionCreateRequest(): Hook<CollectionRequestEvent>;
  OnCollectionUpdateRequest(): Hook<CollectionRequestEvent>;
  OnCollectionDeleteRequest(): Hook<CollectionRequestEvent>;
  OnCollectionsImportRequest(): Hook<CollectionsImportRequestEvent>;

  OnModelCreate(tags?: string[]): TaggedHook<ModelEvent>;
  OnModelCreateExecute(tags?: string[]): TaggedHook<ModelEvent>;
  OnModelAfterCreateSuccess(tags?: string[]): TaggedHook<ModelEvent>;
  OnModelAfterCreateError(tags?: string[]): TaggedHook<ModelErrorEvent>;
  OnModelUpdate(tags?: string[]): TaggedHook<ModelEvent>;
  OnModelUpdateExecute(tags?: string[]): TaggedHook<ModelEvent>;
  OnModelAfterUpdateSuccess(tags?: string[]): TaggedHook<ModelEvent>;
  OnModelAfterUpdateError(tags?: string[]): TaggedHook<ModelErrorEvent>;
  OnModelValidate(tags?: string[]): TaggedHook<ModelEvent>;
  OnModelDelete(tags?: string[]): TaggedHook<ModelEvent>;
  OnModelDeleteExecute(tags?: string[]): TaggedHook<ModelEvent>;
  OnModelAfterDeleteSuccess(tags?: string[]): TaggedHook<ModelEvent>;
  OnModelAfterDeleteError(tags?: string[]): TaggedHook<ModelErrorEvent>;

  OnRecordValidate(tags?: string[]): TaggedHook<RecordEvent>;
  OnRecordCreate(tags?: string[]): TaggedHook<RecordEvent>;
  OnRecordCreateExecute(tags?: string[]): TaggedHook<RecordEvent>;
  OnRecordAfterCreateSuccess(tags?: string[]): TaggedHook<RecordEvent>;
  OnRecordAfterCreateError(tags?: string[]): TaggedHook<RecordErrorEvent>;
  OnRecordUpdate(tags?: string[]): TaggedHook<RecordEvent>;
  OnRecordUpdateExecute(tags?: string[]): TaggedHook<RecordEvent>;
  OnRecordAfterUpdateSuccess(tags?: string[]): TaggedHook<RecordEvent>;
  OnRecordAfterUpdateError(tags?: string[]): TaggedHook<RecordErrorEvent>;
  OnRecordDelete(tags?: string[]): TaggedHook<RecordEvent>;
  OnRecordDeleteExecute(tags?: string[]): TaggedHook<RecordEvent>;
  OnRecordAfterDeleteSuccess(tags?: string[]): TaggedHook<RecordEvent>;
  OnRecordAfterDeleteError(tags?: string[]): TaggedHook<RecordErrorEvent>;
  OnRecordEnrich(tags?: string[]): TaggedHook<RecordEnrichEvent>;
  OnRecordAuthWithPasswordRequest(tags?: string[]): TaggedHook<RecordAuthWithPasswordRequestEvent>;
  OnRecordAuthWithOAuth2Request(tags?: string[]): TaggedHook<RecordAuthWithOAuth2RequestEvent>;
  OnRecordAuthWithOTPRequest(tags?: string[]): TaggedHook<RecordAuthWithOTPRequestEvent>;
  OnRecordsListRequest(tags?: string[]): TaggedHook<RecordsListRequestEvent>;
  OnRecordViewRequest(tags?: string[]): TaggedHook<RecordRequestEvent>;
  OnRecordCreateRequest(tags?: string[]): TaggedHook<RecordRequestEvent>;
  OnRecordUpdateRequest(tags?: string[]): TaggedHook<RecordRequestEvent>;
  OnRecordDeleteRequest(tags?: string[]): TaggedHook<RecordRequestEvent>;
  OnRecordAuthRequest(tags?: string[]): TaggedHook<RecordAuthRequestEvent>;
  OnRecordAuthRefreshRequest(tags?: string[]): TaggedHook<RecordAuthRefreshRequestEvent>;
  OnRecordCreateOTPRequest(tags?: string[]): TaggedHook<RecordCreateOTPRequestEvent>;
  OnRecordRequestPasswordResetRequest(tags?: string[]): TaggedHook<RecordRequestPasswordResetRequestEvent>;
  OnRecordConfirmPasswordResetRequest(tags?: string[]): TaggedHook<RecordConfirmPasswordResetRequestEvent>;
  OnRecordRequestVerificationRequest(tags?: string[]): TaggedHook<RecordRequestVerificationRequestEvent>;
  OnRecordConfirmVerificationRequest(tags?: string[]): TaggedHook<RecordConfirmVerificationRequestEvent>;
  OnRecordRequestEmailChangeRequest(tags?: string[]): TaggedHook<RecordRequestEmailChangeRequestEvent>;
  OnRecordConfirmEmailChangeRequest(tags?: string[]): TaggedHook<RecordConfirmEmailChangeRequestEvent>;

  OnMailerSend(): Hook<MailerEvent>;
  OnMailerRecordAuthAlertSend(tags?: string[]): TaggedHook<MailerRecordEvent>;
  OnMailerRecordPasswordResetSend(tags?: string[]): TaggedHook<MailerRecordEvent>;
  OnMailerRecordVerificationSend(tags?: string[]): TaggedHook<MailerRecordEvent>;
  OnMailerRecordEmailChangeSend(tags?: string[]): TaggedHook<MailerRecordEvent>;
  OnMailerRecordOTPSend(tags?: string[]): TaggedHook<MailerRecordEvent>;

  OnCollectionValidate(tags?: string[]): TaggedHook<CollectionEvent>;
  OnCollectionCreate(tags?: string[]): TaggedHook<CollectionEvent>;
  OnCollectionCreateExecute(tags?: string[]): TaggedHook<CollectionEvent>;
  OnCollectionAfterCreateSuccess(tags?: string[]): TaggedHook<CollectionEvent>;
  OnCollectionAfterCreateError(tags?: string[]): TaggedHook<CollectionErrorEvent>;
  OnCollectionUpdate(tags?: string[]): TaggedHook<CollectionEvent>;
  OnCollectionUpdateExecute(tags?: string[]): TaggedHook<CollectionEvent>;
  OnCollectionAfterUpdateSuccess(tags?: string[]): TaggedHook<CollectionEvent>;
  OnCollectionAfterUpdateError(tags?: string[]): TaggedHook<CollectionErrorEvent>;
  OnCollectionDelete(tags?: string[]): TaggedHook<CollectionEvent>;
  OnCollectionDeleteExecute(tags?: string[]): TaggedHook<CollectionEvent>;
  OnCollectionAfterDeleteSuccess(tags?: string[]): TaggedHook<CollectionEvent>;
  OnCollectionAfterDeleteError(tags?: string[]): TaggedHook<CollectionErrorEvent>;

  SaveView(name: string, selectQuery: string): Error | null;
  DeleteView(name: string): Error | null;
  CreateViewFields(selectQuery: string): FieldsList;
  TableInfo(tableName: string): TableInfoRow[];
}
