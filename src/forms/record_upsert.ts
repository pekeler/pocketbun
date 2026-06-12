// Ported from pocketbase/forms/record_upsert.go

import type { App } from "../core/app.ts";
import type { Record as RecordModel } from "../core/record_model.ts";
import { PasswordField, PasswordFieldValue } from "../core/field_password.ts";
import { FieldNameExpand } from "../core/record_model.ts";
import { NormalizeUniqueIndexError } from "../core/validators/db.ts";
import { Equal } from "../core/validators/equal.ts";
import { ErrUnsupportedValueType } from "../core/validators/validators.ts";
import { toStringValue } from "../internal/compat/cast.ts";
import { ValidationErrors, required, newError } from "../internal/compat/validation.ts";
import { randomString } from "../tools/security/random.ts";

const accessLevelDefault = 0;
const accessLevelManager = 1;
const accessLevelSuperuser = 2;

export class RecordUpsert {
  ctx: unknown;
  app: App;
  record: RecordModel;
  accessLevel: number;

  disablePasswordValidations = false;
  password = "";
  passwordConfirm = "";
  oldPassword = "";

  constructor(app: App, record: RecordModel) {
    this.ctx = null;
    this.app = app;
    this.record = record;
    this.accessLevel = accessLevelDefault;
  }

  // SetContext assigns ctx as context of the current form.
  SetContext(ctx: unknown): void {
    this.ctx = ctx;
  }

  setContext(ctx: unknown): void {
    this.SetContext(ctx);
  }

  // SetApp replaces the current form app instance.
  //
  // This could be used for example if you want to change at later stage
  // before submission to change from regular -> transactional app instance.
  SetApp(app: App): void {
    this.app = app;
  }

  setApp(app: App): void {
    this.SetApp(app);
  }

  // SetRecord replaces the current form record instance.
  SetRecord(record: RecordModel): void {
    this.record = record;
  }

  setRecord(record: RecordModel): void {
    this.SetRecord(record);
  }

  // ResetAccess resets the form access level to the accessLevelDefault.
  ResetAccess(): void {
    this.accessLevel = accessLevelDefault;
  }

  resetAccess(): void {
    this.ResetAccess();
  }

  // GrantManagerAccess updates the form access level to "manager" allowing
  // directly changing some system record fields (often used with auth collection records).
  GrantManagerAccess(): void {
    this.accessLevel = accessLevelManager;
  }

  grantManagerAccess(): void {
    this.GrantManagerAccess();
  }

  // GrantSuperuserAccess updates the form access level to "superuser" allowing
  // directly changing all system record fields, including those marked as "Hidden".
  GrantSuperuserAccess(): void {
    this.accessLevel = accessLevelSuperuser;
  }

  grantSuperuserAccess(): void {
    this.GrantSuperuserAccess();
  }

  // HasManageAccess reports whether the form has "manager" or "superuser" level access.
  HasManageAccess(): boolean {
    return this.accessLevel === accessLevelManager || this.accessLevel === accessLevelSuperuser;
  }

  hasManageAccess(): boolean {
    return this.HasManageAccess();
  }

  // Load loads the provided data into the form and the related record.
  Load(data: Record<string, unknown>): void {
    const { excludeFields, isAuth } = this.prepareLoad(data);

    for (const [key, value] of Object.entries(data)) {
      if (excludeFields.has(key)) {
        continue;
      }

      const field = this.record.SetIfFieldExists(key, value);
      this.restoreHiddenFieldValue(field, isAuth);
    }
  }

  load(data: Record<string, unknown>): void {
    this.Load(data);
  }

  // LoadAsync loads the provided data into the form and the related record,
  // using async password hashing for auth records.
  async LoadAsync(data: Record<string, unknown>): Promise<void> {
    const { excludeFields, isAuth } = this.prepareLoad(data);

    for (const [key, value] of Object.entries(data)) {
      if (excludeFields.has(key)) {
        continue;
      }

      let field = null;
      if (isAuth && key === "password") {
        // PocketBun perf deviation companion to Record.ReplaceModifiers:
        // modifier resolution keeps auth passwords as plain strings and we hash exactly once here.
        const passwordField = this.record.collection().Fields.GetByName("password");
        if (passwordField instanceof PasswordField) {
          await passwordField.SetValueAsync(this.record, value);
          field = passwordField;
        } else {
          field = this.record.SetIfFieldExists(key, value);
        }
      } else {
        field = this.record.SetIfFieldExists(key, value);
      }

      this.restoreHiddenFieldValue(field, isAuth);
    }
  }

