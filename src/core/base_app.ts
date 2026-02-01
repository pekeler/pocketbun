// Ported from pocketbase/core/base_app.go

import "../migrations/index.ts";
import "./fields_register.ts";
import type { Database, SQLQueryBindings } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { SqlExpr } from "../tools/search/types.ts";
import type { App, Logger } from "./app.ts";
import type { PostValidator, PreValidator } from "./db.ts";
import type { RequestInfo } from "./event_request.ts";
import type { RecordProxy } from "./record_proxy.ts";
import { ValidationErrors, newError, required } from "../internal/compat/validation.ts";
import { Providers } from "../tools/auth/auth.ts";
import { Cron } from "../tools/cron/cron.ts";
import { findSingleColumnUniqueIndex, parseIndex } from "../tools/dbutils/index.ts";
import { DbxDatabase } from "../tools/dbx/database.ts";
import { HashExp, NewExp, Not } from "../tools/dbx/expr.ts";
import { NewLocal } from "../tools/filesystem/filesystem.ts";
import { Hook } from "../tools/hook/hook.ts";
import { NewTaggedHook } from "../tools/hook/tagged.ts";
import { columnify } from "../tools/inflector/inflector.ts";
import { Sendmail } from "../tools/mailer/sendmail.ts";
import { SMTPClient } from "../tools/mailer/smtp.ts";
import { buildFilterExpr } from "../tools/search/filter.ts";
import { buildSortExpr, parseSortFromString } from "../tools/search/sort.ts";
import { DefaultFilterExprLimit } from "../tools/search/types.ts";
import { parseJWT, parseUnverifiedJWT } from "../tools/security/jwt.ts";
import { randomString } from "../tools/security/random.ts";
import { Broker } from "../tools/subscriptions/broker.ts";
import { DateTime, GeoPoint, JSONRaw, NowDateTime, ParseDateTime } from "../tools/types/index.ts";
import { AuthOrigin, CollectionNameAuthOrigins, recordRefHooks } from "./auth_origin_model.ts";
import {
  Collection,
  CollectionTypeAuth,
  NewAuthCollection,
  NewBaseCollection,
  NewViewCollection,
  applyCollectionData,
  collectionFromRow,
  parseCollectionFields,
  type CollectionRow,
} from "./collection.ts";
import { validateCollection } from "./collection_validate.ts";
import { TableInfo } from "./db_table.ts";
import {
  SettingsReloadEvent,
  type CollectionErrorEvent,
  type CollectionEvent,
  type CollectionRequestEvent,
  type CollectionsImportRequestEvent,
  type CollectionsListRequestEvent,
  type MailerRecordEvent,
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
} from "./field.ts";
import { FieldsList, NewFieldsList } from "./fields_list.ts";
import { CollectionNameMFAs, MFA } from "./mfa_model.ts";
import { MigrationsList } from "./migrations_list.ts";
import { AppMigrations, MigrationsRunner, SystemMigrations } from "./migrations_runner.ts";
import { CollectionNameOTPs, OTP } from "./otp_model.ts";
import { FieldNameEmail, FieldNamePassword, Record as RecordModel, type RecordData } from "./record.ts";
import { RecordFieldResolver } from "./record_field_resolver.ts";
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
import { Store } from "./store.ts";
import { NormalizeUniqueIndexError } from "./validators/db.ts";
import { CreateViewFields, DeleteView, SaveView, FindRecordByViewFile as findRecordByViewFile } from "./view.ts";

