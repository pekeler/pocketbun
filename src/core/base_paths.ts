// PocketBun-only: shared base path constants extracted to avoid circular imports after splitting base_backup.

export const LocalStorageDirName = "storage";
export const LocalBackupsDirName = "backups";
// optional watched directory that is used as a cross-platform workaround for synchronizing
// various runtime states between multiple PocketBase instances pointing to the same pb_data
export const LocalNotifyDirName = ".notify";
export const LocalTempDirName = ".pb_temp_to_delete"; // temp pb_data sub directory that will be deleted on each app.Bootstrap()
export const LocalAutocertCacheDirName = ".autocert_cache";
