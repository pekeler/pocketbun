// Ported from pocketbase/core/app.go
//
// Package core is the backbone of PocketBase.
//
// It defines the main PocketBase App interface and its base implementation.

import type { Database, SQLQueryBindings } from "bun:sqlite";
import type { Logger as SlogLogger } from "../internal/compat/slog.ts";
import type { Cron } from "../tools/cron/cron.ts";
import type { SelectQuery } from "../tools/dbx/select_query.ts";
import type { System } from "../tools/filesystem/filesystem.ts";
import type { Hook } from "../tools/hook/hook.ts";
import type { TaggedHook } from "../tools/hook/tagged.ts";
import type { Mailer } from "../tools/mailer/mailer.ts";
import type { SqlExpr } from "../tools/search/types.ts";
import type { Broker } from "../tools/subscriptions/broker.ts";
import type { AuthOrigin } from "./auth_origin_model.ts";
import type { Collection } from "./collection_model.ts";
import type { Model } from "./db_model.ts";
import type { TableInfoRow } from "./db_table.ts";
import type { RequestInfo } from "./event_request.ts";
import type { BatchRequestEvent } from "./event_request_batch.ts";
import type {
  BackupEvent,
  BootstrapEvent,
  CollectionRequestEvent,
  CollectionsImportRequestEvent,
  CollectionsListRequestEvent,
  CollectionEvent,
  CollectionErrorEvent,
  FileDownloadRequestEvent,
  FileTokenRequestEvent,
  MailerEvent,
  MailerRecordEvent,
  ModelErrorEvent,
  ModelEvent,
  RealtimeConnectRequestEvent,
  RealtimeMessageEvent,
  RealtimeSubscribeRequestEvent,
  ServeEvent,
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
  SettingsListRequestEvent,
  SettingsReloadEvent,
  SettingsUpdateRequestEvent,
  TerminateEvent,
} from "./events.ts";
import type { ExternalAuth } from "./external_auth_model.ts";
import type { Field } from "./field.ts";
import type { FieldsList } from "./fields_list.ts";
import type { Log } from "./log_model.ts";
import type { LogsStatsItem } from "./log_query.ts";
import type { MFA } from "./mfa_model.ts";
import type { OTP } from "./otp_model.ts";
import type { Record as RecordModel } from "./record_model.ts";
import type { RecordQueryFilter } from "./record_query.ts";
import type { RecordQuery } from "./record_query.ts";
import type { ExpandFetchFunc } from "./record_query_expand.ts";
import type { Settings } from "./settings_model.ts";
import type { Store } from "./store.ts";
import type { DryRunViewResult } from "./view.ts";

export type Logger = SlogLogger;

