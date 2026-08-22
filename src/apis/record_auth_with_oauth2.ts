// Ported from pocketbase/apis/record_auth_with_oauth2.go

import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import { basename } from "node:path";
import type { App } from "../core/app.ts";
import type { Collection } from "../core/collection_model.ts";
import type { RequestInfo } from "../core/event_request.ts";
import type { Record as RecordModel } from "../core/record_model.ts";
import type { OAuth2Token } from "../tools/auth/auth.ts";
import { CollectionNameSuperusers } from "../core/collection_model.ts";
import { RequestEvent, RequestEventKeyInfoContext, RequestInfoContextOAuth2 } from "../core/event_request.ts";
import { RecordAuthWithOAuth2RequestEvent, RecordRequestEvent } from "../core/events.ts";
import { NewExternalAuth, type ExternalAuth } from "../core/external_auth_model.ts";
import { FieldTypeFile } from "../core/field_file.ts";
import { PasswordFieldValue } from "../core/field_password.ts";
import { TextField } from "../core/field_text.ts";
import { MFAMethodOAuth2 } from "../core/mfa_model.ts";
import { FieldNameEmail, FieldNamePassword, NewRecord } from "../core/record_model.ts";
import { RecordUpsert } from "../forms/record_upsert.ts";
import { takeExpiringValue } from "../internal/cluster/expiring.ts";
import { readRequestTextAndRebind } from "../internal/compat/request_body.ts";
import { ValidationErrors, ErrRequired, newError, required } from "../internal/compat/validation.ts";
import { AuthUser } from "../tools/auth/auth.ts";
import { SetAuthURLParam } from "../tools/auth/oauth2.ts";
import { findSingleColumnUniqueIndex } from "../tools/dbutils/index.ts";
import { HashExp, NewExp } from "../tools/dbx/expr.ts";
import { NewFileFromBytes } from "../tools/filesystem/file.ts";
import { randomString } from "../tools/security/random.ts";
import { badRequest, forbidden, internalServerError } from "./api_errors.ts";
import { DefaultMaxBodySize } from "./middlewares_body_limit.ts";
import { authCollectionNotFound, findAuthCollection } from "./record_auth_utils.ts";
import { buildCreateRuleContext, checkCreateRule, resolveRecordData } from "./record_crud.ts";
import { EnrichRecord, RecordAuthResponse } from "./record_helpers.ts";

const oauth2RedirectAppleNameStoreKeyPrefix = "@redirect_name_";

type OAuth2Form = {
  createData: Record<string, unknown>;
  provider: string;
  code: string;
  codeVerifier: string;
  redirectURL: string;
  redirectUrl: string;
};

type OAuth2CreateContext = {
  requestEvent: RequestEvent;
  requestInfo: RequestInfo;
  record: RecordModel;
  data: Record<string, unknown>;
  hasSuperuser: boolean;
  skipPlainPasswordRecordValidators: boolean;
};

type SafeLookup = (
  hostname: string,
  options: { all: true; verbatim: true },
) => Promise<Array<{ address: string; family: number }>>;

type SafeFetch = (input: string, init?: RequestInit) => Promise<Response>;

type SafeFileFromURLOptions = {
  lookup?: SafeLookup;
  fetch?: SafeFetch;
  maxBodySize?: number;
  maxRedirects?: number;
};

const safeFileFromURLMaxRedirects = 5;

