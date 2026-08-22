// Ported from pocketbase/apis/record_auth_with_otp.go

import type { App } from "../core/app.ts";
import type { RequestEvent } from "../core/event_request.ts";
import type { Record as RecordModel } from "../core/record_model.ts";
import { RequestEventKeyInfoContext, RequestInfoContextOTP } from "../core/event_request.ts";
import { RecordAuthWithOTPRequestEvent } from "../core/events.ts";
import { MFAMethodOTP } from "../core/mfa_model.ts";
import { ValidationErrors, ErrRequired, newError, required } from "../internal/compat/validation.ts";
import { badRequest, forbidden, tooManyRequests } from "./api_errors.ts";
import { checkRateLimit } from "./middlewares_rate_limit.ts";
import { authCollectionNotFound, findAuthCollection, readJsonBody } from "./record_auth_utils.ts";
import { RecordAuthResponse } from "./record_helpers.ts";

export async function recordAuthWithOTP(app: App, event: RequestEvent): Promise<Response> {
  const collection = findAuthCollection(app, event);
  if (!collection) {
    return authCollectionNotFound(event);
  }

  if (!collection.OTP.Enabled) {
    return forbidden(event, "The collection is not configured to allow OTP authentication.");
  }

  const form = { otpId: "", password: "" };
  const body = await readJsonBody(event);
  if (body.error) {
    return badRequest(event, "An error occurred while loading the submitted data.");
  }
  if (body.data) {
    if (typeof body.data.otpId === "string") {
      form.otpId = body.data.otpId;
    }
    if (typeof body.data.password === "string") {
      form.password = body.data.password;
    }
  }

  const validationErr = validateOTPAuthForm(form);
  if (validationErr) {
    return badRequest(event, "An error occurred while validating the submitted data.", validationErr);
  }

  event.Set(RequestEventKeyInfoContext, RequestInfoContextOTP);
  await event.requestInfo();

  const hookEvent = new RecordAuthWithOTPRequestEvent(event, collection, null);

  let otp = null;
  try {
    otp = app.FindOTPById(form.otpId);
  } catch {
    return badRequest(event, "Invalid or expired OTP");
  }

  if (otp.CollectionRef() !== collection.Id) {
    return badRequest(event, "Invalid or expired OTP");
  }

  if (otp.HasExpired(collection.OTP.DurationTime() * 1000)) {
    return badRequest(event, "Invalid or expired OTP");
  }

  let record: RecordModel | null = null;
  try {
    record = app.FindRecordById(otp.CollectionRef(), otp.RecordRef());
  } catch {
    return badRequest(event, "Invalid or expired OTP");
  }

  const rateLimitResult = checkRateLimit(event, `@pb_otp_${record.Id}`, {
    label: "",
    audience: "",
    duration: 180,
    maxRequests: 5,
  });
  const rateLimitResponse = rateLimitResult instanceof Promise ? await rateLimitResult : rateLimitResult;
  if (rateLimitResponse) {
    return tooManyRequests(event, "Too many attempts, please try again later with a new OTP.");
  }

  // PocketBun-only async verify to avoid blocking Bun's event loop on bcrypt checks.
  if (!(await otp.ProxyRecord().ValidatePasswordAsync(form.password))) {
    return badRequest(event, "Invalid or expired OTP");
  }

  hookEvent.OTP = otp;
  hookEvent.Record = record;

  const out = await app.OnRecordAuthWithOTPRequest().Trigger(hookEvent, async () => {
    const otpId = otp.Id;
    const otpSentTo = otp.SentTo();

    const deleteErr = await app.Delete(otp);
    if (deleteErr) {
      app.Logger().Error("Failed to delete used OTP", "error", deleteErr, "otpId", otp.Id);
    }

    if (!record.Verified() && otpSentTo && record.Email() === otpSentTo) {
      record.SetVerified(true);

      // this is technically not required but we enforce password
      // reset on verified upgrades in case the OTP is used on its own
      // since this makes it less error prone to pre-hijacking attacks
      if (!record.collection().MFA.Enabled) {
        await record.SetRandomPasswordAsync();
      }

      const saveErr = await app.Save(record);
      if (saveErr) {
        app
          .Logger()
          .Error(
            "Failed to update record verified state after successful OTP validation",
            "error",
            saveErr,
            "otpId",
            otpId,
            "recordId",
            record.Id,
          );
      }
    }

    return RecordAuthResponse(event, record, MFAMethodOTP, null);
  });

  if (out instanceof Response) {
    return out;
  }

  return badRequest(event, "Invalid or expired OTP");
}

function validateOTPAuthForm(form: { otpId: string; password: string }): Error | null {
  const errors: Record<string, Error> = {};

  if (required(form.otpId)) {
    errors.otpId = ErrRequired;
  } else if (form.otpId.length < 1 || form.otpId.length > 255) {
    errors.otpId = newError("validation_length_out_of_range", "The length must be between 1 and 255.");
  }

  if (required(form.password)) {
    errors.password = ErrRequired;
  } else if (form.password.length < 1 || form.password.length > 71) {
    errors.password = newError("validation_length_out_of_range", "The length must be between 1 and 71.");
  }

  return Object.keys(errors).length > 0 ? new ValidationErrors(errors) : null;
}
