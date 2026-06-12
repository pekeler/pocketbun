// PocketBun-only: package entrypoint that re-exports the public API.

import {
  Register as RegisterServerJS,
  MustRegister as MustRegisterServerJS,
  RegisterAsync as RegisterServerJSAsync,
  MustRegisterAsync as MustRegisterServerJSAsync,
  type Config as ServerJSConfig,
} from "./src/plugins/jsvm/jsvm.ts";

export { buildServeHandler, serve, serveAsync, type ServeConfig } from "./src/apis/serve.ts";
export { Static, StaticWildcardParam } from "./src/apis/base.ts";
export {
  RequireGuestOnly,
  RequireAuth,
  RequireSuperuserAuth,
  RequireSuperuserOrOwnerAuth,
  RequireSameCollectionContextAuth,
  SkipSuccessActivityLog,
} from "./src/apis/middlewares.ts";
export { superuser, superuserCreate, superuserDelete, superuserOTP, superuserUpdate, superuserUpsert } from "./src/cmd/superuser.ts";
export { type SuperuserOtpResult } from "./src/cmd/superuser.ts";
export { BaseApp, type BaseAppConfig } from "./src/core/base.ts";
export { type App } from "./src/core/app.ts";
export { type ServeEvent } from "./src/core/events.ts";
export { migrate, migrateAsync, type MigrateMode } from "./src/core/migrate.ts";
export { New, NewWithConfig, PocketBase, type PocketBaseConfig, Version } from "./src/pocketbase.ts";
export { RegisterServerJS, MustRegisterServerJS, RegisterServerJSAsync, MustRegisterServerJSAsync };
export type { ServerJSConfig };

/**
 * @deprecated Prefer RegisterServerJS. This alias exists because PocketBase's upstream
 * JavaScript extension package is named "jsvm".
 */
export const RegisterJSVM = RegisterServerJS;

/**
 * @deprecated Prefer MustRegisterServerJS. This alias exists because PocketBase's upstream
 * JavaScript extension package is named "jsvm".
 */
export const MustRegisterJSVM = MustRegisterServerJS;

/**
 * @deprecated Prefer RegisterServerJSAsync. This alias exists because PocketBase's upstream
 * JavaScript extension package is named "jsvm".
 */
export const RegisterJSVMAsync = RegisterServerJSAsync;

/**
 * @deprecated Prefer MustRegisterServerJSAsync. This alias exists because PocketBase's upstream
 * JavaScript extension package is named "jsvm".
 */
export const MustRegisterJSVMAsync = MustRegisterServerJSAsync;

/**
 * @deprecated Prefer ServerJSConfig. This alias exists because PocketBase's upstream JavaScript
 * extension package is named "jsvm".
 */
export type JSVMConfig = ServerJSConfig;

/**
 * @deprecated Prefer RegisterServerJS. This older PocketBun alias remains for compatibility
 * with released package versions.
 */
export const RegisterHooksPlugin = RegisterServerJS;

/**
 * @deprecated Prefer MustRegisterServerJS. This older PocketBun alias remains for compatibility
 * with released package versions.
 */
export const MustRegisterHooksPlugin = MustRegisterServerJS;

/**
 * @deprecated Prefer RegisterServerJSAsync. This older PocketBun alias remains for compatibility
 * with released package versions.
 */
export const RegisterHooksPluginAsync = RegisterServerJSAsync;

/**
 * @deprecated Prefer MustRegisterServerJSAsync. This older PocketBun alias remains for compatibility
 * with released package versions.
 */
export const MustRegisterHooksPluginAsync = MustRegisterServerJSAsync;
export {
  BindApis,
  BindCore,
  BindDbx,
  BindFilesystem,
  BindFilepath,
  BindForms,
  BindHTTP,
  BindMails,
  BindOS,
  BindSecurity,
} from "./src/plugins/jsvm/binds.ts";
export {
  Register as RegisterMigrateCmd,
  MustRegister as MustRegisterMigrateCmd,
  TemplateLangGo,
  TemplateLangJS,
  type Config as MigrateCmdConfig,
} from "./src/plugins/migratecmd/migratecmd.ts";
export { Create, CreateAsync, Extract, ExtractAsync } from "./src/tools/archive/index.ts";
export { DbxDatabase, attachDbxRewrite, rewriteDbxIdentifiers } from "./src/tools/dbx/index.ts";
export { NewRegistry } from "./src/tools/template/registry.ts";