export async function recordAuthWithOAuth2(app: App, event: RequestEvent): Promise<Response> {
  const collection = findAuthCollection(app, event);
  if (!collection) {
    return authCollectionNotFound(event);
  }

  if (!collection.OAuth2.Enabled) {
    return forbidden(event, "The collection is not configured to allow OAuth2 authentication.");
  }

  let fallbackAuthRecord: RecordModel | null = null;
  if (event.auth && event.auth.collection().Id === collection.Id) {
    fallbackAuthRecord = event.auth;
  }

  event.Set(RequestEventKeyInfoContext, RequestInfoContextOAuth2);

  const formResult = await parseOAuth2Form(event);
  if (formResult.error) {
    return badRequest(event, "An error occurred while loading the submitted data.");
  }

  const form = formResult.data;
  if (form.redirectUrl && !form.redirectURL) {
    app
      .Logger()
      .Warn(
        "[recordAuthWithOAuth2] redirectUrl body param is deprecated and will be removed in the future. Please replace it with redirectURL.",
      );
    form.redirectURL = form.redirectUrl;
  }

  const validationErr = validateOAuth2Form(form, collection);
  if (validationErr) {
    return badRequest(event, "An error occurred while validating the submitted data.", validationErr);
  }

  const providerConfig = collection.OAuth2.GetProviderConfig(form.provider);
  if (!providerConfig.exists) {
    return internalServerError(event, "Missing or invalid provider config.");
  }

  const { provider, error } = providerConfig.config.InitProvider();
  if (error || !provider) {
    return internalServerError(event, `Failed to init provider ${form.provider}`, error ?? undefined);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  provider.SetContext(controller.signal);
  provider.SetRedirectURL(form.redirectURL);

  const opts: Array<ReturnType<typeof SetAuthURLParam>> = [];
  if (provider.PKCE()) {
    opts.push(SetAuthURLParam("code_verifier", form.codeVerifier));
  }

  let token: OAuth2Token;
  try {
    token = await provider.FetchToken(form.code, ...opts);
  } catch (error) {
    clearTimeout(timeout);
    return badRequest(event, "Failed to fetch OAuth2 token.", error);
  }

  let authUser: AuthUser;
  try {
    authUser = await provider.FetchAuthUser(token);
  } catch (error) {
    clearTimeout(timeout);
    return badRequest(event, "Failed to fetch OAuth2 user.", error);
  }
  clearTimeout(timeout);

  if (form.provider === "apple" && !authUser.Name) {
    const nameKey = oauth2RedirectAppleNameStoreKeyPrefix + form.code;
    const storedName = await takeExpiringValue(app, nameKey);
    if (storedName !== null) {
      authUser.Name = storedName;
    } else {
      app.Logger().Warn("Missing or already removed Apple user's name");
    }
  }

  let authRecord: RecordModel | null = null;
  let externalAuthRel: ExternalAuth | null = null;
  try {
    externalAuthRel = app.FindFirstExternalAuthByExpr({
      collectionRef: collection.Id,
      provider: form.provider,
      providerId: authUser.Id,
    });
  } catch (error) {
    if ((error as Error).message !== "record not found") {
      return internalServerError(event, "Failed OAuth2 relation check.", error);
    }
  }

  if (externalAuthRel) {
    try {
      authRecord = app.FindRecordById(collection, externalAuthRel.RecordRef());
    } catch (error) {
      return internalServerError(event, "Failed OAuth2 auth record check.", error);
    }
  } else if (fallbackAuthRecord && fallbackAuthRecord.collection().Id === collection.Id) {
    authRecord = fallbackAuthRecord;
  } else if (authUser.Email) {
    try {
      authRecord = app.FindAuthRecordByEmail(collection.Id, authUser.Email);
    } catch (error) {
      if ((error as Error).message !== "record not found") {
        return internalServerError(event, "Failed OAuth2 auth record check.", error);
      }
    }
  }

  const hookEvent = new RecordAuthWithOAuth2RequestEvent(event, collection, authRecord);
  hookEvent.ProviderName = form.provider;
  hookEvent.ProviderClient = provider;
  hookEvent.OAuth2User = authUser;
  hookEvent.CreateData = form.createData;
  hookEvent.Record = authRecord;
  hookEvent.IsNewRecord = authRecord == null;

  const out = await app.OnRecordAuthWithOAuth2Request().Trigger(hookEvent, async () => {
    const submitErr = await oauth2Submit(hookEvent, externalAuthRel);
    if (submitErr) {
      return badRequest(event, "Failed to authenticate.", submitErr);
    }

    let meta: Record<string, unknown>;
    try {
      meta = JSON.parse(JSON.stringify(hookEvent.OAuth2User ?? {})) as Record<string, unknown>;
    } catch (error) {
      return badRequest(event, "Failed to authenticate.", error);
    }
    meta.isNew = hookEvent.IsNewRecord;

    return RecordAuthResponse(event, hookEvent.Record as RecordModel, MFAMethodOAuth2, meta);
  });

  if (out instanceof Response) {
    return out;
  }

  return badRequest(event, "Failed to authenticate.");
}

async function oauth2Submit(
  event: RecordAuthWithOAuth2RequestEvent,
  optExternalAuth: ExternalAuth | null,
): Promise<Error | null> {
  const authUser = event.OAuth2User as AuthUser;
  let createContext: OAuth2CreateContext | null = null;
  let createdRecord: RecordModel | null = null;

  if (!event.Record) {
    const createPayload = await buildOAuth2CreatePayload(event, authUser);
    const baseRequest = event.RequestEvent.request;
    const createUrl = new URL(baseRequest.url);
    createUrl.pathname = `/api/collections/${event.Collection.name}/records`;
    createUrl.search = "";

    const headers = new Headers(baseRequest.headers);
    headers.set("content-type", "application/json");

    const createEvent = new RequestEvent({
      app: event.App,
      request: new Request(createUrl.toString(), {
        method: "POST",
        headers,
        body: JSON.stringify(createPayload ?? {}),
      }),
      params: { collection: event.Collection.name },
      remoteAddress: event.RequestEvent.remoteIP() || null,
    });
    createEvent.auth = event.RequestEvent.auth;

    createEvent.Set(RequestEventKeyInfoContext, RequestInfoContextOAuth2);
    const requestInfo = await createEvent.requestInfo();
    requestInfo.body = createPayload ?? {};

    const record = NewRecord(event.Collection);
    let data = resolveRecordData(record, requestInfo, new Map());
    requestInfo.body = data;

    let skipPlainPasswordRecordValidators = false;
    if (requestInfo.context === RequestInfoContextOAuth2 && !(FieldNamePassword in data)) {
      const generated = randomString(30);
      data[FieldNamePassword] = generated;
      data[`${FieldNamePassword}Confirm`] = generated;
      skipPlainPasswordRecordValidators = true;
      requestInfo.body = data;
    }

    createContext = {
      requestEvent: createEvent,
      requestInfo,
      record,
      data,
      hasSuperuser: Boolean(requestInfo.auth?.isSuperuser()),
      skipPlainPasswordRecordValidators,
    };
  }

  const err = await event.App.RunInTransaction(async (txApp) => {
    if (!event.Record) {
      if (!createContext) {
        return new Error("missing OAuth2 create context");
      }

      if (event.Collection.name === CollectionNameSuperusers) {
        return new Error("superusers are not allowed to sign-up with OAuth2");
      }

      if (!createContext.hasSuperuser && event.Collection.createRule === null) {
        return new Error("Only superusers can perform this action.");
      }

      const form = new RecordUpsert(txApp, createContext.record);
      if (createContext.hasSuperuser) {
        form.GrantSuperuserAccess();
      }
      if (event.Collection.IsAuth() && Object.prototype.hasOwnProperty.call(createContext.data, FieldNamePassword)) {
        await form.LoadAsync(createContext.data);
      } else {
        form.Load(createContext.data);
      }

      if (createContext.skipPlainPasswordRecordValidators) {
        const raw = createContext.record.GetRaw(FieldNamePassword);
        if (raw instanceof PasswordFieldValue) {
          raw.Plain = "";
        }
      }

      if (!createContext.hasSuperuser && event.Collection.createRule && event.Collection.createRule !== "") {
        const ruleContext = buildCreateRuleContext(event.Collection, createContext.record);
        if (ruleContext instanceof Error) {
          return ruleContext;
        }
        const ruleErr = checkCreateRule(txApp, ruleContext, createContext.requestInfo);
        if (ruleErr) {
          return ruleErr;
        }
      }

      const hookEvent = new RecordRequestEvent(createContext.requestEvent, event.Collection, createContext.record);
      const originalApp = createContext.requestEvent.app;
      createContext.requestEvent.app = txApp;
      const hookResult = await txApp.OnRecordCreateRequest().Trigger(hookEvent, async (hook) => {
        const recordRef = hook.Record ?? createContext.record;
        form.SetApp(hook.App);
        form.SetRecord(recordRef);

        const submitErr = await form.Submit();
        if (submitErr) {
          return submitErr;
        }

        return null;
      });
      createContext.requestEvent.app = originalApp;

      if (hookResult instanceof Error) {
        return hookResult;
      }
      if (hookResult instanceof Response) {
        return new Error("failed to create OAuth2 auth record");
      }

      const recordRef = hookEvent.Record ?? createContext.record;
      event.Record = recordRef;
      event.IsNewRecord = true;
      createdRecord = recordRef;

      if (recordRef.Email() === authUser.Email && !recordRef.Verified()) {
        recordRef.SetVerified(true);
        const verifyErr = await txApp.Save(recordRef);
        if (verifyErr) {
          return verifyErr;
        }
      }
    } else {
      let needUpdate = false;

      const loggedRecord = event.RequestEvent.auth;
      const isLoggedAuthRecord =
        loggedRecord && loggedRecord.Id === event.Record.Id && loggedRecord.collection().Id === event.Record.collection().Id;

      // prevent pre-hijacking with password auth
      //
      // reset the unverified user password in case the record was precreated by a malicious actor
      if (!isLoggedAuthRecord && !event.Record.Verified()) {
        await event.Record.SetRandomPasswordAsync();
        needUpdate = true;
      }

      // prevent pre-hijacking with different OAuth2 provider
      //
      // delete all other previous OAuth2 record links for the cases
      // when the user was precreated by malicious OAuth2 auth with custom payload data
      //
      // while this would be also done automatically on unverified -> verified upgrade,
      // doing it manually here ensures that a single unverified record could have
      // max 1 OAuth2 link to prevent further abuse when mixed with other auth flows
      if (!event.Record.Verified()) {
        const deleteErr = await txApp.DeleteAllExternalAuthsByRecord(event.Record);
        if (deleteErr) {
          return deleteErr;
        }
        optExternalAuth = null;
      }

      if (!event.Record.Email() && authUser.Email) {
        event.Record.SetEmail(authUser.Email);
        needUpdate = true;
      }

      if (!event.Record.Verified() && (!event.Record.Email() || event.Record.Email() === authUser.Email)) {
        event.Record.SetVerified(true);
        needUpdate = true;
      }

      if (needUpdate) {
        const updateErr = await txApp.Save(event.Record);
        if (updateErr) {
          return updateErr;
        }
      }
    }

    if (!optExternalAuth) {
      const externalAuth = NewExternalAuth(txApp);
      externalAuth.SetCollectionRef(event.Record.collection().Id);
      externalAuth.SetRecordRef(event.Record.Id);
      externalAuth.SetProvider(event.ProviderName);
      externalAuth.SetProviderId(authUser.Id);

      const saveRelErr = await txApp.Save(externalAuth);
      if (saveRelErr) {
        return new Error(`failed to save linked rel: ${saveRelErr.message}`);
      }
    }

    return null;
  });

  if (err) {
    return err;
  }

  if (createdRecord && createContext) {
    const enrichErr = await EnrichRecord(createContext.requestEvent, createdRecord);
    if (enrichErr) {
      return enrichErr;
    }
  }

  return null;
}

async function buildOAuth2CreatePayload(event: RecordAuthWithOAuth2RequestEvent, authUser: AuthUser) {
  const payload = event.CreateData ? { ...event.CreateData } : {};

  const emailValue = payload[FieldNameEmail];
  if (!emailValue || (typeof emailValue === "string" && emailValue === "")) {
    payload[FieldNameEmail] = authUser.Email;
  }

  const mappedFields = event.Collection.OAuth2.MappedFields;

  if (mappedFields.Id && !(mappedFields.Id in payload)) {
    payload[mappedFields.Id] = authUser.Id;
  }

  if (mappedFields.Name && !(mappedFields.Name in payload)) {
    payload[mappedFields.Name] = authUser.Name;
  }

  if (
    mappedFields.Username &&
    !(mappedFields.Username in payload) &&
    authUser.Username &&
    oldCanAssignUsername(event.App, event.Collection, authUser.Username)
  ) {
    payload[mappedFields.Username] = authUser.Username;
  }

  const avatarUrl = authUser.AvatarURL || (authUser as unknown as { AvatarUrl?: string }).AvatarUrl || "";
  if (mappedFields.AvatarURL && !(mappedFields.AvatarURL in payload) && avatarUrl) {
    const mappedField = event.Collection.Fields.GetByName(mappedFields.AvatarURL);
    if (mappedField && mappedField.Type() === FieldTypeFile) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);
        try {
          // The extra checks are not required because the OAuth2 APIs are trusted vendors,
          // but are here to minimize the impact in case the provider is vulnerable.
          payload[mappedFields.AvatarURL] = await safeFileFromURL(controller.signal, avatarUrl);
        } finally {
          clearTimeout(timeout);
        }
      } catch (error) {
        event.App.Logger().Warn("Failed to retrieve OAuth2 avatar", "error", (error as Error).message);
      }
    } else {
      payload[mappedFields.AvatarURL] = avatarUrl;
    }
  }

  return payload;
}

