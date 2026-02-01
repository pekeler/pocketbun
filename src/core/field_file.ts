// Ported from pocketbase/core/field_file.go

import type { App } from "./app.ts";
import type { Collection } from "./collection.ts";
import type { Record as RecordModel } from "./record.ts";
import { toStringValue } from "../internal/compat/cast.ts";
import { newError, ValidationErrors, ErrRequired } from "../internal/compat/validation.ts";
import { File } from "../tools/filesystem/file.ts";
import { NotFoundError, ThumbSizeRegex } from "../tools/filesystem/filesystem.ts";
import { toInterfaceSlice, toUniqueStringSlice } from "../tools/list/list.ts";
import { JSONArray } from "../tools/types/json_array.ts";
import {
  Fields,
  type DriverValuer,
  type Field,
  type GetterFinder,
  type GetterFunc,
  type MaxBodySizeCalculator,
  type MultiValuer,
  type RecordInterceptor,
  type RecordLike,
  type SetterFinder,
  type SetterFunc,
  defaultFieldIdValidationRule,
  defaultFieldNameValidationRule,
  maxSafeJSONInt,
  InterceptorActionAfterCreate,
  InterceptorActionAfterCreateError,
  InterceptorActionAfterUpdate,
  InterceptorActionAfterUpdateError,
  InterceptorActionCreateExecute,
  InterceptorActionUpdateExecute,
} from "./field.ts";
import { internalCustomFieldKeyPrefix } from "./record.ts";
import { UploadedFileMimeType, UploadedFileSize } from "./validators/file.ts";

export const FieldTypeFile = "file";
export const DefaultFileFieldMaxSize = 5 << 20;

const looseFilenameRegex = /^[^./\\][^/\\]+$/;

const deletedFilesPrefix = `${internalCustomFieldKeyPrefix}_deletedFilesPrefix_`;
const uploadedFilesPrefix = `${internalCustomFieldKeyPrefix}_uploadedFilesPrefix_`;

