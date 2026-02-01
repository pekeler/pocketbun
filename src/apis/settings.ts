// Ported from pocketbase/apis/settings.go

import type { App } from "../core/app.ts";
import type { RequestEvent } from "../core/event_request.ts";
import type { RouterGroup } from "../tools/router/group.ts";
import { SettingsListRequestEvent, SettingsUpdateRequestEvent } from "../core/events.ts";
import { NewAppleClientSecretCreate } from "../forms/apple_client_secret_create.ts";
import { NewTestEmailSend } from "../forms/test_email_send.ts";
import { NewTestS3Filesystem } from "../forms/test_s3_filesystem.ts";
import { ValidationErrors } from "../internal/compat/validation.ts";
import { badRequest, noContent } from "./api_errors.ts";
import { RequireSuperuserAuth } from "./middlewares.ts";
import { readJsonBody } from "./record_auth_utils.ts";
import { execAfterSuccessTx } from "./record_helpers.ts";

export function bindSettingsApi(app: App, rg: RouterGroup<RequestEvent>): void {
  const sub = rg.group("/settings").bind(RequireSuperuserAuth());
  sub.get("", (event) => settingsList(app, event));
  sub.patch("", (event) => settingsSet(app, event));
  sub.post("/test/s3", (event) => settingsTestS3(app, event));
  sub.post("/test/email", (event) => settingsTestEmail(app, event));
  sub.post("/apple/generate-client-secret", (event) => settingsGenerateAppleClientSecret(app, event));
}

async function settingsList(app: App, event: RequestEvent): Promise<Response> {
  const settings = app.settings().Clone();
  const hookEvent = new SettingsListRequestEvent(event, settings);

  const out = await app.OnSettingsListRequest().Trigger(hookEvent, async (e) => {
    return execAfterSuccessTx(true, app, () => event.json(200, e.Settings));
  });

  if (out instanceof Response) {
    return out;
  }

  return event.json(200, hookEvent.Settings);
}

async function settingsSet(app: App, event: RequestEvent): Promise<Response> {
  const oldSettings = app.settings().Clone();
  const newSettings = app.settings().Clone();

  const body = await readJsonBody(event);
  if (body.error) {
    return badRequest(event, "An error occurred while loading the submitted data.");
  }

  if (body.data) {
    newSettings.loadFromJSON(body.data);
  }

  const hookEvent = new SettingsUpdateRequestEvent(event, oldSettings, newSettings);

  const out = await app.OnSettingsUpdateRequest().Trigger(hookEvent, async (e) => {
    const saveErr = app.Save(e.NewSettings);
    if (saveErr) {
      return badRequest(event, "An error occurred while saving the new settings.", saveErr);
    }

    const appSettings = app.settings().Clone();
    return execAfterSuccessTx(true, app, () => event.json(200, appSettings));
  });

  if (out instanceof Response) {
    return out;
  }

  return event.json(200, app.settings().Clone());
}

async function settingsTestS3(app: App, event: RequestEvent): Promise<Response> {
  const form = NewTestS3Filesystem(app);

  const body = await readJsonBody(event);
  if (body.error) {
    return badRequest(event, "An error occurred while loading the submitted data.");
  }
  if (body.data && typeof body.data.filesystem === "string") {
    form.Filesystem = body.data.filesystem;
  }

  const submitErr = form.Submit();
  if (submitErr) {
    if (submitErr instanceof ValidationErrors) {
      return badRequest(event, "Failed to test the S3 filesystem.", submitErr);
    }
    return badRequest(event, `Failed to test the S3 filesystem. Raw error: \n${submitErr.message}`, null);
  }

  return noContent(event, 204);
}

async function settingsTestEmail(app: App, event: RequestEvent): Promise<Response> {
  const form = NewTestEmailSend(app);

  const body = await readJsonBody(event);
  if (body.error) {
    return badRequest(event, "An error occurred while loading the submitted data.");
  }
  if (body.data) {
    if (typeof body.data.email === "string") {
      form.Email = body.data.email;
    }
    if (typeof body.data.template === "string") {
      form.Template = body.data.template;
    }
    if (typeof body.data.collection === "string") {
      form.Collection = body.data.collection;
    }
  }

  const submitErr = form.Submit();
  if (submitErr) {
    if (submitErr instanceof ValidationErrors) {
      return badRequest(event, "Failed to send the test email.", submitErr);
    }
    return badRequest(event, `Failed to send the test email. Raw error: \n${submitErr.message}`, null);
  }

  return noContent(event, 204);
}

async function settingsGenerateAppleClientSecret(app: App, event: RequestEvent): Promise<Response> {
  const form = NewAppleClientSecretCreate(app);

  const body = await readJsonBody(event);
  if (body.error) {
    return badRequest(event, "An error occurred while loading the submitted data.");
  }
  if (body.data) {
    if (typeof body.data.clientId === "string") {
      form.ClientId = body.data.clientId;
    }
    if (typeof body.data.teamId === "string") {
      form.TeamId = body.data.teamId;
    }
    if (typeof body.data.keyId === "string") {
      form.KeyId = body.data.keyId;
    }
    if (typeof body.data.privateKey === "string") {
      form.PrivateKey = body.data.privateKey;
    }
    if (typeof body.data.duration === "number") {
      form.Duration = body.data.duration;
    } else if (typeof body.data.duration === "string" && body.data.duration.trim() !== "") {
      const parsed = Number(body.data.duration);
      if (Number.isFinite(parsed)) {
        form.Duration = parsed;
      }
    }
  }

  const { secret, error } = form.Submit();
  if (error) {
    if (error instanceof ValidationErrors) {
      return badRequest(event, "Invalid client secret data.", error);
    }
    return badRequest(event, `Failed to generate client secret. Raw error: \n${error.message}`, null);
  }

  return event.json(200, { secret });
}