export async function safeFileFromURL(signal: AbortSignal | null, url: string, options: SafeFileFromURLOptions = {}) {
  const lookup = options.lookup ?? dnsLookup;
  const fetchImpl = options.fetch ?? fetch;
  const maxBodySize = options.maxBodySize ?? DefaultMaxBodySize;
  const maxRedirects = options.maxRedirects ?? safeFileFromURLMaxRedirects;

  let currentUrl = new URL(url);

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    await validateSafeRemoteURL(currentUrl, lookup);

    // Deviation: Bun doesn't expose Go's dial-time host controls, so validate each
    // resolved host and redirect target up front before issuing the fetch.
    const response = await fetchImpl(currentUrl.toString(), {
      signal: signal ?? undefined,
      redirect: "manual",
    });

    if (isRedirectStatus(response.status)) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error(`failed to download url ${currentUrl.toString()} (${response.status})`);
      }
      currentUrl = new URL(location, currentUrl);
      continue;
    }

    if (response.status < 200 || response.status > 399) {
      throw new Error(`failed to download url ${currentUrl.toString()} (${response.status})`);
    }

    const data = await readLimitedResponseBody(response, maxBodySize);
    return NewFileFromBytes(data, decodeURLFilename(currentUrl));
  }

  throw new Error(`failed to download url ${url} (too many redirects)`);
}