  private prepareLoad(data: Record<string, unknown>): { excludeFields: Set<string>; isAuth: boolean } {
    const excludeFields = new Set<string>([FieldNameExpand]);
    const isAuth = this.record.collection().isAuth();
    if (isAuth) {
      if (Object.prototype.hasOwnProperty.call(data, "password")) {
        this.password = toStringValue(data.password);
      }
      if (Object.prototype.hasOwnProperty.call(data, "passwordConfirm")) {
        this.passwordConfirm = toStringValue(data.passwordConfirm);
      }
      if (Object.prototype.hasOwnProperty.call(data, "oldPassword")) {
        this.oldPassword = toStringValue(data.oldPassword);
      }

      excludeFields.add("passwordConfirm");
      excludeFields.add("oldPassword");
    }
    return { excludeFields, isAuth };
  }

  private restoreHiddenFieldValue(field: { GetHidden: () => boolean; GetName: () => string } | null, isAuth: boolean): void {
    if (
      this.accessLevel !== accessLevelSuperuser &&
      field &&
      field.GetHidden() &&
      (!isAuth || field.GetName() !== "password")
    ) {
      this.record.SetRaw(field.GetName(), this.record.Original().GetRaw(field.GetName()));
    }
  }

  private async validateFormFieldsAsync(): Promise<Error | null> {
    if (!this.record.collection().isAuth()) {
      return null;
    }

    this.syncPasswordFields();

    const errors: Record<string, Error> = {};
    const isNew = this.record.IsNew();
    const original = this.record.Original();

    if (!isNew && !this.HasManageAccess()) {
      const err = Equal(original.Email())(this.record.Email());
      if (err) {
        errors.email = err;
      }
    }

    if (!this.HasManageAccess()) {
      const err = Equal(original.Verified())(this.record.Verified());
      if (err) {
        errors.verified = err;
      }
    }

    if (!this.disablePasswordValidations && (isNew || this.passwordConfirm !== "" || this.oldPassword !== "")) {
      const err = required(this.password);
      if (err) {
        errors.password = err;
      }
    }

    if (!this.disablePasswordValidations && (isNew || this.password !== "" || this.oldPassword !== "")) {
      const err = required(this.passwordConfirm);
      if (err) {
        errors.passwordConfirm = err;
      }
    }

    if (!this.disablePasswordValidations) {
      const err = Equal(this.password)(this.passwordConfirm);
      if (err && !errors.passwordConfirm) {
        errors.passwordConfirm = err;
      }
    }

    if (
      !this.disablePasswordValidations &&
      !isNew &&
      !this.HasManageAccess() &&
      (this.password !== "" || this.passwordConfirm !== "")
    ) {
      const err = required(this.oldPassword);
      if (err) {
        errors.oldPassword = err;
      } else {
        const oldErr = await this.checkOldPasswordAsync(this.oldPassword);
        if (oldErr) {
          errors.oldPassword = oldErr;
        }
      }
    }

    return Object.keys(errors).length > 0 ? new ValidationErrors(errors) : null;
  }

  private async checkOldPasswordAsync(value: unknown): Promise<Error | null> {
    if (typeof value !== "string") {
      return ErrUnsupportedValueType;
    }

    // PocketBun-only async verify to avoid blocking form submits on bcrypt checks.
    if (!(await this.record.Original().ValidatePasswordAsync(value))) {
      return newError("validation_invalid_old_password", "Missing or invalid old password.");
    }

    return null;
  }

