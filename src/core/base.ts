// Ported from pocketbase/core/base.go and pocketbase/core/base_backup.go (BaseApp remains in one file; backup logic moved to base_backup.ts).

import "../migrations/index.ts";
import "./fields_register.ts";
import type { Database, SQLQueryBindings } from "bun:sqlite";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { SqlExpr } from "../tools/search/types.ts";
import type { App, Logger } from "./app.ts";
import type { Model } from "./db_model.ts";
import type { RequestInfo } from "./event_request.ts";
import type { BatchRequestEvent } from "./event_request_batch.ts";
import type { RecordProxy } from "./record_proxy.ts";
import * as slog from "../internal/compat/slog.ts";
import { ValidationErrors, newError, required } from "../internal/compat/validation.ts";
import { Providers } from "../tools/auth/auth.ts";
import { Cron } from "../tools/cron/cron.ts";
import { findSingleColumnUniqueIndex } from "../tools/dbutils/index.ts";
import { JSONEach } from "../tools/dbutils/json.ts";
import { DbxDatabase } from "../tools/dbx/database.ts";
import { HashExp, Not } from "../tools/dbx/expr.ts";
import { SelectQuery } from "../tools/dbx/select_query.ts";
import { NewLocal, NewS3 } from "../tools/filesystem/filesystem.ts";
import { Hook } from "../tools/hook/hook.ts";
import { NewTaggedHook } from "../tools/hook/tagged.ts";
import { columnify, snakecase } from "../tools/inflector/inflector.ts";
import { BatchHandler, NewBatchHandler } from "../tools/logger/batch_handler.ts";
import { Sendmail } from "../tools/mailer/sendmail.ts";
import { SMTPClient } from "../tools/mailer/smtp.ts";
import { buildFilterExpr } from "../tools/search/filter.ts";
import { buildSortExpr, parseSortFromString } from "../tools/search/sort.ts";
import { DefaultFilterExprLimit } from "../tools/search/types.ts";
import { encrypt } from "../tools/security/encrypt.ts";
import { parseJWT, parseUnverifiedJWT } from "../tools/security/jwt.ts";
import { Broker } from "../tools/subscriptions/broker.ts";
import { DateTime, GeoPoint, JSONRaw, NowDateTime, ParseDateTime } from "../tools/types/index.ts";
import { AuthOrigin, CollectionNameAuthOrigins, recordRefHooks } from "./auth_origin_model.ts";
import {
  DeleteAllAuthOriginsByRecord as DeleteAllAuthOriginsByRecordQuery,
  FindAllAuthOriginsByCollection as FindAllAuthOriginsByCollectionQuery,
  FindAllAuthOriginsByRecord as FindAllAuthOriginsByRecordQuery,
  FindAuthOriginById as FindAuthOriginByIdQuery,
  FindAuthOriginByRecordAndFingerprint as FindAuthOriginByRecordAndFingerprintQuery,
} from "./auth_origin_query.ts";
import {
  CreateBackup as CreateBackupHelper,
  RestoreBackup as RestoreBackupHelper,
  registerAutobackupHooks as registerAutobackupHooksHelper,
} from "./base_backup.ts";
import { LocalAutocertCacheDirName, LocalBackupsDirName, LocalStorageDirName, LocalTempDirName } from "./base_paths.ts";
import { importCollections, importCollectionsByMarshaledJSON } from "./collection_import.ts";
import {
  Collection,
  CollectionTypeAuth,
  collectionFromRow,
  normalizeCollectionFields,
  type CollectionRow,
} from "./collection_model.ts";
import {
  CollectionQuery as CollectionQueryHelper,
  FindAllCollections as FindAllCollectionsQuery,
  FindCachedCollectionByNameOrId as FindCachedCollectionByNameOrIdQuery,
  FindCachedCollectionReferences as FindCachedCollectionReferencesQuery,
  FindCollectionByNameOrId as FindCollectionByNameOrIdQuery,
  FindCollectionReferences as FindCollectionReferencesQuery,
  IsCollectionNameUnique as IsCollectionNameUniqueQuery,
  ReloadCachedCollections as ReloadCachedCollectionsQuery,
  TruncateCollection as TruncateCollectionQuery,
} from "./collection_query.ts";
import { dropCollectionIndexes, syncRecordTableSchema, syncRecordTableSchemaSync } from "./collection_record_table_sync.ts";
import { validateCollection, validateCollectionSync } from "./collection_validate.ts";
import { GenerateDefaultRandomId, type PostValidator, type PreValidator } from "./db.ts";
import { baseLockRetry, baseLockRetrySync, defaultMaxLockRetries } from "./db_retry.ts";
import { TableInfo, TableIndexes } from "./db_table.ts";
import {
  AuxRunInTransaction as AuxRunInTransactionHelper,
  AuxRunInTransactionSync as AuxRunInTransactionSyncHelper,
  RunInTransaction as RunInTransactionHelper,
  RunInTransactionSync as RunInTransactionSyncHelper,
  TxAppInfo,
} from "./db_tx.ts";
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
  FindAllExternalAuthsByCollection as FindAllExternalAuthsByCollectionQuery,
  FindAllExternalAuthsByRecord as FindAllExternalAuthsByRecordQuery,
  FindFirstExternalAuthByExpr as FindFirstExternalAuthByExprQuery,
} from "./external_auth_query.ts";
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
import { Log, LogsTableName } from "./log_model.ts";
import { printLog } from "./log_printer.ts";
import { deleteOldLogs, findLogById, logQuery, logsStats, type LogsStatsItem } from "./log_query.ts";
import { CollectionNameMFAs, MFA } from "./mfa_model.ts";
import {
  DeleteAllMFAsByRecord as DeleteAllMFAsByRecordQuery,
  DeleteExpiredMFAs as DeleteExpiredMFAsQuery,
  FindAllMFAsByCollection as FindAllMFAsByCollectionQuery,
  FindAllMFAsByRecord as FindAllMFAsByRecordQuery,
  FindMFAById as FindMFAByIdQuery,
} from "./mfa_query.ts";
import { MigrationsList } from "./migrations_list.ts";
import { AppMigrations, MigrationsRunner, SystemMigrations } from "./migrations_runner.ts";
import { CollectionNameOTPs, OTP } from "./otp_model.ts";
import {
  DeleteAllOTPsByRecord as DeleteAllOTPsByRecordQuery,
  DeleteExpiredOTPs as DeleteExpiredOTPsQuery,
  FindAllOTPsByCollection as FindAllOTPsByCollectionQuery,
  FindAllOTPsByRecord as FindAllOTPsByRecordQuery,
  FindOTPById as FindOTPByIdQuery,
} from "./otp_query.ts";
import { RecordFieldResolver } from "./record_field_resolver.ts";
import { FieldNameEmail, FieldNamePassword, Record as RecordModel, type RecordData } from "./record_model.ts";
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
import { Settings } from "./settings_model.ts";
import { ReloadSettings as ReloadSettingsHelper } from "./settings_query.ts";
import { Store } from "./store.ts";
import { NormalizeUniqueIndexError } from "./validators/db.ts";
import {
  CreateViewFields,
  CreateViewFieldsSync,
  DeleteView,
  SaveView,
  SaveViewSync,
  FindRecordByViewFile as findRecordByViewFile,
} from "./view.ts";

// BaseAppConfig defines a BaseApp configuration option.
export type BaseAppConfig = {
  dataDir?: string;
  encryptionEnv?: string;
  isDev?: boolean;
};