function oldCanAssignUsername(app: App, collection: Collection, username: string): boolean {
  const mapped = collection.OAuth2.MappedFields.Username;
  if (!mapped) {
    return false;
  }

  const [index, ok] = findSingleColumnUniqueIndex(collection.indexes, mapped);
  if (ok) {
    let exists = false;
    try {
      const expr =
        (index.columns[0]?.collate ?? "").toLowerCase() === "nocase"
          ? NewExp(`[[${mapped}]] = {:username} COLLATE NOCASE`, { username })
          : HashExp({ [mapped]: username });
      app.RecordQuery(collection).AndWhere(expr).Limit(1).One();
      exists = true;
    } catch {
      exists = false;
    }

    if (exists) {
      return false;
    }
  }

  const field = collection.Fields.GetByName(mapped);
  if (!field || !(field instanceof TextField)) {
    return false;
  }

  return field.ValidatePlainValue(username) == null;
}

async function validateSafeRemoteURL(url: URL, lookup: SafeLookup): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`failed to download url ${url.toString()} (unsupported protocol)`);
  }

  const hostname = url.hostname;
  if (!hostname) {
    throw new Error(`failed to download url ${url.toString()} (missing host)`);
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (!Array.isArray(addresses) || addresses.length === 0) {
    throw new Error(`address ${JSON.stringify(hostname)} is invalid or resolve to disallowed IP`);
  }

  for (const entry of addresses) {
    if (!entry?.address || isDisallowedIP(entry.address)) {
      throw new Error(`address ${JSON.stringify(entry?.address ?? hostname)} is invalid or resolve to disallowed IP`);
    }
  }
}

