// Ported from pocketbase/core/collection_validate.go

import type { App } from "./app.ts";
import type { RequestInfo } from "./event_request.ts";
import { ValidationErrors, ErrRequired, newError } from "../internal/compat/validation.ts";
import { parseIndex, findSingleColumnUniqueIndex } from "../tools/dbutils/index.ts";
import { existInSlice } from "../tools/list/list.ts";
import { buildFilterExpr } from "../tools/search/filter.ts";
import { DefaultFilterExprLimit } from "../tools/search/types.ts";
import {
  Collection,
  CollectionTypeAuth,
  CollectionTypeBase,
  CollectionTypeView,
  NewCollection,
  parseCollectionFields,
} from "./collection_model.ts";
import { DefaultIdRegex } from "./db.ts";
import {
  ErrMustBeSystem,
  ErrMustBeSystemAndHidden,
  FieldNameEmail,
  FieldNameEmailVisibility,
  FieldNameId,
  FieldNamePassword,
  FieldNameTokenKey,
  FieldNameVerified,
} from "./field.ts";
import { BoolField } from "./field_bool.ts";
import { EmailField } from "./field_email.ts";
import { PasswordField } from "./field_password.ts";
import { TextField } from "./field_text.ts";
import { FieldsList } from "./fields_list.ts";
import { RecordFieldResolver } from "./record_field_resolver.ts";
import { UniqueId } from "./validators/db.ts";
import { Equal } from "./validators/equal.ts";
import { ErrUnsupportedValueType, joinValidationErrors } from "./validators/index.ts";

const collectionNameRegex = /^\w+$/;
const reservedAuthKeys = ["passwordConfirm", "oldPassword"];

export async function validateCollection(app: App, collection: Collection, original: Collection | null): Promise<Error | null> {
  const validator = new CollectionValidator(app, collection, original);
  return validator.run();
}

export function validateCollectionSync(app: App, collection: Collection, original: Collection | null): Error | null {
  const validator = new CollectionValidator(app, collection, original);
  return validator.runSync();
}

class CollectionValidator {
  #original: Collection;
  #next: Collection;
  #app: App;
  #ctx: unknown;

  constructor(app: App, next: Collection, original: Collection | null) {
    this.#app = app;
    this.#next = next;
    this.#original = original ?? NewCollection(this.#next.type, "");
    this.#ctx = null;
  }

  async run(): Promise<Error | null> {
    if (this.#original.IsNew()) {
      this.#next.updateGeneratedIdIfExists(this.#app);
    }

    if (this.#next.IsView()) {
      try {
        this.#next.Fields = await this.#app.CreateViewFields(this.#next.ViewQuery);
      } catch {
        this.#next.Fields = new FieldsList();
      }
    }
    this.syncFields();

    const baseErr = this.validateBase();
    const optionsErr = await this.validateOptions();
    return joinValidationErrors(baseErr, optionsErr);
  }

  runSync(): Error | null {
    if (this.#original.IsNew()) {
      this.#next.updateGeneratedIdIfExists(this.#app);
    }

    if (this.#next.IsView()) {
      try {
        this.#next.Fields = this.#app.CreateViewFieldsSync(this.#next.ViewQuery);
      } catch {
        this.#next.Fields = new FieldsList();
      }
    }
    this.syncFields();

    const baseErr = this.validateBase();
    const optionsErr = this.validateOptionsSync();
    return joinValidationErrors(baseErr, optionsErr);
  }

  private syncFields(): void {
    if (this.#next.Fields.length === 0 && this.#next.fields.length > 0) {
      try {
        this.#next.Fields = FieldsList.fromJSON(JSON.stringify(this.#next.fields));
      } catch {
        this.#next.Fields = new FieldsList();
      }
    }

    if (this.#next.Fields.length > 0) {
      this.#next.fields = parseCollectionFields(this.#next.Fields.toJSON());
    }
  }

