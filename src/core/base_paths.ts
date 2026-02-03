// PocketBun-only: shared base path constants extracted to avoid circular imports after splitting base_backup.

export const LocalStorageDirName = "storage";
export const LocalBackupsDirName = "backups";
export const LocalTempDirName = ".pb_temp_to_delete"; // temp pb_data sub directory that will be deleted on each app.Bootstrap()
export const LocalAutocertCacheDirName = ".autocert_cache";
