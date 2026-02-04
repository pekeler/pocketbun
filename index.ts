// PocketBun-only: package entrypoint that re-exports the public API.

export { buildServeHandler, serve, type ServeConfig } from "./src/apis/serve.ts";
export { superuser, superuserCreate, superuserDelete, superuserOTP, superuserUpdate, superuserUpsert } from "./src/cmd/superuser.ts";
export { type SuperuserOtpResult } from "./src/cmd/superuser.ts";
export { BaseApp, type BaseAppConfig } from "./src/core/base.ts";
export { type App } from "./src/core/app.ts";
export { migrate, type MigrateMode } from "./src/core/migrate.ts";
export { New, NewWithConfig, PocketBase, type PocketBaseConfig, Version } from "./src/pocketbase.ts";
export { DbxDatabase, attachDbxRewrite, rewriteDbxIdentifiers } from "./src/tools/dbx/index.ts";
