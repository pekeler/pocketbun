// PocketBun-only: minimal in-memory store until the upstream store package is ported.

// PocketBun-only: re-export the upstream store and keep core-level constants in one place.

export { Store } from "../tools/store/store.ts";

// Matches pocketbase/core/base_backup.go
export const StoreKeyActiveBackup = "@activeBackup";