export { LocalAutocertCacheDirName, LocalBackupsDirName, LocalStorageDirName, LocalTempDirName };

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
    this.#logger = slog.Default();
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

  CollectionQuery(): SelectQuery {
    return CollectionQueryHelper(this);
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
      const loggerErr = this.initLogger();
      if (loggerErr) {
        return loggerErr;
      }
      try {
        this.runSystemMigrations();
      } catch (error) {
        return error as Error;
      }
      const reloadErr = this.ReloadCachedCollections();
      if (reloadErr) {
        return reloadErr;
      }
      this.reloadSettings();
      try {
        rmSync(join(this.#dataDir, LocalTempDirName), { recursive: true, force: true });
      } catch {
        // ignore cleanup failures
      }
      this.#bootstrapped = true;
      return null;
    });

    const checkBootstrapped = () => {
      if (!this.isBootstrapped()) {
        this.Logger().Warn("OnBootstrap hook didn't fail but the app is still not bootstrapped - maybe missing e.Next()?");
      }
    };

    if (result instanceof Promise) {
      void result.then(checkBootstrapped).catch((err) => this.Logger().Error("Failed to bootstrap app", "error", err));
    } else if (result instanceof Error) {
      throw result;
    } else {
      checkBootstrapped();
    }
  }

  private initLogger(): Error | null {
    const flushDelayMs = 3000;
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    const handler = NewBatchHandler({
      Level: getLoggerMinLevel(this),
      BatchSize: 200,
      BeforeAddFunc: (_ctx, log) => {
        if (this.IsDev()) {
          printLog.fn(log);

          // manually check the log level and skip if necessary
          if (Number(log.Level) < this.settings().logs.minLevel) {
            return false;
          }
        }

        if (flushTimer) {
          clearTimeout(flushTimer);
        }
        flushTimer = setTimeout(() => {
          void handler.WriteAll({});
        }, flushDelayMs);

        return this.settings().logs.maxDays > 0;
      },
      WriteFunc: async (_ctx, logs) => {
        if (!this.isBootstrapped() || this.settings().logs.maxDays === 0) {
          return null;
        }

        const txErr = await this.AuxRunInTransaction(async (txApp) => {
          for (const entry of logs) {
            const model = new Log();
            model.MarkAsNew();
            model.id = GenerateDefaultRandomId();
            model.level = Number(entry.Level);
            model.message = entry.Message;
            model.data = entry.Data;
            model.created = ParseDateTime(entry.Time);

            const saveErr = await txApp.AuxSave(model);
            if (saveErr) {
              // eslint-disable-next-line no-console
              console.warn("Failed to write log", model, saveErr);
            }
          }
          return null;
        });

        return txErr;
      },
    });

    this.#logger = slog.New(handler);

    // write all remaining logs before timer cleanup to avoid races with ResetBootstrapState
    this.OnTerminate().Bind({
      Id: "__pbAppLoggerOnTerminate__",
      Priority: -999,
      Func: async (event) => {
        await handler.WriteAll({});

        if (flushTimer) {
          clearTimeout(flushTimer);
          flushTimer = null;
        }

        return event.Next();
      },
    });

    // reload log handler level (if initialized)
    this.OnSettingsReload().Bind({
      Id: "__pbAppLoggerOnSettingsReload__",
      Priority: -999,
      Func: (event) => {
        const result = event.Next();
        if (result instanceof Error) {
          return result;
        }
        if (result instanceof Promise) {
          event.App.Logger().Warn("OnSettingsReload handlers should not be async; skipping log cleanup");
          return null;
        }

        const logger = event.App.Logger();
        const loggerHandler = logger.Handler();
        if (loggerHandler instanceof BatchHandler) {
          loggerHandler.SetLevel(getLoggerMinLevel(event.App));
        }

        // try to clear old logs not matching the new settings
        const createdBefore = NowDateTime().addDate(0, 0, -1 * event.App.settings().logs.maxDays);
        try {
          event.App.auxDb().run(`delete from {{${LogsTableName}}} where [[created]] <= ? or [[level]] < ?`, [
            createdBefore.toString(),
            event.App.settings().logs.minLevel,
          ]);
        } catch (error) {
          logger.Debug("Failed to cleanup old logs", "error", error);
        }

        // no logs are allowed -> try to reclaim preserved disk space after delete operation
        if (event.App.settings().logs.maxDays === 0) {
          try {
            event.App.auxDb().run("VACUUM");
          } catch (error) {
            logger.Debug("Failed to VACUUM aux database", "error", error);
          }
        }

        return null;
      },
    });

    return null;
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

  reloadSettings(): Error | null {
    const err = ReloadSettingsHelper(this);
    if (err) {
      this.Logger().Warn("Failed to reload settings", "error", err);
    }
    return err;
  }

  ReloadSettings(): Error | null {
    return this.reloadSettings();
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
    return FindAllExternalAuthsByRecordQuery(this, authRecord);
  }

  // Ported from pocketbase/core/external_auth_query.go.
  FindAllExternalAuthsByCollection(collection: Collection): ExternalAuth[] {
    return FindAllExternalAuthsByCollectionQuery(this, collection);
  }

  // Ported from pocketbase/core/external_auth_query.go.
  FindFirstExternalAuthByExpr(expr: SqlExpr | Record<string, unknown>): ExternalAuth {
    return FindFirstExternalAuthByExprQuery(this, expr);
  }

  // Ported from pocketbase/core/otp_query.go.
  FindAllOTPsByRecord(authRecord: RecordModel): OTP[] {
    return FindAllOTPsByRecordQuery(this, authRecord);
  }

  // Ported from pocketbase/core/otp_query.go.
  FindAllOTPsByCollection(collection: Collection): OTP[] {
    return FindAllOTPsByCollectionQuery(this, collection);
  }

  // Ported from pocketbase/core/otp_query.go.
  FindOTPById(id: string): OTP {
    return FindOTPByIdQuery(this, id);
  }

  // Ported from pocketbase/core/otp_query.go.
  async DeleteAllOTPsByRecord(authRecord: RecordModel): Promise<Error | null> {
    return await DeleteAllOTPsByRecordQuery(this, authRecord);
  }

  // Ported from pocketbase/core/otp_query.go.
  async DeleteExpiredOTPs(): Promise<Error | null> {
    return await DeleteExpiredOTPsQuery(this);
  }

  // Ported from pocketbase/core/mfa_query.go.
  FindAllMFAsByRecord(authRecord: RecordModel): MFA[] {
    return FindAllMFAsByRecordQuery(this, authRecord);
  }

  // Ported from pocketbase/core/mfa_query.go.
  FindAllMFAsByCollection(collection: Collection): MFA[] {
    return FindAllMFAsByCollectionQuery(this, collection);
  }

  // Ported from pocketbase/core/mfa_query.go.
  FindMFAById(id: string): MFA {
    return FindMFAByIdQuery(this, id);
  }

  // Ported from pocketbase/core/mfa_query.go.
  async DeleteAllMFAsByRecord(authRecord: RecordModel): Promise<Error | null> {
    return await DeleteAllMFAsByRecordQuery(this, authRecord);
  }

  // Ported from pocketbase/core/mfa_query.go.
  async DeleteExpiredMFAs(): Promise<Error | null> {
    return await DeleteExpiredMFAsQuery(this);
  }

  FindAllAuthOriginsByRecord(authRecord: RecordModel): AuthOrigin[] {
    return FindAllAuthOriginsByRecordQuery(this, authRecord);
  }

  FindAllAuthOriginsByCollection(collection: Collection): AuthOrigin[] {
    return FindAllAuthOriginsByCollectionQuery(this, collection);
  }

  FindAuthOriginById(id: string): AuthOrigin {
    return FindAuthOriginByIdQuery(this, id);
  }

  FindAuthOriginByRecordAndFingerprint(authRecord: RecordModel, fingerprint: string): AuthOrigin {
    return FindAuthOriginByRecordAndFingerprintQuery(this, authRecord, fingerprint);
  }

  async DeleteAllAuthOriginsByRecord(authRecord: RecordModel): Promise<Error | null> {
    return await DeleteAllAuthOriginsByRecordQuery(this, authRecord);
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
    return FindAllCollectionsQuery(this, ...collectionTypes);
  }

  ReloadCachedCollections(): Error | null {
    return ReloadCachedCollectionsQuery(this);
  }

  FindCollectionByNameOrId(identifier: string): Collection {
    return FindCollectionByNameOrIdQuery(this, identifier);
  }

  FindCachedCollectionReferences(collection: Collection, ...excludeIds: string[]): Map<Collection, Field[]> {
    return FindCachedCollectionReferencesQuery(this, collection, ...excludeIds);
  }

  FindCollectionReferences(collection: Collection, ...excludeIds: string[]): Map<Collection, Field[]> {
    return FindCollectionReferencesQuery(this, collection, ...excludeIds);
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
        "select id, name, system, type, fields, indexes, listRule, viewRule, createRule, updateRule, deleteRule, options, created, updated from _collections where id = ? or lower(name) = lower(?)",
      )
      .get(identifier, identifier) as CollectionRow | undefined;

    if (!row) {
      return null;
    }

    return collectionFromRow(row);
  }

  FindCachedCollectionByNameOrId(identifier: string): Collection {
    return FindCachedCollectionByNameOrIdQuery(this, identifier);
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
    return await CreateBackupHelper(this, ctx, name);
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
    return await RestoreBackupHelper(this, ctx, name);
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

  // PocketBun keeps async Save for runtime flexibility; SaveSync preserves JSVM sync semantics.
  SaveSync(model: Model): Error | null {
    return this.saveModelSync(model, true);
  }

  SaveNoValidateSync(model: Model): Error | null {
    return this.saveModelSync(model, false);
  }

  SaveWithContextSync(_ctx: unknown, model: Model): Error | null {
    return this.saveModelSync(model, true);
  }

  SaveNoValidateWithContextSync(_ctx: unknown, model: Model): Error | null {
    return this.saveModelSync(model, false);
  }

  private async withDatabase<T>(db: DbxDatabase, fn: () => Promise<T>): Promise<T> {
    // Deviation: reuse the primary save/delete code by temporarily swapping the active db.
    const previous = this.#db;
    this.#db = db;
    try {
      return await fn();
    } finally {
      this.#db = previous;
    }
  }

  async AuxSave(model: Model): Promise<Error | null> {
    return await this.withDatabase(this.auxDb() as DbxDatabase, () => this.saveModel(model, true));
  }

  async AuxSaveNoValidate(model: Model): Promise<Error | null> {
    return await this.withDatabase(this.auxDb() as DbxDatabase, () => this.saveModel(model, false));
  }

  async AuxSaveWithContext(_ctx: unknown, model: Model): Promise<Error | null> {
    return await this.withDatabase(this.auxDb() as DbxDatabase, () => this.saveModel(model, true));
  }

  async AuxSaveNoValidateWithContext(_ctx: unknown, model: Model): Promise<Error | null> {
    return await this.withDatabase(this.auxDb() as DbxDatabase, () => this.saveModel(model, false));
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

  private runRecordInterceptorsSync(record: RecordModel, action: string, actionFunc: () => Error | null): Error | null {
    if (!this.#hooksEnabled) {
      return actionFunc();
    }
    return record.callFieldInterceptorsSync(null, this, action, actionFunc);
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

  private saveModelSync(model: Model, runValidation: boolean): Error | null {
    const recordInfo = resolveRecordProxy(model);
    if (recordInfo) {
      const { record, model: eventModel } = recordInfo;
      const isNew = record.IsNew();
      const modelEvent = new ModelEvent(this, eventModel, isNew ? ModelEventTypeCreate : ModelEventTypeUpdate);
      const action = isNew ? InterceptorActionCreate : InterceptorActionUpdate;
      const executeAction = isNew ? InterceptorActionCreateExecute : InterceptorActionUpdateExecute;
      const afterSuccess = isNew ? InterceptorActionAfterCreate : InterceptorActionAfterUpdate;
      const afterError = isNew ? InterceptorActionAfterCreateError : InterceptorActionAfterUpdateError;

      const runPersist = (): Error | null =>
        this.runRecordInterceptorsSync(record, executeAction, () => {
          if (this.#hooksEnabled) {
            const execErr = this.onRecordSaveExecute(record);
            if (execErr) {
              return execErr;
            }
          }
          return this.persistRecordSync(record);
        });

      const runValidatedExecute = (): Error | null =>
        this.runRecordInterceptorsSync(record, action, () => {
          if (runValidation) {
            const validateErr = this.ValidateSync(eventModel);
            if (validateErr) {
              return validateErr;
            }
          }

          const executeResult = (isNew ? this.OnModelCreateExecute() : this.OnModelUpdateExecute()).Trigger(
            modelEvent,
            runPersist,
          );
          return ensureSyncHookResult(executeResult, "OnModelSaveExecute");
        });

      const saveResult = (isNew ? this.OnModelCreate() : this.OnModelUpdate()).Trigger(modelEvent, runValidatedExecute);
      const saveErr = ensureSyncHookResult(saveResult, "OnModelSave");

      if (saveErr) {
        const errorEvent = new ModelErrorEvent(modelEvent, saveErr);
        const afterResult = (isNew ? this.OnModelAfterCreateError() : this.OnModelAfterUpdateError()).Trigger(errorEvent, () =>
          this.runRecordInterceptorsSync(record, afterError, () => errorEvent.Error),
        );
        const afterErr = ensureSyncHookResult(afterResult, "OnModelAfterSaveError");
        return afterErr ?? errorEvent.Error;
      }

      if (this.#txInfo) {
        this.#txInfo.OnComplete((txErr) => {
          if (txErr) {
            if (action === InterceptorActionCreate) {
              record.markNew(true);
            }
            const errorEvent = new ModelErrorEvent(modelEvent, txErr);
            const result = (isNew ? this.OnModelAfterCreateError() : this.OnModelAfterUpdateError()).Trigger(errorEvent, () =>
              this.runRecordInterceptorsSync(record, afterError, () => errorEvent.Error),
            );
            return ensureSyncHookResult(result, "OnModelAfterSaveError") ?? null;
          }
          const result = (isNew ? this.OnModelAfterCreateSuccess() : this.OnModelAfterUpdateSuccess()).Trigger(modelEvent, () =>
            this.runRecordInterceptorsSync(record, afterSuccess, () => null),
          );
          return ensureSyncHookResult(result, "OnModelAfterSaveSuccess") ?? null;
        });
        return null;
      }

      const afterResult = (isNew ? this.OnModelAfterCreateSuccess() : this.OnModelAfterUpdateSuccess()).Trigger(
        modelEvent,
        () => this.runRecordInterceptorsSync(record, afterSuccess, () => null),
      );
      const afterErr = ensureSyncHookResult(afterResult, "OnModelAfterSaveSuccess");
      return afterErr ?? null;
    }

    if (model instanceof Settings) {
      const isNew = model.IsNew();
      const modelEvent = new ModelEvent(this, model, isNew ? ModelEventTypeCreate : ModelEventTypeUpdate);
      const runValidatedExecute = (): Error | null => {
        if (runValidation) {
          const validateErr = this.ValidateSync(model);
          if (validateErr) {
            return validateErr;
          }
        }

        const execResult = (isNew ? this.OnModelCreateExecute() : this.OnModelUpdateExecute()).Trigger(modelEvent, () =>
          this.saveSettings(model),
        );
        return ensureSyncHookResult(execResult, "OnModelSaveExecute");
      };

      const saveResult = (isNew ? this.OnModelCreate() : this.OnModelUpdate()).Trigger(modelEvent, runValidatedExecute);
      const saveErr = ensureSyncHookResult(saveResult, "OnModelSave");
      if (saveErr) {
        const errorEvent = new ModelErrorEvent(modelEvent, saveErr);
        const afterResult = (isNew ? this.OnModelAfterCreateError() : this.OnModelAfterUpdateError()).Trigger(
          errorEvent,
          () => errorEvent.Error,
        );
        const afterErr = ensureSyncHookResult(afterResult, "OnModelAfterSaveError");
        return afterErr ?? errorEvent.Error;
      }
      if (this.#txInfo) {
        this.#txInfo.OnComplete((txErr) => {
          if (txErr) {
            const errorEvent = new ModelErrorEvent(modelEvent, txErr);
            const result = (isNew ? this.OnModelAfterCreateError() : this.OnModelAfterUpdateError()).Trigger(
              errorEvent,
              () => errorEvent.Error,
            );
            return ensureSyncHookResult(result, "OnModelAfterSaveError") ?? null;
          }
          const result = (isNew ? this.OnModelAfterCreateSuccess() : this.OnModelAfterUpdateSuccess()).Trigger(
            modelEvent,
            () => null,
          );
          return ensureSyncHookResult(result, "OnModelAfterSaveSuccess") ?? null;
        });
        return null;
      }
      const afterResult = (isNew ? this.OnModelAfterCreateSuccess() : this.OnModelAfterUpdateSuccess()).Trigger(
        modelEvent,
        () => null,
      );
      const afterErr = ensureSyncHookResult(afterResult, "OnModelAfterSaveSuccess");
      return afterErr ?? null;
    }

    if (!(model instanceof Collection)) {
      return this.saveGenericModelSync(model, runValidation);
    }

    const isNew = model.isNew();
    const modelEvent = new ModelEvent(this, model, isNew ? ModelEventTypeCreate : ModelEventTypeUpdate);
    const runValidatedExecute = (): Error | null => {
      if (runValidation) {
        if (isNew) {
          model.initDefaultId();
        }
        const validateErr = this.ValidateSync(model);
        if (validateErr) {
          return validateErr;
        }
      }
      const execResult = (isNew ? this.OnModelCreateExecute() : this.OnModelUpdateExecute()).Trigger(modelEvent, () =>
        this.saveCollectionSync(model, false),
      );
      return ensureSyncHookResult(execResult, "OnModelSaveExecute");
    };
    const saveResult = (isNew ? this.OnModelCreate() : this.OnModelUpdate()).Trigger(modelEvent, runValidatedExecute);
    const saveErr = ensureSyncHookResult(saveResult, "OnModelSave");
    if (saveErr) {
      const errorEvent = new ModelErrorEvent(modelEvent, saveErr);
      const afterResult = (isNew ? this.OnModelAfterCreateError() : this.OnModelAfterUpdateError()).Trigger(
        errorEvent,
        () => errorEvent.Error,
      );
      const afterErr = ensureSyncHookResult(afterResult, "OnModelAfterSaveError");
      return afterErr ?? errorEvent.Error;
    }
    if (this.#txInfo) {
      this.#txInfo.OnComplete((txErr) => {
        if (txErr) {
          const errorEvent = new ModelErrorEvent(modelEvent, txErr);
          const result = (isNew ? this.OnModelAfterCreateError() : this.OnModelAfterUpdateError()).Trigger(
            errorEvent,
            () => errorEvent.Error,
          );
          return ensureSyncHookResult(result, "OnModelAfterSaveError") ?? null;
        }
        const result = (isNew ? this.OnModelAfterCreateSuccess() : this.OnModelAfterUpdateSuccess()).Trigger(
          modelEvent,
          () => null,
        );
        return ensureSyncHookResult(result, "OnModelAfterSaveSuccess") ?? null;
      });
      return null;
    }
    const afterResult = (isNew ? this.OnModelAfterCreateSuccess() : this.OnModelAfterUpdateSuccess()).Trigger(
      modelEvent,
      () => null,
    );
    const afterErr = ensureSyncHookResult(afterResult, "OnModelAfterSaveSuccess");
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

      return (await (isNew ? this.OnModelCreateExecute() : this.OnModelUpdateExecute()).Trigger(modelEvent, async () =>
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

  private saveGenericModelSync(model: Model, runValidation: boolean): Error | null {
    const isNew = model.IsNew();
    const modelEvent = new ModelEvent(this, model, isNew ? ModelEventTypeCreate : ModelEventTypeUpdate);

    const runValidatedExecute = (): Error | null => {
      if (runValidation) {
        const validateErr = this.ValidateSync(model);
        if (validateErr) {
          return validateErr;
        }
      }

      const execResult = (isNew ? this.OnModelCreateExecute() : this.OnModelUpdateExecute()).Trigger(modelEvent, () =>
        this.persistGenericModelSync(model),
      );
      return ensureSyncHookResult(execResult, "OnModelSaveExecute");
    };

    const saveResult = (isNew ? this.OnModelCreate() : this.OnModelUpdate()).Trigger(modelEvent, runValidatedExecute);
    const saveErr = ensureSyncHookResult(saveResult, "OnModelSave");
    if (saveErr) {
      if (isNew) {
        model.MarkAsNew();
      }
      const errorEvent = new ModelErrorEvent(modelEvent, saveErr);
      const afterResult = (isNew ? this.OnModelAfterCreateError() : this.OnModelAfterUpdateError()).Trigger(
        errorEvent,
        () => errorEvent.Error,
      );
      const afterErr = ensureSyncHookResult(afterResult, "OnModelAfterSaveError");
      return afterErr ?? errorEvent.Error;
    }

    if (this.#txInfo) {
      this.#txInfo.OnComplete((txErr) => {
        if (txErr) {
          if (isNew) {
            model.MarkAsNew();
          }
          const errorEvent = new ModelErrorEvent(modelEvent, txErr);
          const result = (isNew ? this.OnModelAfterCreateError() : this.OnModelAfterUpdateError()).Trigger(
            errorEvent,
            () => errorEvent.Error,
          );
          return ensureSyncHookResult(result, "OnModelAfterSaveError") ?? null;
        }
        const result = (isNew ? this.OnModelAfterCreateSuccess() : this.OnModelAfterUpdateSuccess()).Trigger(
          modelEvent,
          () => null,
        );
        return ensureSyncHookResult(result, "OnModelAfterSaveSuccess") ?? null;
      });
      return null;
    }

    const afterResult = (isNew ? this.OnModelAfterCreateSuccess() : this.OnModelAfterUpdateSuccess()).Trigger(
      modelEvent,
      () => null,
    );
    const afterErr = ensureSyncHookResult(afterResult, "OnModelAfterSaveSuccess");
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

  ValidateSync(model: Model): Error | null {
    const preValidator = model as Partial<PreValidator>;
    if (typeof preValidator.PreValidate === "function") {
      const preErr = preValidator.PreValidate(null, this);
      if (preErr) {
        return preErr;
      }
    }

    const event = new ModelEvent(this, model, ModelEventTypeValidate);
    const result = this.OnModelValidate().Trigger(event, (modelEvent) => {
      const recordInfo = resolveRecordProxy(model);
      if (!recordInfo && model instanceof Collection) {
        const original = model.isNew() ? null : this.findCollectionById(model.LastSavedPK());
        const validationErr = this.validateCollectionSync(model, original);
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

      const nextResult = modelEvent.Next();
      if (nextResult instanceof Promise) {
        return new Error("async model validate handlers are not supported in sync validation");
      }
      return nextResult as Error | null;
    });

    return ensureSyncHookResult(result, "OnModelValidate");
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
    return await RunInTransactionHelper(
      {
        app: this,
        db: () => this.db(),
        getTxInfo: () => this.#txInfo,
        setTxInfo: (info) => {
          this.#txInfo = info;
        },
      },
      fn,
    );
  }

  RunInTransactionSync(fn: (txApp: App) => Error | null): Error | null {
    return RunInTransactionSyncHelper(
      {
        app: this,
        db: () => this.db(),
        getTxInfo: () => this.#txInfo,
        setTxInfo: (info) => {
          this.#txInfo = info;
        },
      },
      fn,
    );
  }

  async AuxRunInTransaction(fn: (txApp: App) => Error | null | Promise<Error | null>): Promise<Error | null> {
    return await AuxRunInTransactionHelper(this, () => this.auxDb(), fn);
  }

  AuxRunInTransactionSync(fn: (txApp: App) => Error | null): Error | null {
    return AuxRunInTransactionSyncHelper(this, () => this.auxDb(), fn);
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
    return await TruncateCollectionQuery(this, collection);
  }

  // ImportCollectionsByMarshaledJSON is the same as ImportCollections
  // but accept marshaled json array as import data (usually used for the autogenerated snapshots).
  async ImportCollectionsByMarshaledJSON(rawSliceOfMaps: string | Uint8Array, deleteMissing: boolean): Promise<Error | null> {
    return await importCollectionsByMarshaledJSON(this, rawSliceOfMaps, deleteMissing);
  }

  // ImportCollections imports the provided collections data in a single transaction.
  //
  // For existing matching collections, the imported data is unmarshaled on top of the existing model.
  //
  // NB! If deleteMissing is true, ALL NON-SYSTEM COLLECTIONS AND SCHEMA FIELDS,
  // that are not present in the imported configuration, WILL BE DELETED
  // (this includes their related records data).
  async ImportCollections(toImport: Array<Record<string, unknown>>, deleteMissing: boolean): Promise<Error | null> {
    return await importCollections(this, toImport, deleteMissing);
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

  private async persistRecord(record: RecordModel): Promise<Error | null> {
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
    const dbErr = await baseLockRetry(() => {
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
        return err instanceof Error ? err : new Error(String(err));
      }
      return null;
    }, defaultMaxLockRetries);

    if (dbErr) {
      return NormalizeUniqueIndexError(dbErr, record.collection().name, record.collection().Fields.FieldNames());
    }

    return record.PostScan();
  }

  private persistRecordSync(record: RecordModel): Error | null {
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
    const dbErr = baseLockRetrySync(() => {
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
        return err instanceof Error ? err : new Error(String(err));
      }
      return null;
    }, defaultMaxLockRetries);

    if (dbErr) {
      return NormalizeUniqueIndexError(dbErr, record.collection().name, record.collection().Fields.FieldNames());
    }

    return record.PostScan();
  }

  private async persistGenericModel(model: Model): Promise<Error | null> {
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

    const dbErr = await baseLockRetry(() => {
      try {
        if (model.IsNew()) {
          const columns = keys.map((key) => `"${key}"`).join(", ");
          const placeholders = keys.map(() => "?").join(", ");
          const values = keys.map((key) => normalizeDbValue(data[key]));
          const sql = `insert into {{${model.TableName()}}} (${columns}) values (${placeholders})`;
          this.db().run(sql, values);
        } else {
          const columns = keys.filter((key) => key !== "id");
          if (columns.length > 0) {
            const assignments = columns.map((key) => `"${key}" = ?`).join(", ");
            const values = columns.map((key) => normalizeDbValue(data[key]));
            values.push(normalizeDbValue(model.PK() ?? data.id));
            const sql = `update {{${model.TableName()}}} set ${assignments} where [[id]] = ?`;
            this.db().run(sql, values);
          }
        }
      } catch (error) {
        return error as Error;
      }
      return null;
    }, defaultMaxLockRetries);

    if (dbErr) {
      return dbErr;
    }

    model.MarkAsNotNew();

    return null;
  }

  private persistGenericModelSync(model: Model): Error | null {
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

    const dbErr = baseLockRetrySync(() => {
      try {
        if (model.IsNew()) {
          const columns = keys.map((key) => `"${key}"`).join(", ");
          const placeholders = keys.map(() => "?").join(", ");
          const values = keys.map((key) => normalizeDbValue(data[key]));
          const sql = `insert into {{${model.TableName()}}} (${columns}) values (${placeholders})`;
          this.db().run(sql, values);
        } else {
          const columns = keys.filter((key) => key !== "id");
          if (columns.length > 0) {
            const assignments = columns.map((key) => `"${key}" = ?`).join(", ");
            const values = columns.map((key) => normalizeDbValue(data[key]));
            values.push(normalizeDbValue(model.PK() ?? data.id));
            const sql = `update {{${model.TableName()}}} set ${assignments} where [[id]] = ?`;
            this.db().run(sql, values);
          }
        }
      } catch (error) {
        return error as Error;
      }
      return null;
    }, defaultMaxLockRetries);

    if (dbErr) {
      return dbErr;
    }

    model.MarkAsNotNew();

    return null;
  }

  private async deleteRecord(record: RecordModel): Promise<Error | null> {
    if (!record.Id) {
      return new Error("missing record id");
    }

    return await baseLockRetry(() => {
      try {
        this.db().run(`delete from {{${record.TableName()}}} where id = ?`, [record.Id]);
        return null;
      } catch (error) {
        return error as Error;
      }
    }, defaultMaxLockRetries);
  }

  private async deleteGenericModel(model: Model): Promise<Error | null> {
    const pk = model.PK();
    if (!pk) {
      return new Error("the model can be deleted only if it is existing and has a non-empty primary key");
    }

    const modelEvent = new ModelEvent(this, model, ModelEventTypeDelete);

    const deleteErr = (await this.OnModelDelete().Trigger(modelEvent, () =>
      this.OnModelDeleteExecute().Trigger(modelEvent, async () =>
        baseLockRetry(() => {
          try {
            this.db().run(`delete from {{${model.TableName()}}} where [[id]] = ?`, [normalizeDbValue(pk)]);
            return null;
          } catch (error) {
            return error as Error;
          }
        }, defaultMaxLockRetries),
      ),
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

    const reloadErr = this.ReloadCachedCollections();
    if (reloadErr) {
      this.Logger().Warn("Failed to reload collections cache", "error", reloadErr);
    }

    return null;
  }

  private saveCollectionSync(collection: Collection, runValidation: boolean): Error | null {
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
      const validationErr = this.ValidateSync(collection);
      if (validationErr) {
        return validationErr;
      }
    }

    if (collection.isView()) {
      let viewFields: FieldsList;
      try {
        viewFields = this.CreateViewFieldsSync(collection.ViewQuery);
      } catch (error) {
        return error as Error;
      }

      if (original) {
        const deleteErr = this.DeleteView(original.name);
        if (deleteErr) {
          return deleteErr;
        }
      }

      const saveViewErr = this.SaveViewSync(collection.name, collection.ViewQuery);
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

    const syncErr = this.syncRecordTableSchemaSync(collection, original);
    if (syncErr) {
      return syncErr;
    }

    const reloadErr = this.ReloadCachedCollections();
    if (reloadErr) {
      this.Logger().Warn("Failed to reload collections cache", "error", reloadErr);
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

    const dropErr = dropCollectionIndexes(this, collection);
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
    const reloadErr = this.ReloadCachedCollections();
    if (reloadErr) {
      this.Logger().Warn("Failed to reload collections cache", "error", reloadErr);
    }
    return null;
  }

  private async validateCollection(collection: Collection, original: Collection | null): Promise<Error | null> {
    return await validateCollection(this, collection, original);
  }

  private validateCollectionSync(collection: Collection, original: Collection | null): Error | null {
    return validateCollectionSync(this, collection, original);
  }

  private async syncRecordTableSchema(newCollection: Collection, oldCollection: Collection | null): Promise<Error | null> {
    return await syncRecordTableSchema(this, newCollection, oldCollection);
  }

  private syncRecordTableSchemaSync(newCollection: Collection, oldCollection: Collection | null): Error | null {
    return syncRecordTableSchemaSync(this, newCollection, oldCollection);
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
    registerAutobackupHooksHelper(this);
  }

  private registerCollectionHooks(): void {
    const systemHookIdCollection = "__pbCollectionSystemHook__";

    this.OnModelValidate().Bind({
      Id: systemHookIdCollection,
      Priority: -99,
      Func: (me) => {
        const { event: ce, ok } = newCollectionEventFromModelEvent(me);
        if (!ok || !ce) {
          return me.Next();
        }
        const err = this.OnCollectionValidate().Trigger(ce, (event) =>
          runHookNextWithSync(me, event, syncModelEventWithCollectionEvent, syncCollectionEventWithModelEvent),
        );
        syncModelEventWithCollectionEvent(me, ce);
        return err;
      },
    });

    this.OnModelCreate().Bind({
      Id: systemHookIdCollection,
      Priority: -99,
      Func: (me) => {
        const { event: ce, ok } = newCollectionEventFromModelEvent(me);
        if (!ok || !ce) {
          return me.Next();
        }
        const err = this.OnCollectionCreate().Trigger(ce, (event) =>
          runHookNextWithSync(me, event, syncModelEventWithCollectionEvent, syncCollectionEventWithModelEvent),
        );
        syncModelEventWithCollectionEvent(me, ce);
        return err;
      },
    });

    this.OnModelCreateExecute().Bind({
      Id: systemHookIdCollection,
      Priority: -99,
      Func: (me) => {
        const { event: ce, ok } = newCollectionEventFromModelEvent(me);
        if (!ok || !ce) {
          return me.Next();
        }
        const err = this.OnCollectionCreateExecute().Trigger(ce, (event) =>
          runHookNextWithSync(me, event, syncModelEventWithCollectionEvent, syncCollectionEventWithModelEvent),
        );
        syncModelEventWithCollectionEvent(me, ce);
        return err;
      },
    });

    this.OnModelAfterCreateSuccess().Bind({
      Id: systemHookIdCollection,
      Priority: -99,
      Func: (me) => {
        const { event: ce, ok } = newCollectionEventFromModelEvent(me);
        if (!ok || !ce) {
          return me.Next();
        }
        const err = this.OnCollectionAfterCreateSuccess().Trigger(ce, (event) =>
          runHookNextWithSync(me, event, syncModelEventWithCollectionEvent, syncCollectionEventWithModelEvent),
        );
        syncModelEventWithCollectionEvent(me, ce);
        return err;
      },
    });

    this.OnModelAfterCreateError().Bind({
      Id: systemHookIdCollection,
      Priority: -99,
      Func: (me) => {
        const { event: ce, ok } = newCollectionErrorEventFromModelErrorEvent(me);
        if (!ok || !ce) {
          return me.Next();
        }
        const err = this.OnCollectionAfterCreateError().Trigger(ce, (event) =>
          runHookNextWithSync(
            me,
            event,
            syncModelErrorEventWithCollectionErrorEvent,
            syncCollectionErrorEventWithModelErrorEvent,
          ),
        );
        syncModelErrorEventWithCollectionErrorEvent(me, ce);
        return err;
      },
    });

    this.OnModelUpdate().Bind({
      Id: systemHookIdCollection,
      Priority: -99,
      Func: (me) => {
        const { event: ce, ok } = newCollectionEventFromModelEvent(me);
        if (!ok || !ce) {
          return me.Next();
        }
        const err = this.OnCollectionUpdate().Trigger(ce, (event) =>
          runHookNextWithSync(me, event, syncModelEventWithCollectionEvent, syncCollectionEventWithModelEvent),
        );
        syncModelEventWithCollectionEvent(me, ce);
        return err;
      },
    });

    this.OnModelUpdateExecute().Bind({
      Id: systemHookIdCollection,
      Priority: -99,
      Func: (me) => {
        const { event: ce, ok } = newCollectionEventFromModelEvent(me);
        if (!ok || !ce) {
          return me.Next();
        }
        const err = this.OnCollectionUpdateExecute().Trigger(ce, (event) =>
          runHookNextWithSync(me, event, syncModelEventWithCollectionEvent, syncCollectionEventWithModelEvent),
        );
        syncModelEventWithCollectionEvent(me, ce);
        return err;
      },
    });

    this.OnModelAfterUpdateSuccess().Bind({
      Id: systemHookIdCollection,
      Priority: -99,
      Func: (me) => {
        const { event: ce, ok } = newCollectionEventFromModelEvent(me);
        if (!ok || !ce) {
          return me.Next();
        }
        const err = this.OnCollectionAfterUpdateSuccess().Trigger(ce, (event) =>
          runHookNextWithSync(me, event, syncModelEventWithCollectionEvent, syncCollectionEventWithModelEvent),
        );
        syncModelEventWithCollectionEvent(me, ce);
        return err;
      },
    });

    this.OnModelAfterUpdateError().Bind({
      Id: systemHookIdCollection,
      Priority: -99,
      Func: (me) => {
        const { event: ce, ok } = newCollectionErrorEventFromModelErrorEvent(me);
        if (!ok || !ce) {
          return me.Next();
        }
        const err = this.OnCollectionAfterUpdateError().Trigger(ce, (event) =>
          runHookNextWithSync(
            me,
            event,
            syncModelErrorEventWithCollectionErrorEvent,
            syncCollectionErrorEventWithModelErrorEvent,
          ),
        );
        syncModelErrorEventWithCollectionErrorEvent(me, ce);
        return err;
      },
    });

    this.OnModelDelete().Bind({
      Id: systemHookIdCollection,
      Priority: -99,
      Func: (me) => {
        const { event: ce, ok } = newCollectionEventFromModelEvent(me);
        if (!ok || !ce) {
          return me.Next();
        }
        const err = this.OnCollectionDelete().Trigger(ce, (event) =>
          runHookNextWithSync(me, event, syncModelEventWithCollectionEvent, syncCollectionEventWithModelEvent),
        );
        syncModelEventWithCollectionEvent(me, ce);
        return err;
      },
    });

    this.OnModelDeleteExecute().Bind({
      Id: systemHookIdCollection,
      Priority: -99,
      Func: (me) => {
        const { event: ce, ok } = newCollectionEventFromModelEvent(me);
        if (!ok || !ce) {
          return me.Next();
        }
        const err = this.OnCollectionDeleteExecute().Trigger(ce, (event) =>
          runHookNextWithSync(me, event, syncModelEventWithCollectionEvent, syncCollectionEventWithModelEvent),
        );
        syncModelEventWithCollectionEvent(me, ce);
        return err;
      },
    });

    this.OnModelAfterDeleteSuccess().Bind({
      Id: systemHookIdCollection,
      Priority: -99,
      Func: (me) => {
        const { event: ce, ok } = newCollectionEventFromModelEvent(me);
        if (!ok || !ce) {
          return me.Next();
        }
        const err = this.OnCollectionAfterDeleteSuccess().Trigger(ce, (event) =>
          runHookNextWithSync(me, event, syncModelEventWithCollectionEvent, syncCollectionEventWithModelEvent),
        );
        syncModelEventWithCollectionEvent(me, ce);
        return err;
      },
    });

    this.OnModelAfterDeleteError().Bind({
      Id: systemHookIdCollection,
      Priority: -99,
      Func: (me) => {
        const { event: ce, ok } = newCollectionErrorEventFromModelErrorEvent(me);
        if (!ok || !ce) {
          return me.Next();
        }
        const err = this.OnCollectionAfterDeleteError().Trigger(ce, (event) =>
          runHookNextWithSync(
            me,
            event,
            syncModelErrorEventWithCollectionErrorEvent,
            syncCollectionErrorEventWithModelErrorEvent,
          ),
        );
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
      Func: (me) => {
        const { event: re, ok } = newRecordEventFromModelEvent(me);
        if (!ok || !re) {
          return me.Next();
        }
        const err = this.OnRecordValidate().Trigger(re, (event) =>
          runHookNextWithSync(me, event, syncModelEventWithRecordEvent, syncRecordEventWithModelEvent),
        );
        syncModelEventWithRecordEvent(me, re);
        return err;
      },
    });

    this.OnModelCreate().Bind({
      Id: systemHookIdRecord,
      Priority: -99,
      Func: (me) => {
        const { event: re, ok } = newRecordEventFromModelEvent(me);
        if (!ok || !re) {
          return me.Next();
        }
        const err = this.OnRecordCreate().Trigger(re, (event) =>
          runHookNextWithSync(me, event, syncModelEventWithRecordEvent, syncRecordEventWithModelEvent),
        );
        syncModelEventWithRecordEvent(me, re);
        return err;
      },
    });

    this.OnModelCreateExecute().Bind({
      Id: systemHookIdRecord,
      Priority: -99,
      Func: (me) => {
        const { event: re, ok } = newRecordEventFromModelEvent(me);
        if (!ok || !re) {
          return me.Next();
        }
        const err = this.OnRecordCreateExecute().Trigger(re, (event) =>
          runHookNextWithSync(me, event, syncModelEventWithRecordEvent, syncRecordEventWithModelEvent),
        );
        syncModelEventWithRecordEvent(me, re);
        return err;
      },
    });

    this.OnModelAfterCreateSuccess().Bind({
      Id: systemHookIdRecord,
      Priority: -99,
      Func: (me) => {
        const { event: re, ok } = newRecordEventFromModelEvent(me);
        if (!ok || !re) {
          return me.Next();
        }
        const err = this.OnRecordAfterCreateSuccess().Trigger(re, (event) =>
          runHookNextWithSync(me, event, syncModelEventWithRecordEvent, syncRecordEventWithModelEvent),
        );
        syncModelEventWithRecordEvent(me, re);
        return err;
      },
    });

    this.OnModelAfterCreateError().Bind({
      Id: systemHookIdRecord,
      Priority: -99,
      Func: (me) => {
        const { event: re, ok } = newRecordErrorEventFromModelErrorEvent(me);
        if (!ok || !re) {
          return me.Next();
        }
        const err = this.OnRecordAfterCreateError().Trigger(re, (event) =>
          runHookNextWithSync(me, event, syncModelErrorEventWithRecordErrorEvent, syncRecordErrorEventWithModelErrorEvent),
        );
        syncModelErrorEventWithRecordErrorEvent(me, re);
        return err;
      },
    });

    this.OnModelUpdate().Bind({
      Id: systemHookIdRecord,
      Priority: -99,
      Func: (me) => {
        const { event: re, ok } = newRecordEventFromModelEvent(me);
        if (!ok || !re) {
          return me.Next();
        }
        const err = this.OnRecordUpdate().Trigger(re, (event) =>
          runHookNextWithSync(me, event, syncModelEventWithRecordEvent, syncRecordEventWithModelEvent),
        );
        syncModelEventWithRecordEvent(me, re);
        return err;
      },
    });

    this.OnModelUpdateExecute().Bind({
      Id: systemHookIdRecord,
      Priority: -99,
      Func: (me) => {
        const { event: re, ok } = newRecordEventFromModelEvent(me);
        if (!ok || !re) {
          return me.Next();
        }
        const err = this.OnRecordUpdateExecute().Trigger(re, (event) =>
          runHookNextWithSync(me, event, syncModelEventWithRecordEvent, syncRecordEventWithModelEvent),
        );
        syncModelEventWithRecordEvent(me, re);
        return err;
      },
    });

    this.OnModelAfterUpdateSuccess().Bind({
      Id: systemHookIdRecord,
      Priority: -99,
      Func: (me) => {
        const { event: re, ok } = newRecordEventFromModelEvent(me);
        if (!ok || !re) {
          return me.Next();
        }
        const err = this.OnRecordAfterUpdateSuccess().Trigger(re, (event) =>
          runHookNextWithSync(me, event, syncModelEventWithRecordEvent, syncRecordEventWithModelEvent),
        );
        syncModelEventWithRecordEvent(me, re);
        return err;
      },
    });

    this.OnModelAfterUpdateError().Bind({
      Id: systemHookIdRecord,
      Priority: -99,
      Func: (me) => {
        const { event: re, ok } = newRecordErrorEventFromModelErrorEvent(me);
        if (!ok || !re) {
          return me.Next();
        }
        const err = this.OnRecordAfterUpdateError().Trigger(re, (event) =>
          runHookNextWithSync(me, event, syncModelErrorEventWithRecordErrorEvent, syncRecordErrorEventWithModelErrorEvent),
        );
        syncModelErrorEventWithRecordErrorEvent(me, re);
        return err;
      },
    });

    this.OnModelDelete().Bind({
      Id: systemHookIdRecord,
      Priority: -99,
      Func: (me) => {
        const { event: re, ok } = newRecordEventFromModelEvent(me);
        if (!ok || !re) {
          return me.Next();
        }
        const err = this.OnRecordDelete().Trigger(re, (event) =>
          runHookNextWithSync(me, event, syncModelEventWithRecordEvent, syncRecordEventWithModelEvent),
        );
        syncModelEventWithRecordEvent(me, re);
        return err;
      },
    });

    this.OnModelDeleteExecute().Bind({
      Id: systemHookIdRecord,
      Priority: -99,
      Func: (me) => {
        const { event: re, ok } = newRecordEventFromModelEvent(me);
        if (!ok || !re) {
          return me.Next();
        }
        const err = this.OnRecordDeleteExecute().Trigger(re, (event) =>
          runHookNextWithSync(me, event, syncModelEventWithRecordEvent, syncRecordEventWithModelEvent),
        );
        syncModelEventWithRecordEvent(me, re);
        return err;
      },
    });

    this.OnRecordDeleteExecute().Bind({
      Id: systemHookIdRecord,
      Priority: 99,
      Func: (event) => this.onRecordDeleteExecute(event),
    });

    this.OnModelAfterDeleteSuccess().Bind({
      Id: systemHookIdRecord,
      Priority: -99,
      Func: (me) => {
        const { event: re, ok } = newRecordEventFromModelEvent(me);
        if (!ok || !re) {
          return me.Next();
        }
        const err = this.OnRecordAfterDeleteSuccess().Trigger(re, (event) =>
          runHookNextWithSync(me, event, syncModelEventWithRecordEvent, syncRecordEventWithModelEvent),
        );
        syncModelEventWithRecordEvent(me, re);
        return err;
      },
    });

    this.OnModelAfterDeleteError().Bind({
      Id: systemHookIdRecord,
      Priority: -99,
      Func: (me) => {
        const { event: re, ok } = newRecordErrorEventFromModelErrorEvent(me);
        if (!ok || !re) {
          return me.Next();
        }
        const err = this.OnRecordAfterDeleteError().Trigger(re, (event) =>
          runHookNextWithSync(me, event, syncModelErrorEventWithRecordErrorEvent, syncRecordErrorEventWithModelErrorEvent),
        );
        syncModelErrorEventWithRecordErrorEvent(me, re);
        return err;
      },
    });

    this.OnRecordValidate().Bind({
      Id: systemHookIdRecord,
      Priority: 99,
      Func: (e) => {
        if (!e.Record) {
          return e.Next();
        }
        return e.Record.callFieldInterceptors(e.Context, e.App, InterceptorActionValidate, () => {
          const err = this.validateRecord(e.Record as RecordModel);
          if (err) {
            return err;
          }
          const nextResult = e.Next();
          if (nextResult instanceof Promise) {
            return nextResult.then((result) => result as Error | null);
          }
          return nextResult as Error | null;
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
      Func: (e) => {
        const record = e.Record;
        const isAuth = record?.collection().IsAuth() ?? false;
        // Deviation: capture the original hash before e.Next() because PostScan updates originals during save.
        const oldHash = isAuth && record ? record.Original().GetString(`${FieldNamePassword}:hash`) : "";

        const nextResult = e.Next();
        const handleResult = (err: Error | null) => {
          if (err || !isAuth || !record) {
            return err;
          }

          const newHash = record.GetString(`${FieldNamePassword}:hash`);
          if (oldHash !== newHash) {
            const deleteResult = e.App.DeleteAllMFAsByRecord(record);
            if (deleteResult instanceof Promise) {
              return deleteResult.then((deleteErr) => {
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
                return null;
              });
            }
            if (deleteResult) {
              e.App.Logger().Warn(
                "Failed to delete all previous mfas",
                "error",
                deleteResult,
                "recordId",
                record.Id,
                "collectionId",
                record.collection().id,
              );
            }
          }

          return null;
        };

        if (nextResult instanceof Promise) {
          return nextResult.then((err) => handleResult(err as Error | null));
        }

        return handleResult(nextResult as Error | null);
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
      Func: (e) => {
        const record = e.Record;
        const isAuth = record?.collection().IsAuth() ?? false;
        // Deviation: capture the original hash before e.Next() because PostScan updates originals during save.
        const oldHash = isAuth && record ? record.Original().GetString(`${FieldNamePassword}:hash`) : "";

        const nextResult = e.Next();
        const handleResult = (err: Error | null) => {
          if (err || !isAuth || !record) {
            return err;
          }

          const newHash = record.GetString(`${FieldNamePassword}:hash`);
          if (oldHash !== newHash) {
            const deleteResult = e.App.DeleteAllAuthOriginsByRecord(record);
            if (deleteResult instanceof Promise) {
              return deleteResult.then((deleteErr) => {
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
                return null;
              });
            }
            if (deleteResult) {
              e.App.Logger().Warn(
                "Failed to delete all previous auth origin fingerprints",
                "error",
                deleteResult,
                "recordId",
                record.Id,
                "collectionId",
                record.collection().id,
              );
            }
          }

          return null;
        };

        if (nextResult instanceof Promise) {
          return nextResult.then((err) => handleResult(err as Error | null));
        }

        return handleResult(nextResult as Error | null);
      },
      Priority: 99,
    });
  }

  async SaveView(name: string, selectQuery: string): Promise<Error | null> {
    return await SaveView(this, name, selectQuery);
  }

  SaveViewSync(name: string, selectQuery: string): Error | null {
    return SaveViewSync(this, name, selectQuery);
  }

  DeleteView(name: string): Error | null {
    return DeleteView(this, name);
  }

  async CreateViewFields(selectQuery: string): Promise<FieldsList> {
    return await CreateViewFields(this, selectQuery);
  }

  CreateViewFieldsSync(selectQuery: string): FieldsList {
    return CreateViewFieldsSync(this, selectQuery);
  }

  TableInfo(tableName: string) {
    return TableInfo(this.db(), tableName);
  }

  TableIndexes(tableName: string): Record<string, string> {
    return TableIndexes(this.db(), tableName);
  }

  HasTable(name: string): boolean {
    const row = this.db()
      .query("select name from sqlite_master where type in ('table','view') and lower(name) = lower(?)")
      .get(name) as { name?: string } | undefined;
    return Boolean(row?.name);
  }

  IsCollectionNameUnique(name: string, excludeId?: string): boolean {
    return IsCollectionNameUniqueQuery(this, name, excludeId);
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

function runHookNextWithSync<TModelEvent extends { Next: () => unknown }, TEvent>(
  modelEvent: TModelEvent,
  event: TEvent,
  syncToEvent: (modelEvent: TModelEvent, event: TEvent) => void,
  syncToModel: (event: TEvent, modelEvent: TModelEvent) => void,
): unknown {
  syncToEvent(modelEvent, event);
  const result = modelEvent.Next();
  if (result instanceof Promise) {
    return result.then((value) => {
      syncToModel(event, modelEvent);
      return value;
    });
  }
  syncToModel(event, modelEvent);
  return result;
}

function ensureSyncHookResult(result: unknown, context: string): Error | null {
  if (result instanceof Promise) {
    return new Error(`async handlers are not supported in sync ${context}`);
  }
  return result instanceof Error ? result : null;
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

// getLoggerMinLevel returns the logger min level based on the app configurations.
function getLoggerMinLevel(app: App): slog.Level {
  if (app.IsDev()) {
    return new slog.Level(-99999);
  }

  return new slog.Level(app.settings().logs.minLevel);
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