function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function isDisallowedIP(address: string): boolean {
  const normalized = address.toLowerCase().split("%", 1)[0] ?? address.toLowerCase();
  const version = isIP(normalized);
  if (version === 4) {
    return isDisallowedIPv4(normalized);
  }
  if (version === 6) {
    return isDisallowedIPv6(normalized);
  }
  return true;
}

function isDisallowedIPv4(address: string): boolean {
  const parts = address.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }

  const a = parts[0]!;
  const b = parts[1]!;
  if (a === 0 || a === 127) {
    return true;
  }
  if (a === 10) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  if (a >= 224 && a <= 239) {
    return true;
  }

  return false;
}

function isDisallowedIPv6(address: string): boolean {
  if (address === "::" || address === "::1") {
    return true;
  }

  const mappedIPv4 = extractMappedIPv4(address);
  if (mappedIPv4) {
    return isDisallowedIPv4(mappedIPv4);
  }

  if (/^f[cd]/.test(address)) {
    return true;
  }
  if (/^fe[89ab]/.test(address)) {
    return true;
  }
  if (address.startsWith("ff")) {
    return true;
  }

  return false;
}

function extractMappedIPv4(address: string): string | null {
  const lastColon = address.lastIndexOf(":");
  if (lastColon < 0) {
    return null;
  }

  const candidate = address.slice(lastColon + 1);
  return isIP(candidate) === 4 ? candidate : null;
}