  // Deprecated: It was previously used as part of the record create action but it is not needed anymore and will be removed in the future.
  //
  // DrySubmit performs a temp form submit within a transaction and reverts it at the end.
  // For actual record persistence, check the [RecordUpsert.Submit()] method.
  //
  // This method doesn't perform validations, handle file uploads/deletes or trigger app save events!
  async DrySubmit(
    callback: ((txApp: App, drySavedRecord: RecordModel) => Error | null | Promise<Error | null>) | null,
  ): Promise<Error | null> {
    const isNew = this.record.IsNew();
    const clone = this.record.Clone();
    const rollbackData = clone.Original().FieldsData();

    if (clone.IsNew() && clone.Id === "") {
      clone.Id = `_temp_${randomString(15)}`;
    }

    const app = this.app.UnsafeWithoutHooks();

    if (!app.IsTransactional()) {
      const db = app.db();
      db.run("BEGIN");
      let callbackErr: Error | null = null;
      try {
        const saveErr = await app.SaveNoValidateWithContext(this.ctx, clone);
        if (saveErr) {
          return NormalizeUniqueIndexError(saveErr, clone.collection().name, clone.collection().Fields.FieldNames());
        }

        if (callback) {
          callbackErr = (await callback(app, clone)) ?? null;
          if (callbackErr) {
            return callbackErr;
          }
        }
      } finally {
        db.run("ROLLBACK");
      }

      return callbackErr;
    }

    const saveErr = await app.SaveNoValidateWithContext(this.ctx, clone);
    if (saveErr) {
      return NormalizeUniqueIndexError(saveErr, clone.collection().name, clone.collection().Fields.FieldNames());
    }

    const manualRollback = async (): Promise<Error | null> => {
      if (isNew) {
        const deleteErr = await app.DeleteWithContext(this.ctx, clone);
        if (deleteErr) {
          return new Error(`failed to rollback dry submit created record: ${deleteErr.message}`);
        }
      } else {
        clone.Load(rollbackData);
        const rollbackErr = await app.SaveNoValidateWithContext(this.ctx, clone);
        if (rollbackErr) {
          return new Error(`failed to rollback dry submit updated record: ${rollbackErr.message}`);
        }
      }

      return null;
    };

    if (callback) {
      const cbErr = (await callback(app, clone)) ?? null;
      const rollbackErr = await manualRollback();
      if (cbErr && rollbackErr) {
        return new Error(`${cbErr.message}; ${rollbackErr.message}`);
      }
      return cbErr ?? rollbackErr;
    }

    return manualRollback();
  }

  async drySubmit(
    callback: ((txApp: App, drySavedRecord: RecordModel) => void | Error | null | Promise<void | Error | null>) | null,
  ): Promise<void> {
    const err = await this.DrySubmit(async (txApp, drySavedRecord) => {
      if (!callback) {
        return null;
      }
      const result = await callback(txApp, drySavedRecord);
      return result instanceof Error ? result : null;
    });
    if (err) {
      throw err;
    }
  }

  // Submit validates the form specific validations and attempts to save the form record.
  async Submit(): Promise<Error | null> {
    // PocketBun perf deviation (behavior-compatible): non-auth collections have
    // no form-level validations, so skip async validation machinery on hot CRUD paths.
    if (!this.record.collection().isAuth()) {
      return this.app.SaveWithContext(this.ctx, this.record);
    }

    const err = await this.validateFormFieldsAsync();
    if (err) {
      return err;
    }

    return this.app.SaveWithContext(this.ctx, this.record);
  }

  async submit(): Promise<void> {
    const err = await this.Submit();
    if (err) {
      throw err;
    }
  }

  // syncPasswordFields syncs the form's auth password fields with their
  // corresponding record field values.
  //
  // This could be useful in case the password fields were programmatically set
  // directly by modifying the related record model.
  syncPasswordFields(): void {
    if (!this.record.collection().isAuth()) {
      return;
    }

    this.disablePasswordValidations = false;

    const rawPassword = this.record.GetRaw("password");
    if (rawPassword instanceof PasswordFieldValue) {
      if (
        (rawPassword.Plain !== "" && rawPassword.Plain !== this.password) ||
        (rawPassword.Plain === "" && rawPassword.Hash !== "" && this.record.IsNew())
      ) {
        this.disablePasswordValidations = true;
      }
    }
  }
}
