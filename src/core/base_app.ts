// Ported from pocketbase/core/base.go.
// Includes backup-related methods from pocketbase/core/base_backup.go (merged to keep BaseApp in one file).

import "../migrations/index.ts";
import "./fields_register.ts";
import type { Database, SQLQueryBindings } from "bun:sqlite";
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { SqlExpr } from "../tools/search/types.ts";
import type { App, Logger } from "./app.ts";
import type { PostValidator, PreValidator } from "./db.ts";
import type { Model } from "./db_model.ts";
import type { RequestInfo } from "./event_request.ts";
import type { BatchRequestEvent } from "./event_request_batch.ts";
import type { RecordProxy } from "./record_proxy.ts";
import { ValidationErrors, newError, required } from "../internal/compat/validation.ts";
import { Create, Extract } from "../tools/archive/index.ts";
import { Providers } from "../tools/auth/auth.ts";
import { Cron } from "../tools/cron/cron.ts";
import { findSingleColumnUniqueIndex, parseIndex } from "../tools/dbutils/index.ts";
import { JSONEach } from "../tools/dbutils/json.ts";
import { DbxDatabase } from "../tools/dbx/database.ts";
import { HashExp, NewExp, Not } from "../tools/dbx/expr.ts";
import { SelectQuery } from "../tools/dbx/select_query.ts";
import { NewFileFromPath } from "../tools/filesystem/file.ts";
import { NewLocal, NewS3 } from "../tools/filesystem/filesystem.ts";
import { Hook } from "../tools/hook/hook.ts";
import { NewTaggedHook } from "../tools/hook/tagged.ts";
import { columnify, snakecase } from "../tools/inflector/inflector.ts";
import { Sendmail } from "../tools/mailer/sendmail.ts";
import { SMTPClient } from "../tools/mailer/smtp.ts";
import { MoveDirContent } from "../tools/osutils/dir.ts";
import { buildFilterExpr } from "../tools/search/filter.ts";
import { buildSortExpr, parseSortFromString } from "../tools/search/sort.ts";
import { DefaultFilterExprLimit } from "../tools/search/types.ts";
import { decrypt, encrypt } from "../tools/security/encrypt.ts";
import { parseJWT, parseUnverifiedJWT } from "../tools/security/jwt.ts";
import { pseudorandomString, randomString } from "../tools/security/random.ts";
import { Broker } from "../tools/subscriptions/broker.ts";
import { DateTime, GeoPoint, JSONRaw, NowDateTime, ParseDateTime } from "../tools/types/index.ts";
import { AuthOrigin, CollectionNameAuthOrigins, recordRefHooks } from "./auth_origin_model.ts";
import { Collection, CollectionTypeAuth, collectionFromRow, parseCollectionFields, type CollectionRow } from "./collection.ts";
import { validateCollection } from "./collection_validate.ts";
import { TableInfo, TableIndexes } from "./db_table.ts";
import {
  BackupEvent,
  BootstrapEvent,
  ServeEvent,
  TerminateEvent,
  SettingsListRequestEvent,
  SettingsReloadEvent,
  SettingsUpdateRequestEvent,
  type CollectionErrorEvent,
  type CollectionEvent,
  type CollectionRequestEvent,
  type CollectionsImportRequestEvent,
  type CollectionsListRequestEvent,
  type FileDownloadRequestEvent,
  type FileTokenRequestEvent,
  type MailerRecordEvent,
  type RealtimeConnectRequestEvent,
  type RealtimeMessageEvent,
  type RealtimeSubscribeRequestEvent,
  type RecordAuthRefreshRequestEvent,
  type RecordAuthRequestEvent,
  type RecordAuthWithOAuth2RequestEvent,
  type RecordAuthWithOTPRequestEvent,
  type RecordAuthWithPasswordRequestEvent,
  type RecordConfirmEmailChangeRequestEvent,
  type RecordConfirmPasswordResetRequestEvent,
  type RecordConfirmVerificationRequestEvent,
  type RecordCreateOTPRequestEvent,
  type RecordEnrichEvent,
  type RecordErrorEvent,
  type RecordEvent,
  type RecordRequestEvent,
  type RecordsListRequestEvent,
  type RecordRequestEmailChangeRequestEvent,
  type RecordRequestPasswordResetRequestEvent,
  type RecordRequestVerificationRequestEvent,
} from "./events.ts";
import {
  MailerEvent,
  ModelErrorEvent,
  ModelEvent,
  ModelEventTypeCreate,
  ModelEventTypeDelete,
  ModelEventTypeUpdate,
  ModelEventTypeValidate,
  newCollectionErrorEventFromModelErrorEvent,
  newCollectionEventFromModelEvent,
  newRecordErrorEventFromModelErrorEvent,
  newRecordEventFromModelEvent,
  syncCollectionErrorEventWithModelErrorEvent,
  syncCollectionEventWithModelEvent,
  syncModelErrorEventWithCollectionErrorEvent,
  syncModelErrorEventWithRecordErrorEvent,
  syncModelEventWithCollectionEvent,
  syncModelEventWithRecordEvent,
  syncRecordErrorEventWithModelErrorEvent,
  syncRecordEventWithModelEvent,
} from "./events.ts";
import { CollectionNameExternalAuths, ExternalAuth } from "./external_auth_model.ts";
import {
  InterceptorActionAfterDelete,
  InterceptorActionAfterDeleteError,
  InterceptorActionAfterCreate,
  InterceptorActionAfterCreateError,
  InterceptorActionAfterUpdate,
  InterceptorActionAfterUpdateError,
  InterceptorActionDelete,
  InterceptorActionDeleteExecute,
  InterceptorActionCreate,
  InterceptorActionCreateExecute,
  InterceptorActionUpdate,
  InterceptorActionUpdateExecute,
  InterceptorActionValidate,
  type Field,
} from "./field.ts";
import { FieldTypeFile } from "./field_file.ts";
import { RelationField } from "./field_relation.ts";
import { FieldsList, NewFieldsList } from "./fields_list.ts";
import { deleteOldLogs, findLogById, logQuery, logsStats, type LogsStatsItem } from "./log_query.ts";
import { CollectionNameMFAs, MFA } from "./mfa_model.ts";
import { MigrationsList } from "./migrations_list.ts";
import { AppMigrations, MigrationsRunner, SystemMigrations } from "./migrations_runner.ts";
import { CollectionNameOTPs, OTP } from "./otp_model.ts";
import { FieldNameEmail, FieldNamePassword, Record as RecordModel, type RecordData } from "./record.ts";
import { RecordFieldResolver } from "./record_field_resolver.ts";
import { registerSuperuserHooks } from "./record_model_superusers.ts";
import { RecordQuery, buildRecordFilterExpr, combineSqlExprs, type RecordQueryFilter } from "./record_query.ts";
import { expandRecord as expandRecordHelper, expandRecords as expandRecordsHelper } from "./record_query_expand.ts";
import {
  TokenClaimCollectionId,
  TokenClaimId,
  TokenClaimType,
  TokenTypeAuth,
  TokenTypeEmailChange,
  TokenTypeFile,
  TokenTypePasswordReset,
  TokenTypeVerification,
} from "./record_tokens.ts";
import { Settings } from "./settings.ts";
import { Store, StoreKeyActiveBackup } from "./store.ts";
import { NormalizeUniqueIndexError } from "./validators/db.ts";
import { CreateViewFields, DeleteView, SaveView, FindRecordByViewFile as findRecordByViewFile } from "./view.ts";

// BaseAppConfig defines a BaseApp configuration option.
export type BaseAppConfig = {
  dataDir?: string;
  encryptionEnv?: string;
  isDev?: boolean;
};

export const LocalStorageDirName = "storage";
export const LocalBackupsDirName = "backups";
export const LocalTempDirName = ".pb_temp_to_delete"; // temp pb_data sub directory that will be deleted on each app.Bootstrap()
export const LocalAutocertCacheDirName = ".autocert_cache";

// @todo consider removing after backups refactoring
const lostFoundDirName = "lost+found";

// BaseApp implements core.App and defines the base PocketBase app structure.
export class BaseApp implements App {
  #dataDir: string;
  #encryptionEnv: string;
  #settings: Settings;
  #store: Store<string, unknown>;
  #cron: Cron;
  #subscriptionsBroker: Broker;
  #isDev: boolean;
  #bootstrapped = false;
  #db: DbxDatabase | null = null;
  #auxDb: DbxDatabase | null = null;
  #logger: Logger;
  #txInfo: TxAppInfo | null = null;
  #hooksEnabled = false;
  // app event hooks
  #onBootstrap!: Hook<BootstrapEvent>;
  #onServe!: Hook<ServeEvent>;
  #onTerminate!: Hook<TerminateEvent>;
  // collection API event hooks
  #onCollectionsListRequest!: Hook<CollectionsListRequestEvent>;
  #onCollectionViewRequest!: Hook<CollectionRequestEvent>;
  #onCollectionCreateRequest!: Hook<CollectionRequestEvent>;
  #onCollectionUpdateRequest!: Hook<CollectionRequestEvent>;
  #onCollectionDeleteRequest!: Hook<CollectionRequestEvent>;
  #onCollectionsImportRequest!: Hook<CollectionsImportRequestEvent>;
  // batch API event hooks
  #onBatchRequest!: Hook<BatchRequestEvent>;
  // realtime API event hooks
  #onRealtimeConnectRequest!: Hook<RealtimeConnectRequestEvent>;
  #onRealtimeMessageSend!: Hook<RealtimeMessageEvent>;
  #onRealtimeSubscribeRequest!: Hook<RealtimeSubscribeRequestEvent>;
  // db model hooks
  #onModelCreate!: Hook<ModelEvent>;
  #onModelCreateExecute!: Hook<ModelEvent>;
  #onModelAfterCreateSuccess!: Hook<ModelEvent>;
  #onModelAfterCreateError!: Hook<ModelErrorEvent>;
  #onModelUpdate!: Hook<ModelEvent>;
  #onModelUpdateExecute!: Hook<ModelEvent>;
  #onModelAfterUpdateSuccess!: Hook<ModelEvent>;
  #onModelAfterUpdateError!: Hook<ModelErrorEvent>;
  #onModelValidate!: Hook<ModelEvent>;
  #onModelDelete!: Hook<ModelEvent>;
  #onModelDeleteExecute!: Hook<ModelEvent>;
  #onModelAfterDeleteSuccess!: Hook<ModelEvent>;
  #onModelAfterDeleteError!: Hook<ModelErrorEvent>;
  // db record hooks
  #onRecordValidate!: Hook<RecordEvent>;
  #onRecordCreate!: Hook<RecordEvent>;
  #onRecordCreateExecute!: Hook<RecordEvent>;
  #onRecordAfterCreateSuccess!: Hook<RecordEvent>;
  #onRecordAfterCreateError!: Hook<RecordErrorEvent>;
  #onRecordUpdate!: Hook<RecordEvent>;
  #onRecordUpdateExecute!: Hook<RecordEvent>;
  #onRecordAfterUpdateSuccess!: Hook<RecordEvent>;
  #onRecordAfterUpdateError!: Hook<RecordErrorEvent>;
  #onRecordDelete!: Hook<RecordEvent>;
  #onRecordDeleteExecute!: Hook<RecordEvent>;
  #onRecordAfterDeleteSuccess!: Hook<RecordEvent>;
  #onRecordAfterDeleteError!: Hook<RecordErrorEvent>;
  #onRecordEnrich!: Hook<RecordEnrichEvent>;
  // record auth API event hooks
  #onRecordAuthWithPasswordRequest!: Hook<RecordAuthWithPasswordRequestEvent>;
  #onRecordAuthWithOAuth2Request!: Hook<RecordAuthWithOAuth2RequestEvent>;
  #onRecordAuthWithOTPRequest!: Hook<RecordAuthWithOTPRequestEvent>;
  #onRecordAuthRequest!: Hook<RecordAuthRequestEvent>;
  #onRecordAuthRefreshRequest!: Hook<RecordAuthRefreshRequestEvent>;
  #onRecordCreateOTPRequest!: Hook<RecordCreateOTPRequestEvent>;
  #onRecordRequestPasswordResetRequest!: Hook<RecordRequestPasswordResetRequestEvent>;
  #onRecordConfirmPasswordResetRequest!: Hook<RecordConfirmPasswordResetRequestEvent>;
  #onRecordRequestVerificationRequest!: Hook<RecordRequestVerificationRequestEvent>;
  #onRecordConfirmVerificationRequest!: Hook<RecordConfirmVerificationRequestEvent>;
  #onRecordRequestEmailChangeRequest!: Hook<RecordRequestEmailChangeRequestEvent>;
  #onRecordConfirmEmailChangeRequest!: Hook<RecordConfirmEmailChangeRequestEvent>;
  // record crud API event hooks
  #onRecordsListRequest!: Hook<RecordsListRequestEvent>;
  #onRecordViewRequest!: Hook<RecordRequestEvent>;
  #onRecordCreateRequest!: Hook<RecordRequestEvent>;
  #onRecordUpdateRequest!: Hook<RecordRequestEvent>;
  #onRecordDeleteRequest!: Hook<RecordRequestEvent>;
  // settings event hooks
  #onSettingsListRequest!: Hook<SettingsListRequestEvent>;
  #onSettingsUpdateRequest!: Hook<SettingsUpdateRequestEvent>;
  #onSettingsReload!: Hook<SettingsReloadEvent>;
  // app event hooks
  #onBackupCreate!: Hook<BackupEvent>;
  #onBackupRestore!: Hook<BackupEvent>;
  // file api event hooks
  #onFileDownloadRequest!: Hook<FileDownloadRequestEvent>;
  #onFileTokenRequest!: Hook<FileTokenRequestEvent>;
  // mailer event hooks
  #onMailerSend!: Hook<MailerEvent>;
  #onMailerRecordAuthAlertSend!: Hook<MailerRecordEvent>;
  #onMailerRecordPasswordResetSend!: Hook<MailerRecordEvent>;
  #onMailerRecordVerificationSend!: Hook<MailerRecordEvent>;
  #onMailerRecordEmailChangeSend!: Hook<MailerRecordEvent>;
  #onMailerRecordOTPSend!: Hook<MailerRecordEvent>;
  // db collection hooks
  #onCollectionValidate!: Hook<CollectionEvent>;
  #onCollectionCreate!: Hook<CollectionEvent>;
  #onCollectionCreateExecute!: Hook<CollectionEvent>;
  #onCollectionAfterCreateSuccess!: Hook<CollectionEvent>;
  #onCollectionAfterCreateError!: Hook<CollectionErrorEvent>;
  #onCollectionUpdate!: Hook<CollectionEvent>;
  #onCollectionUpdateExecute!: Hook<CollectionEvent>;
  #onCollectionAfterUpdateSuccess!: Hook<CollectionEvent>;
  #onCollectionAfterUpdateError!: Hook<CollectionErrorEvent>;
  #onCollectionDelete!: Hook<CollectionEvent>;
  #onCollectionDeleteExecute!: Hook<CollectionEvent>;
  #onCollectionAfterDeleteSuccess!: Hook<CollectionEvent>;
  #onCollectionAfterDeleteError!: Hook<CollectionErrorEvent>;

  constructor(config: BaseAppConfig = {}) {
    this.#dataDir = config.dataDir ?? "pb_data";
    this.#encryptionEnv = config.encryptionEnv ?? "";
    this.#isDev = config.isDev ?? false;
    this.#settings = new Settings();
    this.#store = new Store();
    this.#cron = new Cron();
    this.#subscriptionsBroker = new Broker();
    this.#logger = {
      Debug: (message: string, ...args: unknown[]) => {
        console.debug(message, ...args);
      },
      Warn: (message: string, ...args: unknown[]) => {
        console.warn(message, ...args);
      },
      Error: (message: string, ...args: unknown[]) => {
        console.error(message, ...args);
      },
    };
    this.resetHooks();