export type BaseAppConfig = {
  dataDir?: string;
  encryptionEnv?: string;
  isDev?: boolean;
};

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
  #onCollectionsListRequest!: Hook<CollectionsListRequestEvent>;
  #onCollectionViewRequest!: Hook<CollectionRequestEvent>;
  #onCollectionCreateRequest!: Hook<CollectionRequestEvent>;
  #onCollectionUpdateRequest!: Hook<CollectionRequestEvent>;
  #onCollectionDeleteRequest!: Hook<CollectionRequestEvent>;
  #onCollectionsImportRequest!: Hook<CollectionsImportRequestEvent>;
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
  #onRecordAuthWithPasswordRequest!: Hook<RecordAuthWithPasswordRequestEvent>;
  #onRecordAuthWithOAuth2Request!: Hook<RecordAuthWithOAuth2RequestEvent>;
  #onRecordAuthWithOTPRequest!: Hook<RecordAuthWithOTPRequestEvent>;
  #onRecordsListRequest!: Hook<RecordsListRequestEvent>;
  #onRecordViewRequest!: Hook<RecordRequestEvent>;
  #onRecordCreateRequest!: Hook<RecordRequestEvent>;
  #onRecordUpdateRequest!: Hook<RecordRequestEvent>;
  #onRecordDeleteRequest!: Hook<RecordRequestEvent>;
  #onRecordAuthRequest!: Hook<RecordAuthRequestEvent>;
  #onRecordAuthRefreshRequest!: Hook<RecordAuthRefreshRequestEvent>;
  #onRecordCreateOTPRequest!: Hook<RecordCreateOTPRequestEvent>;
  #onRecordRequestPasswordResetRequest!: Hook<RecordRequestPasswordResetRequestEvent>;
  #onRecordConfirmPasswordResetRequest!: Hook<RecordConfirmPasswordResetRequestEvent>;
  #onRecordRequestVerificationRequest!: Hook<RecordRequestVerificationRequestEvent>;
  #onRecordConfirmVerificationRequest!: Hook<RecordConfirmVerificationRequestEvent>;
  #onRecordRequestEmailChangeRequest!: Hook<RecordRequestEmailChangeRequestEvent>;
  #onRecordConfirmEmailChangeRequest!: Hook<RecordConfirmEmailChangeRequestEvent>;
  #onSettingsReload!: Hook<SettingsReloadEvent>;
  #onMailerSend!: Hook<MailerEvent>;
  #onMailerRecordAuthAlertSend!: Hook<MailerRecordEvent>;
  #onMailerRecordPasswordResetSend!: Hook<MailerRecordEvent>;
  #onMailerRecordVerificationSend!: Hook<MailerRecordEvent>;
  #onMailerRecordEmailChangeSend!: Hook<MailerRecordEvent>;
  #onMailerRecordOTPSend!: Hook<MailerRecordEvent>;
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
      Warn: (message: string, ...args: unknown[]) => {
        console.warn(message, ...args);
      },
      Error: (message: string, ...args: unknown[]) => {
        console.error(message, ...args);
      },
    };
    this.resetHooks();

    this.registerCollectionHooks();
    this.registerRecordHooks();
    this.registerOTPHooks();
    this.registerMFAHooks();
    this.registerExternalAuthHooks();
    this.registerAuthOriginHooks();
    this.#hooksEnabled = true;
  }

  private resetHooks(): void {
    this.#hooksEnabled = false;
    this.#onCollectionsListRequest = new Hook();
    this.#onCollectionViewRequest = new Hook();
    this.#onCollectionCreateRequest = new Hook();
    this.#onCollectionUpdateRequest = new Hook();
    this.#onCollectionDeleteRequest = new Hook();
    this.#onCollectionsImportRequest = new Hook();
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
    this.#onRecordsListRequest = new Hook();
    this.#onRecordViewRequest = new Hook();
    this.#onRecordCreateRequest = new Hook();
    this.#onRecordUpdateRequest = new Hook();
    this.#onRecordDeleteRequest = new Hook();
    this.#onRecordAuthRequest = new Hook();
    this.#onRecordAuthRefreshRequest = new Hook();
    this.#onRecordCreateOTPRequest = new Hook();
    this.#onRecordRequestPasswordResetRequest = new Hook();
    this.#onRecordConfirmPasswordResetRequest = new Hook();
    this.#onRecordRequestVerificationRequest = new Hook();
    this.#onRecordConfirmVerificationRequest = new Hook();
    this.#onRecordRequestEmailChangeRequest = new Hook();
    this.#onRecordConfirmEmailChangeRequest = new Hook();
    this.#onSettingsReload = new Hook();
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
    if (this.#bootstrapped) {
      return;
    }

    if (!existsSync(this.#dataDir)) {
      mkdirSync(this.#dataDir, { recursive: true });
    }

    this.#db = new DbxDatabase(join(this.#dataDir, "data.db"));
    this.#auxDb = new DbxDatabase(join(this.#dataDir, "auxiliary.db"));
    this.reloadSettings();
    this.#bootstrapped = true;
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
      const row = this.db().query("select value from _params where id = 'settings'").get() as { value?: string } | undefined;
      if (!row?.value || typeof row.value !== "string") {
        return;
      }

      const parsed = JSON.parse(row.value) as Record<string, unknown>;
      const event = new SettingsReloadEvent(this);
      const result = this.OnSettingsReload().Trigger(event, () => {
        this.#settings.loadFromJSON(parsed);
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

    let sql = `select * from {{${collection.name}}}`;
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

    let sql = `select * from {{${collection.name}}}`;
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

    let sql = `select * from {{${collection.name}}}`;
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
    let sql = `select * from {{${collection.name}}}`;
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
  DeleteAllOTPsByRecord(authRecord: RecordModel): Error | null {
    const models = this.FindAllOTPsByRecord(authRecord);
    const errors: Error[] = [];

    for (const model of models) {
      const err = this.Delete(model);
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
  DeleteExpiredOTPs(): Error | null {
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
        const err = this.Delete(item);
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
  DeleteAllMFAsByRecord(authRecord: RecordModel): Error | null {
    const models = this.FindAllMFAsByRecord(authRecord);
    const errors: Error[] = [];

    for (const model of models) {
      const err = this.Delete(model);
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
  DeleteExpiredMFAs(): Error | null {
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
        const err = this.Delete(item);
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

  DeleteAllAuthOriginsByRecord(authRecord: RecordModel): Error | null {
    let models: AuthOrigin[];
    try {
      models = this.FindAllAuthOriginsByRecord(authRecord);
    } catch (error) {
      return error as Error;
    }

    const errors: Error[] = [];
    for (const model of models) {
      const err = this.Delete(model);
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

    let sql = `select * from {{${collection.name}}}`;
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
    return NewLocal(join(this.#dataDir, "storage"));
  }

  Save(model: RecordModel | Collection | RecordProxy): Error | null {
    return this.saveModel(model, true);
  }

  SaveNoValidate(model: RecordModel | Collection | RecordProxy): Error | null {
    return this.saveModel(model, false);
  }

  SaveWithContext(_ctx: unknown, model: RecordModel | Collection | RecordProxy): Error | null {
    return this.saveModel(model, true);
  }

  SaveNoValidateWithContext(_ctx: unknown, model: RecordModel | Collection | RecordProxy): Error | null {
    return this.saveModel(model, false);
  }

  private runRecordInterceptors(record: RecordModel, action: string, actionFunc: () => Error | null): Error | null {
    if (!this.#hooksEnabled) {
      return actionFunc();
    }
    return record.callFieldInterceptors(null, this, action, actionFunc);
  }

  private saveModel(model: RecordModel | Collection | RecordProxy, runValidation: boolean): Error | null {
    const recordInfo = resolveRecordProxy(model);
    if (recordInfo) {
      const { record, model: eventModel } = recordInfo;
      const isNew = record.IsNew();
      const modelEvent = new ModelEvent(this, eventModel, isNew ? ModelEventTypeCreate : ModelEventTypeUpdate);
      const action = isNew ? InterceptorActionCreate : InterceptorActionUpdate;
      const executeAction = record.IsNew() ? InterceptorActionCreateExecute : InterceptorActionUpdateExecute;
      const afterSuccess = isNew ? InterceptorActionAfterCreate : InterceptorActionAfterUpdate;
      const afterError = isNew ? InterceptorActionAfterCreateError : InterceptorActionAfterUpdateError;

      const runPersist = () =>
        this.runRecordInterceptors(record, executeAction, () => {
          if (this.#hooksEnabled) {
            const execErr = this.onRecordSaveExecute(record);
            if (execErr) {
              return execErr;
            }
          }
          return this.persistRecord(record);
        });

      const runValidatedExecute = (): Error | null =>
        this.runRecordInterceptors(record, action, () => {
          if (runValidation) {
            const validateErr = this.Validate(eventModel);
            if (validateErr) {
              return validateErr;
            }
          }

          return (isNew ? this.OnModelCreateExecute() : this.OnModelUpdateExecute()).Trigger(
            modelEvent,
            runPersist,
          ) as Error | null;
        });

      const saveErr = (isNew ? this.OnModelCreate() : this.OnModelUpdate()).Trigger(
        modelEvent,
        runValidatedExecute,
      ) as Error | null;

      if (saveErr) {
        const errorEvent = new ModelErrorEvent(modelEvent, saveErr);
        const afterErr = (isNew ? this.OnModelAfterCreateError() : this.OnModelAfterUpdateError()).Trigger(errorEvent, () =>
          this.runRecordInterceptors(record, afterError, () => errorEvent.Error),
        ) as Error | null;
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
              this.runRecordInterceptors(record, afterError, () => errorEvent.Error),
            ) as Error | null;
            return result ?? null;
          }
          const result = (isNew ? this.OnModelAfterCreateSuccess() : this.OnModelAfterUpdateSuccess()).Trigger(modelEvent, () =>
            this.runRecordInterceptors(record, afterSuccess, () => null),
          ) as Error | null;
          return result ?? null;
        });
        return null;
      }

      const afterErr = (isNew ? this.OnModelAfterCreateSuccess() : this.OnModelAfterUpdateSuccess()).Trigger(modelEvent, () =>
        this.runRecordInterceptors(record, afterSuccess, () => null),
      ) as Error | null;
      return afterErr ?? null;
    }

    if (!(model instanceof Collection)) {
      throw new Error("unknown model type");
    }

    const isNew = model.isNew();
    const modelEvent = new ModelEvent(this, model, isNew ? ModelEventTypeCreate : ModelEventTypeUpdate);
    const saveErr = (isNew ? this.OnModelCreate() : this.OnModelUpdate()).Trigger(modelEvent, () =>
      (isNew ? this.OnModelCreateExecute() : this.OnModelUpdateExecute()).Trigger(modelEvent, () =>
        this.saveCollection(model, runValidation),
      ),
    ) as Error | null;
    if (saveErr) {
      const errorEvent = new ModelErrorEvent(modelEvent, saveErr);
      const afterErr = (isNew ? this.OnModelAfterCreateError() : this.OnModelAfterUpdateError()).Trigger(
        errorEvent,
        () => errorEvent.Error,
      ) as Error | null;
      return afterErr ?? errorEvent.Error;
    }
    if (this.#txInfo) {
      this.#txInfo.OnComplete((txErr) => {
        if (txErr) {
          const errorEvent = new ModelErrorEvent(modelEvent, txErr);
          const result = (isNew ? this.OnModelAfterCreateError() : this.OnModelAfterUpdateError()).Trigger(
            errorEvent,
            () => errorEvent.Error,
          ) as Error | null;
          return result ?? null;
        }
        const result = (isNew ? this.OnModelAfterCreateSuccess() : this.OnModelAfterUpdateSuccess()).Trigger(
          modelEvent,
          () => null,
        ) as Error | null;
        return result ?? null;
      });
      return null;
    }
    const afterErr = (isNew ? this.OnModelAfterCreateSuccess() : this.OnModelAfterUpdateSuccess()).Trigger(
      modelEvent,
      () => null,
    ) as Error | null;
    return afterErr ?? null;
  }

  Validate(model: RecordModel | Collection | RecordProxy): Error | null {
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
        const validationErr = this.validateCollection(model, original);
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

      return modelEvent.Next();
    }) as Error | null;

    return result ?? null;
  }

  Delete(model: RecordModel | Collection | RecordProxy): Error | null {
    const recordInfo = resolveRecordProxy(model);
    if (recordInfo) {
      const { record, model: eventModel } = recordInfo;
      const modelEvent = new ModelEvent(this, eventModel, ModelEventTypeDelete);
      const action = InterceptorActionDelete;
      const executeAction = InterceptorActionDeleteExecute;
      const afterSuccess = InterceptorActionAfterDelete;
      const afterError = InterceptorActionAfterDeleteError;

      const runDelete = () =>
        this.runRecordInterceptors(record, action, () =>
          this.runRecordInterceptors(record, executeAction, () => this.deleteRecord(record)),
        );
      const deleteErr = this.OnModelDelete().Trigger(modelEvent, () =>
        this.OnModelDeleteExecute().Trigger(modelEvent, runDelete),
      ) as Error | null;

      if (deleteErr) {
        const errorEvent = new ModelErrorEvent(modelEvent, deleteErr);
        const afterErr = this.OnModelAfterDeleteError().Trigger(errorEvent, () =>
          this.runRecordInterceptors(record, afterError, () => errorEvent.Error),
        ) as Error | null;
        return afterErr ?? errorEvent.Error;
      }

      if (this.#txInfo) {
        this.#txInfo.OnComplete((txErr) => {
          if (txErr) {
            const errorEvent = new ModelErrorEvent(modelEvent, txErr);
            const result = this.OnModelAfterDeleteError().Trigger(errorEvent, () =>
              this.runRecordInterceptors(record, afterError, () => errorEvent.Error),
            ) as Error | null;
            return result ?? null;
          }
          const result = this.OnModelAfterDeleteSuccess().Trigger(modelEvent, () =>
            this.runRecordInterceptors(record, afterSuccess, () => null),
          ) as Error | null;
          return result ?? null;
        });
        return null;
      }

      const afterErr = this.OnModelAfterDeleteSuccess().Trigger(modelEvent, () =>
        this.runRecordInterceptors(record, afterSuccess, () => null),
      ) as Error | null;
      return afterErr ?? null;
    }

    if (!(model instanceof Collection)) {
      throw new Error("unknown model type");
    }

    const modelEvent = new ModelEvent(this, model, ModelEventTypeDelete);
    const deleteErr = this.OnModelDelete().Trigger(modelEvent, () =>
      this.OnModelDeleteExecute().Trigger(modelEvent, () => this.deleteCollection(model)),
    ) as Error | null;
    if (deleteErr) {
      const errorEvent = new ModelErrorEvent(modelEvent, deleteErr);
      const afterErr = this.OnModelAfterDeleteError().Trigger(errorEvent, () => errorEvent.Error) as Error | null;
      return afterErr ?? errorEvent.Error;
    }
    if (this.#txInfo) {
      this.#txInfo.OnComplete((txErr) => {
        if (txErr) {
          const errorEvent = new ModelErrorEvent(modelEvent, txErr);
          const result = this.OnModelAfterDeleteError().Trigger(errorEvent, () => errorEvent.Error) as Error | null;
          return result ?? null;
        }
        const result = this.OnModelAfterDeleteSuccess().Trigger(modelEvent, () => null) as Error | null;
        return result ?? null;
      });
      return null;
    }
    const afterErr = this.OnModelAfterDeleteSuccess().Trigger(modelEvent, () => null) as Error | null;
    return afterErr ?? null;
  }

  RunInTransaction(fn: (txApp: App) => Error | null): Error | null {
    if (this.#txInfo) {
      return fn(this);
    }

    this.#txInfo = new TxAppInfo();
    let txErr: Error | null = null;
    this.db().run("BEGIN");
    try {
      txErr = fn(this) ?? null;
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
    const afterErr = txInfo.runAfterFuncs(txErr);

    if (txErr && afterErr) {
      return new Error(`${txErr.message}; ${afterErr.message}`);
    }
    if (txErr) {
      return txErr;
    }
    if (afterErr) {
      return afterErr;
    }
    return null;
  }

  DeleteWithContext(_ctx: unknown, model: RecordModel | Collection | RecordProxy): Error | null {
    return this.Delete(model);
  }

  TruncateCollection(collection: Collection): Error | null {
    if (collection.isView()) {
      return new Error("view collections cannot be truncated");
    }
    this.db().run(`delete from {{${collection.name}}}`);
    return null;
  }

  ImportCollections(toImport: Array<Record<string, unknown>>, deleteMissing: boolean): Error | null {
    return this.RunInTransaction((txApp) => {
      const names = new Set<string>();
      for (const data of toImport) {
        const imported = collectionFromData(data);
        names.add(imported.name);
        const err = txApp.Save(imported);
        if (err) {
          return err;
        }
      }

      if (deleteMissing) {
        const existing = this.db().query("select id, name, system from _collections").all() as Array<{
          id: string;
          name: string;
          system: number;
        }>;
        for (const row of existing) {
          if (row.system) {
            continue;
          }
          if (!names.has(row.name)) {
            const collection = this.findCollectionById(row.id);
            if (collection) {
              const err = txApp.Delete(collection);
              if (err) {
                return err;
              }
            }
          }
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

  private deleteRecord(record: RecordModel): Error | null {
    if (!record.Id) {
      return new Error("missing record id");
    }
    this.db().run(`delete from {{${record.TableName()}}} where id = ?`, [record.Id]);
    return null;
  }

  private saveCollection(collection: Collection, runValidation: boolean): Error | null {
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
      const validationErr = this.validateCollection(collection, original);
      if (validationErr) {
        return validationErr;
      }
    }

    if (collection.isView()) {
      let viewFields: FieldsList;
      try {
        viewFields = this.CreateViewFields(collection.ViewQuery);
      } catch (error) {
        return error as Error;
      }

      if (original) {
        const deleteErr = this.DeleteView(original.name);
        if (deleteErr) {
          return deleteErr;
        }
      }

      const saveViewErr = this.SaveView(collection.name, collection.ViewQuery);
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

    const syncErr = this.syncRecordTableSchema(collection, original);
    if (syncErr) {
      return syncErr;
    }

    return null;
  }

  private deleteCollection(collection: Collection): Error | null {
    if (collection.system) {
      return new Error("system collection cannot be deleted");
    }
    if (collection.id === "") {
      return new Error("missing collection id");
    }

    const dropErr = this.dropCollectionIndexes(collection);
    if (dropErr) {
      return dropErr;
    }

    if (!collection.isView()) {
      this.db().run(`drop table if exists {{${collection.name}}}`);
    }

    this.db().run("delete from _collections where id = ?", [collection.id]);
    return null;
  }

  private validateCollection(collection: Collection, original: Collection | null): Error | null {
    return validateCollection(this, collection, original);
  }

  private syncRecordTableSchema(newCollection: Collection, oldCollection: Collection | null): Error | null {
    if (newCollection.isView()) {
      return null;
    }

    return this.RunInTransaction((txApp) => {
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
        const err = this.OnCollectionValidate().Trigger(ce, (event) => {
          syncModelEventWithCollectionEvent(me, event);
          const result = me.Next();
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
      Func: (me) => {
        const { event: ce, ok } = newCollectionEventFromModelEvent(me);
        if (!ok || !ce) {
          return me.Next();
        }
        const err = this.OnCollectionCreate().Trigger(ce, (event) => {
          syncModelEventWithCollectionEvent(me, event);
          const result = me.Next();
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
      Func: (me) => {
        const { event: ce, ok } = newCollectionEventFromModelEvent(me);
        if (!ok || !ce) {
          return me.Next();
        }
        const err = this.OnCollectionCreateExecute().Trigger(ce, (event) => {
          syncModelEventWithCollectionEvent(me, event);
          const result = me.Next();
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
      Func: (me) => {
        const { event: ce, ok } = newCollectionEventFromModelEvent(me);
        if (!ok || !ce) {
          return me.Next();
        }
        const err = this.OnCollectionAfterCreateSuccess().Trigger(ce, (event) => {
          syncModelEventWithCollectionEvent(me, event);
          const result = me.Next();
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
      Func: (me) => {
        const { event: ce, ok } = newCollectionErrorEventFromModelErrorEvent(me);
        if (!ok || !ce) {
          return me.Next();
        }
        const err = this.OnCollectionAfterCreateError().Trigger(ce, (event) => {
          syncModelErrorEventWithCollectionErrorEvent(me, event);
          const result = me.Next();
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
      Func: (me) => {
        const { event: ce, ok } = newCollectionEventFromModelEvent(me);
        if (!ok || !ce) {
          return me.Next();
        }
        const err = this.OnCollectionUpdate().Trigger(ce, (event) => {
          syncModelEventWithCollectionEvent(me, event);
          const result = me.Next();
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
      Func: (me) => {
        const { event: ce, ok } = newCollectionEventFromModelEvent(me);
        if (!ok || !ce) {
          return me.Next();
        }
        const err = this.OnCollectionUpdateExecute().Trigger(ce, (event) => {
          syncModelEventWithCollectionEvent(me, event);
          const result = me.Next();
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
      Func: (me) => {
        const { event: ce, ok } = newCollectionEventFromModelEvent(me);
        if (!ok || !ce) {
          return me.Next();
        }
        const err = this.OnCollectionAfterUpdateSuccess().Trigger(ce, (event) => {
          syncModelEventWithCollectionEvent(me, event);
          const result = me.Next();
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
      Func: (me) => {
        const { event: ce, ok } = newCollectionErrorEventFromModelErrorEvent(me);
        if (!ok || !ce) {
          return me.Next();
        }
        const err = this.OnCollectionAfterUpdateError().Trigger(ce, (event) => {
          syncModelErrorEventWithCollectionErrorEvent(me, event);
          const result = me.Next();
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
      Func: (me) => {
        const { event: ce, ok } = newCollectionEventFromModelEvent(me);
        if (!ok || !ce) {
          return me.Next();
        }
        const err = this.OnCollectionDelete().Trigger(ce, (event) => {
          syncModelEventWithCollectionEvent(me, event);
          const result = me.Next();
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
      Func: (me) => {
        const { event: ce, ok } = newCollectionEventFromModelEvent(me);
        if (!ok || !ce) {
          return me.Next();
        }
        const err = this.OnCollectionDeleteExecute().Trigger(ce, (event) => {
          syncModelEventWithCollectionEvent(me, event);
          const result = me.Next();
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
      Func: (me) => {
        const { event: ce, ok } = newCollectionEventFromModelEvent(me);
        if (!ok || !ce) {
          return me.Next();
        }
        const err = this.OnCollectionAfterDeleteSuccess().Trigger(ce, (event) => {
          syncModelEventWithCollectionEvent(me, event);
          const result = me.Next();
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
      Func: (me) => {
        const { event: ce, ok } = newCollectionErrorEventFromModelErrorEvent(me);
        if (!ok || !ce) {
          return me.Next();
        }
        const err = this.OnCollectionAfterDeleteError().Trigger(ce, (event) => {
          syncModelErrorEventWithCollectionErrorEvent(me, event);
          const result = me.Next();
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
      Func: (me) => {
        const { event: re, ok } = newRecordEventFromModelEvent(me);
        if (!ok || !re) {
          return me.Next();
        }
        const err = this.OnRecordValidate().Trigger(re, (event) => {
          syncModelEventWithRecordEvent(me, event);
          const result = me.Next();
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
      Func: (me) => {
        const { event: re, ok } = newRecordEventFromModelEvent(me);
        if (!ok || !re) {
          return me.Next();
        }
        const err = this.OnRecordCreate().Trigger(re, (event) => {
          syncModelEventWithRecordEvent(me, event);
          const result = me.Next();
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
      Func: (me) => {
        const { event: re, ok } = newRecordEventFromModelEvent(me);
        if (!ok || !re) {
          return me.Next();
        }
        const err = this.OnRecordCreateExecute().Trigger(re, (event) => {
          syncModelEventWithRecordEvent(me, event);
          const result = me.Next();
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
      Func: (me) => {
        const { event: re, ok } = newRecordEventFromModelEvent(me);
        if (!ok || !re) {
          return me.Next();
        }
        const err = this.OnRecordAfterCreateSuccess().Trigger(re, (event) => {
          syncModelEventWithRecordEvent(me, event);
          const result = me.Next();
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
      Func: (me) => {
        const { event: re, ok } = newRecordErrorEventFromModelErrorEvent(me);
        if (!ok || !re) {
          return me.Next();
        }
        const err = this.OnRecordAfterCreateError().Trigger(re, (event) => {
          syncModelErrorEventWithRecordErrorEvent(me, event);
          const result = me.Next();
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
      Func: (me) => {
        const { event: re, ok } = newRecordEventFromModelEvent(me);
        if (!ok || !re) {
          return me.Next();
        }
        const err = this.OnRecordUpdate().Trigger(re, (event) => {
          syncModelEventWithRecordEvent(me, event);
          const result = me.Next();
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
      Func: (me) => {
        const { event: re, ok } = newRecordEventFromModelEvent(me);
        if (!ok || !re) {
          return me.Next();
        }
        const err = this.OnRecordUpdateExecute().Trigger(re, (event) => {
          syncModelEventWithRecordEvent(me, event);
          const result = me.Next();
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
      Func: (me) => {
        const { event: re, ok } = newRecordEventFromModelEvent(me);
        if (!ok || !re) {
          return me.Next();
        }
        const err = this.OnRecordAfterUpdateSuccess().Trigger(re, (event) => {
          syncModelEventWithRecordEvent(me, event);
          const result = me.Next();
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
      Func: (me) => {
        const { event: re, ok } = newRecordErrorEventFromModelErrorEvent(me);
        if (!ok || !re) {
          return me.Next();
        }
        const err = this.OnRecordAfterUpdateError().Trigger(re, (event) => {
          syncModelErrorEventWithRecordErrorEvent(me, event);
          const result = me.Next();
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
      Func: (me) => {
        const { event: re, ok } = newRecordEventFromModelEvent(me);
        if (!ok || !re) {
          return me.Next();
        }
        const err = this.OnRecordDelete().Trigger(re, (event) => {
          syncModelEventWithRecordEvent(me, event);
          const result = me.Next();
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
      Func: (me) => {
        const { event: re, ok } = newRecordEventFromModelEvent(me);
        if (!ok || !re) {
          return me.Next();
        }
        const err = this.OnRecordDeleteExecute().Trigger(re, (event) => {
          syncModelEventWithRecordEvent(me, event);
          const result = me.Next();
          syncRecordEventWithModelEvent(event, me);
          return result;
        });
        syncModelEventWithRecordEvent(me, re);
        return err;
      },
    });

    this.OnModelAfterDeleteSuccess().Bind({
      Id: systemHookIdRecord,
      Priority: -99,
      Func: (me) => {
        const { event: re, ok } = newRecordEventFromModelEvent(me);
        if (!ok || !re) {
          return me.Next();
        }
        const err = this.OnRecordAfterDeleteSuccess().Trigger(re, (event) => {
          syncModelEventWithRecordEvent(me, event);
          const result = me.Next();
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
      Func: (me) => {
        const { event: re, ok } = newRecordErrorEventFromModelErrorEvent(me);
        if (!ok || !re) {
          return me.Next();
        }
        const err = this.OnRecordAfterDeleteError().Trigger(re, (event) => {
          syncModelErrorEventWithRecordErrorEvent(me, event);
          const result = me.Next();
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
      Func: (e) => {
        if (!e.Record) {
          return e.Next();
        }
        return e.Record.callFieldInterceptors(e.Context, e.App, InterceptorActionValidate, () => {
          const err = this.validateRecord(e.Record as RecordModel);
          if (err) {
            return err;
          }
          return e.Next() as Error | null;
        });
      },
    });
  }

  private registerOTPHooks(): void {
    recordRefHooks(this, CollectionNameOTPs, CollectionTypeAuth);

    this.Cron().Add("__pbOTPCleanup__", "0 * * * *", () => {
      const err = this.DeleteExpiredOTPs();
      if (err) {
        this.Logger().Warn("Failed to delete expired OTP sessions", "error", err);
      }
    });
  }

  private registerMFAHooks(): void {
    recordRefHooks(this, CollectionNameMFAs, CollectionTypeAuth);

    this.Cron().Add("__pbMFACleanup__", "0 * * * *", () => {
      const err = this.DeleteExpiredMFAs();
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

        const err = e.Next() as Error | null;
        if (err || !isAuth || !record) {
          return err;
        }

        const newHash = record.GetString(`${FieldNamePassword}:hash`);
        if (oldHash !== newHash) {
          const deleteErr = e.App.DeleteAllMFAsByRecord(record);
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
      Func: (e) => {
        const record = e.Record;
        const isAuth = record?.collection().IsAuth() ?? false;
        // Deviation: capture the original hash before e.Next() because PostScan updates originals during save.
        const oldHash = isAuth && record ? record.Original().GetString(`${FieldNamePassword}:hash`) : "";

        const err = e.Next() as Error | null;
        if (err || !isAuth || !record) {
          return err;
        }

        const newHash = record.GetString(`${FieldNamePassword}:hash`);
        if (oldHash !== newHash) {
          const deleteErr = e.App.DeleteAllAuthOriginsByRecord(record);
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

  SaveView(name: string, selectQuery: string): Error | null {
    return SaveView(this, name, selectQuery);
  }

  DeleteView(name: string): Error | null {
    return DeleteView(this, name);
  }

  CreateViewFields(selectQuery: string): FieldsList {
    return CreateViewFields(this, selectQuery);
  }

  TableInfo(tableName: string) {
    return TableInfo(this.db(), tableName);
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

function resolveRecordProxy(
  model: RecordModel | Collection | RecordProxy,
): { record: RecordModel; model: RecordModel | RecordProxy } | null {
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
  #afterFuncs: Array<(txErr: Error | null) => Error | null> = [];

  OnComplete(fn: (txErr: Error | null) => Error | null) {
    this.#afterFuncs.push(fn);
  }

  runAfterFuncs(txErr: Error | null): Error | null {
    const errors: Error[] = [];
    for (const fn of this.#afterFuncs) {
      const err = fn(txErr);
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
    return new Error(errors.map((err) => err.message).join("; "));
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

function ensureDefaultCollectionFields(collection: Collection): void {
  collection.initDefaultFields();
  collection.fields = parseCollectionFields(collection.Fields.toJSON());
}

function collectionFromData(data: Record<string, unknown>): Collection {
  const name = typeof data.name === "string" ? data.name : "";
  const type = typeof data.type === "string" ? data.type : "base";

  let collection: Collection;
  if (type === "auth") {
    collection = NewAuthCollection(name);
  } else if (type === "view") {
    collection = NewViewCollection(name);
  } else {
    collection = NewBaseCollection(name);
  }

  applyCollectionData(collection, data);
  normalizeCollectionFields(collection);
  ensureDefaultCollectionFields(collection);

  return collection;
}