async function readLimitedResponseBody(response: Response, maxBodySize: number): Promise<Uint8Array> {
  if (!response.body) {
    return new Uint8Array();
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done || !value) {
      break;
    }

    if (total + value.length > maxBodySize) {
      const remaining = maxBodySize - total;
      if (remaining > 0) {
        chunks.push(value.subarray(0, remaining));
        total += remaining;
      }
      await reader.cancel();
      break;
    }

    chunks.push(value);
    total += value.length;
  }

  const data = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.length;
  }

  return data;
}

function decodeURLFilename(url: URL): string {
  const rawName = basename(url.pathname);
  if (!rawName) {
    return "file";
  }

  try {
    return decodeURIComponent(rawName);
  } catch {
    return rawName;
  }
}

async function parseOAuth2Form(event: RequestEvent): Promise<{ data: OAuth2Form; error: Error | null }> {
  const data: OAuth2Form = {
    createData: {},
    provider: "",
    code: "",
    codeVerifier: "",
    redirectURL: "",
    redirectUrl: "",
  };

  if (!event.request.body) {
    return { data, error: null };
  }

  try {
    const bound = await readRequestTextAndRebind(event.request);
    event.request = bound.request;
    const parsed = JSON.parse(bound.text) as unknown;
    if (parsed && typeof parsed === "object") {
      const raw = parsed as Record<string, unknown>;
      if (typeof raw.provider === "string") {
        data.provider = raw.provider;
      }
      if (typeof raw.code === "string") {
        data.code = raw.code;
      }
      if (typeof raw.codeVerifier === "string") {
        data.codeVerifier = raw.codeVerifier;
      }
      if (typeof raw.redirectURL === "string") {
        data.redirectURL = raw.redirectURL;
      }
      if (typeof raw.redirectUrl === "string") {
        data.redirectUrl = raw.redirectUrl;
      }
      if (raw.createData && typeof raw.createData === "object" && !Array.isArray(raw.createData)) {
        data.createData = raw.createData as Record<string, unknown>;
      }
    }
    return { data, error: null };
  } catch (error) {
    return { data, error: error as Error };
  }
}

function validateOAuth2Form(form: OAuth2Form, collection: Collection): Error | null {
  const errors: Record<string, Error> = {};

  if (required(form.provider)) {
    errors.provider = ErrRequired;
  } else if (form.provider.length > 100) {
    errors.provider = newError("validation_length_out_of_range", "The length must be between 0 and 100.");
  } else {
    const providerErr = checkProviderName(form.provider, collection);
    if (providerErr) {
      errors.provider = providerErr;
    }
  }

  if (required(form.code)) {
    errors.code = ErrRequired;
  }

  return Object.keys(errors).length > 0 ? new ValidationErrors(errors) : null;
}

function checkProviderName(name: string, collection: Collection): Error | null {
  const config = collection.OAuth2.GetProviderConfig(name);
  if (!config.exists) {
    return newError("validation_invalid_provider", "Provider with name {{.name}} is missing or is not enabled.").setParams({
      name,
    });
  }

  return null;
}