    this.registerBaseHooks();
    this.registerAutobackupHooks();
    this.registerCollectionHooks();
    this.registerRecordHooks();
    this.registerSuperuserHooks();
    this.registerOTPHooks();
    this.registerMFAHooks();
    this.registerExternalAuthHooks();
    this.registerAuthOriginHooks();
    this.#hooksEnabled = true;
  }

  // resetHooks initializes all app hook handlers.
  private resetHooks(): void {
    this.#hooksEnabled = false;
    this.#onBootstrap = new Hook();
    this.#onServe = new Hook();
    this.#onTerminate = new Hook();
    this.#onCollectionsListRequest = new Hook();
    this.#onCollectionViewRequest = new Hook();
    this.#onCollectionCreateRequest = new Hook();
    this.#onCollectionUpdateRequest = new Hook();
    this.#onCollectionDeleteRequest = new Hook();
    this.#onCollectionsImportRequest = new Hook();
    this.#onBatchRequest = new Hook();
    this.#onRealtimeConnectRequest = new Hook();
    this.#onRealtimeMessageSend = new Hook();
    this.#onRealtimeSubscribeRequest = new Hook();
    this.#onModelCreate = new Hook();
    this.#onModelCreateExecute = new Hook();
    this.#onModelAfterCreateSuccess = new Hook();
    this.#onModelAfterCreateError = new Hook();
    this.#onModelUpdate = new Hook();
    this.#onModelUpdateExecute = new Hook();
    this.#onModelAfterUpdateSuccess = new Hook();
    this.#onModelAfterUpdateError = new Hook();
    this.#onModelValidate = new Hook();
    this.#onModelDelete = new Hook();
    this.#onModelDeleteExecute = new Hook();
    this.#onModelAfterDeleteSuccess = new Hook();
    this.#onModelAfterDeleteError = new Hook();
    this.#onRecordValidate = new Hook();
    this.#onRecordCreate = new Hook();
    this.#onRecordCreateExecute = new Hook();
    this.#onRecordAfterCreateSuccess = new Hook();
    this.#onRecordAfterCreateError = new Hook();
    this.#onRecordUpdate = new Hook();
    this.#onRecordUpdateExecute = new Hook();
    this.#onRecordAfterUpdateSuccess = new Hook();
    this.#onRecordAfterUpdateError = new Hook();
    this.#onRecordDelete = new Hook();
    this.#onRecordDeleteExecute = new Hook();
    this.#onRecordAfterDeleteSuccess = new Hook();
    this.#onRecordAfterDeleteError = new Hook();
    this.#onRecordEnrich = new Hook();
    this.#onRecordAuthWithPasswordRequest = new Hook();
    this.#onRecordAuthWithOAuth2Request = new Hook();
    this.#onRecordAuthWithOTPRequest = new Hook();
    this.#onRecordAuthRequest = new Hook();
    this.#onRecordAuthRefreshRequest = new Hook();
    this.#onRecordCreateOTPRequest = new Hook();
    this.#onRecordRequestPasswordResetRequest = new Hook();
    this.#onRecordConfirmPasswordResetRequest = new Hook();
    this.#onRecordRequestVerificationRequest = new Hook();
    this.#onRecordConfirmVerificationRequest = new Hook();
    this.#onRecordRequestEmailChangeRequest = new Hook();
    this.#onRecordConfirmEmailChangeRequest = new Hook();
    this.#onRecordsListRequest = new Hook();
    this.#onRecordViewRequest = new Hook();
    this.#onRecordCreateRequest = new Hook();
    this.#onRecordUpdateRequest = new Hook();
    this.#onRecordDeleteRequest = new Hook();
    this.#onSettingsListRequest = new Hook();
    this.#onSettingsUpdateRequest = new Hook();
    this.#onSettingsReload = new Hook();
    this.#onBackupCreate = new Hook();
    this.#onBackupRestore = new Hook();
    this.#onFileDownloadRequest = new Hook();
    this.#onFileTokenRequest = new Hook();
    this.#onMailerSend = new Hook();
    this.#onMailerRecordAuthAlertSend = new Hook();
    this.#onMailerRecordPasswordResetSend = new Hook();
    this.#onMailerRecordVerificationSend = new Hook();
    this.#onMailerRecordEmailChangeSend = new Hook();
    this.#onMailerRecordOTPSend = new Hook();
    this.#onCollectionValidate = new Hook();
    this.#onCollectionCreate = new Hook();
    this.#onCollectionCreateExecute = new Hook();
    this.#onCollectionAfterCreateSuccess = new Hook();
    this.#onCollectionAfterCreateError = new Hook();
    this.#onCollectionUpdate = new Hook();
    this.#onCollectionUpdateExecute = new Hook();
    this.#onCollectionAfterUpdateSuccess = new Hook();
    this.#onCollectionAfterUpdateError = new Hook();
    this.#onCollectionDelete = new Hook();
    this.#onCollectionDeleteExecute = new Hook();
    this.#onCollectionAfterDeleteSuccess = new Hook();
    this.#onCollectionAfterDeleteError = new Hook();
  }

  dataDir(): string {
    return this.#dataDir;
  }

  DataDir(): string {
    return this.dataDir();
  }

  encryptionEnv(): string {
    return this.#encryptionEnv;
  }

  settings(): Settings {
    return this.#settings;
  }

  store(): Store<string, unknown> {
    return this.#store;
  }

  Cron(): Cron {
    return this.#cron;
  }

  IsDev(): boolean {
    return this.#isDev;
  }

  SubscriptionsBroker(): Broker {
    return this.#subscriptionsBroker;
  }

  Logger(): Logger {
    return this.#logger;
  }

  ModelQuery(model: { TableName: () => string }): SelectQuery {
    return new SelectQuery(this.db(), model.TableName());
  }

  AuxModelQuery(model: { TableName: () => string }): SelectQuery {
    return new SelectQuery(this.auxDb(), model.TableName());
  }

  LogQuery(): SelectQuery {
    return logQuery(this);
  }

  FindLogById(id: string) {
    return findLogById(this, id);
  }

  LogsStats(expr: SqlExpr | null): LogsStatsItem[] {
    return logsStats(this, expr);
  }

  DeleteOldLogs(createdBefore: Date): Error | null {
    return deleteOldLogs(this, createdBefore);
  }

  OnBootstrap(): Hook<BootstrapEvent> {
    return this.#onBootstrap;
  }

  OnServe(): Hook<ServeEvent> {
    return this.#onServe;
  }

  OnTerminate(): Hook<TerminateEvent> {
    return this.#onTerminate;
  }

  OnCollectionsListRequest(): Hook<CollectionsListRequestEvent> {
    return this.#onCollectionsListRequest;
  }

  OnCollectionViewRequest(): Hook<CollectionRequestEvent> {
    return this.#onCollectionViewRequest;
  }

  OnCollectionCreateRequest(): Hook<CollectionRequestEvent> {
    return this.#onCollectionCreateRequest;
  }

  OnCollectionUpdateRequest(): Hook<CollectionRequestEvent> {
    return this.#onCollectionUpdateRequest;
  }

  OnCollectionDeleteRequest(): Hook<CollectionRequestEvent> {
    return this.#onCollectionDeleteRequest;
  }

  OnCollectionsImportRequest(): Hook<CollectionsImportRequestEvent> {
    return this.#onCollectionsImportRequest;
  }

  OnBatchRequest(): Hook<BatchRequestEvent> {
    return this.#onBatchRequest;
  }

  OnRealtimeConnectRequest(): Hook<RealtimeConnectRequestEvent> {
    return this.#onRealtimeConnectRequest;
  }

  OnRealtimeMessageSend(): Hook<RealtimeMessageEvent> {
    return this.#onRealtimeMessageSend;
  }

  OnRealtimeSubscribeRequest(): Hook<RealtimeSubscribeRequestEvent> {
    return this.#onRealtimeSubscribeRequest;
  }

  OnSettingsListRequest(): Hook<SettingsListRequestEvent> {
    return this.#onSettingsListRequest;
  }

  OnSettingsUpdateRequest(): Hook<SettingsUpdateRequestEvent> {
    return this.#onSettingsUpdateRequest;
  }

  OnModelCreate(tags: string[] = []): ReturnType<typeof NewTaggedHook<ModelEvent>> {
    return NewTaggedHook(this.#onModelCreate, ...tags);
  }

  OnModelCreateExecute(tags: string[] = []): ReturnType<typeof NewTaggedHook<ModelEvent>> {
    return NewTaggedHook(this.#onModelCreateExecute, ...tags);
  }

  OnModelAfterCreateSuccess(tags: string[] = []): ReturnType<typeof NewTaggedHook<ModelEvent>> {
    return NewTaggedHook(this.#onModelAfterCreateSuccess, ...tags);
  }

  OnModelAfterCreateError(tags: string[] = []): ReturnType<typeof NewTaggedHook<ModelErrorEvent>> {
    return NewTaggedHook(this.#onModelAfterCreateError, ...tags);
  }

  OnModelUpdate(tags: string[] = []): ReturnType<typeof NewTaggedHook<ModelEvent>> {
    return NewTaggedHook(this.#onModelUpdate, ...tags);
  }

  OnModelUpdateExecute(tags: string[] = []): ReturnType<typeof NewTaggedHook<ModelEvent>> {
    return NewTaggedHook(this.#onModelUpdateExecute, ...tags);
  }

  OnModelAfterUpdateSuccess(tags: string[] = []): ReturnType<typeof NewTaggedHook<ModelEvent>> {
    return NewTaggedHook(this.#onModelAfterUpdateSuccess, ...tags);
  }

  OnModelAfterUpdateError(tags: string[] = []): ReturnType<typeof NewTaggedHook<ModelErrorEvent>> {
    return NewTaggedHook(this.#onModelAfterUpdateError, ...tags);
  }

  OnModelValidate(tags: string[] = []): ReturnType<typeof NewTaggedHook<ModelEvent>> {
    return NewTaggedHook(this.#onModelValidate, ...tags);
  }

  OnModelDelete(tags: string[] = []): ReturnType<typeof NewTaggedHook<ModelEvent>> {
    return NewTaggedHook(this.#onModelDelete, ...tags);
  }

  OnModelDeleteExecute(tags: string[] = []): ReturnType<typeof NewTaggedHook<ModelEvent>> {
    return NewTaggedHook(this.#onModelDeleteExecute, ...tags);
  }

  OnModelAfterDeleteSuccess(tags: string[] = []): ReturnType<typeof NewTaggedHook<ModelEvent>> {
    return NewTaggedHook(this.#onModelAfterDeleteSuccess, ...tags);
  }

  OnModelAfterDeleteError(tags: string[] = []): ReturnType<typeof NewTaggedHook<ModelErrorEvent>> {
    return NewTaggedHook(this.#onModelAfterDeleteError, ...tags);
  }

  OnRecordValidate(tags: string[] = []): ReturnType<typeof NewTaggedHook<RecordEvent>> {
    return NewTaggedHook(this.#onRecordValidate, ...tags);
  }

  OnRecordCreate(tags: string[] = []): ReturnType<typeof NewTaggedHook<RecordEvent>> {
    return NewTaggedHook(this.#onRecordCreate, ...tags);
  }

  OnRecordCreateExecute(tags: string[] = []): ReturnType<typeof NewTaggedHook<RecordEvent>> {
    return NewTaggedHook(this.#onRecordCreateExecute, ...tags);
  }

  OnRecordAfterCreateSuccess(tags: string[] = []): ReturnType<typeof NewTaggedHook<RecordEvent>> {
    return NewTaggedHook(this.#onRecordAfterCreateSuccess, ...tags);
  }

  OnRecordAfterCreateError(tags: string[] = []): ReturnType<typeof NewTaggedHook<RecordErrorEvent>> {
    return NewTaggedHook(this.#onRecordAfterCreateError, ...tags);
  }

  OnRecordUpdate(tags: string[] = []): ReturnType<typeof NewTaggedHook<RecordEvent>> {
    return NewTaggedHook(this.#onRecordUpdate, ...tags);
  }

  OnRecordUpdateExecute(tags: string[] = []): ReturnType<typeof NewTaggedHook<RecordEvent>> {
    return NewTaggedHook(this.#onRecordUpdateExecute, ...tags);
  }

  OnRecordAfterUpdateSuccess(tags: string[] = []): ReturnType<typeof NewTaggedHook<RecordEvent>> {
    return NewTaggedHook(this.#onRecordAfterUpdateSuccess, ...tags);
  }

  OnRecordAfterUpdateError(tags: string[] = []): ReturnType<typeof NewTaggedHook<RecordErrorEvent>> {
    return NewTaggedHook(this.#onRecordAfterUpdateError, ...tags);
  }

  OnRecordDelete(tags: string[] = []): ReturnType<typeof NewTaggedHook<RecordEvent>> {
    return NewTaggedHook(this.#onRecordDelete, ...tags);
  }

  OnRecordDeleteExecute(tags: string[] = []): ReturnType<typeof NewTaggedHook<RecordEvent>> {
    return NewTaggedHook(this.#onRecordDeleteExecute, ...tags);
  }

  OnRecordAfterDeleteSuccess(tags: string[] = []): ReturnType<typeof NewTaggedHook<RecordEvent>> {
    return NewTaggedHook(this.#onRecordAfterDeleteSuccess, ...tags);
  }

  OnRecordAfterDeleteError(tags: string[] = []): ReturnType<typeof NewTaggedHook<RecordErrorEvent>> {
    return NewTaggedHook(this.#onRecordAfterDeleteError, ...tags);
  }

  OnRecordEnrich(tags: string[] = []): ReturnType<typeof NewTaggedHook<RecordEnrichEvent>> {
    return NewTaggedHook(this.#onRecordEnrich, ...tags);
  }

  OnRecordAuthWithPasswordRequest(tags: string[] = []): ReturnType<typeof NewTaggedHook<RecordAuthWithPasswordRequestEvent>> {
    return NewTaggedHook(this.#onRecordAuthWithPasswordRequest, ...tags);
  }

  OnRecordAuthWithOAuth2Request(tags: string[] = []): ReturnType<typeof NewTaggedHook<RecordAuthWithOAuth2RequestEvent>> {
    return NewTaggedHook(this.#onRecordAuthWithOAuth2Request, ...tags);
  }

  OnRecordAuthWithOTPRequest(tags: string[] = []): ReturnType<typeof NewTaggedHook<RecordAuthWithOTPRequestEvent>> {
    return NewTaggedHook(this.#onRecordAuthWithOTPRequest, ...tags);
  }

  OnRecordsListRequest(tags: string[] = []): ReturnType<typeof NewTaggedHook<RecordsListRequestEvent>> {
    return NewTaggedHook(this.#onRecordsListRequest, ...tags);
  }

  OnRecordViewRequest(tags: string[] = []): ReturnType<typeof NewTaggedHook<RecordRequestEvent>> {
    return NewTaggedHook(this.#onRecordViewRequest, ...tags);
  }

  OnRecordCreateRequest(tags: string[] = []): ReturnType<typeof NewTaggedHook<RecordRequestEvent>> {
    return NewTaggedHook(this.#onRecordCreateRequest, ...tags);
  }

  OnRecordUpdateRequest(tags: string[] = []): ReturnType<typeof NewTaggedHook<RecordRequestEvent>> {
    return NewTaggedHook(this.#onRecordUpdateRequest, ...tags);
  }

  OnRecordDeleteRequest(tags: string[] = []): ReturnType<typeof NewTaggedHook<RecordRequestEvent>> {
    return NewTaggedHook(this.#onRecordDeleteRequest, ...tags);
  }

  OnRecordAuthRequest(tags: string[] = []): ReturnType<typeof NewTaggedHook<RecordAuthRequestEvent>> {
    return NewTaggedHook(this.#onRecordAuthRequest, ...tags);
  }

  OnRecordAuthRefreshRequest(tags: string[] = []): ReturnType<typeof NewTaggedHook<RecordAuthRefreshRequestEvent>> {
    return NewTaggedHook(this.#onRecordAuthRefreshRequest, ...tags);
  }

  OnRecordCreateOTPRequest(tags: string[] = []): ReturnType<typeof NewTaggedHook<RecordCreateOTPRequestEvent>> {
    return NewTaggedHook(this.#onRecordCreateOTPRequest, ...tags);
  }

  OnRecordRequestPasswordResetRequest(
    tags: string[] = [],
  ): ReturnType<typeof NewTaggedHook<RecordRequestPasswordResetRequestEvent>> {
    return NewTaggedHook(this.#onRecordRequestPasswordResetRequest, ...tags);
  }

  OnRecordConfirmPasswordResetRequest(
    tags: string[] = [],
  ): ReturnType<typeof NewTaggedHook<RecordConfirmPasswordResetRequestEvent>> {
    return NewTaggedHook(this.#onRecordConfirmPasswordResetRequest, ...tags);
  }

  OnRecordRequestVerificationRequest(
    tags: string[] = [],
  ): ReturnType<typeof NewTaggedHook<RecordRequestVerificationRequestEvent>> {
    return NewTaggedHook(this.#onRecordRequestVerificationRequest, ...tags);
  }

  OnRecordConfirmVerificationRequest(
    tags: string[] = [],
  ): ReturnType<typeof NewTaggedHook<RecordConfirmVerificationRequestEvent>> {
    return NewTaggedHook(this.#onRecordConfirmVerificationRequest, ...tags);
  }

  OnRecordRequestEmailChangeRequest(
    tags: string[] = [],
  ): ReturnType<typeof NewTaggedHook<RecordRequestEmailChangeRequestEvent>> {
    return NewTaggedHook(this.#onRecordRequestEmailChangeRequest, ...tags);
  }

  OnRecordConfirmEmailChangeRequest(
    tags: string[] = [],
  ): ReturnType<typeof NewTaggedHook<RecordConfirmEmailChangeRequestEvent>> {
    return NewTaggedHook(this.#onRecordConfirmEmailChangeRequest, ...tags);
  }

  OnSettingsReload(): Hook<SettingsReloadEvent> {
    return this.#onSettingsReload;
  }

  OnBackupCreate(): Hook<BackupEvent> {
    return this.#onBackupCreate;
  }

  OnBackupRestore(): Hook<BackupEvent> {
    return this.#onBackupRestore;
  }

  OnFileDownloadRequest(tags: string[] = []): ReturnType<typeof NewTaggedHook<FileDownloadRequestEvent>> {
    return NewTaggedHook(this.#onFileDownloadRequest, ...tags);
  }

  OnFileTokenRequest(tags: string[] = []): ReturnType<typeof NewTaggedHook<FileTokenRequestEvent>> {
    return NewTaggedHook(this.#onFileTokenRequest, ...tags);
  }

  OnMailerSend(): Hook<MailerEvent> {
    return this.#onMailerSend;
  }

  OnMailerRecordAuthAlertSend(tags: string[] = []): ReturnType<typeof NewTaggedHook<MailerRecordEvent>> {
    return NewTaggedHook(this.#onMailerRecordAuthAlertSend, ...tags);
  }

  OnMailerRecordPasswordResetSend(tags: string[] = []): ReturnType<typeof NewTaggedHook<MailerRecordEvent>> {
    return NewTaggedHook(this.#onMailerRecordPasswordResetSend, ...tags);
  }

  OnMailerRecordVerificationSend(tags: string[] = []): ReturnType<typeof NewTaggedHook<MailerRecordEvent>> {
    return NewTaggedHook(this.#onMailerRecordVerificationSend, ...tags);
  }

  OnMailerRecordEmailChangeSend(tags: string[] = []): ReturnType<typeof NewTaggedHook<MailerRecordEvent>> {
    return NewTaggedHook(this.#onMailerRecordEmailChangeSend, ...tags);
  }

  OnMailerRecordOTPSend(tags: string[] = []): ReturnType<typeof NewTaggedHook<MailerRecordEvent>> {
    return NewTaggedHook(this.#onMailerRecordOTPSend, ...tags);
  }

  OnCollectionValidate(tags: string[] = []): ReturnType<typeof NewTaggedHook<CollectionEvent>> {
    return NewTaggedHook(this.#onCollectionValidate, ...tags);
  }

  OnCollectionCreate(tags: string[] = []): ReturnType<typeof NewTaggedHook<CollectionEvent>> {
    return NewTaggedHook(this.#onCollectionCreate, ...tags);
  }

  OnCollectionCreateExecute(tags: string[] = []): ReturnType<typeof NewTaggedHook<CollectionEvent>> {
    return NewTaggedHook(this.#onCollectionCreateExecute, ...tags);
  }

  OnCollectionAfterCreateSuccess(tags: string[] = []): ReturnType<typeof NewTaggedHook<CollectionEvent>> {
    return NewTaggedHook(this.#onCollectionAfterCreateSuccess, ...tags);
  }

  OnCollectionAfterCreateError(tags: string[] = []): ReturnType<typeof NewTaggedHook<CollectionErrorEvent>> {
    return NewTaggedHook(this.#onCollectionAfterCreateError, ...tags);
  }

  OnCollectionUpdate(tags: string[] = []): ReturnType<typeof NewTaggedHook<CollectionEvent>> {
    return NewTaggedHook(this.#onCollectionUpdate, ...tags);
  }

  OnCollectionUpdateExecute(tags: string[] = []): ReturnType<typeof NewTaggedHook<CollectionEvent>> {
    return NewTaggedHook(this.#onCollectionUpdateExecute, ...tags);
  }

  OnCollectionAfterUpdateSuccess(tags: string[] = []): ReturnType<typeof NewTaggedHook<CollectionEvent>> {
    return NewTaggedHook(this.#onCollectionAfterUpdateSuccess, ...tags);
  }

  OnCollectionAfterUpdateError(tags: string[] = []): ReturnType<typeof NewTaggedHook<CollectionErrorEvent>> {
    return NewTaggedHook(this.#onCollectionAfterUpdateError, ...tags);
  }

  OnCollectionDelete(tags: string[] = []): ReturnType<typeof NewTaggedHook<CollectionEvent>> {
    return NewTaggedHook(this.#onCollectionDelete, ...tags);
  }

  OnCollectionDeleteExecute(tags: string[] = []): ReturnType<typeof NewTaggedHook<CollectionEvent>> {
    return NewTaggedHook(this.#onCollectionDeleteExecute, ...tags);
  }

  OnCollectionAfterDeleteSuccess(tags: string[] = []): ReturnType<typeof NewTaggedHook<CollectionEvent>> {
    return NewTaggedHook(this.#onCollectionAfterDeleteSuccess, ...tags);
  }

  OnCollectionAfterDeleteError(tags: string[] = []): ReturnType<typeof NewTaggedHook<CollectionErrorEvent>> {
    return NewTaggedHook(this.#onCollectionAfterDeleteError, ...tags);
  }

  isBootstrapped(): boolean {
    return this.#bootstrapped;
  }

  bootstrap(): void {
    const event = new BootstrapEvent(this);
    const result = this.OnBootstrap().Trigger(event, () => {
      this.resetBootstrapState();
      if (!existsSync(this.#dataDir)) {
        mkdirSync(this.#dataDir, { recursive: true });
      }

      this.#db = new DbxDatabase(join(this.#dataDir, "data.db"));
      this.#auxDb = new DbxDatabase(join(this.#dataDir, "auxiliary.db"));
      this.reloadSettings();
      this.#bootstrapped = true;
      return null;
    });

    if (result instanceof Promise) {
      void result.catch((err) => this.Logger().Error("Failed to bootstrap app", "error", err));
    } else if (result instanceof Error) {
      throw result;
    }
  }

  resetBootstrapState(): void {
    if (this.#db) {
      this.#db.close();
      this.#db = null;
    }
    if (this.#auxDb) {
      this.#auxDb.close();
      this.#auxDb = null;
    }
    this.#bootstrapped = false;
  }

  IsTransactional(): boolean {
    return this.#txInfo !== null;
  }

  UnsafeWithoutHooks(): App {
    const CloneCtor = this.constructor as typeof BaseApp;
    const clone = new CloneCtor({
      dataDir: this.#dataDir,
      encryptionEnv: this.#encryptionEnv,
      isDev: this.#isDev,
    });
    clone.#dataDir = this.#dataDir;
    clone.#encryptionEnv = this.#encryptionEnv;
    clone.#settings = this.#settings;
    clone.#store = this.#store;
    clone.#cron = this.#cron;
    clone.#subscriptionsBroker = this.#subscriptionsBroker;
    clone.#isDev = this.#isDev;
    clone.#bootstrapped = this.#bootstrapped;
    clone.#db = this.#db;
    clone.#auxDb = this.#auxDb;
    clone.#logger = this.#logger;
    clone.#txInfo = this.#txInfo;
    clone.resetHooks();
    return clone;
  }

  db(): Database {
    if (!this.#db) {
      throw new Error("app is not bootstrapped");
    }
    return this.#db;
  }

  auxDb(): Database {
    if (!this.#auxDb) {
      throw new Error("app is not bootstrapped");
    }
    return this.#auxDb;
  }

  TxInfo(): TxAppInfo | null {
    return this.#txInfo;
  }

  auxHasTable(name: string): boolean {
    const row = this.auxDb()
      .query("select name from sqlite_master where type in ('table','view') and lower(name) = lower(?)")
      .get(name) as { name?: string } | undefined;
    return Boolean(row?.name);
  }

  runAllMigrations(): void {
    const list = new MigrationsList();
    list.copy(SystemMigrations);
    list.copy(AppMigrations);
    new MigrationsRunner(this, list).up();
  }

  runSystemMigrations(): void {
    new MigrationsRunner(this, SystemMigrations).up();
  }

  runAppMigrations(): void {
    new MigrationsRunner(this, AppMigrations).up();
  }

  reloadSettings(): void {
    try {
      const row = this.db().query("select value from _params where id = 'settings'").get() as
        | { value?: string | Uint8Array }
        | undefined;
      if (!row?.value) {
        return;
      }

      let rawValue = "";
      if (typeof row.value === "string") {
        rawValue = row.value;
      } else if (row.value instanceof Uint8Array) {
        rawValue = new TextDecoder().decode(row.value);
      }

      if (!rawValue) {
        return;
      }

      const encryptionKey = process.env[this.#encryptionEnv] ?? "";
      let payload = rawValue;
      if (encryptionKey) {
        try {
          const decrypted = decrypt(rawValue, encryptionKey);
          payload = new TextDecoder().decode(decrypted);
        } catch {
          payload = rawValue;
        }
      }

      const parsed = JSON.parse(payload) as Record<string, unknown>;
      const event = new SettingsReloadEvent(this);
      const result = this.OnSettingsReload().Trigger(event, () => {
        this.#settings.loadFromJSON(parsed);
        this.#settings.MarkAsNotNew();
        return null;
      });
      if (result instanceof Promise) {
        void result.catch((err) => this.Logger().Warn("Failed to reload settings", "error", err));
      } else if (result instanceof Error) {
        this.Logger().Warn("Failed to reload settings", "error", result);
      }
    } catch {
      // ignore missing settings table or invalid JSON
    }
  }

  NewMailClient() {
    let client: Sendmail | SMTPClient;

    if (this.#settings.smtp.enabled) {
      client = new SMTPClient();
      client.Host = this.#settings.smtp.host;
      client.Port = this.#settings.smtp.port;
      client.Username = this.#settings.smtp.username;
      client.Password = this.#settings.smtp.password;
      client.TLS = this.#settings.smtp.tls;
      client.AuthMethod = this.#settings.smtp.authMethod;
      client.LocalName = this.#settings.smtp.localName;
    } else {
      client = new Sendmail();
    }

    if (typeof (client as Sendmail | SMTPClient).OnSend === "function") {
      client.OnSend().Bind({
        Id: "__pbMailerOnSend__",
        Func: (e) => {
          const appEvent = new MailerEvent(this, client, e.Message);

          return this.OnMailerSend().Trigger(appEvent, (ae) => {
            e.Message = ae.Message;

            if (ae.Mailer !== client) {
              return ae.Mailer.Send(e.Message);
            }

            return e.Next();
          });
        },
      });
    }

    return client;
  }

  RecordQuery(collectionModelOrIdentifier: Collection | string | null | undefined): RecordQuery {
    return new RecordQuery(this, collectionModelOrIdentifier);
  }

  ExpandRecord(record: RecordModel, expands: string[], optFetchFunc = null): Record<string, Error> {
    return expandRecordHelper(this, record, expands, optFetchFunc);
  }

  ExpandRecords(records: RecordModel[], expands: string[], optFetchFunc = null): Record<string, Error> {
    return expandRecordsHelper(this, records, expands, optFetchFunc);
  }

  FindRecordById(
    collectionModelOrIdentifier: Collection | string,
    id: string,
    ...filters: Array<RecordQueryFilter | null | undefined>
  ): RecordModel {
    const collection =
      typeof collectionModelOrIdentifier === "string"
        ? this.findCollectionByNameOrId(collectionModelOrIdentifier)
        : collectionModelOrIdentifier;

    if (!collection) {
      throw new Error("unknown collection identifier - must be collection model, id or name");
    }

    const rule = buildRecordFilterExpr(filters);
    const record = this.findRecordById(collection, id, rule);
    if (!record) {
      throw new Error("record not found");
    }

    return record;
  }

  FindRecordByViewFile(
    viewCollectionModelOrIdentifier: Collection | string,
    fileFieldName: string,
    filename: string,
  ): RecordModel {
    return findRecordByViewFile(this, viewCollectionModelOrIdentifier, fileFieldName, filename);
  }

  FindRecordsByIds(
    collectionModelOrIdentifier: Collection | string,
    ids: string[],
    ...filters: Array<RecordQueryFilter | null | undefined>
  ): RecordModel[] {
    const collection =
      typeof collectionModelOrIdentifier === "string"
        ? this.findCollectionByNameOrId(collectionModelOrIdentifier)
        : collectionModelOrIdentifier;

    if (!collection) {
      throw new Error("unknown collection identifier - must be collection model, id or name");
    }

    const filteredIds = ids.filter((id) => id !== "");
    if (filteredIds.length === 0) {
      return [];
    }

    let sql = `select {{${collection.name}}}.* from {{${collection.name}}}`;
    const params: SQLQueryBindings[] = [];

    const placeholders = filteredIds.map(() => "?").join(", ");
    sql = appendWhere(sql, `[[${collection.name}.id]] IN (${placeholders})`);
    params.push(...(filteredIds as SQLQueryBindings[]));

    const rule = buildRecordFilterExpr(filters);
    if (rule?.sql) {
      sql = appendWhere(sql, rule.sql);
      params.push(...(rule.params as SQLQueryBindings[]));
    }

    const rows = this.db()
      .query(sql)
      .all(...params) as RecordData[] | undefined;
    if (!rows || rows.length === 0) {
      return [];
    }

    return rows.map((row) => RecordModel.fromRow(collection, row));
  }

  FindAllRecords(
    collectionModelOrIdentifier: Collection | string,
    ...exprs: Array<SqlExpr | Record<string, unknown> | null | undefined>
  ): RecordModel[] {
    const collection =
      typeof collectionModelOrIdentifier === "string"
        ? this.findCollectionByNameOrId(collectionModelOrIdentifier)
        : collectionModelOrIdentifier;

    if (!collection) {
      throw new Error("unknown collection identifier - must be collection model, id or name");
    }

    let sql = `select {{${collection.name}}}.* from {{${collection.name}}}`;
    const params: SQLQueryBindings[] = [];

    const combined = combineSqlExprs(exprs);
    if (combined?.sql) {
      sql = appendWhere(sql, combined.sql);
      params.push(...(combined.params as SQLQueryBindings[]));
    }

    const rows = this.db()
      .query(sql)
      .all(...params) as RecordData[] | undefined;
    if (!rows || rows.length === 0) {
      return [];
    }

    return rows.map((row) => RecordModel.fromRow(collection, row));
  }

  FindFirstRecordByData(collectionModelOrIdentifier: Collection | string, key: string, value: unknown): RecordModel {
    const collection =
      typeof collectionModelOrIdentifier === "string"
        ? this.findCollectionByNameOrId(collectionModelOrIdentifier)
        : collectionModelOrIdentifier;

    if (!collection) {
      throw new Error("unknown collection identifier - must be collection model, id or name");
    }

    const field = collection.Fields.GetByName(key);
    if (!field) {
      throw new Error(`invalid or missing field ${key}`);
    }

    let sql = `select {{${collection.name}}}.* from {{${collection.name}}}`;
    sql = appendWhere(sql, `[[${columnify(key)}]] = ?`);
    const row = this.db()
      .query(sql)
      .get(value as SQLQueryBindings);
    if (!row || typeof row !== "object") {
      throw new Error("record not found");
    }

    return RecordModel.fromRow(collection, row as RecordData);
  }

  FindRecordsByFilter(
    collectionModelOrIdentifier: Collection | string,
    filter: string,
    sort: string,
    limit: number,
    offset: number,
    ...params: Array<Record<string, unknown>>
  ): RecordModel[] {
    const collection =
      typeof collectionModelOrIdentifier === "string"
        ? this.findCollectionByNameOrId(collectionModelOrIdentifier)
        : collectionModelOrIdentifier;

    if (!collection) {
      throw new Error("unknown collection identifier - must be collection model, id or name");
    }

    const resolver = new RecordFieldResolver(this, collection, null, true);
    let sql = `select {{${collection.name}}}.* from {{${collection.name}}}`;
    const bindings: SQLQueryBindings[] = [];

    if (filter) {
      const expr = buildFilterExpr(filter, resolver, DefaultFilterExprLimit, params);
      if (expr.sql) {
        sql = appendWhere(sql, expr.sql);
        bindings.push(...(expr.params as SQLQueryBindings[]));
      }
    }

    if (sort) {
      const orderParts: string[] = [];
      for (const sortField of parseSortFromString(sort)) {
        const expr = buildSortExpr(sortField, resolver);
        if (expr) {
          orderParts.push(expr);
        }
      }
      if (orderParts.length > 0) {
        sql = appendOrderBy(sql, orderParts.join(", "));
      }
    }

    if (resolver.updateQuery) {
      const updated = resolver.updateQuery({ select: sql, params: bindings });
      sql = updated.select;
      bindings.splice(0, bindings.length, ...((updated.params ?? []) as SQLQueryBindings[]));
    }

    sql = applyLimitOffset(sql, limit, offset);

    const rows = this.db()
      .query(sql)
      .all(...bindings) as RecordData[] | undefined;
    if (!rows || rows.length === 0) {
      return [];
    }

    return rows.map((row) => RecordModel.fromRow(collection, row));
  }

  FindFirstRecordByFilter(
    collectionModelOrIdentifier: Collection | string,
    filter: string,
    ...params: Array<Record<string, unknown>>
  ): RecordModel {
    const records = this.FindRecordsByFilter(collectionModelOrIdentifier, filter, "", 1, 0, ...params);
    if (records.length === 0) {
      throw new Error("record not found");
    }
    return records[0]!;
  }

  CountRecords(
    collectionModelOrIdentifier: Collection | string,
    ...exprs: Array<SqlExpr | Record<string, unknown> | null | undefined>
  ): number {
    const collection =
      typeof collectionModelOrIdentifier === "string"
        ? this.findCollectionByNameOrId(collectionModelOrIdentifier)
        : collectionModelOrIdentifier;

    if (!collection) {
      throw new Error("unknown collection identifier - must be collection model, id or name");
    }

    let sql = `select count(*) as total from {{${collection.name}}}`;
    const params: SQLQueryBindings[] = [];

    const combined = combineSqlExprs(exprs);
    if (combined?.sql) {
      sql = appendWhere(sql, combined.sql);
      params.push(...(combined.params as SQLQueryBindings[]));
    }

    const row = this.db()
      .query(sql)
      .get(...params) as { total?: number } | undefined;
    return Number(row?.total ?? 0);
  }

  CanAccessRecord(record: RecordModel, requestInfo: RequestInfo, accessRule: string | null): [boolean, Error | null] {
    if (requestInfo.auth?.isSuperuser()) {
      return [true, null];
    }

    if (accessRule === null) {
      return [false, null];
    }

    if (accessRule === "") {
      return [true, null];
    }

    let expr: SqlExpr;
    try {
      const resolver = new RecordFieldResolver(this, record.collection(), requestInfo, true);
      expr = buildFilterExpr(accessRule, resolver, DefaultFilterExprLimit);

      let sql = `select (1) as ok from {{${record.collection().name}}}`;
      sql = appendWhere(sql, `[[${record.collection().name}.id]] = ?`);
      const params: SQLQueryBindings[] = [record.Id];

      if (expr.sql) {
        sql = appendWhere(sql, expr.sql);
        params.push(...(expr.params as SQLQueryBindings[]));
      }

      if (resolver.updateQuery) {
        const updated = resolver.updateQuery({ select: sql, params });
        sql = updated.select;
        params.splice(0, params.length, ...((updated.params ?? []) as SQLQueryBindings[]));
      }

      const row = this.db()
        .query(sql)
        .get(...params) as { ok?: number } | undefined;
      return [Boolean(row?.ok), null];
    } catch (error) {
      return [false, error as Error];
    }
  }

  FindAuthRecordByToken(token: string, ...validTypes: string[]): RecordModel {
    return this.findAuthRecordByToken(token, validTypes);
  }

  FindAuthRecordByEmail(collectionModelOrIdentifier: Collection | string, email: string): RecordModel {
    const collection =
      typeof collectionModelOrIdentifier === "string"
        ? this.findCollectionByNameOrId(collectionModelOrIdentifier)
        : collectionModelOrIdentifier;
    if (!collection) {
      throw new Error("failed to fetch auth collection: unknown collection identifier - must be collection model, id or name");
    }

    if (!collection.IsAuth()) {
      throw new Error(`"${collection.name}" is not an auth collection`);
    }

    const [index, ok] = findSingleColumnUniqueIndex(collection.indexes ?? [], FieldNameEmail);
    const useNoCase = ok && (index.columns[0]?.collate ?? "").toLowerCase() === "nocase";

    const sql = useNoCase
      ? `select * from [[${collection.name}]] where [[${FieldNameEmail}]] = ? COLLATE NOCASE limit 1`
      : `select * from [[${collection.name}]] where [[${FieldNameEmail}]] = ? limit 1`;

    const row = this.db().query(sql).get(email);
    if (!row || typeof row !== "object") {
      throw new Error("record not found");
    }

    return RecordModel.fromRow(collection, row as RecordData);
  }

  // Ported from pocketbase/core/external_auth_query.go.
  FindAllExternalAuthsByRecord(authRecord: RecordModel): ExternalAuth[] {
    const result: ExternalAuth[] = [new ExternalAuth()];

    this.RecordQuery(CollectionNameExternalAuths)
      .AndWhere({
        collectionRef: authRecord.collection().id,
        recordRef: authRecord.Id,
      })
      .OrderBy("created DESC")
      .All(result);

    return result;
  }

  // Ported from pocketbase/core/external_auth_query.go.
  FindAllExternalAuthsByCollection(collection: Collection): ExternalAuth[] {
    const result: ExternalAuth[] = [new ExternalAuth()];

    this.RecordQuery(CollectionNameExternalAuths)
      .AndWhere({ collectionRef: collection.id })
      .OrderBy("created DESC")
      .All(result);

    return result;
  }

  // Ported from pocketbase/core/external_auth_query.go.
  FindFirstExternalAuthByExpr(expr: SqlExpr | Record<string, unknown>): ExternalAuth {
    const result = new ExternalAuth();

    this.RecordQuery(CollectionNameExternalAuths)
      .AndWhere(Not(HashExp({ providerId: "" })))
      .AndWhere(expr)
      .OrderBy("created DESC")
      .Limit(1)
      .One(result);

    return result;
  }

  // Ported from pocketbase/core/otp_query.go.
  FindAllOTPsByRecord(authRecord: RecordModel): OTP[] {
    const result: OTP[] = [new OTP()];

    this.RecordQuery(CollectionNameOTPs)
      .AndWhere({
        collectionRef: authRecord.collection().id,
        recordRef: authRecord.Id,
      })
      .OrderBy("created DESC")
      .All(result);

    return result;
  }

  // Ported from pocketbase/core/otp_query.go.
  FindAllOTPsByCollection(collection: Collection): OTP[] {
    const result: OTP[] = [new OTP()];

    this.RecordQuery(CollectionNameOTPs).AndWhere({ collectionRef: collection.id }).OrderBy("created DESC").All(result);

    return result;
  }

  // Ported from pocketbase/core/otp_query.go.
  FindOTPById(id: string): OTP {
    const result = new OTP();

    this.RecordQuery(CollectionNameOTPs).AndWhere({ id }).Limit(1).One(result);

    return result;
  }

  // Ported from pocketbase/core/otp_query.go.
  async DeleteAllOTPsByRecord(authRecord: RecordModel): Promise<Error | null> {
    const models = this.FindAllOTPsByRecord(authRecord);
    const errors: Error[] = [];

    for (const model of models) {
      const err = await this.Delete(model);
      if (err) {
        errors.push(err);
      }
    }

    if (errors.length > 0) {
      return new Error(errors.map((err) => err.message ?? String(err)).join("; "));
    }

    return null;
  }

  // Ported from pocketbase/core/otp_query.go.
  async DeleteExpiredOTPs(): Promise<Error | null> {
    const authCollections = this.FindAllCollections(CollectionTypeAuth);

    for (const collection of authCollections) {
      const durationMs = collection.OTP.DurationTime() * 1000;
      const minValidDate = ParseDateTime(new Date(Date.now() - durationMs)).toString();

      const items: RecordModel[] = [];
      this.RecordQuery(CollectionNameOTPs)
        .AndWhere({ collectionRef: collection.id })
        .AndWhere(NewExp("[[created]] < {:date}", { date: minValidDate }))
        .All(items);

      for (const item of items) {
        const err = await this.Delete(item);
        if (err) {
          return err;
        }
      }
    }

    return null;
  }

  // Ported from pocketbase/core/mfa_query.go.
  FindAllMFAsByRecord(authRecord: RecordModel): MFA[] {
    const result: MFA[] = [new MFA()];

    this.RecordQuery(CollectionNameMFAs)
      .AndWhere({
        collectionRef: authRecord.collection().id,
        recordRef: authRecord.Id,
      })
      .OrderBy("created DESC")
      .All(result);

    return result;
  }

  // Ported from pocketbase/core/mfa_query.go.
  FindAllMFAsByCollection(collection: Collection): MFA[] {
    const result: MFA[] = [new MFA()];

    this.RecordQuery(CollectionNameMFAs).AndWhere({ collectionRef: collection.id }).OrderBy("created DESC").All(result);

    return result;
  }

  // Ported from pocketbase/core/mfa_query.go.
  FindMFAById(id: string): MFA {
    const result = new MFA();

    this.RecordQuery(CollectionNameMFAs).AndWhere({ id }).Limit(1).One(result);

    return result;
  }

  // Ported from pocketbase/core/mfa_query.go.
  async DeleteAllMFAsByRecord(authRecord: RecordModel): Promise<Error | null> {
    const models = this.FindAllMFAsByRecord(authRecord);
    const errors: Error[] = [];

    for (const model of models) {
      const err = await this.Delete(model);
      if (err) {
        errors.push(err);
      }
    }

    if (errors.length > 0) {
      return new Error(errors.map((err) => err.message ?? String(err)).join("; "));
    }

    return null;
  }

  // Ported from pocketbase/core/mfa_query.go.
  async DeleteExpiredMFAs(): Promise<Error | null> {
    const authCollections = this.FindAllCollections(CollectionTypeAuth);

    for (const collection of authCollections) {
      const durationMs = collection.MFA.DurationTime() * 1000;
      const minValidDate = ParseDateTime(new Date(Date.now() - durationMs)).toString();

      const items: RecordModel[] = [];
      this.RecordQuery(CollectionNameMFAs)
        .AndWhere({ collectionRef: collection.id })
        .AndWhere(NewExp("[[created]] < {:date}", { date: minValidDate }))
        .All(items);

      for (const item of items) {
        const err = await this.Delete(item);
        if (err) {
          return err;
        }
      }
    }

    return null;
  }

  FindAllAuthOriginsByRecord(authRecord: RecordModel): AuthOrigin[] {
    const result: AuthOrigin[] = [new AuthOrigin()];

    this.RecordQuery(CollectionNameAuthOrigins)
      .AndWhere({
        collectionRef: authRecord.collection().id,
        recordRef: authRecord.Id,
      })
      .OrderBy("created DESC")
      .All(result);

    return result;
  }

  FindAllAuthOriginsByCollection(collection: Collection): AuthOrigin[] {
    const result: AuthOrigin[] = [new AuthOrigin()];

    this.RecordQuery(CollectionNameAuthOrigins).AndWhere({ collectionRef: collection.id }).OrderBy("created DESC").All(result);

    return result;
  }

  FindAuthOriginById(id: string): AuthOrigin {
    const result = new AuthOrigin();

    this.RecordQuery(CollectionNameAuthOrigins).AndWhere({ id }).Limit(1).One(result);

    return result;
  }

  FindAuthOriginByRecordAndFingerprint(authRecord: RecordModel, fingerprint: string): AuthOrigin {
    const result = new AuthOrigin();

    this.RecordQuery(CollectionNameAuthOrigins)
      .AndWhere({
        collectionRef: authRecord.collection().id,
        recordRef: authRecord.Id,
        fingerprint,
      })
      .Limit(1)
      .One(result);

    return result;
  }

  async DeleteAllAuthOriginsByRecord(authRecord: RecordModel): Promise<Error | null> {
    let models: AuthOrigin[];
    try {
      models = this.FindAllAuthOriginsByRecord(authRecord);
    } catch (error) {
      return error as Error;
    }

    const errors: Error[] = [];
    for (const model of models) {
      const err = await this.Delete(model);
      if (err) {
        errors.push(err);
      }
    }

    if (errors.length === 0) {
      return null;
    }

    if (errors.length === 1) {
      return errors[0]!;
    }

    return new Error(errors.map((err) => err.message ?? String(err)).join("\n"));
  }

  findAuthRecordByToken(token: string, validTypes: string[] = []): RecordModel {
    if (token === "") {
      throw new Error("missing token");
    }

    const claims = parseUnverifiedJWT(token);
    const id = typeof claims[TokenClaimId] === "string" ? claims[TokenClaimId] : "";
    const collectionId = typeof claims[TokenClaimCollectionId] === "string" ? claims[TokenClaimCollectionId] : "";
    const tokenType = typeof claims[TokenClaimType] === "string" ? claims[TokenClaimType] : "";

    if (!id || !collectionId || !tokenType) {
      throw new Error("missing or invalid token claims");
    }

    if (validTypes.length > 0 && !validTypes.includes(tokenType)) {
      throw new Error(`invalid token type "${tokenType}"`);
    }

    const collection = this.findCollectionById(collectionId);
    if (!collection || !collection.isAuth()) {
      throw new Error("the token is not associated to an auth collection record");
    }

    const record = this.findRecordById(collection, id);
    if (!record) {
      throw new Error("record not found");
    }

    const baseTokenKey = resolveBaseTokenKey(collection, tokenType);
    if (!baseTokenKey) {
      throw new Error("missing or invalid signing key");
    }

    const secret = record.tokenKey() + baseTokenKey;
    parseJWT(token, secret);

    return record;
  }

  FindAllCollections(...collectionTypes: string[]): Collection[] {
    const types = Array.from(new Set(collectionTypes.filter((type) => type)));
    const params: SQLQueryBindings[] = [];
    let sql =
      "select id, name, system, type, fields, indexes, listRule, viewRule, createRule, updateRule, deleteRule, options, created, updated from _collections";

    if (types.length > 0) {
      const placeholders = types.map(() => "?").join(", ");
      sql += ` where type in (${placeholders})`;
      params.push(...types);
    }

    sql += " order by rowid asc";

    const rows = this.db()
      .query(sql)
      .all(...params);

    if (!Array.isArray(rows)) {
      return [];
    }

    return rows.map((row) => collectionFromRow(row as CollectionRow));
  }

  FindCachedCollectionReferences(collection: Collection, ...excludeIds: string[]): Map<Collection, Field[]> {
    const exclude = new Set(excludeIds.filter((value) => value));
    const result = new Map<Collection, Field[]>();
    const collections = this.FindAllCollections();

    for (const candidate of collections) {
      if (exclude.has(candidate.id)) {
        continue;
      }

      for (const field of candidate.Fields) {
        if (field instanceof RelationField && field.CollectionId === collection.id) {
          const current = result.get(candidate) ?? [];
          current.push(field);
          result.set(candidate, current);
        }
      }
    }

    return result;
  }

  findCollectionById(id: string): Collection | null {
    const row = this.db()
      .query(
        "select id, name, system, type, fields, indexes, listRule, viewRule, createRule, updateRule, deleteRule, options, created, updated from _collections where id = ?",
      )
      .get(id) as CollectionRow | undefined;

    if (!row) {
      return null;
    }

    return collectionFromRow(row);
  }

  findCollectionByNameOrId(identifier: string): Collection | null {
    const row = this.db()
      .query(
        "select id, name, system, type, fields, indexes, listRule, viewRule, createRule, updateRule, deleteRule, options, created, updated from _collections where id = ? or name = ?",
      )
      .get(identifier, identifier) as CollectionRow | undefined;

    if (!row) {
      return null;
    }

    return collectionFromRow(row);
  }

  FindCachedCollectionByNameOrId(identifier: string): Collection | null {
    return this.findCollectionByNameOrId(identifier);
  }

  findRecordById(collection: Collection, id: string, rule: SqlExpr | null = null): RecordModel | null {
    const table = collection.name;
    if (!isSafeIdentifier(table)) {
      throw new Error(`unsafe table name ${table}`);
    }

    let sql = `select * from "${table}" where id = ?`;
    const params: SQLQueryBindings[] = [id];
    if (rule?.sql) {
      sql = appendWhere(sql, rule.sql);
      params.push(...(rule.params as SQLQueryBindings[]));
    }

    const row = this.db()
      .query(sql)
      .get(...params);
    if (!row || typeof row !== "object") {
      return null;
    }

    return RecordModel.fromRow(collection, row as RecordData);
  }

  findFirstRecordByFilter(
    collectionOrIdentifier: Collection | string,
    filter: string,
    ...params: SQLQueryBindings[]
  ): RecordModel | null {
    const collection =
      typeof collectionOrIdentifier === "string"
        ? this.findCollectionByNameOrId(collectionOrIdentifier)
        : collectionOrIdentifier;
    if (!collection) {
      return null;
    }

    let sql = `select {{${collection.name}}}.* from {{${collection.name}}}`;
    if (filter) {
      sql = appendWhere(sql, filter);
    }

    const row = this.db()
      .query(sql)
      .get(...params);
    if (!row || typeof row !== "object") {
      return null;
    }
    return RecordModel.fromRow(collection, row as RecordData);
  }

  NewFilesystem() {
    if (this.#settings.s3.enabled) {
      return NewS3(
        this.#settings.s3.bucket,
        this.#settings.s3.region,
        this.#settings.s3.endpoint,
        this.#settings.s3.accessKey,
        this.#settings.s3.secret,
        this.#settings.s3.forcePathStyle,
      );
    }

    return NewLocal(join(this.#dataDir, LocalStorageDirName));
  }

  NewBackupsFilesystem() {
    if (this.#settings.backups.s3.enabled) {
      return NewS3(
        this.#settings.backups.s3.bucket,
        this.#settings.backups.s3.region,
        this.#settings.backups.s3.endpoint,
        this.#settings.backups.s3.accessKey,
        this.#settings.backups.s3.secret,
        this.#settings.backups.s3.forcePathStyle,
      );
    }

    return NewLocal(join(this.#dataDir, LocalBackupsDirName));
  }

  // CreateBackup creates a new backup of the current app pb_data directory.
  //
  // If name is empty, it will be autogenerated.
  // If backup with the same name exists, the new backup file will replace it.
  //
  // The backup is executed within a transaction, meaning that new writes
  // will be temporary "blocked" until the backup file is generated.
  //
  // To safely perform the backup, it is recommended to have free disk space
  // for at least 2x the size of the pb_data directory.
  //
  // By default backups are stored in pb_data/backups
  // (the backups directory itself is excluded from the generated backup).
  //
  // When using S3 storage for the uploaded collection files, you have to
  // take care manually to backup those since they are not part of the pb_data.
  //
  // Backups can be stored on S3 if it is configured in app.Settings().Backups.
  async CreateBackup(ctx: unknown, name: string): Promise<Error | null> {
    if (this.store().has(StoreKeyActiveBackup)) {
      return new Error("try again later - another backup/restore operation has already been started");
    }

    this.store().set(StoreKeyActiveBackup, name);
    try {
      // default root dir entries to exclude from the backup generation
      // default root dir entries to exclude from the backup restore
      const event = new BackupEvent(this, ctx, name, [
        LocalBackupsDirName,
        LocalTempDirName,
        LocalAutocertCacheDirName,
        lostFoundDirName,
      ]);

      return (await this.OnBackupCreate().Trigger(event, async (e) => {
        // generate a default name if missing
        if (!e.Name) {
          e.Name = generateBackupName(e.App, "pb_backup_");
        }

        // make sure that the special temp directory exists
        // note: it needs to be inside the current pb_data to avoid "cross-device link" errors
        // make sure that the special temp directory exists
        // note: it needs to be inside the current pb_data to avoid "cross-device link" errors
        const localTempDir = join(e.App.dataDir(), LocalTempDirName);
        mkdirSync(localTempDir, { recursive: true });

        // archive pb_data in a temp directory, exluding the "backups" and the temp dirs
        //
        // run in transaction to temporary block other writes (transactions uses the NonconcurrentDB connection)
        // ---
        const tempPath = join(localTempDir, `pb_backup_${pseudorandomString(6)}`);

        const createErr = await e.App.RunInTransaction((txApp) => {
          return txApp.AuxRunInTransaction((auxApp) => {
            // run manual checkpoint and truncate the WAL files
            // (errors are ignored because it is not that important and the PRAGMA may not be supported by the used driver)
            try {
              auxApp.db().query("PRAGMA wal_checkpoint(TRUNCATE)").run();
            } catch {
              // ignore
            }

            try {
              auxApp.auxDb().query("PRAGMA wal_checkpoint(TRUNCATE)").run();
            } catch {
              // ignore
            }

            try {
              Create(auxApp.dataDir(), tempPath, ...e.Exclude);
              return null;
            } catch (error) {
              return error as Error;
            }
          });
        });

        if (createErr) {
          return createErr;
        }

        // persist the backup in the backups filesystem
        // ---
        try {
          const fsys = e.App.NewBackupsFilesystem();
          try {
            fsys.SetContext(e.Context);
            const file = NewFileFromPath(tempPath);
            file.OriginalName = e.Name;
            file.Name = file.OriginalName;
            await fsys.UploadFile(file, file.Name);
          } finally {
            await fsys.Close();
          }
        } catch (error) {
          return error as Error;
        } finally {
          rmSync(tempPath, { force: true });
        }

        return null;
      })) as Error | null;
    } finally {
      this.store().remove(StoreKeyActiveBackup);
    }
  }

  // RestoreBackup restores the backup with the specified name and restarts
  // the current running application process.
  //
  // NB! This feature is experimental and currently is expected to work only on UNIX based systems.
  //
  // To safely perform the restore it is recommended to have free disk space
  // for at least 2x the size of the restored pb_data backup.
  //
  // The performed steps are:
  //
  //  1. Download the backup with the specified name in a temp location
  //     (this is in case of S3; otherwise it creates a temp copy of the zip)
  //
  //  2. Extract the backup in a temp directory inside the app "pb_data"
  //     (eg. "pb_data/.pb_temp_to_delete/pb_restore").
  //
  //  3. Move the current app "pb_data" content (excluding the local backups and the special temp dir)
  //     under another temp sub dir that will be deleted on the next app start up
  //     (eg. "pb_data/.pb_temp_to_delete/old_pb_data").
  //     This is because on some environments it may not be allowed
  //     to delete the currently open "pb_data" files.
  //
  //  4. Move the extracted dir content to the app "pb_data".
  //
  //  5. Restart the app (on successful app bootstap it will also remove the old pb_data).
  //
  // If a failure occure during the restore process the dir changes are reverted.
  // If for whatever reason the revert is not possible, it panics.
  //
  // Note that if your pb_data has custom network mounts as subdirectories, then
  // it is possible the restore to fail during the `os.Rename` operations
  // (see https://github.com/pocketbase/pocketbase/issues/4647).
  async RestoreBackup(ctx: unknown, name: string): Promise<Error | null> {
    if (this.store().has(StoreKeyActiveBackup)) {
      return new Error("try again later - another backup/restore operation has already been started");
    }

    this.store().set(StoreKeyActiveBackup, name);
    try {
      const event = new BackupEvent(this, ctx, name, [
        LocalBackupsDirName,
        LocalTempDirName,
        LocalAutocertCacheDirName,
        lostFoundDirName,
      ]);

      return (await this.OnBackupRestore().Trigger(event, async (e) => {
        if (process.platform === "win32") {
          return new Error("restore is not supported on Windows");
        }

        const localTempDir = join(e.App.dataDir(), LocalTempDirName);
        mkdirSync(localTempDir, { recursive: true });

        let fsys;
        try {
          fsys = e.App.NewBackupsFilesystem();
        } catch (error) {
          return error as Error;
        }

        try {
          fsys.SetContext(e.Context);
          if (!(await fsys.Exists(name))) {
            return new Error(`missing or invalid backup file ${JSON.stringify(name)} to restore`);
          }

          const extractedDataDir = join(localTempDir, `pb_restore_${pseudorandomString(8)}`);
          try {
            // extract the zip
            if (e.App.settings().backups.s3.enabled) {
              const reader = await fsys.GetReader(name);
              const tempZipPath = join(localTempDir, `pb_restore_zip_${pseudorandomString(6)}`);
              try {
                // create a temp zip file from the blob.Reader and try to extract it
                writeFileSync(tempZipPath, reader.readAll());
                Extract(tempZipPath, extractedDataDir);
              } finally {
                reader.close();
                try {
                  // remove the temp zip file since we no longer need it
                  // (this is in case the app restarts and the defer calls are not called)
                  rmSync(tempZipPath, { force: true });
                } catch (error) {
                  e.App.Logger().Warn(
                    "[RestoreBackup] Failed to remove the temp zip backup file",
                    "file",
                    tempZipPath,
                    "error",
                    String(error),
                  );
                }
              }
            } else {
              // manually construct the local path to avoid creating a copy of the zip file
              // since the blob reader currently doesn't implement ReaderAt
              const zipPath = join(e.App.dataDir(), LocalBackupsDirName, basename(name));
              Extract(zipPath, extractedDataDir);
            }

            // ensure that at least a database file exists
            try {
              statSync(join(extractedDataDir, "data.db"));
            } catch (error) {
              return new Error(`data.db file is missing or invalid: ${(error as Error).message}`);
            }

            const oldTempDataDir = join(localTempDir, `old_pb_data_${pseudorandomString(8)}`);

            const replaceErr = await e.App.RunInTransaction((txApp) => {
              return txApp.AuxRunInTransaction((auxApp) => {
                // move the current pb_data content to a special temp location
                // that will hold the old data between dirs replace
                // (the temp dir will be automatically removed on the next app start)
                try {
                  MoveDirContent(auxApp.dataDir(), oldTempDataDir, ...e.Exclude);
                } catch (error) {
                  return new Error(
                    `failed to move the current pb_data content to a temp location: ${(error as Error).message}`,
                  );
                }

                // move the extracted archive content to the app's pb_data
                try {
                  MoveDirContent(extractedDataDir, auxApp.dataDir(), ...e.Exclude);
                } catch (error) {
                  return new Error(`failed to move the extracted archive content to pb_data: ${(error as Error).message}`);
                }

                return null;
              });
            });

            if (replaceErr) {
              return replaceErr;
            }

            const revertDataDirChanges = async (): Promise<Error | null> => {
              return e.App.RunInTransaction((txApp) => {
                return txApp.AuxRunInTransaction((auxApp) => {
                  try {
                    MoveDirContent(auxApp.dataDir(), extractedDataDir, ...e.Exclude);
                  } catch (error) {
                    return new Error(`failed to revert the extracted dir change: ${(error as Error).message}`);
                  }

                  try {
                    MoveDirContent(oldTempDataDir, auxApp.dataDir(), ...e.Exclude);
                  } catch (error) {
                    return new Error(`failed to revert old pb_data dir change: ${(error as Error).message}`);
                  }

                  return null;
                });
              });
            };

            // restart the app
            const restartErr = e.App.Restart();
            if (restartErr) {
              const revertErr = await revertDataDirChanges();
              if (revertErr) {
                throw revertErr;
              }

              return new Error(`failed to restart the app process: ${restartErr.message}`);
            }
          } finally {
            rmSync(extractedDataDir, { recursive: true, force: true });
          }
        } finally {
          await fsys.Close();
        }

        return null;
      })) as Error | null;
    } finally {
      this.store().remove(StoreKeyActiveBackup);
    }
  }

  // Restart restarts (aka. replaces) the current running application process.
  //
  // NB! It relies on execve which is supported only on UNIX based systems.
  Restart(): Error | null {
    if (process.platform === "win32") {
      return new Error("restart is not supported on windows");
    }

    // Deviation: Bun can't execve the current process, so we rebootstrap in-process.
    try {
      this.resetBootstrapState();
      this.bootstrap();
    } catch (error) {
      return error as Error;
    }

    return null;
  }

  async Save(model: Model): Promise<Error | null> {
    return this.saveModel(model, true);
  }

  async SaveNoValidate(model: Model): Promise<Error | null> {
    return this.saveModel(model, false);
  }

  async SaveWithContext(_ctx: unknown, model: Model): Promise<Error | null> {
    return this.saveModel(model, true);
  }

  async SaveNoValidateWithContext(_ctx: unknown, model: Model): Promise<Error | null> {
    return this.saveModel(model, false);
  }

  private async runRecordInterceptors(
    record: RecordModel,
    action: string,
    actionFunc: () => Error | null | Promise<Error | null>,
  ): Promise<Error | null> {
    if (!this.#hooksEnabled) {
      return await actionFunc();
    }
    return await record.callFieldInterceptors(null, this, action, actionFunc);
  }

  private async saveModel(model: Model, runValidation: boolean): Promise<Error | null> {
    const recordInfo = resolveRecordProxy(model);
    if (recordInfo) {
      const { record, model: eventModel } = recordInfo;
      const isNew = record.IsNew();
      const modelEvent = new ModelEvent(this, eventModel, isNew ? ModelEventTypeCreate : ModelEventTypeUpdate);
      const action = isNew ? InterceptorActionCreate : InterceptorActionUpdate;
      const executeAction = record.IsNew() ? InterceptorActionCreateExecute : InterceptorActionUpdateExecute;
      const afterSuccess = isNew ? InterceptorActionAfterCreate : InterceptorActionAfterUpdate;
      const afterError = isNew ? InterceptorActionAfterCreateError : InterceptorActionAfterUpdateError;

      const runPersist = async (): Promise<Error | null> =>
        this.runRecordInterceptors(record, executeAction, () => {
          if (this.#hooksEnabled) {
            const execErr = this.onRecordSaveExecute(record);
            if (execErr) {
              return execErr;
            }
          }
          return this.persistRecord(record);
        });

      const runValidatedExecute = async (): Promise<Error | null> =>
        this.runRecordInterceptors(record, action, async () => {
          if (runValidation) {
            const validateErr = await this.Validate(eventModel);
            if (validateErr) {
              return validateErr;
            }
          }

          return (await (isNew ? this.OnModelCreateExecute() : this.OnModelUpdateExecute()).Trigger(
            modelEvent,
            runPersist,
          )) as Error | null;
        });

      const saveErr = (await (isNew ? this.OnModelCreate() : this.OnModelUpdate()).Trigger(
        modelEvent,
        runValidatedExecute,
      )) as Error | null;

      if (saveErr) {
        const errorEvent = new ModelErrorEvent(modelEvent, saveErr);
        const afterErr = (await (isNew ? this.OnModelAfterCreateError() : this.OnModelAfterUpdateError()).Trigger(
          errorEvent,
          async () => this.runRecordInterceptors(record, afterError, () => errorEvent.Error),
        )) as Error | null;
        return afterErr ?? errorEvent.Error;
      }

      if (this.#txInfo) {
        this.#txInfo.OnComplete(async (txErr) => {
          if (txErr) {
            if (action === InterceptorActionCreate) {
              record.markNew(true);
            }
            const errorEvent = new ModelErrorEvent(modelEvent, txErr);
            const result = (await (isNew ? this.OnModelAfterCreateError() : this.OnModelAfterUpdateError()).Trigger(
              errorEvent,
              async () => this.runRecordInterceptors(record, afterError, () => errorEvent.Error),
            )) as Error | null;
            return result ?? null;
          }
          const result = (await (isNew ? this.OnModelAfterCreateSuccess() : this.OnModelAfterUpdateSuccess()).Trigger(
            modelEvent,
            async () => this.runRecordInterceptors(record, afterSuccess, () => null),
          )) as Error | null;
          return result ?? null;
        });
        return null;
      }

      const afterErr = (await (isNew ? this.OnModelAfterCreateSuccess() : this.OnModelAfterUpdateSuccess()).Trigger(
        modelEvent,
        async () => this.runRecordInterceptors(record, afterSuccess, () => null),
      )) as Error | null;
      return afterErr ?? null;
    }

    if (model instanceof Settings) {
      const isNew = model.IsNew();
      const modelEvent = new ModelEvent(this, model, isNew ? ModelEventTypeCreate : ModelEventTypeUpdate);
      const runValidatedExecute = async (): Promise<Error | null> => {
        if (runValidation) {
          const validateErr = await this.Validate(model);
          if (validateErr) {
            return validateErr;
          }
        }

        return (await (isNew ? this.OnModelCreateExecute() : this.OnModelUpdateExecute()).Trigger(modelEvent, () =>
          this.saveSettings(model),
        )) as Error | null;
      };

      const saveErr = (await (isNew ? this.OnModelCreate() : this.OnModelUpdate()).Trigger(
        modelEvent,
        runValidatedExecute,
      )) as Error | null;
      if (saveErr) {
        const errorEvent = new ModelErrorEvent(modelEvent, saveErr);
        const afterErr = (await (isNew ? this.OnModelAfterCreateError() : this.OnModelAfterUpdateError()).Trigger(
          errorEvent,
          () => errorEvent.Error,
        )) as Error | null;
        return afterErr ?? errorEvent.Error;
      }
      if (this.#txInfo) {
        this.#txInfo.OnComplete(async (txErr) => {
          if (txErr) {
            const errorEvent = new ModelErrorEvent(modelEvent, txErr);
            const result = (await (isNew ? this.OnModelAfterCreateError() : this.OnModelAfterUpdateError()).Trigger(
              errorEvent,
              () => errorEvent.Error,
            )) as Error | null;
            return result ?? null;
          }
          const result = (await (isNew ? this.OnModelAfterCreateSuccess() : this.OnModelAfterUpdateSuccess()).Trigger(
            modelEvent,
            () => null,
          )) as Error | null;
          return result ?? null;
        });
        return null;
      }
      const afterErr = (await (isNew ? this.OnModelAfterCreateSuccess() : this.OnModelAfterUpdateSuccess()).Trigger(
        modelEvent,
        () => null,
      )) as Error | null;
      return afterErr ?? null;
    }

    if (!(model instanceof Collection)) {
      return await this.saveGenericModel(model, runValidation);
    }

    const isNew = model.isNew();
    const modelEvent = new ModelEvent(this, model, isNew ? ModelEventTypeCreate : ModelEventTypeUpdate);
    const runValidatedExecute = async (): Promise<Error | null> => {
      if (runValidation) {
        if (isNew) {
          model.initDefaultId();
        }
        const validateErr = await this.Validate(model);
        if (validateErr) {
          return validateErr;
        }
      }
      return (await (isNew ? this.OnModelCreateExecute() : this.OnModelUpdateExecute()).Trigger(modelEvent, async () =>
        this.saveCollection(model, false),
      )) as Error | null;
    };
    const saveErr = (await (isNew ? this.OnModelCreate() : this.OnModelUpdate()).Trigger(
      modelEvent,
      runValidatedExecute,
    )) as Error | null;
    if (saveErr) {
      const errorEvent = new ModelErrorEvent(modelEvent, saveErr);
      const afterErr = (await (isNew ? this.OnModelAfterCreateError() : this.OnModelAfterUpdateError()).Trigger(
        errorEvent,
        () => errorEvent.Error,
      )) as Error | null;
      return afterErr ?? errorEvent.Error;
    }
    if (this.#txInfo) {
      this.#txInfo.OnComplete(async (txErr) => {
        if (txErr) {
          const errorEvent = new ModelErrorEvent(modelEvent, txErr);
          const result = (await (isNew ? this.OnModelAfterCreateError() : this.OnModelAfterUpdateError()).Trigger(
            errorEvent,
            () => errorEvent.Error,
          )) as Error | null;
          return result ?? null;
        }
        const result = (await (isNew ? this.OnModelAfterCreateSuccess() : this.OnModelAfterUpdateSuccess()).Trigger(
          modelEvent,
          () => null,
        )) as Error | null;
        return result ?? null;
      });
      return null;
    }
    const afterErr = (await (isNew ? this.OnModelAfterCreateSuccess() : this.OnModelAfterUpdateSuccess()).Trigger(
      modelEvent,
      () => null,
    )) as Error | null;
    return afterErr ?? null;
  }

  private async saveGenericModel(model: Model, runValidation: boolean): Promise<Error | null> {
    const isNew = model.IsNew();
    const modelEvent = new ModelEvent(this, model, isNew ? ModelEventTypeCreate : ModelEventTypeUpdate);

    const runValidatedExecute = async (): Promise<Error | null> => {
      if (runValidation) {
        const validateErr = await this.Validate(model);
        if (validateErr) {
          return validateErr;
        }
      }

      return (await (isNew ? this.OnModelCreateExecute() : this.OnModelUpdateExecute()).Trigger(modelEvent, () =>
        this.persistGenericModel(model),
      )) as Error | null;
    };

    const saveErr = (await (isNew ? this.OnModelCreate() : this.OnModelUpdate()).Trigger(
      modelEvent,
      runValidatedExecute,
    )) as Error | null;
    if (saveErr) {
      if (isNew) {
        model.MarkAsNew();
      }
      const errorEvent = new ModelErrorEvent(modelEvent, saveErr);
      const afterErr = (await (isNew ? this.OnModelAfterCreateError() : this.OnModelAfterUpdateError()).Trigger(
        errorEvent,
        () => errorEvent.Error,
      )) as Error | null;
      return afterErr ?? errorEvent.Error;
    }

    if (this.#txInfo) {
      this.#txInfo.OnComplete(async (txErr) => {
        if (txErr) {
          if (isNew) {
            model.MarkAsNew();
          }
          const errorEvent = new ModelErrorEvent(modelEvent, txErr);
          const result = (await (isNew ? this.OnModelAfterCreateError() : this.OnModelAfterUpdateError()).Trigger(
            errorEvent,
            () => errorEvent.Error,
          )) as Error | null;
          return result ?? null;
        }
        const result = (await (isNew ? this.OnModelAfterCreateSuccess() : this.OnModelAfterUpdateSuccess()).Trigger(
          modelEvent,
          () => null,
        )) as Error | null;
        return result ?? null;
      });
      return null;
    }

    const afterErr = (await (isNew ? this.OnModelAfterCreateSuccess() : this.OnModelAfterUpdateSuccess()).Trigger(
      modelEvent,
      () => null,
    )) as Error | null;
    return afterErr ?? null;
  }

  async Validate(model: Model): Promise<Error | null> {
    const preValidator = model as Partial<PreValidator>;
    if (typeof preValidator.PreValidate === "function") {
      const preErr = preValidator.PreValidate(null, this);
      if (preErr) {
        return preErr;
      }
    }

    const event = new ModelEvent(this, model, ModelEventTypeValidate);
    const result = (await this.OnModelValidate().Trigger(event, async (modelEvent) => {
      const recordInfo = resolveRecordProxy(model);
      if (!recordInfo && model instanceof Collection) {
        const original = model.isNew() ? null : this.findCollectionById(model.LastSavedPK());
        const validationErr = await this.validateCollection(model, original);
        if (validationErr) {
          return validationErr;
        }
      }

      const postValidator = model as Partial<PostValidator>;
      if (typeof postValidator.PostValidate === "function") {
        const postErr = postValidator.PostValidate(null, this);
        if (postErr) {
          return postErr;
        }
      }

      return await modelEvent.Next();
    })) as Error | null;

    return result ?? null;
  }

  async Delete(model: Model): Promise<Error | null> {
    const recordInfo = resolveRecordProxy(model);
    if (recordInfo) {
      const { record, model: eventModel } = recordInfo;
      const modelEvent = new ModelEvent(this, eventModel, ModelEventTypeDelete);
      const action = InterceptorActionDelete;
      const executeAction = InterceptorActionDeleteExecute;
      const afterSuccess = InterceptorActionAfterDelete;
      const afterError = InterceptorActionAfterDeleteError;

      const runDelete = async (): Promise<Error | null> =>
        this.runRecordInterceptors(record, action, async () =>
          this.runRecordInterceptors(record, executeAction, () => this.deleteRecord(record)),
        );
      const deleteErr = (await this.OnModelDelete().Trigger(modelEvent, async () =>
        this.OnModelDeleteExecute().Trigger(modelEvent, runDelete),
      )) as Error | null;

      if (deleteErr) {
        const errorEvent = new ModelErrorEvent(modelEvent, deleteErr);
        const afterErr = (await this.OnModelAfterDeleteError().Trigger(errorEvent, async () =>
          this.runRecordInterceptors(record, afterError, () => errorEvent.Error),
        )) as Error | null;
        return afterErr ?? errorEvent.Error;
      }

      if (this.#txInfo) {
        this.#txInfo.OnComplete(async (txErr) => {
          if (txErr) {
            const errorEvent = new ModelErrorEvent(modelEvent, txErr);
            const result = (await this.OnModelAfterDeleteError().Trigger(errorEvent, async () =>
              this.runRecordInterceptors(record, afterError, () => errorEvent.Error),
            )) as Error | null;
            return result ?? null;
          }
          const result = (await this.OnModelAfterDeleteSuccess().Trigger(modelEvent, async () =>
            this.runRecordInterceptors(record, afterSuccess, () => null),
          )) as Error | null;
          return result ?? null;
        });
        return null;
      }

      const afterErr = (await this.OnModelAfterDeleteSuccess().Trigger(modelEvent, async () =>
        this.runRecordInterceptors(record, afterSuccess, () => null),
      )) as Error | null;
      return afterErr ?? null;
    }

    if (!(model instanceof Collection)) {
      return await this.deleteGenericModel(model);
    }

    const modelEvent = new ModelEvent(this, model, ModelEventTypeDelete);
    const deleteErr = (await this.OnModelDelete().Trigger(modelEvent, () =>
      this.OnModelDeleteExecute().Trigger(modelEvent, () => this.deleteCollection(model)),
    )) as Error | null;
    if (deleteErr) {
      const errorEvent = new ModelErrorEvent(modelEvent, deleteErr);
      const afterErr = (await this.OnModelAfterDeleteError().Trigger(errorEvent, () => errorEvent.Error)) as Error | null;
      return afterErr ?? errorEvent.Error;
    }
    if (this.#txInfo) {
      this.#txInfo.OnComplete(async (txErr) => {
        if (txErr) {
          const errorEvent = new ModelErrorEvent(modelEvent, txErr);
          const result = (await this.OnModelAfterDeleteError().Trigger(errorEvent, () => errorEvent.Error)) as Error | null;
          return result ?? null;
        }
        const result = (await this.OnModelAfterDeleteSuccess().Trigger(modelEvent, () => null)) as Error | null;
        return result ?? null;
      });
      return null;
    }
    const afterErr = (await this.OnModelAfterDeleteSuccess().Trigger(modelEvent, () => null)) as Error | null;
    return afterErr ?? null;
  }

  async RunInTransaction(fn: (txApp: App) => Error | null | Promise<Error | null>): Promise<Error | null> {
    if (this.#txInfo) {
      return (await fn(this)) ?? null;
    }

    this.#txInfo = new TxAppInfo();
    let txErr: Error | null = null;
    this.db().run("BEGIN");
    try {
      txErr = (await fn(this)) ?? null;
    } catch (error) {
      txErr = error as Error;
    }

    if (txErr) {
      this.db().run("ROLLBACK");
    } else {
      this.db().run("COMMIT");
    }

    const txInfo = this.#txInfo;
    this.#txInfo = null;
    const afterErr = await txInfo.runAfterFuncs(txErr);
    return joinErrors(txErr, afterErr);
  }

  async AuxRunInTransaction(fn: (txApp: App) => Error | null | Promise<Error | null>): Promise<Error | null> {
    let txErr: Error | null = null;
    this.auxDb().run("BEGIN");
    try {
      txErr = (await fn(this)) ?? null;
    } catch (error) {
      txErr = error as Error;
    }

    if (txErr) {
      this.auxDb().run("ROLLBACK");
    } else {
      this.auxDb().run("COMMIT");
    }

    return txErr;
  }

  // Bun port adds an async variant to accommodate request parsing and hook delays.
  async RunInTransactionAsync(fn: (txApp: App) => Promise<Error | null> | Error | null): Promise<Error | null> {
    return this.RunInTransaction(fn);
  }

  async DeleteWithContext(_ctx: unknown, model: Model): Promise<Error | null> {
    return this.Delete(model);
  }

  // TruncateCollection deletes all records associated with the provided collection.
  //
  // The truncate operation is executed in a single transaction,
  // aka. either everything is deleted or none.
  //
  // Note that this method will also trigger the records related
  // cascade and file delete actions.
  async TruncateCollection(collection: Collection): Promise<Error | null> {
    if (collection.isView()) {
      return new Error("view collections cannot be truncated since they don't store their own records");
    }

    return this.RunInTransaction(async (txApp) => {
      const records: RecordModel[] = [];

      for (;;) {
        try {
          txApp.RecordQuery(collection).Limit(500).All(records);
        } catch (error) {
          return error as Error;
        }

        if (records.length === 0) {
          return null;
        }

        for (const record of records) {
          const err = await txApp.Delete(record);
          if (err) {
            return err;
          }
        }

        records.length = 0;
      }
    });
  }

  // ImportCollectionsByMarshaledJSON is the same as ImportCollections
  // but accept marshaled json array as import data (usually used for the autogenerated snapshots).
  async ImportCollectionsByMarshaledJSON(rawSliceOfMaps: string | Uint8Array, deleteMissing: boolean): Promise<Error | null> {
    try {
      const decoded = typeof rawSliceOfMaps === "string" ? rawSliceOfMaps : new TextDecoder().decode(rawSliceOfMaps);
      const data = JSON.parse(decoded) as Array<Record<string, unknown>>;
      if (!Array.isArray(data)) {
        return new Error("invalid collections data");
      }
      return await this.ImportCollections(data, deleteMissing);
    } catch (error) {
      return error as Error;
    }
  }

  // ImportCollections imports the provided collections data in a single transaction.
  //
  // For existing matching collections, the imported data is unmarshaled on top of the existing model.
  //
  // NB! If deleteMissing is true, ALL NON-SYSTEM COLLECTIONS AND SCHEMA FIELDS,
  // that are not present in the imported configuration, WILL BE DELETED
  // (this includes their related records data).
  async ImportCollections(toImport: Array<Record<string, unknown>>, deleteMissing: boolean): Promise<Error | null> {
    if (toImport.length === 0) {
      return new Error("no collections to import");
    }

    const importedCollections: Collection[] = Array.from({ length: toImport.length });
    const mappedImported = new Map<string, Collection>();

    for (let i = 0; i < toImport.length; i += 1) {
      const data = (toImport[i] ?? {}) as Record<string, unknown>;
      let identifier = typeof data.id === "string" ? data.id : "";
      if (!identifier) {
        identifier = typeof data.name === "string" ? data.name : "";
      }

      const existing = identifier ? this.findCollectionByNameOrId(identifier) : null;
      const imported = existing ? (this.findCollectionById(existing.id) ?? existing) : new Collection();
      const normalizedData = normalizeImportedCollectionData(data, deleteMissing);

      applyImportData(imported, normalizedData);

      if (existing) {
        for (const field of existing.Fields) {
          if (!field.GetSystem() && deleteMissing) {
            continue;
          }
          if (!imported.Fields.GetById(field.GetId())) {
            const found = imported.Fields.GetByName(field.GetName());
            if (found && found.Type() === field.Type()) {
              found.SetId(field.GetId());
            }
            imported.Fields.Add(field);
          }
        }
      }

      imported.IntegrityChecks(false);
      importedCollections[i] = imported;
      mappedImported.set(imported.id, imported);
    }

    importedCollections.sort((left, right) => {
      const leftView = left.IsView();
      const rightView = right.IsView();
      if (leftView !== rightView) {
        return leftView ? 1 : -1;
      }

      const created = left.created.compare(right.created);
      if (created !== 0) {
        return created;
      }

      return left.updated.compare(right.updated);
    });

    return this.RunInTransaction(async (txApp) => {
      const rows = txApp
        .db()
        .query(
          "select id, name, system, type, fields, indexes, listRule, viewRule, createRule, updateRule, deleteRule, options, created, updated from _collections order by updated asc",
        )
        .all() as CollectionRow[];
      const existingCollections = rows.map((row) => collectionFromRow(row));
      const mappedExisting = new Map<string, Collection>();

      for (const existing of existingCollections) {
        existing.IntegrityChecks(false);
        mappedExisting.set(existing.id, existing);
      }

      if (deleteMissing) {
        for (const existing of existingCollections) {
          if (mappedImported.get(existing.id) || existing.system) {
            continue;
          }
          const err = await txApp.Delete(existing);
          if (err) {
            return err;
          }
        }
      }

      for (const imported of importedCollections) {
        const err = await txApp.SaveNoValidate(imported);
        if (err) {
          return new Error(`failed to save collection "${imported.name}": ${err.message}`);
        }
      }

      for (const imported of importedCollections) {
        const original = mappedExisting.get(imported.id) ?? imported;
        const validationErr = await (txApp as BaseApp).validateCollection(imported, original);
        if (validationErr) {
          const serialized = JSON.stringify(validationErr, null, 2);
          return new ValidationErrors({
            collections: newError(
              "validation_collections_import_failure",
              `Data validations failed for collection "${imported.name}" (${imported.id}):\n${serialized}`,
            ),
          });
        }
      }

      return null;
    });
  }

  private validateRecord(record: RecordModel): Error | null {
    const errors: Record<string, Error> = {};
    for (const field of record.collection().Fields) {
      const err = field.ValidateValue(null, this, record);
      if (err) {
        errors[field.GetName()] = err;
      }
    }
    return Object.keys(errors).length > 0 ? new ValidationErrors(errors) : null;
  }

  private onRecordSaveExecute(record: RecordModel): Error | null {
    if (!record.collection().IsAuth()) {
      return null;
    }

    if (!record.IsNew()) {
      let lastSavedRecord: RecordModel;
      try {
        lastSavedRecord = this.FindRecordById(record.collection(), record.Id);
      } catch (error) {
        return error as Error;
      }

      if (
        lastSavedRecord.TokenKey() === record.TokenKey() &&
        (lastSavedRecord.Get(FieldNamePassword) !== record.Get(FieldNamePassword) || lastSavedRecord.Email() !== record.Email())
      ) {
        record.RefreshTokenKey();
      }
    }

    const authCollections = this.FindAllCollections(CollectionTypeAuth);
    for (const collection of authCollections) {
      if (collection.Id === record.collection().Id) {
        continue;
      }
      const existing = this.findRecordById(collection, record.Id);
      if (existing) {
        return new ValidationErrors({
          id: newError("validation_invalid_auth_id", "Invalid or duplicated auth record id."),
        });
      }
    }

    return null;
  }

  private async onRecordDeleteExecute(event: RecordEvent): Promise<Error | null> {
    const record = event.Record;
    if (!record) {
      return new Error("missing record in record delete event");
    }
    const refs = this.FindCachedCollectionReferences(record.collection());

    const originalApp = event.App;
    const txErr = await this.RunInTransaction(async (txApp) => {
      event.App = txApp;
      const nextResult = await event.Next();
      if (nextResult instanceof Error) {
        return nextResult;
      }

      return await cascadeRecordDelete(txApp, record, refs);
    });
    event.App = originalApp;

    return txErr ?? null;
  }

  private persistRecord(record: RecordModel): Error | null {
    let data: Record<string, unknown>;
    try {
      data = record.DBExport();
    } catch (error) {
      return error as Error;
    }

    if (!("id" in data) || !data.id) {
      data.id = record.Id;
    }
    if (!data.id) {
      return new Error("empty primary key is not allowed");
    }

    const keys = Object.keys(data);
    try {
      if (record.IsNew()) {
        const columns = keys.map((key) => `"${key}"`).join(", ");
        const placeholders = keys.map(() => "?").join(", ");
        const values = keys.map((key) => normalizeDbValue(data[key]));
        const sql = `insert into "${record.TableName()}" (${columns}) values (${placeholders})`;
        this.db().run(sql, values);
      } else {
        const columns = keys.filter((key) => key !== "id");
        if (columns.length > 0) {
          const assignments = columns.map((key) => `"${key}" = ?`).join(", ");
          const values = columns.map((key) => normalizeDbValue(data[key]));
          values.push(record.Id);
          const sql = `update "${record.TableName()}" set ${assignments} where id = ?`;
          this.db().run(sql, values);
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      return NormalizeUniqueIndexError(error, record.collection().name, record.collection().Fields.FieldNames());
    }

    return record.PostScan();
  }

  private persistGenericModel(model: Model): Error | null {
    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(model as Record<string, unknown>)) {
      if (typeof value === "function" || value === undefined) {
        continue;
      }
      data[snakecase(key)] = value;
    }

    if (!("id" in data) || !data.id) {
      data.id = model.PK();
    }

    if (!data.id) {
      return new Error("empty primary key is not allowed");
    }

    const keys = Object.keys(data);
    if (keys.length === 0) {
      return null;
    }

    try {
      if (model.IsNew()) {
        const columns = keys.map((key) => `"${key}"`).join(", ");
        const placeholders = keys.map(() => "?").join(", ");
        const values = keys.map((key) => normalizeDbValue(data[key]));
        const sql = `insert into {{${model.TableName()}}} (${columns}) values (${placeholders})`;
        this.db().run(sql, values);
        model.MarkAsNotNew();
      } else {
        const columns = keys.filter((key) => key !== "id");
        if (columns.length > 0) {
          const assignments = columns.map((key) => `"${key}" = ?`).join(", ");
          const values = columns.map((key) => normalizeDbValue(data[key]));
          values.push(normalizeDbValue(model.PK() ?? data.id));
          const sql = `update {{${model.TableName()}}} set ${assignments} where [[id]] = ?`;
          this.db().run(sql, values);
        }
        model.MarkAsNotNew();
      }
    } catch (error) {
      return error as Error;
    }

    return null;
  }

  private deleteRecord(record: RecordModel): Error | null {
    if (!record.Id) {
      return new Error("missing record id");
    }
    this.db().run(`delete from {{${record.TableName()}}} where id = ?`, [record.Id]);
    return null;
  }

  private async deleteGenericModel(model: Model): Promise<Error | null> {
    const pk = model.PK();
    if (!pk) {
      return new Error("the model can be deleted only if it is existing and has a non-empty primary key");
    }

    const modelEvent = new ModelEvent(this, model, ModelEventTypeDelete);

    const deleteErr = (await this.OnModelDelete().Trigger(modelEvent, () =>
      this.OnModelDeleteExecute().Trigger(modelEvent, () => {
        try {
          this.db().run(`delete from {{${model.TableName()}}} where [[id]] = ?`, [normalizeDbValue(pk)]);
          return null;
        } catch (error) {
          return error as Error;
        }
      }),
    )) as Error | null;

    if (deleteErr) {
      const errorEvent = new ModelErrorEvent(modelEvent, deleteErr);
      const afterErr = (await this.OnModelAfterDeleteError().Trigger(errorEvent, () => errorEvent.Error)) as Error | null;
      return afterErr ?? errorEvent.Error;
    }

    if (this.#txInfo) {
      this.#txInfo.OnComplete(async (txErr) => {
        if (txErr) {
          const errorEvent = new ModelErrorEvent(modelEvent, txErr);
          const result = (await this.OnModelAfterDeleteError().Trigger(errorEvent, () => errorEvent.Error)) as Error | null;
          return result ?? null;
        }
        const result = (await this.OnModelAfterDeleteSuccess().Trigger(modelEvent, () => null)) as Error | null;
        return result ?? null;
      });
      return null;
    }

    const afterErr = (await this.OnModelAfterDeleteSuccess().Trigger(modelEvent, () => null)) as Error | null;
    return afterErr ?? null;
  }

  private saveSettings(settings: Settings): Error | null {
    const now = NowDateTime().String();
    const raw = JSON.stringify(settings.toRaw());
    const encryptionKey = process.env[this.#encryptionEnv] ?? "";
    const value = encryptionKey ? encrypt(Buffer.from(raw, "utf8"), encryptionKey) : raw;

    if (settings.IsNew()) {
      this.db().run("insert into _params (id, value, created, updated) values (?, ?, ?, ?)", [settings.PK(), value, now, now]);
      settings.MarkAsNotNew();
    } else {
      const changes = this.db().run("update _params set value = ?, updated = ? where id = ?", [value, now, settings.PK()]);
      if (changes.changes === 0) {
        this.db().run("insert into _params (id, value, created, updated) values (?, ?, ?, ?)", [
          settings.PK(),
          value,
          now,
          now,
        ]);
      }
      settings.MarkAsNotNew();
    }

    this.reloadSettings();

    return null;
  }

  private async saveCollection(collection: Collection, runValidation: boolean): Promise<Error | null> {
    const original = collection.isNew() ? null : this.findCollectionById(collection.LastSavedPK());

    if (!collection.type) {
      collection.type = "base";
    }

    if (collection.isNew()) {
      collection.initDefaultId();
      collection.created = NowDateTime();
    }
    collection.updated = NowDateTime();

    collection.Fields = NewFieldsList(...collection.Fields);
    collection.initDefaultFields();
    if (collection.isAuth()) {
      collection.unsetMissingOAuth2MappedFields();
    }
    collection.updateGeneratedIdIfExists(this);

    normalizeCollectionFields(collection);

    if (runValidation) {
      const validationErr = await this.Validate(collection);
      if (validationErr) {
        return validationErr;
      }
    }

    if (collection.isView()) {
      let viewFields: FieldsList;
      try {
        viewFields = await this.CreateViewFields(collection.ViewQuery);
      } catch (error) {
        return error as Error;
      }

      if (original) {
        const deleteErr = this.DeleteView(original.name);
        if (deleteErr) {
          return deleteErr;
        }
      }

      const saveViewErr = await this.SaveView(collection.name, collection.ViewQuery);
      if (saveViewErr) {
        return saveViewErr;
      }

      collection.Fields = viewFields;
    }

    const fieldsJson = JSON.stringify(collection.Fields.toJSON());
    const indexesJson = JSON.stringify(collection.indexes ?? []);
    const optionsJson = JSON.stringify(collection.options ?? {});
    const now = collection.updated.toString();
    const created = collection.created.toString();

    if (collection.isNew()) {
      this.db().run(
        `insert into _collections
          (id, system, type, name, fields, indexes, listRule, viewRule, createRule, updateRule, deleteRule, options, created, updated)
         values
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          collection.id,
          collection.system ? 1 : 0,
          collection.type,
          collection.name,
          fieldsJson,
          indexesJson,
          collection.listRule ?? null,
          collection.viewRule ?? null,
          collection.createRule ?? null,
          collection.updateRule ?? null,
          collection.deleteRule ?? null,
          optionsJson,
          created,
          now,
        ],
      );
      collection.markNew(false);
    } else {
      this.db().run(
        `update _collections
          set system = ?, type = ?, name = ?, fields = ?, indexes = ?, listRule = ?, viewRule = ?, createRule = ?, updateRule = ?, deleteRule = ?, options = ?, updated = ?
         where id = ?`,
        [
          collection.system ? 1 : 0,
          collection.type,
          collection.name,
          fieldsJson,
          indexesJson,
          collection.listRule ?? null,
          collection.viewRule ?? null,
          collection.createRule ?? null,
          collection.updateRule ?? null,
          collection.deleteRule ?? null,
          optionsJson,
          now,
          collection.id,
        ],
      );
    }

    const syncErr = await this.syncRecordTableSchema(collection, original);
    if (syncErr) {
      return syncErr;
    }

    return null;
  }

  private deleteCollection(collection: Collection): Error | null {
    if (collection.system) {
      return new Error(`[${collection.name}] system collections cannot be deleted`);
    }
    if (collection.id === "") {
      return new Error("missing collection id");
    }

    if (collection.integrityChecksEnabled()) {
      const references = this.FindCachedCollectionReferences(collection, collection.id);
      if (references.size > 0) {
        const names = Array.from(references.keys()).map((ref) => ref.name);
        return new Error(`[${collection.name}] failed to delete due to existing relation references: ${names.join(", ")}`);
      }
    }

    const dropErr = this.dropCollectionIndexes(collection);
    if (dropErr) {
      return dropErr;
    }

    if (collection.isView()) {
      const viewErr = this.DeleteView(collection.name);
      if (viewErr) {
        return viewErr;
      }
    } else {
      this.db().run(`drop table if exists {{${collection.name}}}`);
    }

    this.db().run("delete from _collections where id = ?", [collection.id]);
    return null;
  }

  private async validateCollection(collection: Collection, original: Collection | null): Promise<Error | null> {
    return await validateCollection(this, collection, original);
  }

  private async syncRecordTableSchema(newCollection: Collection, oldCollection: Collection | null): Promise<Error | null> {
    if (newCollection.isView()) {
      return null;
    }

    return await this.RunInTransaction((txApp) => {
      const db = (txApp as BaseApp).db();
      const hasOldTable = oldCollection ? (txApp as BaseApp).HasTable(oldCollection.name) : false;

      if (!hasOldTable) {
        const columns = newCollection.Fields.map((field) => `"${field.GetName()}" ${field.ColumnType(txApp)}`);
        db.run(`create table if not exists {{${newCollection.name}}} (${columns.join(", ")})`);
        return (txApp as BaseApp).createCollectionIndexes(newCollection);
      }

      const oldTableName = oldCollection?.name ?? newCollection.name;
      const newTableName = newCollection.name;
      const needTableRename = oldTableName.toLowerCase() !== newTableName.toLowerCase();
      if (needTableRename) {
        db.run(`alter table {{${oldTableName}}} rename to {{${newTableName}}}`);
      }

      const oldFields = oldCollection?.Fields ?? new FieldsList();
      const newFields = newCollection.Fields;
      const oldIndexesJson = JSON.stringify(oldCollection?.indexes ?? []);
      const newIndexesJson = JSON.stringify(newCollection.indexes ?? []);
      const oldFieldsJson = JSON.stringify(oldFields.toJSON());
      const newFieldsJson = JSON.stringify(newFields.toJSON());
      const needIndexesUpdate = needTableRename || oldFieldsJson !== newFieldsJson || oldIndexesJson !== newIndexesJson;

      if (needIndexesUpdate && oldCollection) {
        const dropErr = (txApp as BaseApp).dropCollectionIndexes(oldCollection);
        if (dropErr) {
          return dropErr;
        }
      }

      for (const oldField of oldFields) {
        if (!newFields.GetById(oldField.GetId())) {
          db.run(`alter table {{${newTableName}}} drop column "${oldField.GetName()}"`);
        }
      }

      const toRename: Record<string, string> = {};
      for (const field of newFields) {
        const oldField = oldFields.GetById(field.GetId());
        if (!oldField) {
          const tempName = `${field.GetName()}${randomString(5)}`;
          toRename[tempName] = field.GetName();
          db.run(`alter table {{${newTableName}}} add column "${tempName}" ${field.ColumnType(txApp)}`);
        } else if (oldField.GetName() !== field.GetName()) {
          const tempName = `${field.GetName()}${randomString(5)}`;
          toRename[tempName] = field.GetName();
          db.run(`alter table {{${newTableName}}} rename column "${oldField.GetName()}" to "${tempName}"`);
        }
      }

      for (const [tempName, actualName] of Object.entries(toRename)) {
        db.run(`alter table {{${newTableName}}} rename column "${tempName}" to "${actualName}"`);
      }

      // Deviation: single vs multiple field migration and view resave are not implemented yet.

      if (needIndexesUpdate) {
        return (txApp as BaseApp).createCollectionIndexes(newCollection);
      }
      return null;
    });
  }

  private createCollectionIndexes(collection: Collection): Error | null {
    if (collection.isView()) {
      return null;
    }

    const errors: Record<string, Error> = {};
    const indexes = collection.indexes ?? [];

    for (let i = 0; i < indexes.length; i += 1) {
      const index = indexes[i];
      if (!index) {
        continue;
      }

      const parsed = parseIndex(index);
      parsed.tableName = collection.name;

      if (!parsed.isValid()) {
        errors[String(i)] = newError("validation_invalid_index_expression", "Invalid CREATE INDEX expression.");
        continue;
      }

      const sql = parsed.build();
      if (!sql) {
        errors[String(i)] = newError("validation_invalid_index_expression", "Invalid CREATE INDEX expression.");
        continue;
      }

      try {
        this.db().run(sql);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors[String(i)] = newError(
          "validation_invalid_index_expression",
          `Failed to create index ${parsed.indexName} - ${message}.`,
        );
      }
    }

    if (Object.keys(errors).length > 0) {
      return new ValidationErrors({ indexes: new ValidationErrors(errors) });
    }

    return null;
  }

  // registerAutobackupHooks registers the autobackup app serve hooks.
  private registerBaseHooks(): void {
    this.OnModelAfterDeleteSuccess().Bind({
      Id: "__pbFilesManagerDelete__",
      Func: async (event) => {
        const model = event.Model;
        if (!model) {
          return await event.Next();
        }

        const baseFilesPath = resolveBaseFilesPath(model);
        if (!baseFilesPath || !supportFiles(model)) {
          return await event.Next();
        }

        let fsys;
        try {
          fsys = this.NewFilesystem();
        } catch (error) {
          this.Logger().Error("Failed to initialize filesystem for delete hook", "error", String(error));
          return await event.Next();
        }

        try {
          const prefix = baseFilesPath.replace(/\/+$/g, "") + "/";
          const failed = await fsys.DeletePrefix(prefix);
          if (failed.length > 0) {
            this.Logger().Error("Failed to delete storage prefix", "prefix", prefix);
          }
        } finally {
          await fsys.Close();
        }

        return await event.Next();
      },
    });

    this.OnServe().Bind({
      Id: "__pbCronStart__",
      Priority: 999,
      Func: (event) => {
        this.Cron().Start();
        return event.Next();
      },
    });

    this.Cron().Add("__pbDBOptimize__", "0 0 * * *", () => {
      try {
        this.db().query("PRAGMA wal_checkpoint(TRUNCATE)").run();
      } catch (error) {
        this.Logger().Warn("Failed to run periodic PRAGMA wal_checkpoint for the main DB", "error", String(error));
      }

      try {
        this.auxDb().query("PRAGMA wal_checkpoint(TRUNCATE)").run();
      } catch (error) {
        this.Logger().Warn("Failed to run periodic PRAGMA wal_checkpoint for the auxiliary DB", "error", String(error));
      }

      try {
        this.db().query("PRAGMA optimize").run();
      } catch (error) {
        this.Logger().Warn("Failed to run periodic PRAGMA optimize", "error", String(error));
      }
    });

    this.Cron().Add("__pbLogsCleanup__", "0 */6 * * *", () => {
      const createdBefore = NowDateTime()
        .addDate(0, 0, -1 * this.settings().logs.maxDays)
        .time();
      const deleteErr = this.DeleteOldLogs(createdBefore);
      if (deleteErr) {
        this.Logger().Warn("Failed to delete old logs", "error", deleteErr);
      }
    });
  }

  // registerAutobackupHooks registers the autobackup app serve hooks.
  private registerAutobackupHooks(): void {
    const jobId = "__pbAutoBackup__";

    const loadJob = () => {
      const rawSchedule = this.#settings.backups.cron;
      if (!rawSchedule) {
        this.#cron.Remove(jobId);
        return;
      }

      this.#cron.Add(jobId, rawSchedule, () => {
        void (async () => {
          const autoPrefix = "@auto_pb_backup_";
          const name = generateBackupName(this, autoPrefix);

          const backupErr = await this.CreateBackup(null, name);
          if (backupErr) {
            this.Logger().Error("[Backup cron] Failed to create backup", "name", name, "error", backupErr.message);
          }

          const maxKeep = this.#settings.backups.cronMaxKeep;
          if (maxKeep === 0) {
            return; // no explicit limit
          }

          let fsys;
          try {
            fsys = this.NewBackupsFilesystem();
          } catch (error) {
            this.Logger().Error("[Backup cron] Failed to initialize the backup filesystem", "error", String(error));
            return;
          }

          try {
            const files = await fsys.List(autoPrefix);
            if (maxKeep >= files.length) {
              return; // nothing to remove
            }

            // sort desc
            files.sort((a, b) => b.ModTime.getTime() - a.ModTime.getTime());
            // keep only the most recent n auto backup files
            const toRemove = files.slice(maxKeep);

            for (const file of toRemove) {
              try {
                await fsys.Delete(file.Key);
              } catch (error) {
                this.Logger().Error(
                  "[Backup cron] Failed to remove old autogenerated backup",
                  "key",
                  file.Key,
                  "error",
                  String(error),
                );
              }
            }
          } catch (error) {
            this.Logger().Error("[Backup cron] Failed to list autogenerated backups", "error", String(error));
          } finally {
            await fsys.Close();
          }
        })().catch((error) => {
          this.Logger().Error("[Backup cron] Failed to run backup task", "error", String(error));
        });
      });
    };

    this.OnBootstrap().BindFunc(async (event) => {
      const result = await event.Next();
      loadJob();
      return result;
    });

    this.OnSettingsReload().BindFunc(async (event) => {
      const result = await event.Next();
      loadJob();
      return result;
    });
  }

  private registerCollectionHooks(): void {
    const systemHookIdCollection = "__pbCollectionSystemHook__";

    this.OnModelValidate().Bind({
      Id: systemHookIdCollection,
      Priority: -99,
      Func: async (me) => {
        const { event: ce, ok } = newCollectionEventFromModelEvent(me);
        if (!ok || !ce) {
          return await me.Next();
        }
        const err = await this.OnCollectionValidate().Trigger(ce, async (event) => {
          syncModelEventWithCollectionEvent(me, event);
          const result = await me.Next();
          syncCollectionEventWithModelEvent(event, me);
          return result;
        });
        syncModelEventWithCollectionEvent(me, ce);
        return err;
      },
    });

    this.OnModelCreate().Bind({
      Id: systemHookIdCollection,
      Priority: -99,
      Func: async (me) => {
        const { event: ce, ok } = newCollectionEventFromModelEvent(me);
        if (!ok || !ce) {
          return await me.Next();
        }
        const err = await this.OnCollectionCreate().Trigger(ce, async (event) => {
          syncModelEventWithCollectionEvent(me, event);
          const result = await me.Next();
          syncCollectionEventWithModelEvent(event, me);
          return result;
        });
        syncModelEventWithCollectionEvent(me, ce);
        return err;
      },
    });

    this.OnModelCreateExecute().Bind({
      Id: systemHookIdCollection,
      Priority: -99,
      Func: async (me) => {
        const { event: ce, ok } = newCollectionEventFromModelEvent(me);
        if (!ok || !ce) {
          return await me.Next();
        }
        const err = await this.OnCollectionCreateExecute().Trigger(ce, async (event) => {
          syncModelEventWithCollectionEvent(me, event);
          const result = await me.Next();
          syncCollectionEventWithModelEvent(event, me);
          return result;
        });
        syncModelEventWithCollectionEvent(me, ce);
        return err;
      },
    });

    this.OnModelAfterCreateSuccess().Bind({
      Id: systemHookIdCollection,
      Priority: -99,
      Func: async (me) => {
        const { event: ce, ok } = newCollectionEventFromModelEvent(me);
        if (!ok || !ce) {
          return await me.Next();
        }
        const err = await this.OnCollectionAfterCreateSuccess().Trigger(ce, async (event) => {
          syncModelEventWithCollectionEvent(me, event);
          const result = await me.Next();
          syncCollectionEventWithModelEvent(event, me);
          return result;
        });
        syncModelEventWithCollectionEvent(me, ce);
        return err;
      },
    });

    this.OnModelAfterCreateError().Bind({
      Id: systemHookIdCollection,
      Priority: -99,
      Func: async (me) => {
        const { event: ce, ok } = newCollectionErrorEventFromModelErrorEvent(me);
        if (!ok || !ce) {
          return await me.Next();
        }
        const err = await this.OnCollectionAfterCreateError().Trigger(ce, async (event) => {
          syncModelErrorEventWithCollectionErrorEvent(me, event);
          const result = await me.Next();
          syncCollectionErrorEventWithModelErrorEvent(event, me);
          return result;
        });
        syncModelErrorEventWithCollectionErrorEvent(me, ce);
        return err;
      },
    });

    this.OnModelUpdate().Bind({
      Id: systemHookIdCollection,
      Priority: -99,
      Func: async (me) => {
        const { event: ce, ok } = newCollectionEventFromModelEvent(me);
        if (!ok || !ce) {
          return await me.Next();
        }
        const err = await this.OnCollectionUpdate().Trigger(ce, async (event) => {
          syncModelEventWithCollectionEvent(me, event);
          const result = await me.Next();
          syncCollectionEventWithModelEvent(event, me);
          return result;
        });
        syncModelEventWithCollectionEvent(me, ce);
        return err;
      },
    });

    this.OnModelUpdateExecute().Bind({
      Id: systemHookIdCollection,
      Priority: -99,
      Func: async (me) => {
        const { event: ce, ok } = newCollectionEventFromModelEvent(me);
        if (!ok || !ce) {
          return await me.Next();
        }
        const err = await this.OnCollectionUpdateExecute().Trigger(ce, async (event) => {
          syncModelEventWithCollectionEvent(me, event);
          const result = await me.Next();
          syncCollectionEventWithModelEvent(event, me);
          return result;
        });
        syncModelEventWithCollectionEvent(me, ce);
        return err;
      },
    });

    this.OnModelAfterUpdateSuccess().Bind({
      Id: systemHookIdCollection,
      Priority: -99,
      Func: async (me) => {
        const { event: ce, ok } = newCollectionEventFromModelEvent(me);
        if (!ok || !ce) {
          return await me.Next();
        }
        const err = await this.OnCollectionAfterUpdateSuccess().Trigger(ce, async (event) => {
          syncModelEventWithCollectionEvent(me, event);
          const result = await me.Next();
          syncCollectionEventWithModelEvent(event, me);
          return result;
        });
        syncModelEventWithCollectionEvent(me, ce);
        return err;
      },
    });

    this.OnModelAfterUpdateError().Bind({
      Id: systemHookIdCollection,
      Priority: -99,
      Func: async (me) => {
        const { event: ce, ok } = newCollectionErrorEventFromModelErrorEvent(me);
        if (!ok || !ce) {
          return await me.Next();
        }
        const err = await this.OnCollectionAfterUpdateError().Trigger(ce, async (event) => {
          syncModelErrorEventWithCollectionErrorEvent(me, event);
          const result = await me.Next();
          syncCollectionErrorEventWithModelErrorEvent(event, me);
          return result;
        });
        syncModelErrorEventWithCollectionErrorEvent(me, ce);
        return err;
      },
    });

    this.OnModelDelete().Bind({
      Id: systemHookIdCollection,
      Priority: -99,
      Func: async (me) => {
        const { event: ce, ok } = newCollectionEventFromModelEvent(me);
        if (!ok || !ce) {
          return await me.Next();
        }
        const err = await this.OnCollectionDelete().Trigger(ce, async (event) => {
          syncModelEventWithCollectionEvent(me, event);
          const result = await me.Next();
          syncCollectionEventWithModelEvent(event, me);
          return result;
        });
        syncModelEventWithCollectionEvent(me, ce);
        return err;
      },
    });

    this.OnModelDeleteExecute().Bind({
      Id: systemHookIdCollection,
      Priority: -99,
      Func: async (me) => {
        const { event: ce, ok } = newCollectionEventFromModelEvent(me);
        if (!ok || !ce) {
          return await me.Next();
        }
        const err = await this.OnCollectionDeleteExecute().Trigger(ce, async (event) => {
          syncModelEventWithCollectionEvent(me, event);
          const result = await me.Next();
          syncCollectionEventWithModelEvent(event, me);
          return result;
        });
        syncModelEventWithCollectionEvent(me, ce);
        return err;
      },
    });

    this.OnModelAfterDeleteSuccess().Bind({
      Id: systemHookIdCollection,
      Priority: -99,
      Func: async (me) => {
        const { event: ce, ok } = newCollectionEventFromModelEvent(me);
        if (!ok || !ce) {
          return await me.Next();
        }
        const err = await this.OnCollectionAfterDeleteSuccess().Trigger(ce, async (event) => {
          syncModelEventWithCollectionEvent(me, event);
          const result = await me.Next();
          syncCollectionEventWithModelEvent(event, me);
          return result;
        });
        syncModelEventWithCollectionEvent(me, ce);
        return err;
      },
    });

    this.OnModelAfterDeleteError().Bind({
      Id: systemHookIdCollection,
      Priority: -99,
      Func: async (me) => {
        const { event: ce, ok } = newCollectionErrorEventFromModelErrorEvent(me);
        if (!ok || !ce) {
          return await me.Next();
        }
        const err = await this.OnCollectionAfterDeleteError().Trigger(ce, async (event) => {
          syncModelErrorEventWithCollectionErrorEvent(me, event);
          const result = await me.Next();
          syncCollectionErrorEventWithModelErrorEvent(event, me);
          return result;
        });
        syncModelErrorEventWithCollectionErrorEvent(me, ce);
        return err;
      },
    });
  }

  private registerRecordHooks(): void {
    const systemHookIdRecord = "__pbRecordSystemHook__";

    this.OnModelValidate().Bind({
      Id: systemHookIdRecord,
      Priority: -99,
      Func: async (me) => {
        const { event: re, ok } = newRecordEventFromModelEvent(me);
        if (!ok || !re) {
          return await me.Next();
        }
        const err = await this.OnRecordValidate().Trigger(re, async (event) => {
          syncModelEventWithRecordEvent(me, event);
          const result = await me.Next();
          syncRecordEventWithModelEvent(event, me);
          return result;
        });
        syncModelEventWithRecordEvent(me, re);
        return err;
      },
    });

    this.OnModelCreate().Bind({
      Id: systemHookIdRecord,
      Priority: -99,
      Func: async (me) => {
        const { event: re, ok } = newRecordEventFromModelEvent(me);
        if (!ok || !re) {
          return await me.Next();
        }
        const err = await this.OnRecordCreate().Trigger(re, async (event) => {
          syncModelEventWithRecordEvent(me, event);
          const result = await me.Next();
          syncRecordEventWithModelEvent(event, me);
          return result;
        });
        syncModelEventWithRecordEvent(me, re);
        return err;
      },
    });

    this.OnModelCreateExecute().Bind({
      Id: systemHookIdRecord,
      Priority: -99,
      Func: async (me) => {
        const { event: re, ok } = newRecordEventFromModelEvent(me);
        if (!ok || !re) {
          return await me.Next();
        }
        const err = await this.OnRecordCreateExecute().Trigger(re, async (event) => {
          syncModelEventWithRecordEvent(me, event);
          const result = await me.Next();
          syncRecordEventWithModelEvent(event, me);
          return result;
        });
        syncModelEventWithRecordEvent(me, re);
        return err;
      },
    });

    this.OnModelAfterCreateSuccess().Bind({
      Id: systemHookIdRecord,
      Priority: -99,
      Func: async (me) => {
        const { event: re, ok } = newRecordEventFromModelEvent(me);
        if (!ok || !re) {
          return await me.Next();
        }
        const err = await this.OnRecordAfterCreateSuccess().Trigger(re, async (event) => {
          syncModelEventWithRecordEvent(me, event);
          const result = await me.Next();
          syncRecordEventWithModelEvent(event, me);
          return result;
        });
        syncModelEventWithRecordEvent(me, re);
        return err;
      },
    });

    this.OnModelAfterCreateError().Bind({
      Id: systemHookIdRecord,
      Priority: -99,
      Func: async (me) => {
        const { event: re, ok } = newRecordErrorEventFromModelErrorEvent(me);
        if (!ok || !re) {
          return await me.Next();
        }
        const err = await this.OnRecordAfterCreateError().Trigger(re, async (event) => {
          syncModelErrorEventWithRecordErrorEvent(me, event);
          const result = await me.Next();
          syncRecordErrorEventWithModelErrorEvent(event, me);
          return result;
        });
        syncModelErrorEventWithRecordErrorEvent(me, re);
        return err;
      },
    });

    this.OnModelUpdate().Bind({
      Id: systemHookIdRecord,
      Priority: -99,
      Func: async (me) => {
        const { event: re, ok } = newRecordEventFromModelEvent(me);
        if (!ok || !re) {
          return await me.Next();
        }
        const err = await this.OnRecordUpdate().Trigger(re, async (event) => {
          syncModelEventWithRecordEvent(me, event);
          const result = await me.Next();
          syncRecordEventWithModelEvent(event, me);
          return result;
        });
        syncModelEventWithRecordEvent(me, re);
        return err;
      },
    });

    this.OnModelUpdateExecute().Bind({
      Id: systemHookIdRecord,
      Priority: -99,
      Func: async (me) => {
        const { event: re, ok } = newRecordEventFromModelEvent(me);
        if (!ok || !re) {
          return await me.Next();
        }
        const err = await this.OnRecordUpdateExecute().Trigger(re, async (event) => {
          syncModelEventWithRecordEvent(me, event);
          const result = await me.Next();
          syncRecordEventWithModelEvent(event, me);
          return result;
        });
        syncModelEventWithRecordEvent(me, re);
        return err;
      },
    });

    this.OnModelAfterUpdateSuccess().Bind({
      Id: systemHookIdRecord,
      Priority: -99,
      Func: async (me) => {
        const { event: re, ok } = newRecordEventFromModelEvent(me);
        if (!ok || !re) {
          return await me.Next();
        }
        const err = await this.OnRecordAfterUpdateSuccess().Trigger(re, async (event) => {
          syncModelEventWithRecordEvent(me, event);
          const result = await me.Next();
          syncRecordEventWithModelEvent(event, me);
          return result;
        });
        syncModelEventWithRecordEvent(me, re);
        return err;
      },
    });

    this.OnModelAfterUpdateError().Bind({
      Id: systemHookIdRecord,
      Priority: -99,
      Func: async (me) => {
        const { event: re, ok } = newRecordErrorEventFromModelErrorEvent(me);
        if (!ok || !re) {
          return await me.Next();
        }
        const err = await this.OnRecordAfterUpdateError().Trigger(re, async (event) => {
          syncModelErrorEventWithRecordErrorEvent(me, event);
          const result = await me.Next();
          syncRecordErrorEventWithModelErrorEvent(event, me);
          return result;
        });
        syncModelErrorEventWithRecordErrorEvent(me, re);
        return err;
      },
    });

    this.OnModelDelete().Bind({
      Id: systemHookIdRecord,
      Priority: -99,
      Func: async (me) => {
        const { event: re, ok } = newRecordEventFromModelEvent(me);
        if (!ok || !re) {
          return await me.Next();
        }
        const err = await this.OnRecordDelete().Trigger(re, async (event) => {
          syncModelEventWithRecordEvent(me, event);
          const result = await me.Next();
          syncRecordEventWithModelEvent(event, me);
          return result;
        });
        syncModelEventWithRecordEvent(me, re);
        return err;
      },
    });

    this.OnModelDeleteExecute().Bind({
      Id: systemHookIdRecord,
      Priority: -99,
      Func: async (me) => {
        const { event: re, ok } = newRecordEventFromModelEvent(me);
        if (!ok || !re) {
          return await me.Next();
        }
        const err = await this.OnRecordDeleteExecute().Trigger(re, async (event) => {
          syncModelEventWithRecordEvent(me, event);
          const result = await me.Next();
          syncRecordEventWithModelEvent(event, me);
          return result;
        });
        syncModelEventWithRecordEvent(me, re);
        return err;
      },
    });

    this.OnRecordDeleteExecute().Bind({
      Id: systemHookIdRecord,
      Priority: 99,
      Func: async (event) => await this.onRecordDeleteExecute(event),
    });

    this.OnModelAfterDeleteSuccess().Bind({
      Id: systemHookIdRecord,
      Priority: -99,
      Func: async (me) => {
        const { event: re, ok } = newRecordEventFromModelEvent(me);
        if (!ok || !re) {
          return await me.Next();
        }
        const err = await this.OnRecordAfterDeleteSuccess().Trigger(re, async (event) => {
          syncModelEventWithRecordEvent(me, event);
          const result = await me.Next();
          syncRecordEventWithModelEvent(event, me);
          return result;
        });
        syncModelEventWithRecordEvent(me, re);
        return err;
      },
    });

    this.OnModelAfterDeleteError().Bind({
      Id: systemHookIdRecord,
      Priority: -99,
      Func: async (me) => {
        const { event: re, ok } = newRecordErrorEventFromModelErrorEvent(me);
        if (!ok || !re) {
          return await me.Next();
        }
        const err = await this.OnRecordAfterDeleteError().Trigger(re, async (event) => {
          syncModelErrorEventWithRecordErrorEvent(me, event);
          const result = await me.Next();
          syncRecordErrorEventWithModelErrorEvent(event, me);
          return result;
        });
        syncModelErrorEventWithRecordErrorEvent(me, re);
        return err;
      },
    });

    this.OnRecordValidate().Bind({
      Id: systemHookIdRecord,
      Priority: 99,
      Func: async (e) => {
        if (!e.Record) {
          return await e.Next();
        }
        return await e.Record.callFieldInterceptors(e.Context, e.App, InterceptorActionValidate, async () => {
          const err = this.validateRecord(e.Record as RecordModel);
          if (err) {
            return err;
          }
          return (await e.Next()) as Error | null;
        });
      },
    });
  }

  // Ported from pocketbase/core/record_model_superusers.go.
  private registerSuperuserHooks(): void {
    registerSuperuserHooks(this);
  }

  private registerOTPHooks(): void {
    recordRefHooks(this, CollectionNameOTPs, CollectionTypeAuth);

    this.Cron().Add("__pbOTPCleanup__", "0 * * * *", async () => {
      const err = await this.DeleteExpiredOTPs();
      if (err) {
        this.Logger().Warn("Failed to delete expired OTP sessions", "error", err);
      }
    });
  }

  private registerMFAHooks(): void {
    recordRefHooks(this, CollectionNameMFAs, CollectionTypeAuth);

    this.Cron().Add("__pbMFACleanup__", "0 * * * *", async () => {
      const err = await this.DeleteExpiredMFAs();
      if (err) {
        this.Logger().Warn("Failed to delete expired MFA sessions", "error", err);
      }
    });

    this.OnRecordUpdate().Bind({
      Func: async (e) => {
        const record = e.Record;
        const isAuth = record?.collection().IsAuth() ?? false;
        // Deviation: capture the original hash before e.Next() because PostScan updates originals during save.
        const oldHash = isAuth && record ? record.Original().GetString(`${FieldNamePassword}:hash`) : "";

        const err = (await e.Next()) as Error | null;
        if (err || !isAuth || !record) {
          return err;
        }

        const newHash = record.GetString(`${FieldNamePassword}:hash`);
        if (oldHash !== newHash) {
          const deleteErr = await e.App.DeleteAllMFAsByRecord(record);
          if (deleteErr) {
            e.App.Logger().Warn(
              "Failed to delete all previous mfas",
              "error",
              deleteErr,
              "recordId",
              record.Id,
              "collectionId",
              record.collection().id,
            );
          }
        }

        return null;
      },
      Priority: 99,
    });
  }

  // Ported from pocketbase/core/external_auth_model.go.
  private registerExternalAuthHooks(): void {
    recordRefHooks(this, CollectionNameExternalAuths, CollectionTypeAuth);

    this.OnRecordValidate([CollectionNameExternalAuths]).Bind({
      Func: (e) => {
        if (!e.Record) {
          return e.Next();
        }

        const providerNames = Object.keys(Providers);
        const provider = e.Record.GetString("provider");
        const providerErr =
          required(provider) ?? (providerNames.includes(provider) ? null : newError("validation_in_invalid", "Invalid value."));
        if (providerErr) {
          return new ValidationErrors({ provider: providerErr });
        }

        return e.Next();
      },
      Priority: 99,
    });
  }

  private registerAuthOriginHooks(): void {
    recordRefHooks(this, CollectionNameAuthOrigins, CollectionTypeAuth);

    // delete existing auth origins on password change
    this.OnRecordUpdate().Bind({
      Func: async (e) => {
        const record = e.Record;
        const isAuth = record?.collection().IsAuth() ?? false;
        // Deviation: capture the original hash before e.Next() because PostScan updates originals during save.
        const oldHash = isAuth && record ? record.Original().GetString(`${FieldNamePassword}:hash`) : "";

        const err = (await e.Next()) as Error | null;
        if (err || !isAuth || !record) {
          return err;
        }

        const newHash = record.GetString(`${FieldNamePassword}:hash`);
        if (oldHash !== newHash) {
          const deleteErr = await e.App.DeleteAllAuthOriginsByRecord(record);
          if (deleteErr) {
            e.App.Logger().Warn(
              "Failed to delete all previous auth origin fingerprints",
              "error",
              deleteErr,
              "recordId",
              record.Id,
              "collectionId",
              record.collection().id,
            );
          }
        }

        return null;
      },
      Priority: 99,
    });
  }

  async SaveView(name: string, selectQuery: string): Promise<Error | null> {
    return await SaveView(this, name, selectQuery);
  }

  DeleteView(name: string): Error | null {
    return DeleteView(this, name);
  }

  async CreateViewFields(selectQuery: string): Promise<FieldsList> {
    return await CreateViewFields(this, selectQuery);
  }

  TableInfo(tableName: string) {
    return TableInfo(this.db(), tableName);
  }

  TableIndexes(tableName: string): Record<string, string> {
    return TableIndexes(this.db(), tableName);
  }

  private dropCollectionIndexes(collection: Collection): Error | null {
    for (const index of collection.indexes ?? []) {
      const parsed = parseIndex(index);
      if (!parsed.indexName) {
        continue;
      }
      this.db().run(`drop index if exists \`${parsed.indexName}\``);
    }
    return null;
  }

  HasTable(name: string): boolean {
    const row = this.db()
      .query("select name from sqlite_master where type in ('table','view') and lower(name) = lower(?)")
      .get(name) as { name?: string } | undefined;
    return Boolean(row?.name);
  }

  IsCollectionNameUnique(name: string, excludeId?: string): boolean {
    const row = this.db().query("select id from _collections where lower(name) = lower(?)").get(name) as
      | { id?: string }
      | undefined;
    if (!row?.id) {
      return true;
    }
    if (excludeId && row.id === excludeId) {
      return true;
    }
    return false;
  }
}

function isRecordProxy(value: unknown): value is RecordProxy {
  return typeof (value as RecordProxy | null)?.ProxyRecord === "function";
}

function resolveRecordProxy(model: Model): { record: RecordModel; model: RecordModel | RecordProxy } | null {
  if (model instanceof RecordModel) {
    return { record: model, model };
  }

  if (isRecordProxy(model)) {
    try {
      const record = model.ProxyRecord();
      return { record, model };
    } catch {
      return null;
    }
  }

  return null;
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

function appendOrderBy(baseSql: string, clause: string): string {
  if (!clause) {
    return baseSql;
  }
  if (/\border\s+by\b/i.test(baseSql)) {
    return `${baseSql}, ${clause}`;
  }
  return `${baseSql} ORDER BY ${clause}`;
}

function applyLimitOffset(sql: string, limit: number, offset: number): string {
  if (limit > 0) {
    return offset > 0 ? `${sql} LIMIT ${limit} OFFSET ${offset}` : `${sql} LIMIT ${limit}`;
  }
  if (offset > 0) {
    return `${sql} LIMIT -1 OFFSET ${offset}`;
  }
  return sql;
}

function generateBackupName(app: App, prefix: string): string {
  let appName = snakecase(app.settings().meta.appName);
  if (appName.length > 50) {
    appName = appName.slice(0, 50);
  }

  const now = new Date();
  const stamp = [
    now.getUTCFullYear(),
    pad2(now.getUTCMonth() + 1),
    pad2(now.getUTCDate()),
    pad2(now.getUTCHours()),
    pad2(now.getUTCMinutes()),
    pad2(now.getUTCSeconds()),
  ].join("");

  return `${prefix}${appName}_${stamp}.zip`;
}

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

function resolveBaseTokenKey(collection: Collection, tokenType: string): string {
  switch (tokenType) {
    case TokenTypeAuth:
      return collection.AuthToken.Secret;
    case TokenTypeFile:
      return collection.FileToken.Secret;
    case TokenTypeVerification:
      return collection.VerificationToken.Secret;
    case TokenTypePasswordReset:
      return collection.PasswordResetToken.Secret;
    case TokenTypeEmailChange:
      return collection.EmailChangeToken.Secret;
    default:
      return "";
  }
}

class TxAppInfo {
  #afterFuncs: Array<(txErr: Error | null) => Error | null | Promise<Error | null>> = [];

  OnComplete(fn: (txErr: Error | null) => Error | null | Promise<Error | null>) {
    this.#afterFuncs.push(fn);
  }

  async runAfterFuncs(txErr: Error | null): Promise<Error | null> {
    const errors: Error[] = [];
    for (const fn of this.#afterFuncs) {
      const err = await fn(txErr);
      if (err) {
        errors.push(err);
      }
    }
    this.#afterFuncs = [];

    if (errors.length === 0) {
      return null;
    }
    if (errors.length === 1) {
      return errors[0] ?? null;
    }
    return new AggregateError(errors, errors.map((err) => err.message).join("\n"));
  }
}

function normalizeDbValue(value: unknown): SQLQueryBindings {
  if (value == null) {
    return null;
  }
  if (value instanceof JSONRaw) {
    return value.toString();
  }
  if (value instanceof DateTime) {
    return value.toString();
  }
  if (value instanceof GeoPoint) {
    return value.toString();
  }
  if (value instanceof Uint8Array) {
    return value;
  }
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }
  if (typeof value === "object") {
    const hasToJSON = (value as { toJSON?: () => unknown }).toJSON;
    if (typeof hasToJSON === "function") {
      return JSON.stringify(hasToJSON.call(value));
    }
    return JSON.stringify(value);
  }
  return value as SQLQueryBindings;
}

function isSafeIdentifier(value: string): boolean {
  return /^[A-Za-z0-9_]+$/.test(value);
}

async function cascadeRecordDelete(app: App, mainRecord: RecordModel, refs: Map<Collection, Field[]>): Promise<Error | null> {
  const sortedRefs = Array.from(refs.keys()).sort((a, b) => a.name.localeCompare(b.name));

  for (const refCollection of sortedRefs) {
    const fields = refs.get(refCollection);
    if (!fields || refCollection.isView()) {
      continue;
    }

    const recordTableName = columnify(refCollection.name);

    for (const field of fields) {
      if (!(field instanceof RelationField)) {
        return new Error(`only RelationField is supported at the moment, got ${field.Type()}`);
      }

      const prefixedFieldName = `${recordTableName}.${columnify(field.GetName())}`;
      const query = app.RecordQuery(refCollection);

      if (!field.IsMultiple()) {
        query.AndWhere({ [prefixedFieldName]: mainRecord.Id });
      } else {
        query.AndWhere({
          sql: `EXISTS (SELECT 1 FROM ${JSONEach(prefixedFieldName)} as {{__je__}} WHERE [[__je__.value]] = ?)`,
          params: [mainRecord.Id],
        });
      }

      if (refCollection.Id === mainRecord.collection().Id) {
        query.AndWhere(Not(HashExp({ [`${recordTableName}.id`]: mainRecord.Id })));
      }

      const batchSize = 4000;
      for (;;) {
        const rows = query.Limit(batchSize).All() as RecordModel[];
        const total = rows.length;
        if (total === 0) {
          break;
        }

        const err = await deleteRefRecords(app, mainRecord, rows, field);
        if (err) {
          return err;
        }

        if (total < batchSize) {
          break;
        }
      }
    }
  }

  return null;
}

async function deleteRefRecords(
  app: App,
  mainRecord: RecordModel,
  refRecords: RecordModel[],
  field: RelationField,
): Promise<Error | null> {
  for (const refRecord of refRecords) {
    let ids = refRecord.GetStringSlice(field.Name);

    for (let i = ids.length - 1; i >= 0; i -= 1) {
      if (ids[i] === mainRecord.Id) {
        ids = ids.slice(0, i).concat(ids.slice(i + 1));
        break;
      }
    }

    if (field.CascadeDelete && ids.length === 0) {
      const deleteErr = await app.Delete(refRecord);
      if (deleteErr) {
        return deleteErr;
      }
      continue;
    }

    if (field.Required && ids.length === 0) {
      return new Error(
        `the record cannot be deleted because it is part of a required reference in record ${refRecord.Id} (${refRecord.collection().Name} collection)`,
      );
    }

    refRecord.Set(field.Name, ids);
    const saveErr = await app.SaveNoValidate(refRecord);
    if (saveErr) {
      return saveErr;
    }
  }

  return null;
}

function joinErrors(...errors: Array<Error | null | undefined>): Error | null {
  const flattened: Error[] = [];
  for (const err of errors) {
    if (!err) {
      continue;
    }
    if (err instanceof AggregateError) {
      for (const inner of err.errors) {
        if (inner instanceof Error) {
          flattened.push(inner);
        }
      }
      continue;
    }
    flattened.push(err);
  }

  if (flattened.length === 0) {
    return null;
  }
  if (flattened.length === 1) {
    return flattened[0] ?? null;
  }

  return new AggregateError(flattened, flattened.map((err) => err.message).join("\n"));
}

function resolveBaseFilesPath(model: Model): string {
  const manager = model as { BaseFilesPath?: () => string };
  if (typeof manager.BaseFilesPath !== "function") {
    return "";
  }
  return manager.BaseFilesPath();
}

function resolveCollectionForFiles(model: Model): Collection | null {
  if (model instanceof Collection) {
    return model;
  }
  if (model instanceof RecordModel) {
    return model.collection();
  }
  const proxy = model as RecordProxy;
  if (typeof proxy.ProxyRecord === "function") {
    try {
      const record = proxy.ProxyRecord();
      return record ? record.collection() : null;
    } catch {
      return null;
    }
  }
  return null;
}

function supportFiles(model: Model): boolean {
  const collection = resolveCollectionForFiles(model);
  if (!collection) {
    return true;
  }
  for (const field of collection.Fields) {
    if (field.Type() === FieldTypeFile) {
      return true;
    }
  }
  return false;
}

function normalizeCollectionFields(collection: Collection): void {
  if (collection.Fields.length === 0 && collection.fields.length > 0) {
    try {
      collection.Fields = FieldsList.fromJSON(JSON.stringify(collection.fields));
    } catch {
      collection.Fields = new FieldsList();
    }
  }

  if (collection.Fields.length > 0) {
    collection.fields = parseCollectionFields(collection.Fields.toJSON());
  }
}

function normalizeImportedCollectionData(data: Record<string, unknown>, deleteMissing: boolean): Record<string, unknown> {
  if (!deleteMissing) {
    return data;
  }

  const hasFields = Object.prototype.hasOwnProperty.call(data, "fields");
  if (hasFields && data.fields != null) {
    return data;
  }

  return { ...data, fields: [] };
}

function applyImportData(collection: Collection, data: Record<string, unknown>): void {
  collection.UnmarshalJSON(data);
  if (typeof data.id === "string") {
    collection.id = data.id;
  }
  if (data.created != null) {
    collection.created = ParseDateTime(data.created);
  }
  if (data.updated != null) {
    collection.updated = ParseDateTime(data.updated);
  }

  normalizeCollectionFields(collection);
}