// App defines the main PocketBase app interface.
//
// Note that the interface is not intended to be implemented manually by users
// and instead they should use core.BaseApp (either directly or as embedded field in a custom struct).
//
// This interface exists to make testing easier and to allow users to
// create common and pluggable helpers and methods that doesn't rely
// on a specific wrapped app struct (hence the large interface size).
export interface App {
  dataDir(): string;
  DataDir(): string;
  encryptionEnv(): string;
  settings(): Settings;
  store(): Store<string, unknown>;
  Cron(): Cron;
  IsDev(): boolean;
  SubscriptionsBroker(): Broker;
  isBootstrapped(): boolean;
  bootstrap(): void;
  // bootstrapAsync is a PocketBun-only async alternative to bootstrap().
  bootstrapAsync?(): Promise<void>;
  resetBootstrapState(): void;
  db(): Database;
  auxDb(): Database;
  TxInfo(): { OnComplete: (fn: (txErr: Error | null) => Error | null) => void } | null;
  auxHasTable(name: string): boolean;
  AuxHasTable(name: string): boolean;
  reloadSettings(): Error | null;
  // reloadSettingsAsync is a PocketBun-only async alternative to reloadSettings().
  reloadSettingsAsync?(): Promise<Error | null>;
  ReloadSettings(): Error | null;
  // ReloadSettingsAsync is a PocketBun-only async alternative to ReloadSettings().
  ReloadSettingsAsync?(): Promise<Error | null>;
  runSystemMigrations(): void;
  runAppMigrations(): void;
  runAllMigrations(): void;
  // NewMailClient creates and returns a new SMTP or Sendmail client
  // based on the current app settings.
  NewMailClient(): Mailer;
  // NewFilesystem creates a new local or S3 filesystem instance
  // for managing regular app files (ex. record uploads)
  // based on the current app settings.
  //
  // NB! Make sure to call Close() on the returned result
  // after you are done working with it.
  NewFilesystem(): System;
  // NewFilesystemAsync is a PocketBun-only async alternative to NewFilesystem().
  NewFilesystemAsync?(): Promise<System>;
  // NewBackupsFilesystem creates a new local or S3 filesystem instance
  // for managing app backups based on the current app settings.
  //
  // NB! Make sure to call Close() on the returned result
  // after you are done working with it.
  NewBackupsFilesystem(): System;
  // NewBackupsFilesystemAsync is a PocketBun-only async alternative to NewBackupsFilesystem().
  NewBackupsFilesystemAsync?(): Promise<System>;
  // CreateBackup creates a new backup of the current app pb_data directory.
  //
  // Backups can be stored on S3 if it is configured in app.Settings().Backups.
  //
  // Please refer to the godoc of the specific core.App implementation
  // for details on the backup procedures.
  CreateBackup(ctx: unknown, name: string): Promise<Error | null>;
  // RestoreBackup restores the backup with the specified name and restarts
  // the current running application process.
  //
  // The safely perform the restore it is recommended to have free disk space
  // for at least 2x the size of the restored pb_data backup.
  //
  // Please refer to the godoc of the specific core.App implementation
  // for details on the restore procedures.
  //
  // NB! This feature is experimental and currently is expected to work only on UNIX based systems.
  RestoreBackup(ctx: unknown, name: string): Promise<Error | null>;
  // Restart restarts (aka. replaces) the current running application process.
  //
  // NB! It relies on execve which is supported only on UNIX based systems.
  Restart(): Error | null;
  // RestartAsync is a PocketBun-only async alternative to Restart().
  RestartAsync?(): Promise<Error | null>;
  Save(model: Model): Promise<Error | null>;
  SaveNoValidate(model: Model): Promise<Error | null>;
  SaveWithContext(ctx: unknown, model: Model): Promise<Error | null>;
  SaveNoValidateWithContext(ctx: unknown, model: Model): Promise<Error | null>;
  SaveSync(model: Model): Error | null;
  SaveNoValidateSync(model: Model): Error | null;
  SaveWithContextSync(ctx: unknown, model: Model): Error | null;
  SaveNoValidateWithContextSync(ctx: unknown, model: Model): Error | null;
  AuxSave(model: Model): Promise<Error | null>;
  AuxSaveNoValidate(model: Model): Promise<Error | null>;
  AuxSaveWithContext(ctx: unknown, model: Model): Promise<Error | null>;
  AuxSaveNoValidateWithContext(ctx: unknown, model: Model): Promise<Error | null>;
  Delete(model: Model): Promise<Error | null>;
  DeleteWithContext(ctx: unknown, model: Model): Promise<Error | null>;
  Validate(model: Model): Promise<Error | null>;
  ValidateWithContext(ctx: unknown, model: Model): Promise<Error | null>;
  ValidateSync(model: Model): Error | null;
  TruncateCollection(collection: Collection): Promise<Error | null>;
  ImportCollectionsByMarshaledJSON(rawSliceOfMaps: string | Uint8Array, deleteMissing: boolean): Promise<Error | null>;
  ImportCollections(toImport: Array<Record<string, unknown>>, deleteMissing: boolean): Promise<Error | null>;
  RunInTransaction(fn: (txApp: App) => Error | null | Promise<Error | null>): Promise<Error | null>;
  // AuxRunInTransaction wraps fn into a transaction for the auxiliary app database.
  AuxRunInTransaction(fn: (txApp: App) => Error | null | Promise<Error | null>): Promise<Error | null>;
  RunInTransactionSync(fn: (txApp: App) => Error | null): Error | null;
  // AuxRunInTransactionSync wraps fn into a transaction for the auxiliary app database.
  AuxRunInTransactionSync(fn: (txApp: App) => Error | null): Error | null;
  // RunInTransactionAsync is PocketBun-only helper for async transaction work.
  RunInTransactionAsync(fn: (txApp: App) => Promise<Error | null> | Error | null): Promise<Error | null>;
  IsTransactional(): boolean;
  UnsafeWithoutHooks(): App;
  // PocketBun deviation: ForMigrations returns a shallow app copy intended for migration code.
  //
  // It preserves PocketBun system hooks while omitting user hooks registered
  // after app construction.
  ForMigrations(): App;
  forMigrations(): App;
  Logger(): Logger;
  ModelQuery(model: { TableName: () => string }): SelectQuery;
  AuxModelQuery(model: { TableName: () => string }): SelectQuery;
  CollectionQuery(): SelectQuery;
  LogQuery(): SelectQuery;
  FindLogById(id: string): Log;
  LogsStats(expr: SqlExpr | null): LogsStatsItem[];
  DeleteOldLogs(createdBefore: Date): Error | null;
  RecordQuery(collectionModelOrIdentifier: Collection | string | null | undefined): RecordQuery;
  findAuthRecordByToken(token: string, validTypes?: string[]): RecordModel;
  findCollectionById(id: string): Collection | null;
  findCollectionByNameOrId(identifier: string): Collection | null;
  FindCollectionByNameOrId(identifier: string): Collection;
  FindCachedCollectionByNameOrId(identifier: string): Collection;
  FindAllCollections(...collectionTypes: string[]): Collection[];
  ReloadCachedCollections(): Error | null;
  FindCollectionReferences(collection: Collection, ...excludeIds: string[]): Map<Collection, Field[]>;
  FindCachedCollectionReferences(collection: Collection, ...excludeIds: string[]): Map<Collection, Field[]>;
  HasTable(name: string): boolean;
  TableColumns(tableName: string): string[];
  TableIndexes(tableName: string): Record<string, string>;
  // DeleteTable drops the specified table.
  //
  // This method is a no-op if a table with the provided name doesn't exist.
  //
  // NB! Be aware that this method is vulnerable to SQL injection and the
  // "dangerousTableName" argument must come only from trusted input!
  DeleteTable(dangerousTableName: string): Error | null;
  Vacuum(): Error | null;
  AuxVacuum(): Error | null;
  IsCollectionNameUnique(name: string, excludeId?: string): boolean;
  findRecordById(collection: Collection, id: string, rule?: SqlExpr | null): RecordModel | null;
  FindRecordById(
    collectionModelOrIdentifier: Collection | string,
    id: string,
    ...filters: Array<RecordQueryFilter | null | undefined>
  ): RecordModel;
  FindRecordByViewFile(
    viewCollectionModelOrIdentifier: Collection | string,
    fileFieldName: string,
    filename: string,
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
  DeleteAllExternalAuthsByRecord(authRecord: RecordModel): Promise<Error | null>;
  FindAllOTPsByRecord(authRecord: RecordModel): OTP[];
  FindAllOTPsByCollection(collection: Collection): OTP[];
  FindOTPById(id: string): OTP;
  DeleteAllOTPsByRecord(authRecord: RecordModel): Promise<Error | null>;
  DeleteExpiredOTPs(): Promise<Error | null>;
  FindAllMFAsByRecord(authRecord: RecordModel): MFA[];
  FindAllMFAsByCollection(collection: Collection): MFA[];
  FindMFAById(id: string): MFA;
  DeleteAllMFAsByRecord(authRecord: RecordModel): Promise<Error | null>;
  DeleteExpiredMFAs(): Promise<Error | null>;
  FindAllAuthOriginsByRecord(authRecord: RecordModel): AuthOrigin[];
  FindAllAuthOriginsByCollection(collection: Collection): AuthOrigin[];
  FindAuthOriginById(id: string): AuthOrigin;
  FindAuthOriginByRecordAndFingerprint(authRecord: RecordModel, fingerprint: string): AuthOrigin;
  DeleteAllAuthOriginsByRecord(authRecord: RecordModel): Promise<Error | null>;
  findFirstRecordByFilter(
    collectionOrIdentifier: Collection | string,
    filter: string,
    ...params: SQLQueryBindings[]
  ): RecordModel | null;
  OnBootstrap(): Hook<BootstrapEvent>;
  OnServe(): Hook<ServeEvent>;
  OnTerminate(): Hook<TerminateEvent>;
  OnCollectionsListRequest(): Hook<CollectionsListRequestEvent>;
  OnCollectionViewRequest(): Hook<CollectionRequestEvent>;
  OnCollectionCreateRequest(): Hook<CollectionRequestEvent>;
  OnCollectionUpdateRequest(): Hook<CollectionRequestEvent>;
  OnCollectionDeleteRequest(): Hook<CollectionRequestEvent>;
  OnCollectionsImportRequest(): Hook<CollectionsImportRequestEvent>;
  OnBatchRequest(): Hook<BatchRequestEvent>;
  OnSettingsListRequest(): Hook<SettingsListRequestEvent>;
  OnSettingsUpdateRequest(): Hook<SettingsUpdateRequestEvent>;

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
  OnRecordRequestOTPRequest(tags?: string[]): TaggedHook<RecordCreateOTPRequestEvent>;
  OnRecordRequestPasswordResetRequest(tags?: string[]): TaggedHook<RecordRequestPasswordResetRequestEvent>;
  OnRecordConfirmPasswordResetRequest(tags?: string[]): TaggedHook<RecordConfirmPasswordResetRequestEvent>;
  OnRecordRequestVerificationRequest(tags?: string[]): TaggedHook<RecordRequestVerificationRequestEvent>;
  OnRecordConfirmVerificationRequest(tags?: string[]): TaggedHook<RecordConfirmVerificationRequestEvent>;
  OnRecordRequestEmailChangeRequest(tags?: string[]): TaggedHook<RecordRequestEmailChangeRequestEvent>;
  OnRecordConfirmEmailChangeRequest(tags?: string[]): TaggedHook<RecordConfirmEmailChangeRequestEvent>;
  OnSettingsReload(): Hook<SettingsReloadEvent>;
  // OnBackupCreate hook is triggered on each [App.CreateBackup] call.
  OnBackupCreate(): Hook<BackupEvent>;
  // OnBackupRestore hook is triggered before app backup restore (aka. [App.RestoreBackup] call).
  OnBackupRestore(): Hook<BackupEvent>;
  OnFileDownloadRequest(tags?: string[]): TaggedHook<FileDownloadRequestEvent>;
  OnFileTokenRequest(tags?: string[]): TaggedHook<FileTokenRequestEvent>;

  OnMailerSend(): Hook<MailerEvent>;
  OnMailerRecordAuthAlertSend(tags?: string[]): TaggedHook<MailerRecordEvent>;
  OnMailerRecordPasswordResetSend(tags?: string[]): TaggedHook<MailerRecordEvent>;
  OnMailerRecordVerificationSend(tags?: string[]): TaggedHook<MailerRecordEvent>;
  OnMailerRecordEmailChangeSend(tags?: string[]): TaggedHook<MailerRecordEvent>;
  OnMailerRecordOTPSend(tags?: string[]): TaggedHook<MailerRecordEvent>;

  OnRealtimeConnectRequest(): Hook<RealtimeConnectRequestEvent>;
  OnRealtimeMessageSend(): Hook<RealtimeMessageEvent>;
  OnRealtimeSubscribeRequest(): Hook<RealtimeSubscribeRequestEvent>;

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

  onBootstrap(): Hook<BootstrapEvent>;
  onServe(): Hook<ServeEvent>;
  onTerminate(): Hook<TerminateEvent>;
  onCollectionsListRequest(): Hook<CollectionsListRequestEvent>;
  onCollectionViewRequest(): Hook<CollectionRequestEvent>;
  onCollectionCreateRequest(): Hook<CollectionRequestEvent>;
  onCollectionUpdateRequest(): Hook<CollectionRequestEvent>;
  onCollectionDeleteRequest(): Hook<CollectionRequestEvent>;
  onCollectionsImportRequest(): Hook<CollectionsImportRequestEvent>;
  onBatchRequest(): Hook<BatchRequestEvent>;
  onSettingsListRequest(): Hook<SettingsListRequestEvent>;
  onSettingsUpdateRequest(): Hook<SettingsUpdateRequestEvent>;

  onModelCreate(...tags: string[]): TaggedHook<ModelEvent>;
  onModelCreateExecute(...tags: string[]): TaggedHook<ModelEvent>;
  onModelAfterCreateSuccess(...tags: string[]): TaggedHook<ModelEvent>;
  onModelAfterCreateError(...tags: string[]): TaggedHook<ModelErrorEvent>;
  onModelUpdate(...tags: string[]): TaggedHook<ModelEvent>;
  onModelUpdateExecute(...tags: string[]): TaggedHook<ModelEvent>;
  onModelAfterUpdateSuccess(...tags: string[]): TaggedHook<ModelEvent>;
  onModelAfterUpdateError(...tags: string[]): TaggedHook<ModelErrorEvent>;
  onModelValidate(...tags: string[]): TaggedHook<ModelEvent>;
  onModelDelete(...tags: string[]): TaggedHook<ModelEvent>;
  onModelDeleteExecute(...tags: string[]): TaggedHook<ModelEvent>;
  onModelAfterDeleteSuccess(...tags: string[]): TaggedHook<ModelEvent>;
  onModelAfterDeleteError(...tags: string[]): TaggedHook<ModelErrorEvent>;

  onRecordValidate(...tags: string[]): TaggedHook<RecordEvent>;
  onRecordCreate(...tags: string[]): TaggedHook<RecordEvent>;
  onRecordCreateExecute(...tags: string[]): TaggedHook<RecordEvent>;
  onRecordAfterCreateSuccess(...tags: string[]): TaggedHook<RecordEvent>;
  onRecordAfterCreateError(...tags: string[]): TaggedHook<RecordErrorEvent>;
  onRecordUpdate(...tags: string[]): TaggedHook<RecordEvent>;
  onRecordUpdateExecute(...tags: string[]): TaggedHook<RecordEvent>;
  onRecordAfterUpdateSuccess(...tags: string[]): TaggedHook<RecordEvent>;
  onRecordAfterUpdateError(...tags: string[]): TaggedHook<RecordErrorEvent>;
  onRecordDelete(...tags: string[]): TaggedHook<RecordEvent>;
  onRecordDeleteExecute(...tags: string[]): TaggedHook<RecordEvent>;
  onRecordAfterDeleteSuccess(...tags: string[]): TaggedHook<RecordEvent>;
  onRecordAfterDeleteError(...tags: string[]): TaggedHook<RecordErrorEvent>;
  onRecordEnrich(...tags: string[]): TaggedHook<RecordEnrichEvent>;
  onRecordAuthWithPasswordRequest(...tags: string[]): TaggedHook<RecordAuthWithPasswordRequestEvent>;
  onRecordAuthWithOAuth2Request(...tags: string[]): TaggedHook<RecordAuthWithOAuth2RequestEvent>;
  onRecordAuthWithOTPRequest(...tags: string[]): TaggedHook<RecordAuthWithOTPRequestEvent>;
  onRecordsListRequest(...tags: string[]): TaggedHook<RecordsListRequestEvent>;
  onRecordViewRequest(...tags: string[]): TaggedHook<RecordRequestEvent>;
  onRecordCreateRequest(...tags: string[]): TaggedHook<RecordRequestEvent>;
  onRecordUpdateRequest(...tags: string[]): TaggedHook<RecordRequestEvent>;
  onRecordDeleteRequest(...tags: string[]): TaggedHook<RecordRequestEvent>;
  onRecordAuthRequest(...tags: string[]): TaggedHook<RecordAuthRequestEvent>;
  onRecordAuthRefreshRequest(...tags: string[]): TaggedHook<RecordAuthRefreshRequestEvent>;
  onRecordCreateOTPRequest(...tags: string[]): TaggedHook<RecordCreateOTPRequestEvent>;
  onRecordRequestOTPRequest(...tags: string[]): TaggedHook<RecordCreateOTPRequestEvent>;
  onRecordRequestPasswordResetRequest(...tags: string[]): TaggedHook<RecordRequestPasswordResetRequestEvent>;
  onRecordConfirmPasswordResetRequest(...tags: string[]): TaggedHook<RecordConfirmPasswordResetRequestEvent>;
  onRecordRequestVerificationRequest(...tags: string[]): TaggedHook<RecordRequestVerificationRequestEvent>;
  onRecordConfirmVerificationRequest(...tags: string[]): TaggedHook<RecordConfirmVerificationRequestEvent>;
  onRecordRequestEmailChangeRequest(...tags: string[]): TaggedHook<RecordRequestEmailChangeRequestEvent>;
  onRecordConfirmEmailChangeRequest(...tags: string[]): TaggedHook<RecordConfirmEmailChangeRequestEvent>;
  onSettingsReload(): Hook<SettingsReloadEvent>;
  onBackupCreate(): Hook<BackupEvent>;
  onBackupRestore(): Hook<BackupEvent>;
  onFileDownloadRequest(...tags: string[]): TaggedHook<FileDownloadRequestEvent>;
  onFileTokenRequest(...tags: string[]): TaggedHook<FileTokenRequestEvent>;

  onMailerSend(): Hook<MailerEvent>;
  onMailerRecordAuthAlertSend(...tags: string[]): TaggedHook<MailerRecordEvent>;
  onMailerRecordPasswordResetSend(...tags: string[]): TaggedHook<MailerRecordEvent>;
  onMailerRecordVerificationSend(...tags: string[]): TaggedHook<MailerRecordEvent>;
  onMailerRecordEmailChangeSend(...tags: string[]): TaggedHook<MailerRecordEvent>;
  onMailerRecordOTPSend(...tags: string[]): TaggedHook<MailerRecordEvent>;

  onRealtimeConnectRequest(): Hook<RealtimeConnectRequestEvent>;
  onRealtimeMessageSend(): Hook<RealtimeMessageEvent>;
  onRealtimeSubscribeRequest(): Hook<RealtimeSubscribeRequestEvent>;

  onCollectionValidate(...tags: string[]): TaggedHook<CollectionEvent>;
  onCollectionCreate(...tags: string[]): TaggedHook<CollectionEvent>;
  onCollectionCreateExecute(...tags: string[]): TaggedHook<CollectionEvent>;
  onCollectionAfterCreateSuccess(...tags: string[]): TaggedHook<CollectionEvent>;
  onCollectionAfterCreateError(...tags: string[]): TaggedHook<CollectionErrorEvent>;
  onCollectionUpdate(...tags: string[]): TaggedHook<CollectionEvent>;
  onCollectionUpdateExecute(...tags: string[]): TaggedHook<CollectionEvent>;
  onCollectionAfterUpdateSuccess(...tags: string[]): TaggedHook<CollectionEvent>;
  onCollectionAfterUpdateError(...tags: string[]): TaggedHook<CollectionErrorEvent>;
  onCollectionDelete(...tags: string[]): TaggedHook<CollectionEvent>;
  onCollectionDeleteExecute(...tags: string[]): TaggedHook<CollectionEvent>;
  onCollectionAfterDeleteSuccess(...tags: string[]): TaggedHook<CollectionEvent>;
  onCollectionAfterDeleteError(...tags: string[]): TaggedHook<CollectionErrorEvent>;

  // DeleteView drops the specified view name.
  //
  // This method is a no-op if a view with the provided name doesn't exist.
  //
  // NB! Be aware that this method is vulnerable to SQL injection and the
  // "dangerousViewName" argument must come only from trusted input!
  DeleteView(dangerousViewName: string): Error | null;
  SaveView(dangerousViewName: string, dangerousSelectQuery: string): Promise<Error | null>;
  SaveViewSync(dangerousViewName: string, dangerousSelectQuery: string): Error | null;
  // CreateViewFields creates a new FieldsList from the provided select query.
  //
  // There are some caveats:
  // - The select query must have an "id" column.
  // - Wildcard ("*") columns are not supported to avoid accidentally leaking sensitive data.
  //
  // NB! Be aware that this method is vulnerable to SQL injection and the
  // "dangerousSelectQuery" argument must come only from trusted input!
  CreateViewFields(dangerousSelectQuery: string): Promise<FieldsList>;
  CreateViewFieldsSync(dangerousSelectQuery: string): FieldsList;
  DryRunView(dangerousSelectQuery: string, sampleSize: number): Promise<DryRunViewResult>;
  TableInfo(tableName: string): TableInfoRow[];
}

export async function bootstrapIfNeededAsync(app: App): Promise<void> {
  if (app.isBootstrapped()) {
    return;
  }

  if (typeof app.bootstrapAsync === "function") {
    await app.bootstrapAsync();
    return;
  }

  app.bootstrap();
}

export async function newFilesystemAsync(app: App): Promise<System> {
  if (typeof app.NewFilesystemAsync === "function") {
    return app.NewFilesystemAsync();
  }

  return app.NewFilesystem();
}

export async function newBackupsFilesystemAsync(app: App): Promise<System> {
  if (typeof app.NewBackupsFilesystemAsync === "function") {
    return app.NewBackupsFilesystemAsync();
  }

  return app.NewBackupsFilesystem();
}
