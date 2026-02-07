// PocketBun-only: package entrypoint that re-exports the public API.

export { buildServeHandler, serve, type ServeConfig } from "./src/apis/serve.ts";
export { Static, StaticWildcardParam } from "./src/apis/base.ts";
export { superuser, superuserCreate, superuserDelete, superuserOTP, superuserUpdate, superuserUpsert } from "./src/cmd/superuser.ts";
export { type SuperuserOtpResult } from "./src/cmd/superuser.ts";
export { BaseApp, type BaseAppConfig } from "./src/core/base.ts";
export { type App } from "./src/core/app.ts";
export { type ServeEvent } from "./src/core/events.ts";
export { migrate, type MigrateMode } from "./src/core/migrate.ts";
export { New, NewWithConfig, PocketBase, type PocketBaseConfig, Version } from "./src/pocketbase.ts";
export { Register as RegisterJSVM, MustRegister as MustRegisterJSVM, type Config as JSVMConfig } from "./src/plugins/jsvm/jsvm.ts";
export {
  Register as RegisterMigrateCmd,
  MustRegister as MustRegisterMigrateCmd,
  TemplateLangGo,
  TemplateLangJS,
  type Config as MigrateCmdConfig,
} from "./src/plugins/migratecmd/migratecmd.ts";
export { Create, CreateAsync, Extract, ExtractAsync } from "./src/tools/archive/index.ts";
export { DbxDatabase, attachDbxRewrite, rewriteDbxIdentifiers } from "./src/tools/dbx/index.ts";
