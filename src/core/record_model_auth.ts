// Ported from pocketbase/core/record_model_auth.go

import type { Record } from "./record_model.ts";
import { randomString } from "../tools/security/random.ts";
import { FieldNameEmail, FieldNameEmailVisibility, FieldNamePassword, FieldNameTokenKey, FieldNameVerified } from "./field.ts";
import { PasswordField, PasswordFieldValue } from "./field_password.ts";
import { autogenerateModifier } from "./field_text.ts";

declare module "./record_model.ts" {
  interface Record {
    Email(): string;
    SetEmail(email: string): void;
    EmailVisibility(): boolean;
    SetEmailVisibility(visible: boolean): void;
    Verified(): boolean;
    SetVerified(verified: boolean): void;
    TokenKey(): string;
    SetTokenKey(key: string): void;
    RefreshTokenKey(): void;
    SetPassword(password: string): void;
    SetPasswordAsync(password: string): Promise<void>;
    SetRandomPassword(): string;
    SetRandomPasswordAsync(): Promise<string>;
    ValidatePassword(password: string): boolean;
    ValidatePasswordAsync(password: string): Promise<boolean>;
  }
}

export function attachRecordAuthMethods(RecordCtor: { prototype: Record }): void {
  RecordCtor.prototype.Email = function (this: Record): string {
    return this.GetString(FieldNameEmail);
  };

  RecordCtor.prototype.SetEmail = function (this: Record, email: string): void {
    this.Set(FieldNameEmail, email);
  };

  RecordCtor.prototype.EmailVisibility = function (this: Record): boolean {
    return this.GetBool(FieldNameEmailVisibility);
  };

  RecordCtor.prototype.SetEmailVisibility = function (this: Record, visible: boolean): void {
    this.Set(FieldNameEmailVisibility, visible);
  };

  RecordCtor.prototype.Verified = function (this: Record): boolean {
    return this.GetBool(FieldNameVerified);
  };

  RecordCtor.prototype.SetVerified = function (this: Record, verified: boolean): void {
    this.Set(FieldNameVerified, verified);
  };

  RecordCtor.prototype.TokenKey = function (this: Record): string {
    return this.GetString(FieldNameTokenKey);
  };

  RecordCtor.prototype.SetTokenKey = function (this: Record, key: string): void {
    this.Set(FieldNameTokenKey, key);
  };

  RecordCtor.prototype.RefreshTokenKey = function (this: Record): void {
    this.Set(FieldNameTokenKey + autogenerateModifier, "");
  };

  RecordCtor.prototype.SetPassword = function (this: Record, password: string): void {
    this.Set(FieldNamePassword, password);
  };

  // PocketBun-only async alternative to avoid sync bcrypt hashing on runtime async paths.
  RecordCtor.prototype.SetPasswordAsync = async function (this: Record, password: string): Promise<void> {
    const field = this.collection().Fields.GetByName(FieldNamePassword);
    if (field instanceof PasswordField) {
      await field.SetValueAsync(this, password);
      return;
    }
    this.Set(FieldNamePassword, password);
  };

  RecordCtor.prototype.SetRandomPassword = function (this: Record): string {
    const pass = randomString(30);
    this.SetPassword(pass);
    this.RefreshTokenKey();

    const raw = this.GetRaw(FieldNamePassword);
    if (raw instanceof PasswordFieldValue) {
      raw.Plain = "";
    }

    return pass;
  };

  // PocketBun-only async alternative to avoid sync bcrypt hashing on runtime async paths.
  RecordCtor.prototype.SetRandomPasswordAsync = async function (this: Record): Promise<string> {
    const pass = randomString(30);
    await this.SetPasswordAsync(pass);
    this.RefreshTokenKey();

    const raw = this.GetRaw(FieldNamePassword);
    if (raw instanceof PasswordFieldValue) {
      raw.Plain = "";
    }

    return pass;
  };

  RecordCtor.prototype.ValidatePassword = function (this: Record, password: string): boolean {
    const raw = this.GetRaw(FieldNamePassword);
    if (!(raw instanceof PasswordFieldValue)) {
      return false;
    }
    return raw.Validate(password);
  };

  RecordCtor.prototype.ValidatePasswordAsync = async function (this: Record, password: string): Promise<boolean> {
    const raw = this.GetRaw(FieldNamePassword);
    if (!(raw instanceof PasswordFieldValue)) {
      return false;
    }
    return await raw.ValidateAsync(password);
  };
}
