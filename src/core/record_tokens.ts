// Ported from pocketbase/core/record_tokens.go

import { newJWT } from "../tools/security/jwt.ts";
import { Record } from "./record_model.ts";

export const TokenTypeAuth = "auth";
export const TokenTypeFile = "file";
export const TokenTypeVerification = "verification";
export const TokenTypePasswordReset = "passwordReset";
export const TokenTypeEmailChange = "emailChange";

export const TokenClaimId = "id";
export const TokenClaimType = "type";
export const TokenClaimCollectionId = "collectionId";
export const TokenClaimEmail = "email";
export const TokenClaimNewEmail = "newEmail";
export const TokenClaimRefreshable = "refreshable";

export const ErrNotAuthRecord = new Error("not an auth collection record");
export const ErrMissingSigningKey = new Error("missing or invalid signing key");

declare module "./record_model.ts" {
  interface Record {
    NewStaticAuthToken(durationSeconds: number): string;
    NewAuthToken(): string;
    NewVerificationToken(): string;
    NewPasswordResetToken(): string;
    NewEmailChangeToken(newEmail: string): string;
    NewFileToken(): string;
    newStaticAuthToken(durationSeconds: number): string;
    newAuthToken(): string;
    newVerificationToken(): string;
    newPasswordResetToken(): string;
    newEmailChangeToken(newEmail: string): string;
    newFileToken(): string;
  }
}

Record.prototype.NewStaticAuthToken = function (this: Record, durationSeconds: number): string {
  return newAuthToken(this, durationSeconds, false);
};

Record.prototype.NewAuthToken = function (this: Record): string {
  return newAuthToken(this, 0, true);
};

Record.prototype.NewVerificationToken = function (this: Record): string {
  const collection = this.collection();
  if (!collection.IsAuth()) {
    throw ErrNotAuthRecord;
  }

  const key = this.TokenKey() + collection.VerificationToken.Secret;
  if (key === "") {
    throw ErrMissingSigningKey;
  }

  return newJWT(
    {
      [TokenClaimType]: TokenTypeVerification,
      [TokenClaimId]: this.Id,
      [TokenClaimCollectionId]: collection.Id,
      [TokenClaimEmail]: this.Email(),
    },
    key,
    collection.VerificationToken.DurationTime(),
  );
};

Record.prototype.NewPasswordResetToken = function (this: Record): string {
  const collection = this.collection();
  if (!collection.IsAuth()) {
    throw ErrNotAuthRecord;
  }

  const key = this.TokenKey() + collection.PasswordResetToken.Secret;
  if (key === "") {
    throw ErrMissingSigningKey;
  }

  return newJWT(
    {
      [TokenClaimType]: TokenTypePasswordReset,
      [TokenClaimId]: this.Id,
      [TokenClaimCollectionId]: collection.Id,
      [TokenClaimEmail]: this.Email(),
    },
    key,
    collection.PasswordResetToken.DurationTime(),
  );
};

Record.prototype.NewEmailChangeToken = function (this: Record, newEmail: string): string {
  const collection = this.collection();
  if (!collection.IsAuth()) {
    throw ErrNotAuthRecord;
  }

  const key = this.TokenKey() + collection.EmailChangeToken.Secret;
  if (key === "") {
    throw ErrMissingSigningKey;
  }

  return newJWT(
    {
      [TokenClaimType]: TokenTypeEmailChange,
      [TokenClaimId]: this.Id,
      [TokenClaimCollectionId]: collection.Id,
      [TokenClaimEmail]: this.Email(),
      [TokenClaimNewEmail]: newEmail,
    },
    key,
    collection.EmailChangeToken.DurationTime(),
  );
};

Record.prototype.NewFileToken = function (this: Record): string {
  const collection = this.collection();
  if (!collection.IsAuth()) {
    throw ErrNotAuthRecord;
  }

  const key = this.TokenKey() + collection.FileToken.Secret;
  if (key === "") {
    throw ErrMissingSigningKey;
  }

  return newJWT(
    {
      [TokenClaimType]: TokenTypeFile,
      [TokenClaimId]: this.Id,
      [TokenClaimCollectionId]: collection.Id,
    },
    key,
    collection.FileToken.DurationTime(),
  );
};

// PocketBun JSVM compatibility: expose PocketBase's lower-camel server-side
// JavaScript token helpers directly on Record instances.
Record.prototype.newStaticAuthToken = function (this: Record, durationSeconds: number): string {
  return this.NewStaticAuthToken(durationSeconds);
};

Record.prototype.newAuthToken = function (this: Record): string {
  return this.NewAuthToken();
};

Record.prototype.newVerificationToken = function (this: Record): string {
  return this.NewVerificationToken();
};

Record.prototype.newPasswordResetToken = function (this: Record): string {
  return this.NewPasswordResetToken();
};

Record.prototype.newEmailChangeToken = function (this: Record, newEmail: string): string {
  return this.NewEmailChangeToken(newEmail);
};

Record.prototype.newFileToken = function (this: Record): string {
  return this.NewFileToken();
};

function newAuthToken(record: Record, durationSeconds: number, refreshable: boolean): string {
  const collection = record.collection();
  if (!collection.IsAuth()) {
    throw ErrNotAuthRecord;
  }

  const key = record.TokenKey() + collection.AuthToken.Secret;
  if (key === "") {
    throw ErrMissingSigningKey;
  }

  let duration = durationSeconds;
  if (duration <= 0) {
    duration = collection.AuthToken.DurationTime();
  }

  return newJWT(
    {
      [TokenClaimType]: TokenTypeAuth,
      [TokenClaimId]: record.Id,
      [TokenClaimCollectionId]: collection.Id,
      [TokenClaimRefreshable]: refreshable,
    },
    key,
    duration,
  );
}