// FileField defines "file" type field for managing record file(s).
//
// Only the file name is stored as part of the record value.
// New files (aka. files to upload) are expected to be of *filesytem.File.
//
// If MaxSelect is not set or <= 1, then the field value is expected to be a single record id.
//
// If MaxSelect is > 1, then the field value is expected to be a slice of record ids.
//
// The respective zero record field value is either empty string (single) or empty string slice (multiple).
//
// ---
//
// The following additional setter keys are available:
//
//   - "fieldName+" - append one or more files to the existing record one. For example:
//
//     // []string{"old1.txt", "old2.txt", "new1_ajkvass.txt", "new2_klhfnwd.txt"}
//     record.Set("documents+", []*filesystem.File{new1, new2})
//
//   - "+fieldName" - prepend one or more files to the existing record one. For example:
//
//     // []string{"new1_ajkvass.txt", "new2_klhfnwd.txt", "old1.txt", "old2.txt",}
//     record.Set("+documents", []*filesystem.File{new1, new2})
//
//   - "fieldName-" - subtract/delete one or more files from the existing record one. For example:
//
//     // []string{"old2.txt",}
//     record.Set("documents-", "old1.txt")
export class FileField
  implements Field, MultiValuer, DriverValuer, GetterFinder, SetterFinder, RecordInterceptor, MaxBodySizeCalculator
{
  Name = "";
  Id = "";
  System = false;
  Hidden = false;
  Presentable = false;
  MaxSize = 0;
  MaxSelect = 0;
  MimeTypes: string[] = [];
  Thumbs: string[] = [];
  Protected = false;
  Required = false;

  // Type implements [Field.Type] interface method.
  Type(): string {
    return FieldTypeFile;
  }

  // GetId implements [Field.GetId] interface method.
  GetId(): string {
    return this.Id;
  }

  // SetId implements [Field.SetId] interface method.
  SetId(id: string): void {
    this.Id = id;
  }

  // GetName implements [Field.GetName] interface method.
  GetName(): string {
    return this.Name;
  }

  // SetName implements [Field.SetName] interface method.
  SetName(name: string): void {
    this.Name = name;
  }

  // GetSystem implements [Field.GetSystem] interface method.
  GetSystem(): boolean {
    return this.System;
  }

  // SetSystem implements [Field.SetSystem] interface method.
  SetSystem(system: boolean): void {
    this.System = system;
  }

  // GetHidden implements [Field.GetHidden] interface method.
  GetHidden(): boolean {
    return this.Hidden;
  }

  // SetHidden implements [Field.SetHidden] interface method.
  SetHidden(hidden: boolean): void {
    this.Hidden = hidden;
  }

  // IsMultiple implements MultiValuer interface and checks whether the
  // current field options support multiple values.
  IsMultiple(): boolean {
    return this.MaxSelect > 1;
  }

  // ColumnType implements [Field.ColumnType] interface method.
  ColumnType(_app: App): string {
    if (this.IsMultiple()) {
      return "JSON DEFAULT '[]' NOT NULL";
    }
    return "TEXT DEFAULT '' NOT NULL";
  }

  // PrepareValue implements [Field.PrepareValue] interface method.
  PrepareValue(_record: RecordLike, raw: unknown): unknown {
    return this.normalizeValue(raw);
  }

  // DriverValue implements the [DriverValuer] interface.
  DriverValue(record: RecordLike): [unknown, Error | null] {
    const files = this.toSliceValue(record.GetRaw(this.Name));

    if (this.IsMultiple()) {
      const ja = new JSONArray<string>();
      for (const value of files) {
        ja.push(this.getFileName(value));
      }
      return [ja, null];
    }

    if (files.length === 0) {
      return ["", null];
    }

    return [this.getFileName(files[files.length - 1]), null];
  }

  // ValidateSettings implements [Field.ValidateSettings] interface method.
  ValidateSettings(_ctx: unknown, _app: App, _collection: Collection): Error | null {
    const errors: Record<string, Error> = {};
    const idErr = defaultFieldIdValidationRule(this.Id);
    if (idErr) {
      errors.id = idErr;
    }
    const nameErr = defaultFieldNameValidationRule(this.Name);
    if (nameErr) {
      errors.name = nameErr;
    }
    if (this.MaxSelect < 0 || this.MaxSelect > maxSafeJSONInt) {
      errors.maxSelect = newError("validation_invalid_max", "Invalid maxSelect value.");
    }
    if (this.MaxSize < 0 || this.MaxSize > maxSafeJSONInt) {
      errors.maxSize = newError("validation_invalid_max", "Invalid maxSize value.");
    }
    const thumbs = Array.isArray(this.Thumbs) ? this.Thumbs : [];
    this.Thumbs = thumbs;
    if (thumbs.length > 0) {
      for (const thumb of thumbs) {
        if (thumb === "0x0" || thumb === "0x0t" || thumb === "0x0b" || thumb === "0x0f") {
          errors.thumbs = newError("validation_invalid_thumb", "Invalid thumb size.");
          break;
        }
        if (!ThumbSizeRegex.test(thumb)) {
          errors.thumbs = newError("validation_invalid_thumb", "Invalid thumb size.");
          break;
        }
      }
    }

    return Object.keys(errors).length > 0 ? new ValidationErrors(errors) : null;
  }

  // ValidateValue implements [Field.ValidateValue] interface method.
  ValidateValue(_ctx: unknown, app: App, record: RecordLike): Error | null {
    const files = this.toSliceValue(record.GetRaw(this.Name));
    if (files.length === 0) {
      if (this.Required) {
        return ErrRequired;
      }
      return null;
    }

    const oldExistingStrings = this.toSliceValue(this.getLatestOldValue(app, record));
    const existingStrings = toInterfaceSlice(this.extractPlainStrings(files));
    const addedStrings = this.excludeFiles(existingStrings, oldExistingStrings);

    if (addedStrings.length > 0) {
      const invalidFiles = addedStrings.map((value) => {
        let invalid = toStringValue(value);
        if (invalid.length > 250) {
          invalid = invalid.slice(0, 250);
        }
        return invalid;
      });

      return newError("validation_invalid_file", "Invalid new files: {{.invalidFiles}}.").setParams({
        invalidFiles,
      });
    }

    const maxSelect = this.effectiveMaxSelect();
    if (files.length > maxSelect) {
      return newError("validation_too_many_files", "The maximum allowed files is {{.maxSelect}}").setParams({
        maxSelect,
      });
    }

    const uploads = this.extractUploadableFiles(files);
    for (const upload of uploads) {
      if (upload.Name.length < 1 || upload.Name.length > 150) {
        return newError("validation_invalid_file", "Invalid file name.");
      }
      if (!looseFilenameRegex.test(upload.Name)) {
        return newError("validation_invalid_file", "Invalid file name.");
      }

      const sizeErr = UploadedFileSize(this.effectiveMaxSize())(upload);
      if (sizeErr) {
        return sizeErr;
      }

      const mimeTypes = Array.isArray(this.MimeTypes) ? this.MimeTypes : [];
      if (mimeTypes.length > 0) {
        const mimeErr = UploadedFileMimeType(mimeTypes)(upload);
        if (mimeErr) {
          return mimeErr;
        }
      }
    }

    return null;
  }

  // CalculateMaxBodySize implements the [MaxBodySizeCalculator] interface.
  CalculateMaxBodySize(): number {
    return this.effectiveMaxSize() * this.effectiveMaxSelect();
  }

  // Intercept implements the [RecordInterceptor] interface.
  //
  // note: files delete after records deletion is handled globally by the app FileManager hook
  Intercept(ctx: unknown, app: App, record: RecordLike, actionName: string, actionFunc: () => Error | null): Error | null {
    switch (actionName) {
      case InterceptorActionCreateExecute:
      case InterceptorActionUpdateExecute: {
        const oldValue = this.getLatestOldValue(app, record);

        const uploadErr = this.processFilesToUpload(ctx, app, record);
        if (uploadErr) {
          return uploadErr;
        }

        const execErr = actionFunc();
        if (execErr) {
          const cleanupErr = this.afterRecordExecuteFailure(ctx, app, record);
          if (cleanupErr) {
            return new Error(`${execErr.message}; ${cleanupErr.message}`);
          }
          return execErr;
        }

        this.rememberFilesToDelete(record, oldValue);
        this.afterRecordExecuteSuccess(app, record);
        return null;
      }
      case InterceptorActionAfterCreateError:
      case InterceptorActionAfterUpdateError: {
        if (app.IsTransactional()) {
          return actionFunc();
        }

        const [failedToDelete, deleteErr] = this.deleteNewlyUploadedFiles(ctx, app, record);
        if (deleteErr) {
          app
            .Logger()
            .Warn(
              "Failed to cleanup all new files after record commit failure",
              "error",
              deleteErr,
              "failedToDelete",
              failedToDelete,
            );
        }

        record.SetRaw(`${deletedFilesPrefix}${this.Name}`, null);

        if (record.IsNew()) {
          const err = this.deleteEmptyRecordDir(ctx, app, record);
          if (err) {
            app.Logger().Warn("Failed to delete empty dir after new record commit failure", "error", err);
          }
        }

        return actionFunc();
      }
      case InterceptorActionAfterCreate:
      case InterceptorActionAfterUpdate: {
        record.SetRaw(`${uploadedFilesPrefix}${this.Name}`, null);

        const err = this.processFilesToDelete(ctx, app, record);
        if (err) {
          return err;
        }

        return actionFunc();
      }
      default:
        return actionFunc();
    }
  }

  // FindGetter implements the [GetterFinder] interface.
  FindGetter(key: string): GetterFunc | null {
    switch (key) {
      case this.Name:
        return (record) => record.GetRaw(this.Name);
      case `${this.Name}:unsaved`:
        return (record) => this.extractUploadableFiles(this.toSliceValue(record.GetRaw(this.Name)));
      case `${this.Name}:uploaded`:
        console.warn("[file field getter] please replace :uploaded with :unsaved");
        return (record) => this.extractUploadableFiles(this.toSliceValue(record.GetRaw(this.Name)));
      default:
        return null;
    }
  }

  // FindSetter implements the [SetterFinder] interface.
  FindSetter(key: string): SetterFunc | null {
    switch (key) {
      case this.Name:
        return (record, raw) => this.setValue(record, raw);
      case `+${this.Name}`:
        return (record, raw) => this.prependValue(record, raw);
      case `${this.Name}+`:
        return (record, raw) => this.appendValue(record, raw);
      case `${this.Name}-`:
        return (record, raw) => this.subtractValue(record, raw);
      default:
        return null;
    }
  }

  private setValue(record: RecordLike, raw: unknown) {
    record.SetRaw(this.Name, this.normalizeValue(raw));
  }

  private prependValue(record: RecordLike, toPrepend: unknown) {
    const files = this.toSliceValue(record.GetRaw(this.Name));
    const prepends = this.toSliceValue(toPrepend);

    if (prepends.length > 0) {
      files.unshift(...prepends);
    }

    this.setValue(record, files);
  }

  private appendValue(record: RecordLike, toAppend: unknown) {
    const files = this.toSliceValue(record.GetRaw(this.Name));
    const appends = this.toSliceValue(toAppend);

    if (appends.length > 0) {
      files.push(...appends);
    }

    this.setValue(record, files);
  }

  private subtractValue(record: RecordLike, toRemove: unknown) {
    const files = this.excludeFiles(this.toSliceValue(record.GetRaw(this.Name)), this.toSliceValue(toRemove));
    this.setValue(record, files);
  }

  private normalizeValue(raw: unknown): unknown {
    const files = this.toSliceValue(raw);

    if (this.IsMultiple()) {
      return files;
    }

    if (files.length > 0) {
      return files[files.length - 1];
    }

    return "";
  }

  private toSliceValue(raw: unknown): unknown[] {
    const result: unknown[] = [];

    if (raw == null) {
      return result;
    }

    if (raw instanceof File) {
      result.push(raw);
      return result;
    }

    if (Array.isArray(raw)) {
      for (const value of raw) {
        const nested = this.toSliceValue(value);
        if (nested.length === 1) {
          result.push(nested[0]);
        }
      }
      return this.uniqueFiles(result);
    }

    const strings = toUniqueStringSlice(raw);
    return toInterfaceSlice(strings);
  }

  private uniqueFiles(files: unknown[]): unknown[] {
    const found = new Set<string>();
    const result: unknown[] = [];
    for (const entry of files) {
      const name = this.getFileName(entry);
      if (found.has(name)) {
        continue;
      }
      found.add(name);
      result.push(entry);
    }
    return result;
  }

  private extractPlainStrings(files: unknown[]): string[] {
    return files.filter((value) => typeof value === "string") as string[];
  }

  private extractUploadableFiles(files: unknown[]): File[] {
    return files.filter((value) => value instanceof File) as File[];
  }

  private excludeFiles(base: unknown[], toExclude: unknown[]): unknown[] {
    const result: unknown[] = [];
    outer: for (const value of base) {
      for (const exclude of toExclude) {
        if (this.getFileName(exclude) === this.getFileName(value)) {
          continue outer;
        }
      }
      result.push(value);
    }
    return result;
  }

  private getFileName(file: unknown): string {
    if (typeof file === "string") {
      return file;
    }
    if (file instanceof File) {
      return file.Name;
    }
    return "";
  }

  private effectiveMaxSize(): number {
    return this.MaxSize > 0 ? this.MaxSize : DefaultFileFieldMaxSize;
  }

  private effectiveMaxSelect(): number {
    return this.MaxSelect > 1 ? this.MaxSelect : 1;
  }

  private getLatestOldValue(app: App, record: RecordLike): unknown {
    const recordModel = record as unknown as RecordModel;
    if (!record.IsNew()) {
      const latest = app.findRecordById(recordModel.collection(), record.LastSavedPK());
      if (latest) {
        return latest.GetRaw(this.Name);
      }
    }
    const original = record.Original?.();
    if (original) {
      return original.GetRaw(this.Name);
    }
    return record.GetRaw(this.Name);
  }

  private afterRecordExecuteSuccess(app: App, record: RecordLike) {
    const uploaded = (record.GetRaw(`${uploadedFilesPrefix}${this.Name}`) as File[]) ?? [];

    const newValue = this.toSliceValue(record.GetRaw(this.Name));
    for (let i = 0; i < newValue.length; i += 1) {
      const value = newValue[i];
      if (value instanceof File) {
        uploaded.push(value);
        newValue[i] = value.Name;
      }
    }
    this.setValue(record, newValue);
    record.SetRaw(`${uploadedFilesPrefix}${this.Name}`, uploaded);
  }

  private afterRecordExecuteFailure(ctx: unknown, app: App, record: RecordLike): Error | null {
    const uploaded = this.extractUploadableFiles(this.toSliceValue(record.GetRaw(this.Name)));
    const toDelete = uploaded.map((file) => file.Name);
    const [failedToDelete, err] = this.deleteFilesByNamesList(ctx, app, record, Array.from(new Set(toDelete)));

    if (failedToDelete.length > 0) {
      app
        .Logger()
        .Warn(
          "Failed to cleanup the new uploaded file after record db write failure",
          "error",
          err,
          "failedToDelete",
          failedToDelete,
        );
    }

    return err;
  }

  private deleteEmptyRecordDir(ctx: unknown, app: App, record: RecordLike): Error | null {
    const fsys = app.NewFilesystem();
    fsys.SetContext(ctx);

    const dir = (record as unknown as RecordModel).BaseFilesPath();
    if (!fsys.IsEmptyDir(dir)) {
      return null;
    }

    try {
      fsys.Delete(dir);
      return null;
    } catch (error) {
      if (error instanceof NotFoundError) {
        return null;
      }
      return error as Error;
    }
  }

  private processFilesToDelete(ctx: unknown, app: App, record: RecordLike): Error | null {
    const markedForDelete = (record.GetRaw(`${deletedFilesPrefix}${this.Name}`) as string[]) ?? [];
    if (markedForDelete.length === 0) {
      return null;
    }

    const old = toInterfaceSlice(markedForDelete);
    const current = toInterfaceSlice(this.extractPlainStrings(this.toSliceValue(record.GetRaw(this.Name))));
    const diff = this.excludeFiles(old, current);

    const toDelete = diff.map((value) => this.getFileName(value));
    const [failedToDelete, err] = this.deleteFilesByNamesList(ctx, app, record, Array.from(new Set(toDelete)));

    record.SetRaw(`${deletedFilesPrefix}${this.Name}`, failedToDelete);
    return err;
  }

  private rememberFilesToDelete(record: RecordLike, oldValue: unknown) {
    const old = toInterfaceSlice(this.extractPlainStrings(this.toSliceValue(oldValue)));
    const current = toInterfaceSlice(this.extractPlainStrings(this.toSliceValue(record.GetRaw(this.Name))));
    const diff = this.excludeFiles(old, current);

    const toDelete = (record.GetRaw(`${deletedFilesPrefix}${this.Name}`) as string[]) ?? [];
    for (const value of diff) {
      toDelete.push(this.getFileName(value));
    }

    record.SetRaw(`${deletedFilesPrefix}${this.Name}`, toDelete);
  }

  private processFilesToUpload(ctx: unknown, app: App, record: RecordLike): Error | null {
    const uploads = this.extractUploadableFiles(this.toSliceValue(record.GetRaw(this.Name)));
    if (uploads.length === 0) {
      return null;
    }

    const recordModel = record as unknown as RecordModel;
    if (!recordModel.Id) {
      return new Error("uploading files requires the record to have a valid nonempty id");
    }

    const fsys = app.NewFilesystem();
    fsys.SetContext(ctx);

    const succeeded: string[] = [];
    for (const upload of uploads) {
      try {
        const path = `${recordModel.BaseFilesPath()}/${upload.Name}`;
        fsys.UploadFile(upload, path);
        succeeded.push(upload.Name);
      } catch (error) {
        void this.deleteFilesByNamesList(ctx, app, record, succeeded);
        return new Error(`failed to upload all files: ${(error as Error).message}`);
      }
    }

    return null;
  }

  private deleteNewlyUploadedFiles(ctx: unknown, app: App, record: RecordLike): [string[], Error | null] {
    const uploaded = (record.GetRaw(`${uploadedFilesPrefix}${this.Name}`) as File[]) ?? [];
    if (uploaded.length === 0) {
      return [[], null];
    }

    const names = uploaded.map((file) => file.Name);
    const [failed, err] = this.deleteFilesByNamesList(ctx, app, record, Array.from(new Set(names)));
    if (!err) {
      record.SetRaw(`${uploadedFilesPrefix}${this.Name}`, null);
    }

    return [failed, err];
  }

  // deleteFiles deletes a list of record files by their names.
  // Returns the failed/remaining files.
  private deleteFilesByNamesList(ctx: unknown, app: App, record: RecordLike, filenames: string[]): [string[], Error | null] {
    if (filenames.length === 0) {
      return [[], null];
    }

    const recordModel = record as unknown as RecordModel;
    if (!recordModel.Id) {
      return [filenames, new Error("the record doesn't have an id")];
    }

    const fsys = app.NewFilesystem();
    fsys.SetContext(ctx);

    const failures: Error[] = [];
    for (let i = filenames.length - 1; i >= 0; i -= 1) {
      const filename = filenames[i];
      if (!filename || /[\\/]/.test(filename)) {
        continue;
      }
      const path = `${recordModel.BaseFilesPath()}/${filename}`;
      try {
        fsys.Delete(path);
        filenames.splice(i, 1);

        const thumbsErrors = fsys.DeletePrefix(`${recordModel.BaseFilesPath()}/thumbs_${filename}/`);
        if (thumbsErrors.length > 0) {
          app.Logger().Warn("Failed to delete file thumbs", "error", thumbsErrors);
        }
      } catch (error) {
        if (error instanceof NotFoundError) {
          filenames.splice(i, 1);
        } else {
          failures.push(new Error(`file ${i} (${filename}): ${(error as Error).message}`));
        }
      }
    }

    if (failures.length > 0) {
      return [filenames, new Error(`failed to delete all files: ${failures.map((f) => f.message).join("; ")}`)];
    }

    return [filenames, null];
  }
}

Fields[FieldTypeFile] = () => new FileField();
