// Ported from pocketbase/apis/record_auth_with_oauth2.go

import type { App } from "../core/app.ts";
import type { Collection } from "../core/collection.ts";
import type { RequestEvent } from "../core/event_request.ts";
import type { Record as RecordModel } from "../core/record.ts";
import type { OAuth2Token } from "../tools/auth/auth.ts";
import { CollectionNameSuperusers } from "../core/collection.ts";
import { RequestInfoContextOAuth2 } from "../core/event_request.ts";
import { RecordAuthWithOAuth2RequestEvent } from "../core/events.ts";
import { NewExternalAuth } from "../core/external_auth_model.ts";
import { FieldTypeFile } from "../core/field_file.ts";
import { TextField } from "../core/field_text.ts";
import { MFAMethodOAuth2 } from "../core/mfa_model.ts";
import { FieldNameEmail, FieldNamePassword, NewRecord } from "../core/record.ts";
import { ValidationErrors, ErrRequired, newError, required } from "../internal/compat/validation.ts";
import { AuthUser } from "../tools/auth/auth.ts";
import { SetAuthURLParam } from "../tools/auth/oauth2.ts";
import { findSingleColumnUniqueIndex } from "../tools/dbutils/index.ts";
import { HashExp, NewExp } from "../tools/dbx/expr.ts";
import { NewFileFromURL } from "../tools/filesystem/file.ts";
import { randomString } from "../tools/security/random.ts";
import { badRequest, forbidden, internalServerError } from "./api_errors.ts";
import { authCollectionNotFound, findAuthCollection } from "./record_auth_utils.ts";
import { RecordAuthResponse } from "./record_helpers.ts";

const oauth2RedirectAppleNameStoreKeyPrefix = "@redirect_name_";

type OAuth2Form = {
  createData: Record<string, unknown>;
  provider: string;
  code: string;
  codeVerifier: string;
  redirectURL: string;
  redirectUrl: string;
};

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

  const info = await event.requestInfo();
  info.context = RequestInfoContextOAuth2;

  const formResult = await parseOAuth2Form(event);
  if (formResult.error) {
    return badRequest(event, "An error occurred while loading the submitted data.", formResult.error);
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
    const storedName = app.store().get(nameKey);
    if (typeof storedName === "string") {
      app.store().remove(nameKey);
      authUser.Name = storedName;
    } else {
      app.Logger().Warn("Missing or already removed Apple user's name");
    }
  }

  let authRecord: RecordModel | null = null;
  let externalAuthRel = null;
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

    let meta: Record<string, unknown> = {};
    try {
      meta = JSON.parse(JSON.stringify(hookEvent.OAuth2User ?? {})) as Record<string, unknown>;
    } catch {
      meta = {};
    }
    meta.isNew = hookEvent.IsNewRecord;

    return RecordAuthResponse(event, hookEvent.Record as RecordModel, MFAMethodOAuth2, meta);
  });

  if (out instanceof Response) {
    return out;
  }

  return badRequest(event, "Failed to authenticate.");
}

async function oauth2Submit(event: RecordAuthWithOAuth2RequestEvent, optExternalAuth: any): Promise<Error | null> {
  const authUser = event.OAuth2User as AuthUser;
  let createPayload: Record<string, unknown> | null = null;

  if (!event.Record) {
    createPayload = await buildOAuth2CreatePayload(event, authUser);
  }

  const err = event.App.RunInTransaction((txApp) => {
    if (!event.Record) {
      if (event.Collection.name === CollectionNameSuperusers) {
        return new Error("superusers are not allowed to sign-up with OAuth2");
      }

      const record = NewRecord(event.Collection);
      for (const [key, value] of Object.entries(createPayload ?? {})) {
        record.Set(key, value);
      }
      if (!Object.prototype.hasOwnProperty.call(createPayload ?? {}, FieldNamePassword)) {
        const generated = randomString(30);
        record.Set(FieldNamePassword, generated);
      }

      const saveErr = txApp.Save(record);
      if (saveErr) {
        return saveErr;
      }

      event.Record = record;
      event.IsNewRecord = true;

      if (record.Email() === authUser.Email && !record.Verified()) {
        record.SetVerified(true);
        const verifyErr = txApp.Save(record);
        if (verifyErr) {
          return verifyErr;
        }
      }
    } else {
      let needUpdate = false;

      const loggedRecord = event.RequestEvent.auth;
      const isLoggedAuthRecord =
        loggedRecord && loggedRecord.Id === event.Record.Id && loggedRecord.collection().Id === event.Record.collection().Id;

      if (!isLoggedAuthRecord && event.Record.Email() && !event.Record.Verified()) {
        event.Record.SetRandomPassword();
        needUpdate = true;
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
        const updateErr = txApp.Save(event.Record);
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

      const saveRelErr = txApp.Save(externalAuth);
      if (saveRelErr) {
        return new Error(`failed to save linked rel: ${saveRelErr.message}`);
      }
    }

    return null;
  });

  return err ?? null;
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
        const timeout = setTimeout(() => controller.abort(), 15_000);
        try {
          payload[mappedFields.AvatarURL] = await NewFileFromURL(controller.signal, avatarUrl);
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
    const parsed = await event.request.clone().json();
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

  if (required(form.redirectURL)) {
    errors.redirectURL = ErrRequired;
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
