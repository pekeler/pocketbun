// Ported from pocketbase/apis/record_auth_otp_request.go

import type { App } from "../core/app.ts";
import type { RequestEvent } from "../core/event_request.ts";
import type { Record as RecordModel } from "../core/record_model.ts";
import { GenerateDefaultRandomId } from "../core/db.ts";
import { RecordCreateOTPRequestEvent } from "../core/events.ts";
import { NewOTP, type OTP } from "../core/otp_model.ts";
import { ValidationErrors, newError, required } from "../internal/compat/validation.ts";
import { SendRecordOTP } from "../mails/record.ts";
import { FireAndForget } from "../tools/routine/routine.ts";
import { randomStringWithAlphabet } from "../tools/security/random.ts";
import { badRequest, forbidden, internalServerError } from "./api_errors.ts";
import { authCollectionNotFound, findAuthCollection, readJsonBody } from "./record_auth_utils.ts";
import { execAfterSuccessTx } from "./record_helpers.ts";

export async function recordRequestOTP(app: App, event: RequestEvent): Promise<Response> {
  const collection = findAuthCollection(app, event);
  if (!collection) {
    return authCollectionNotFound(event);
  }

  if (!collection.OTP.Enabled) {
    return forbidden(event, "The collection is not configured to allow OTP authentication.");
  }

  const form = { email: "" };
  const body = await readJsonBody(event);
  if (body.error) {
    return badRequest(event, "An error occurred while loading the submitted data.");
  }
  if (body.data && typeof body.data.email === "string") {
    form.email = body.data.email;
  }

  const validationErr = validateOTPForm(form);
  if (validationErr) {
    return badRequest(event, "An error occurred while validating the submitted data.", validationErr);
  }

  let record: RecordModel | null = null;
  try {
    record = app.FindAuthRecordByEmail(collection, form.email);
  } catch (error) {
    if ((error as Error).message !== "record not found") {
      return internalServerError(event, "", error);
    }
  }

  const hookEvent = new RecordCreateOTPRequestEvent(event, collection, record);
  hookEvent.Password = randomStringWithAlphabet(collection.OTP.Length, "1234567890");

  const out = await app.OnRecordCreateOTPRequest().Trigger(hookEvent, async () => {
    if (!hookEvent.Record) {
      return event.json(200, { otpId: GenerateDefaultRandomId() });
    }

    let otp: OTP | null = null;

    if (!app.IsDev()) {
      let otps = [] as ReturnType<App["FindAllOTPsByRecord"]>;
      try {
        otps = app.FindAllOTPsByRecord(hookEvent.Record);
      } catch (error) {
        return internalServerError(event, "Failed to fetch previous record OTPs.", error);
      }

      let totalRecent = 0;
      for (const existing of otps) {
        if (!existing.HasExpired(collection.OTP.DurationTime())) {
          totalRecent += 1;
        }
        if (totalRecent > 9) {
          otp = otps[0] ?? null;
          if (otp) {
            app
              .Logger()
              .Warn(
                "Too many OTP requests - reusing the last issued",
                "email",
                form.email,
                "recordId",
                hookEvent.Record.Id,
                "otpId",
                existing.Id,
              );
          }
          break;
        }
      }
    }

    if (!otp) {
      const createdOtp = NewOTP(app);
      createdOtp.SetCollectionRef(hookEvent.Record.collection().Id);
      createdOtp.SetRecordRef(hookEvent.Record.Id);
      createdOtp.ProxyRecord().SetPassword(hookEvent.Password);
      const saveErr = await app.Save(createdOtp);
      if (saveErr) {
        return internalServerError(event, "Failed to create OTP record.", saveErr);
      }

      const originalApp = app;
      const originalRecord = hookEvent.Record;
      const otpId = createdOtp.Id;
      const password = hookEvent.Password;

      FireAndForget(async () => {
        const sendErr = await SendRecordOTP(originalApp, originalRecord, otpId, password);
        if (sendErr) {
          const deleteErr = await originalApp.Delete(createdOtp);
          originalApp.Logger().Error("Failed to send OTP email", "error", sendErr, "deleteErr", deleteErr);
        }
      });
      otp = createdOtp;
    }

    return execAfterSuccessTx(true, app, () => event.json(200, { otpId: otp?.Id ?? "" }));
  });

  if (out instanceof Response) {
    return out;
  }

  return event.json(200, { otpId: GenerateDefaultRandomId() });
}

function validateOTPForm(form: { email: string }): Error | null {
  const errors: Record<string, Error> = {};

  const requiredErr = required(form.email);
  if (requiredErr) {
    errors.email = requiredErr;
  } else if (form.email.length < 1 || form.email.length > 255) {
    errors.email = newError("validation_length_out_of_range", "The length must be between 1 and 255.");
  } else if (!isEmail(form.email)) {
    errors.email = newError("validation_is_email", "Must be a valid email address.");
  }

  return Object.keys(errors).length > 0 ? new ValidationErrors(errors) : null;
}

function isEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}