  private validateBase(): Error | null {
    const errors: Record<string, Error> = {};

    const idErr = this.checkId(this.#next.id);
    if (idErr) {
      errors.id = idErr;
    }

    const systemErr = this.ensureNoSystemFlagChange(this.#next.system);
    if (systemErr) {
      errors.system = systemErr;
    }

    const typeErr = this.checkType(this.#next.type);
    if (typeErr) {
      errors.type = typeErr;
    }

    const nameErr = this.checkName(this.#next.name);
    if (nameErr) {
      errors.name = nameErr;
    }

    const fieldsErr = this.checkFields(this.#next.Fields);
    if (fieldsErr) {
      errors.fields = fieldsErr;
    }

    const listRuleErr = this.checkRule(this.#next.listRule);
    if (listRuleErr) {
      errors.listRule = listRuleErr;
    } else {
      const sysErr = this.ensureNoSystemRuleChange(this.#original.listRule)(this.#next.listRule);
      if (sysErr) {
        errors.listRule = sysErr;
      }
    }

    const viewRuleErr = this.checkRule(this.#next.viewRule);
    if (viewRuleErr) {
      errors.viewRule = viewRuleErr;
    } else {
      const sysErr = this.ensureNoSystemRuleChange(this.#original.viewRule)(this.#next.viewRule);
      if (sysErr) {
        errors.viewRule = sysErr;
      }
    }

    const createRuleErr = this.checkCreateUpdateDeleteRule(this.#next.createRule, this.#original.createRule);
    if (createRuleErr) {
      errors.createRule = createRuleErr;
    }

    const updateRuleErr = this.checkCreateUpdateDeleteRule(this.#next.updateRule, this.#original.updateRule);
    if (updateRuleErr) {
      errors.updateRule = updateRuleErr;
    }

    const deleteRuleErr = this.checkCreateUpdateDeleteRule(this.#next.deleteRule, this.#original.deleteRule);
    if (deleteRuleErr) {
      errors.deleteRule = deleteRuleErr;
    }

    const indexesErr = this.checkIndexes(this.#next.indexes ?? []);
    if (indexesErr) {
      errors.indexes = indexesErr;
    }

    return Object.keys(errors).length > 0 ? new ValidationErrors(errors) : null;
  }

  private async validateOptions(): Promise<Error | null> {
    if (this.#next.IsAuth()) {
      return this.validateAuthOptions();
    }
    if (this.#next.IsView()) {
      return this.validateViewOptions();
    }
    return null;
  }

  private validateOptionsSync(): Error | null {
    if (this.#next.IsAuth()) {
      return this.validateAuthOptions();
    }
    if (this.#next.IsView()) {
      return this.validateViewOptionsSync();
    }
    return null;
  }

  private async validateViewOptions(): Promise<Error | null> {
    const errors: Record<string, Error> = {};
    if (this.#next.ViewQuery === "") {
      errors.viewQuery = ErrRequired;
    } else {
      const viewErr = await this.checkViewQuery(this.#next.ViewQuery);
      if (viewErr) {
        errors.viewQuery = viewErr;
      }
    }

    return Object.keys(errors).length > 0 ? new ValidationErrors(errors) : null;
  }

  private validateViewOptionsSync(): Error | null {
    const errors: Record<string, Error> = {};
    if (this.#next.ViewQuery === "") {
      errors.viewQuery = ErrRequired;
    } else {
      const viewErr = this.checkViewQuerySync(this.#next.ViewQuery);
      if (viewErr) {
        errors.viewQuery = viewErr;
      }
    }

    return Object.keys(errors).length > 0 ? new ValidationErrors(errors) : null;
  }

  private validateAuthOptions(): Error | null {
    const errors: Record<string, Error> = {};

    const authRuleErr = this.checkRule(this.#next.AuthRule);
    if (authRuleErr) {
      errors.authRule = authRuleErr;
    } else {
      const sysErr = this.ensureNoSystemRuleChange(this.#original.AuthRule)(this.#next.AuthRule);
      if (sysErr) {
        errors.authRule = sysErr;
      }
    }

    const manageRuleErr = this.checkManageRule(this.#next.ManageRule, this.#original.ManageRule);
    if (manageRuleErr) {
      errors.manageRule = manageRuleErr;
    }

    const authAlertErr = this.#next.AuthAlert?.Validate?.();
    if (authAlertErr) {
      errors.authAlert = authAlertErr;
    }

    const passwordAuthErr = this.#next.PasswordAuth?.Validate?.();
    if (passwordAuthErr) {
      errors.passwordAuth = passwordAuthErr;
    }

    const oauthErr = this.#next.OAuth2?.Validate?.();
    if (oauthErr) {
      errors.oauth2 = oauthErr;
    }

    const otpErr = this.#next.OTP?.Validate?.();
    if (otpErr) {
      errors.otp = otpErr;
    }

    const mfaErr = this.#next.MFA?.Validate?.();
    if (mfaErr) {
      errors.mfa = mfaErr;
    }

    const authTokenErr = this.#next.AuthToken?.Validate?.();
    if (authTokenErr) {
      errors.authToken = authTokenErr;
    }

    const resetTokenErr = this.#next.PasswordResetToken?.Validate?.();
    if (resetTokenErr) {
      errors.passwordResetToken = resetTokenErr;
    }

    const emailChangeTokenErr = this.#next.EmailChangeToken?.Validate?.();
    if (emailChangeTokenErr) {
      errors.emailChangeToken = emailChangeTokenErr;
    }

    const verificationTokenErr = this.#next.VerificationToken?.Validate?.();
    if (verificationTokenErr) {
      errors.verificationToken = verificationTokenErr;
    }

    const fileTokenErr = this.#next.FileToken?.Validate?.();
    if (fileTokenErr) {
      errors.fileToken = fileTokenErr;
    }

    const verificationTemplateErr = this.#next.VerificationTemplate?.Validate?.();
    if (verificationTemplateErr) {
      errors.verificationTemplate = verificationTemplateErr;
    }

    const resetTemplateErr = this.#next.ResetPasswordTemplate?.Validate?.();
    if (resetTemplateErr) {
      errors.resetPasswordTemplate = resetTemplateErr;
    }

    const confirmTemplateErr = this.#next.ConfirmEmailChangeTemplate?.Validate?.();
    if (confirmTemplateErr) {
      errors.confirmEmailChangeTemplate = confirmTemplateErr;
    }

    if (Object.keys(errors).length > 0) {
      return new ValidationErrors(errors);
    }

    if (this.#next.MFA.Enabled) {
      let authsEnabled = 0;
      if (this.#next.PasswordAuth.Enabled) {
        authsEnabled += 1;
      }
      if (this.#next.OAuth2.Enabled) {
        authsEnabled += 1;
      }
      if (this.#next.OTP.Enabled) {
        authsEnabled += 1;
      }
      if (authsEnabled < 2) {
        return new ValidationErrors({
          mfa: new ValidationErrors({
            enabled: newError("validation_mfa_not_enough_auths", "MFA requires at least 2 auth methods to be enabled."),
          }),
        });
      }

      if (this.#next.MFA.Rule !== "") {
        const mfaErrs = [
          this.checkRule(this.#next.MFA.Rule),
          this.ensureNoSystemRuleChange(this.#original.MFA.Rule)(this.#next.MFA.Rule),
        ].filter(Boolean) as Error[];

        if (mfaErrs.length > 0) {
          return new ValidationErrors({
            mfa: new ValidationErrors({
              rule: mfaErrs[0]!,
            }),
          });
        }
      }
    }

    if (this.#next.PasswordAuth.Enabled) {
      const identityFields = this.#next.PasswordAuth.IdentityFields ?? [];
      const err = this.checkFieldsForUniqueIndex(identityFields);
      if (err) {
        return new ValidationErrors({
          passwordAuth: new ValidationErrors({
            identityFields: err,
          }),
        });
      }
    }

    return null;
  }

  private checkId(value: unknown): Error | null {
    if (typeof value !== "string" || value === "") {
      return ErrRequired;
    }

    if (!this.#original.IsNew()) {
      return Equal(this.#original.id)(value);
    }

    if (value.length < 1 || value.length > 100) {
      return newError("validation_length", "The length must be between 1 and 100.");
    }

    if (!DefaultIdRegex.test(value)) {
      return newError("validation_invalid_format", "Invalid value.");
    }

    return UniqueId(this.#app.db(), this.#next.TableName())(value);
  }

  private checkType(value: unknown): Error | null {
    if (typeof value !== "string" || value === "") {
      return ErrRequired;
    }

    const allowed = [CollectionTypeBase, CollectionTypeAuth, CollectionTypeView];
    if (!allowed.includes(value)) {
      return newError("validation_invalid_type", "Invalid collection type.");
    }

    return this.ensureNoTypeChange(value);
  }

  private checkName(value: unknown): Error | null {
    if (typeof value !== "string" || value === "") {
      return ErrRequired;
    }

    if (value.length < 1 || value.length > 255) {
      return newError("validation_length", "The length must be between 1 and 255.");
    }

    if (value.toLowerCase().includes("_via_")) {
      return newError("validation_found_via", 'The value cannot contain "_via_".');
    }

    if (!collectionNameRegex.test(value)) {
      return newError("validation_invalid_collection_name", "Invalid collection name.");
    }

    const sysErr = this.ensureNoSystemNameChange(value);
    if (sysErr) {
      return sysErr;
    }

    return this.checkUniqueName(value);
  }

  private checkFields(value: unknown): Error | null {
    const fields = value instanceof FieldsList ? value : null;
    if (!fields) {
      return ErrUnsupportedValueType;
    }

    const duplicatesErr = this.checkFieldDuplicates(fields);
    if (duplicatesErr) {
      return duplicatesErr;
    }

    const minErr = this.checkMinFields(fields);
    if (minErr) {
      return minErr;
    }

    if (!this.#next.IsView()) {
      const sysErr = this.ensureNoSystemFieldsChange(fields);
      if (sysErr) {
        return sysErr;
      }

      const typeErr = this.ensureNoFieldsTypeChange(fields);
      if (typeErr) {
        return typeErr;
      }
    }

    if (this.#next.IsAuth()) {
      const reservedErr = this.checkReservedAuthKeys(fields);
      if (reservedErr) {
        return reservedErr;
      }
    }

    return this.checkFieldValidators(fields);
  }

  private checkCreateUpdateDeleteRule(rule: string | null, originalRule: string | null): Error | null {
    if (this.#next.IsView()) {
      if (rule == null) {
        return null;
      }
      return newError("validation_nil", "Must be nil.");
    }

    const ruleErr = this.checkRule(rule);
    if (ruleErr) {
      return ruleErr;
    }

    return this.ensureNoSystemRuleChange(originalRule)(rule);
  }

  private checkManageRule(rule: string | null, originalRule: string | null): Error | null {
    if (rule == null) {
      return null;
    }

    if (rule === "") {
      return ErrRequired;
    }

    const ruleErr = this.checkRule(rule);
    if (ruleErr) {
      return ruleErr;
    }

    return this.ensureNoSystemRuleChange(originalRule)(rule);
  }

  private checkUniqueName(value: string): Error | null {
    if (!this.#app.IsCollectionNameUnique(value, this.#original.id)) {
      return newError("validation_collection_name_exists", "Collection name must be unique (case insensitive).");
    }

    if (this.#app.findCollectionById(value)) {
      return newError("validation_collection_name_id_duplicate", "The name must not match an existing collection id.");
    }

    if (this.#original.name !== value && this.#app.IsCollectionNameUnique(value) && this.#app.HasTable(value)) {
      return newError("validation_collection_name_invalid", "The name shouldn't match with an existing internal table.");
    }

    return null;
  }

  private ensureNoSystemNameChange(value: string): Error | null {
    if (!this.#original.IsNew() && this.#original.system && value !== this.#original.name) {
      return newError("validation_collection_system_name_change", "System collection name cannot be changed.");
    }

    return null;
  }

  private ensureNoSystemFlagChange(value: unknown): Error | null {
    if (typeof value !== "boolean") {
      return ErrUnsupportedValueType;
    }

    if (!this.#original.IsNew() && value !== this.#original.system) {
      return newError("validation_collection_system_flag_change", "System collection state cannot be changed.");
    }

    return null;
  }

  private ensureNoTypeChange(value: string): Error | null {
    if (!this.#original.IsNew() && value !== this.#original.type) {
      return newError("validation_collection_type_change", "Collection type cannot be changed.");
    }

    return null;
  }

  private ensureNoFieldsTypeChange(value: FieldsList): Error | null {
    const errs: Record<string, Error> = {};

    for (let i = 0; i < value.length; i += 1) {
      const field = value[i];
      if (!field) {
        continue;
      }
      const oldField = this.#original.Fields.GetById(field.GetId());
      if (oldField && oldField.Type() !== field.Type()) {
        errs[String(i)] = newError("validation_field_type_change", "Field type cannot be changed.");
      }
    }

    return Object.keys(errs).length > 0 ? new ValidationErrors(errs) : null;
  }

  private checkFieldDuplicates(value: FieldsList): Error | null {
    const ids: string[] = [];
    const names: string[] = [];

    for (let i = 0; i < value.length; i += 1) {
      const field = value[i];
      if (!field) {
        continue;
      }

      if (existInSlice(field.GetId(), ids)) {
        return new ValidationErrors({
          [String(i)]: new ValidationErrors({
            id: newError("validation_duplicated_field_id", `Duplicated or invalid field id ${JSON.stringify(field.GetId())}`),
          }),
        });
      }

      const nameLower = field.GetName().toLowerCase();
      if (existInSlice(nameLower, names)) {
        return new ValidationErrors({
          [String(i)]: new ValidationErrors({
            name: newError("validation_duplicated_field_name", "Duplicated or invalid field name {{.fieldName}}").setParams({
              fieldName: field.GetName(),
            }),
          }),
        });
      }

      ids.push(field.GetId());
      names.push(nameLower);
    }

    return null;
  }

  private checkFieldValidators(value: FieldsList): Error | null {
    const errs: Record<string, Error> = {};
    for (let i = 0; i < value.length; i += 1) {
      const field = value[i];
      if (!field) {
        continue;
      }
      const err = field.ValidateSettings(this.#ctx, this.#app, this.#next);
      if (err) {
        errs[String(i)] = err;
      }
    }

    return Object.keys(errs).length > 0 ? new ValidationErrors(errs) : null;
  }

  private async checkViewQuery(value: string): Promise<Error | null> {
    if (value === "") {
      return null;
    }

    try {
      await this.#app.DryRunView(value, 10);
    } catch (error) {
      let message = error instanceof Error ? error.message : String(error);
      if (message.length > 500) {
        message = message.slice(0, 500);
      }
      return newError("validation_invalid_view_query", `Invalid query - ${message}`);
    }

    return null;
  }

  private checkViewQuerySync(value: string): Error | null {
    if (value === "") {
      return null;
    }

    try {
      // Sync validation still relies on the schema inference helper because
      // PocketBun only exposes DryRunView as an async API.
      this.#app.CreateViewFieldsSync(value);
    } catch (error) {
      let message = error instanceof Error ? error.message : String(error);
      if (message.length > 500) {
        message = message.slice(0, 500);
      }
      return newError("validation_invalid_view_query", `Invalid query - ${message}`);
    }

    return null;
  }

  private checkReservedAuthKeys(value: FieldsList): Error | null {
    if (!this.#next.IsAuth()) {
      return null;
    }

    const errs: Record<string, Error> = {};
    for (let i = 0; i < value.length; i += 1) {
      const field = value[i];
      if (!field) {
        continue;
      }
      if (existInSlice(field.GetName(), reservedAuthKeys)) {
        errs[String(i)] = new ValidationErrors({
          name: newError("validation_reserved_field_name", "The field name is reserved and cannot be used."),
        });
      }
    }

    return Object.keys(errs).length > 0 ? new ValidationErrors(errs) : null;
  }

  private checkMinFields(value: FieldsList): Error | null {
    if (value.length === 0) {
      return ErrRequired;
    }

    const idField = value.GetByName(FieldNameId);
    if (!(idField instanceof TextField) || !idField.PrimaryKey) {
      return newError("validation_missing_primary_key", 'Missing or invalid "id" PK field.');
    }

    if (!this.#next.IsAuth()) {
      return null;
    }

    const passwordField = value.GetByName(FieldNamePassword);
    if (!(passwordField instanceof PasswordField)) {
      return newError("validation_missing_password_field", 'System "password" field is required.');
    }
    if (!passwordField.Hidden || !passwordField.System) {
      return new ValidationErrors({ [FieldNamePassword]: ErrMustBeSystemAndHidden });
    }

    const tokenKeyField = value.GetByName(FieldNameTokenKey);
    if (!(tokenKeyField instanceof TextField)) {
      return newError("validation_missing_tokenKey_field", 'System "tokenKey" field is required.');
    }
    if (!tokenKeyField.Hidden || !tokenKeyField.System) {
      return new ValidationErrors({ [FieldNameTokenKey]: ErrMustBeSystemAndHidden });
    }

    const emailField = value.GetByName(FieldNameEmail);
    if (!(emailField instanceof EmailField)) {
      return newError("validation_missing_email_field", 'System "email" field is required.');
    }
    if (!emailField.System) {
      return new ValidationErrors({ [FieldNameEmail]: ErrMustBeSystem });
    }

    const visibilityField = value.GetByName(FieldNameEmailVisibility);
    if (!(visibilityField instanceof BoolField)) {
      return newError("validation_missing_emailVisibility_field", 'System "emailVisibility" field is required.');
    }
    if (!visibilityField.System) {
      return new ValidationErrors({ [FieldNameEmailVisibility]: ErrMustBeSystem });
    }

    const verifiedField = value.GetByName(FieldNameVerified);
    if (!(verifiedField instanceof BoolField)) {
      return newError("validation_missing_verified_field", 'System "verified" field is required.');
    }
    if (!verifiedField.System) {
      return new ValidationErrors({ [FieldNameVerified]: ErrMustBeSystem });
    }

    return null;
  }

  private ensureNoSystemFieldsChange(value: FieldsList): Error | null {
    if (this.#original.IsNew()) {
      return null;
    }

    for (const oldField of this.#original.Fields) {
      if (!oldField.GetSystem()) {
        continue;
      }

      const newField = value.GetById(oldField.GetId());
      if (!newField || newField.GetName() !== oldField.GetName()) {
        return newError("validation_system_field_change", "System fields cannot be deleted or renamed.");
      }
    }

    return null;
  }

  private checkFieldsForUniqueIndex(names: string[]): Error | null {
    if (names.length === 0) {
      return null;
    }

    for (const name of names) {
      const field = this.#next.Fields.GetByName(name);
      if (!field) {
        return newError("validation_missing_field", "Invalid or missing field {{.fieldName}}").setParams({
          fieldName: name,
        });
      }

      const [, ok] = findSingleColumnUniqueIndex(this.#next.indexes ?? [], name);
      if (!ok) {
        return newError(
          "validation_missing_unique_constraint",
          "The field {{.fieldName}} doesn't have a UNIQUE constraint.",
        ).setParams({ fieldName: name });
      }
    }

    return null;
  }

  private checkRule(value: unknown): Error | null {
    let rule = "";

    if (typeof value === "string") {
      rule = value;
    } else if (value == null) {
      rule = "";
    } else {
      return ErrUnsupportedValueType;
    }

    if (rule === "") {
      return null;
    }

    const requestInfo: RequestInfo = {
      query: {},
      headers: {},
      body: {},
      auth: null,
      method: "",
      context: "",
    };

    const resolver = new RecordFieldResolver(this.#app, this.#next, requestInfo, true);

    try {
      buildFilterExpr(rule, resolver, DefaultFilterExprLimit);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return newError("validation_invalid_rule", `Invalid rule. Raw error: ${message}`);
    }

    return null;
  }

  private ensureNoSystemRuleChange(oldRule: string | null): (value: string | null) => Error | null {
    return (value: string | null): Error | null => {
      if (this.#original.IsNew() || !this.#original.system) {
        return null;
      }

      if ((value == null && oldRule == null) || (value != null && oldRule != null && value === oldRule)) {
        return null;
      }

      return newError("validation_collection_system_rule_change", "System collection API rule cannot be changed.");
    };
  }

  private checkIndexes(indexes: string[]): Error | null {
    if (this.#next.IsView() && indexes.length > 0) {
      return newError("validation_indexes_not_supported", "View collections don't support indexes.");
    }

    const duplicatedNames = new Map<string, true>();
    const duplicatedDefinitions = new Map<string, true>();

    for (let i = 0; i < indexes.length; i += 1) {
      const rawIndex = indexes[i] ?? "";
      const parsed = parseIndex(rawIndex);
      parsed.tableName = "validator";

      if (!parsed.isValid()) {
        return new ValidationErrors({
          [String(i)]: newError("validation_invalid_index_expression", "Invalid CREATE INDEX expression."),
        });
      }

      const nameKey = parsed.indexName.toLowerCase();
      if (duplicatedNames.has(nameKey)) {
        return new ValidationErrors({
          [String(i)]: newError("validation_duplicated_index_name", "The index name already exists."),
        });
      }
      duplicatedNames.set(nameKey, true);

      const row = this.#app
        .db()
        .query(
          "select tbl_name from sqlite_master where type = 'index' and lower(tbl_name) != lower(?) and lower(tbl_name) != lower(?) and lower(name) = lower(?) limit 1",
        )
        .get(this.#original.name, this.#next.name, parsed.indexName) as { tbl_name?: string } | undefined;
      if (row?.tbl_name) {
        return new ValidationErrors({
          [String(i)]: newError(
            "validation_existing_index_name",
            "The index name is already used in {{.usedTableName}} collection.",
          ).setParams({ usedTableName: row.tbl_name }),
        });
      }

      parsed.schemaName = "validator";
      parsed.indexName = "validator";
      const parsedDef = parsed.build();
      if (duplicatedDefinitions.has(parsedDef)) {
        return new ValidationErrors({
          [String(i)]: newError("validation_duplicated_index_definition", "The index definition already exists."),
        });
      }
      duplicatedDefinitions.set(parsedDef, true);
    }

    if (!this.#original.IsNew()) {
      oldIndexes: for (const oldIndex of this.#original.indexes ?? []) {
        const oldParsed = parseIndex(oldIndex);
        if (!oldParsed.unique) {
          continue;
        }

        for (const col of oldParsed.columns) {
          col.collate = "";
          col.sort = "";
        }

        const oldParsedStr = oldParsed.build();

        for (const column of oldParsed.columns) {
          for (const field of this.#original.Fields) {
            if (!field.GetSystem() || column.name.toLowerCase() !== field.GetName().toLowerCase()) {
              continue;
            }

            let hasMatch = false;
            for (const newIndex of this.#next.indexes ?? []) {
              const newParsed = parseIndex(newIndex);
              newParsed.schemaName = oldParsed.schemaName;
              newParsed.indexName = oldParsed.indexName;
              newParsed.tableName = oldParsed.tableName;
              newParsed.where = oldParsed.where;
              for (const newCol of newParsed.columns) {
                newCol.collate = "";
                newCol.sort = "";
              }

              if (oldParsedStr === newParsed.build()) {
                hasMatch = true;
                break;
              }
            }

            if (!hasMatch) {
              return newError(
                "validation_invalid_unique_system_field_index",
                "Unique index definition on system fields ({{.fieldName}}) is invalid or missing.",
              ).setParams({ fieldName: field.GetName() });
            }

            continue oldIndexes;
          }
        }
      }
    }

    if (this.#next.IsAuth()) {
      const requiredNames = [FieldNameTokenKey, FieldNameEmail];
      for (const name of requiredNames) {
        const [, ok] = findSingleColumnUniqueIndex(indexes, name);
        if (!ok) {
          return newError(
            "validation_missing_required_unique_index",
            'Missing required unique index for field "{{.fieldName}}".',
          ).setParams({ fieldName: name });
        }
      }
    }

    return null;
  }
}
