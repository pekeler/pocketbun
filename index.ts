// PocketBun-only: package entrypoint that re-exports the public API.

import {
  Register as RegisterServerJS,
  MustRegister as MustRegisterServerJS,
  RegisterAsync as RegisterServerJSAsync,
  MustRegisterAsync as MustRegisterServerJSAsync,
  type Config as ServerJSConfig,
} from "./src/plugins/jsvm/jsvm.ts";
import { Static, StaticWildcardParam } from "./src/apis/base.ts";
import {
  RequireAuth,
  RequireGuestOnly,
  RequireSameCollectionContextAuth,
  RequireSuperuserAuth,
  RequireSuperuserOrOwnerAuth,
  SkipSuccessActivityLog,
} from "./src/apis/middlewares.ts";
import {
  New,
  NewWithConfig,
  PocketBase,
  newPocketBase,
  newPocketBaseWithConfig,
  Version,
  type PocketBaseConfig,
} from "./src/pocketbase.ts";
import {
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
import {
  Register as RegisterMigrateCmd,
  MustRegister as MustRegisterMigrateCmd,
  TemplateLangGo,
  TemplateLangJS,
} from "./src/plugins/migratecmd/migratecmd.ts";
import { Create, CreateAsync, Extract, ExtractAsync } from "./src/tools/archive/index.ts";
import { NewRegistry } from "./src/tools/template/registry.ts";

export { buildServeHandler, serve, serveAsync, type ServeAsyncConfig, type ServeConfig } from "./src/apis/serve.ts";
export { Static, StaticWildcardParam, serveStatic, staticWildcardParam };
export { requireAuth, requireGuestOnly, requireSameCollectionContextAuth, requireSuperuserAuth, requireSuperuserOrOwnerAuth };
export { skipSuccessActivityLog };
export { RequireGuestOnly, RequireAuth, RequireSuperuserAuth, RequireSuperuserOrOwnerAuth, RequireSameCollectionContextAuth };
export { SkipSuccessActivityLog };
export { superuser, superuserCreate, superuserDelete, superuserOTP, superuserUpdate, superuserUpsert } from "./src/cmd/superuser.ts";
export { type SuperuserOtpResult } from "./src/cmd/superuser.ts";
export { BaseApp, type BaseAppConfig } from "./src/core/base.ts";
export { type App } from "./src/core/app.ts";
export { type ServeEvent } from "./src/core/events.ts";
export { migrate, migrateAsync, type MigrateMode } from "./src/core/migrate.ts";
export {
  newPocketBase,
  newPocketBaseWithConfig,
  New,
  NewWithConfig,
  PocketBase,
  type PocketBaseConfig,
  Version,
  version,
};
export {
  registerServerJS,
  mustRegisterServerJS,
  registerServerJSAsync,
  mustRegisterServerJSAsync,
  RegisterServerJS,
  MustRegisterServerJS,
  RegisterServerJSAsync,
  MustRegisterServerJSAsync,
};
export type { ServerJSConfig };

const serveStatic = Static;
const staticWildcardParam = StaticWildcardParam;
const requireGuestOnly = RequireGuestOnly;
const requireAuth = RequireAuth;
const requireSuperuserAuth = RequireSuperuserAuth;
const requireSuperuserOrOwnerAuth = RequireSuperuserOrOwnerAuth;
const requireSameCollectionContextAuth = RequireSameCollectionContextAuth;
const skipSuccessActivityLog = SkipSuccessActivityLog;
const version = Version;
const registerServerJS = RegisterServerJS;
const mustRegisterServerJS = MustRegisterServerJS;
const registerServerJSAsync = RegisterServerJSAsync;
const mustRegisterServerJSAsync = MustRegisterServerJSAsync;

/**
 * @deprecated Prefer registerServerJS. This alias exists because PocketBase's upstream
 * JavaScript extension package is named "jsvm".
 */
export const RegisterJSVM = RegisterServerJS;

/**
 * @deprecated Prefer mustRegisterServerJS. This alias exists because PocketBase's upstream
 * JavaScript extension package is named "jsvm".
 */
export const MustRegisterJSVM = MustRegisterServerJS;

/**
 * @deprecated Prefer registerServerJSAsync. This alias exists because PocketBase's upstream
 * JavaScript extension package is named "jsvm".
 */
export const RegisterJSVMAsync = RegisterServerJSAsync;

/**
 * @deprecated Prefer mustRegisterServerJSAsync. This alias exists because PocketBase's upstream
 * JavaScript extension package is named "jsvm".
 */
export const MustRegisterJSVMAsync = MustRegisterServerJSAsync;

/**
 * @deprecated Prefer ServerJSConfig. This alias exists because PocketBase's upstream JavaScript
 * extension package is named "jsvm".
 */
export type JSVMConfig = ServerJSConfig;

/**
 * @deprecated Prefer registerServerJS. This older PocketBun alias remains for compatibility
 * with released package versions.
 */
export const RegisterHooksPlugin = RegisterServerJS;

/**
 * @deprecated Prefer mustRegisterServerJS. This older PocketBun alias remains for compatibility
 * with released package versions.
 */
export const MustRegisterHooksPlugin = MustRegisterServerJS;

/**
 * @deprecated Prefer registerServerJSAsync. This older PocketBun alias remains for compatibility
 * with released package versions.
 */
export const RegisterHooksPluginAsync = RegisterServerJSAsync;

/**
 * @deprecated Prefer mustRegisterServerJSAsync. This older PocketBun alias remains for compatibility
 * with released package versions.
 */
export const MustRegisterHooksPluginAsync = MustRegisterServerJSAsync;
export {
  bindApis,
  bindCore,
  bindDbx,
  bindFilesystem,
  bindFilepath,
  bindForms,
  bindHTTP,
  bindMails,
  bindOS,
  bindSecurity,
};
export { BindApis, BindCore, BindDbx, BindFilesystem, BindFilepath, BindForms, BindHTTP, BindMails, BindOS, BindSecurity };
const bindCore = BindCore;
const bindDbx = BindDbx;
const bindMails = BindMails;
const bindSecurity = BindSecurity;
const bindFilesystem = BindFilesystem;
const bindFilepath = BindFilepath;
const bindOS = BindOS;
const bindForms = BindForms;
const bindApis = BindApis;
const bindHTTP = BindHTTP;
const registerMigrateCmd = RegisterMigrateCmd;
const mustRegisterMigrateCmd = MustRegisterMigrateCmd;
const templateLangJS = TemplateLangJS;
const templateLangGo = TemplateLangGo;
export { registerMigrateCmd, mustRegisterMigrateCmd, templateLangJS, templateLangGo };
export {
  Register as RegisterMigrateCmd,
  MustRegister as MustRegisterMigrateCmd,
  TemplateLangGo,
  TemplateLangJS,
  type Config as MigrateCmdConfig,
} from "./src/plugins/migratecmd/migratecmd.ts";
const create = Create;
const createAsync = CreateAsync;
const extract = Extract;
const extractAsync = ExtractAsync;
export { create, createAsync, extract, extractAsync, Create, CreateAsync, Extract, ExtractAsync };
export { DbxDatabase, attachDbxRewrite, rewriteDbxIdentifiers } from "./src/tools/dbx/index.ts";
const newRegistry = NewRegistry;
export { newRegistry, NewRegistry };
