// PocketBun-only: regression tests for the generated server-side JavaScript type/runtime contract.

import { describe, expect, it, setDefaultTimeout } from "bun:test";
import { existsSync } from "node:fs";
import ts from "typescript";
import { buildServeHandler } from "../../apis/serve.ts";
import { newTestApp } from "../../tests/app.ts";
import { NewRegistry } from "../../tools/template/registry.ts";
import {
  apisBinds,
  appBinds,
  baseBinds,
  cronBinds,
  dbxBinds,
  filesystemBinds,
  filepathBinds,
  formsBinds,
  hooksBinds,
  httpClientBinds,
  mailsBinds,
  osBinds,
  routerBinds,
  securityBinds,
} from "./binds.ts";

setDefaultTimeout(15000);

type BindScope = Record<string, any>;
type MemberKind = "method" | "property";
type MemberMap = Map<string, Set<MemberKind>>;
type InterfaceScenario = {
  interfaceName: string;
  name: string;
  namespace: string;
  properties?: boolean;
  value: any;
};

const generatedTypesUrl = new URL("./internal/types/generated/types.d.ts", import.meta.url);
const upstreamTypesPath =
  process.env.POCKETBUN_UPSTREAM_JSVM_TYPES_PATH ?? ".upstream/pocketbase/plugins/jsvm/internal/types/generated/types.d.ts";
const upstreamTypesAvailable = existsSync(upstreamTypesPath);
const pocketBunTopLevelAdditions = new Set(["newCollection", "newBaseCollection", "newViewCollection", "newAuthCollection"]);
const pocketBunNamespaceAdditions = new Set([
  "$filesystem.fileFromPathAsync",
  "$filesystem.fileFromURLAsync",
  "$http.sendAsync",
  "$os.statAsync",
  "$os.readFileAsync",
  "$os.writeFileAsync",
  "$os.readDirAsync",
  "$os.truncateAsync",
  "$os.mkdirAsync",
  "$os.mkdirAllAsync",
  "$os.renameAsync",
  "$os.removeAsync",
  "$os.removeAllAsync",
]);
const pocketBunInterfaceAdditions = new Set(["core.App.forMigrations", "core.BaseApp.forMigrations"]);
const knownNamespaceInterfaceAdditions = new Map<string, Set<string>>([["os", new Set(["processMode"])]]);
const knownNamespaceInterfaceOmissions = new Map<string, Set<string>>([
  ["apis", new Set(["dryRunViewForm", "providerListItem", "runSQLForm", "runSQLResult", "runSQLResultColumn"])],
  ["core", new Set(["defaultFieldHelpValidationRule"])],
  ["os", new Set(["processHandle"])],
  ["slog", new Set(["Source"])],
]);
const knownInterfaceMemberAdditions = new Map<string, Set<string>>([
  ["core.App", new Set(["forMigrations"])],
  ["core.BaseApp", new Set(["forMigrations"])],
]);
const knownInterfaceMemberOmissions = new Map<string, Set<string>>([
  ["core.SMTPConfig", new Set(["marshalJSON"])],
  ["cron.Cron", new Set(["setInterval", "setTimezone"])],
  ["os.dirFS", new Set(["lstat", "readLink"])],
  [
    "os.Root",
    new Set([
      "chmod",
      "chown",
      "chtimes",
      "lchown",
      "link",
      "mkdirAll",
      "readFile",
      "readlink",
      "removeAll",
      "rename",
      "symlink",
      "writeFile",
    ]),
  ],
  [
    "os.rootFS",
    new Set([
      "chmod",
      "chown",
      "chtimes",
      "lchown",
      "link",
      "mkdirAll",
      "readlink",
      "readLink",
      "removeAll",
      "rename",
      "symlink",
      "writeFile",
    ]),
  ],
  ["slog.Record", new Set(["source"])],
]);
const intentionallyDifferentInterfaceContracts = new Set([".Command"]);

async function sourceFile(pathOrUrl: string | URL): Promise<ts.SourceFile> {
  const path = pathOrUrl instanceof URL ? pathOrUrl.pathname : pathOrUrl;
  return ts.createSourceFile(path, await Bun.file(pathOrUrl).text(), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function declarationCommentText(source: string): string {
  return (source.match(/\/\*\*[\s\S]*?\*\//g) ?? []).join("\n");
}

function propName(name: ts.PropertyName | ts.BindingName | ts.ModuleName | undefined): string | null {
  if (!name) {
    return null;
  }
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  if (ts.isPrivateIdentifier(name)) {
    return name.text;
  }
  return null;
}

function namespaceBlocks(sf: ts.SourceFile, namespaceName: string): ts.ModuleBlock[] {
  const blocks: ts.ModuleBlock[] = [];
  for (const stmt of sf.statements) {
    if (!ts.isModuleDeclaration(stmt) || propName(stmt.name) !== namespaceName) {
      continue;
    }

    let body = stmt.body;
    while (body && ts.isModuleDeclaration(body)) {
      body = body.body;
    }
    if (body && ts.isModuleBlock(body)) {
      blocks.push(body);
    }
  }
  return blocks;
}

function namespaceStatements(sf: ts.SourceFile, namespaceName: string): ts.Statement[] {
  return namespaceName === ""
    ? [...sf.statements]
    : namespaceBlocks(sf, namespaceName).flatMap((block) => [...block.statements]);
}

function collectNamespaceNames(sf: ts.SourceFile): Set<string> {
  const names = new Set<string>([""]);
  for (const stmt of sf.statements) {
    if (ts.isModuleDeclaration(stmt)) {
      const name = propName(stmt.name);
      if (name) {
        names.add(name);
      }
    }
  }
  return names;
}

function collectTopLevelValues(sf: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  for (const stmt of sf.statements) {
    if (ts.isFunctionDeclaration(stmt) || ts.isClassDeclaration(stmt)) {
      const name = propName(stmt.name);
      if (name) {
        names.add(name);
      }
      continue;
    }
    if (ts.isVariableStatement(stmt)) {
      for (const declaration of stmt.declarationList.declarations) {
        const name = propName(declaration.name);
        if (name) {
          names.add(name);
        }
      }
      continue;
    }
    if (ts.isModuleDeclaration(stmt)) {
      const name = propName(stmt.name);
      if (name?.startsWith("$")) {
        names.add(name);
      }
    }
  }
  return names;
}

function collectInterfaceNames(sf: ts.SourceFile, namespaceName: string): Set<string> {
  const names = new Set<string>();
  for (const stmt of namespaceStatements(sf, namespaceName)) {
    if (ts.isInterfaceDeclaration(stmt)) {
      names.add(stmt.name.text);
    }
  }
  return names;
}

function collectNamespaceValues(sf: ts.SourceFile, namespaceName: string): Set<string> {
  const names = new Set<string>();
  for (const stmt of namespaceStatements(sf, namespaceName)) {
    if (ts.isFunctionDeclaration(stmt) || ts.isClassDeclaration(stmt)) {
      const name = propName(stmt.name);
      if (name) {
        names.add(name);
      }
      continue;
    }
    if (ts.isVariableStatement(stmt)) {
      for (const declaration of stmt.declarationList.declarations) {
        const name = propName(declaration.name);
        if (name && !name.startsWith("_")) {
          names.add(name);
        }
      }
      continue;
    }
    if (ts.isExportDeclaration(stmt) && stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
      for (const specifier of stmt.exportClause.elements) {
        names.add(specifier.name.text);
      }
    }
  }
  return names;
}

function collectInterfaceMembers(sf: ts.SourceFile, namespaceName: string, interfaceName: string): MemberMap {
  const out: MemberMap = new Map();
  collectInterfaceMembersInto(sf, namespaceName, interfaceName, out, new Set());
  return out;
}

function collectInterfaceMembersInto(
  sf: ts.SourceFile,
  namespaceName: string,
  interfaceName: string,
  out: MemberMap,
  visited: Set<string>,
): void {
  const key = `${namespaceName}.${interfaceName}`;
  if (visited.has(key)) {
    return;
  }
  visited.add(key);

  for (const stmt of namespaceStatements(sf, namespaceName)) {
    if (!ts.isInterfaceDeclaration(stmt) || stmt.name.text !== interfaceName) {
      continue;
    }
    for (const heritage of stmt.heritageClauses ?? []) {
      for (const type of heritage.types) {
        for (const ref of resolveHeritageType(sf, namespaceName, type.expression)) {
          collectInterfaceMembersInto(sf, ref.namespaceName, ref.interfaceName, out, visited);
        }
      }
    }
    for (const member of stmt.members) {
      if (ts.isMethodSignature(member)) {
        addMember(out, propName(member.name), "method");
      }
      if (ts.isPropertySignature(member)) {
        addMember(out, propName(member.name), "property");
      }
    }
  }
}

function addMember(out: MemberMap, name: string | null, kind: MemberKind): void {
  if (!name || name === "constructor") {
    return;
  }
  const kinds = out.get(name) ?? new Set<MemberKind>();
  kinds.add(kind);
  out.set(name, kinds);
}

function resolveHeritageType(
  sf: ts.SourceFile,
  namespaceName: string,
  name: ts.ExpressionWithTypeArguments["expression"] | ts.EntityName,
): Array<{ interfaceName: string; namespaceName: string }> {
  if (ts.isIdentifier(name)) {
    const alias = resolveAlias(sf, namespaceName, name.text, new Set());
    if (alias.length > 0) {
      return alias;
    }
    if (name.text === "Array" || name.text === "Promise" || name.text === "Number" || name.text === "String") {
      return [];
    }
    return [{ namespaceName, interfaceName: name.text }];
  }
  if (ts.isPropertyAccessExpression(name) && ts.isIdentifier(name.expression)) {
    return [{ namespaceName: name.expression.text, interfaceName: name.name.text }];
  }
  if (ts.isQualifiedName(name) && ts.isIdentifier(name.left)) {
    return [{ namespaceName: name.left.text, interfaceName: name.right.text }];
  }
  return [];
}

function resolveAlias(
  sf: ts.SourceFile,
  namespaceName: string,
  aliasName: string,
  visited: Set<string>,
): Array<{ interfaceName: string; namespaceName: string }> {
  const key = `${namespaceName}.${aliasName}`;
  if (visited.has(key)) {
    return [];
  }
  visited.add(key);

  for (const stmt of namespaceStatements(sf, namespaceName)) {
    if (ts.isImportEqualsDeclaration(stmt) && stmt.name.text === aliasName && ts.isEntityName(stmt.moduleReference)) {
      return resolveHeritageType(sf, namespaceName, stmt.moduleReference);
    }
    if (ts.isTypeAliasDeclaration(stmt) && stmt.name.text === aliasName) {
      return resolveTypeNodeAlias(sf, namespaceName, stmt.type);
    }
  }
  return [];
}

function resolveTypeNodeAlias(
  sf: ts.SourceFile,
  namespaceName: string,
  type: ts.TypeNode,
): Array<{ interfaceName: string; namespaceName: string }> {
  if (ts.isTypeReferenceNode(type)) {
    return resolveHeritageType(sf, namespaceName, type.typeName);
  }
  if (ts.isIntersectionTypeNode(type)) {
    return type.types.flatMap((item) => resolveTypeNodeAlias(sf, namespaceName, item));
  }
  return [];
}

function sorted(values: Iterable<string>): string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function difference(left: Set<string>, right: Set<string>): string[] {
  return sorted([...left].filter((name) => !right.has(name)));
}

function unexpectedDelta(actual: string[], known: Set<string> | undefined): string[] {
  return actual.filter((name) => !known?.has(name));
}

function makeHookScope(app: Awaited<ReturnType<typeof newTestApp>>["app"]): BindScope {
  const scope: BindScope = { __hooks: "/tmp/pb_hooks" };
  appBinds(scope, app);
  baseBinds(scope);
  dbxBinds(scope);
  filesystemBinds(scope);
  securityBinds(scope);
  osBinds(scope);
  filepathBinds(scope);
  httpClientBinds(scope);
  formsBinds(scope);
  apisBinds(scope);
  mailsBinds(scope);
  scope.$template = NewRegistry();
  hooksBinds(app, scope);
  cronBinds(app, scope);
  routerBinds(app, scope);
  return scope;
}

function makeMigrationScope(app: Awaited<ReturnType<typeof newTestApp>>["app"]): BindScope {
  const scope: BindScope = { __hooks: "/tmp/pb_hooks" };
  appBinds(scope, app);
  baseBinds(scope);
  dbxBinds(scope);
  securityBinds(scope);
  osBinds(scope);
  filepathBinds(scope);
  httpClientBinds(scope);
  filesystemBinds(scope);
  formsBinds(scope);
  mailsBinds(scope);
  scope.$template = NewRegistry();
  scope.migrate = () => {};
  return scope;
}

function memberNames(members: MemberMap): Set<string> {
  return new Set(members.keys());
}

describe("jsvm generated type runtime contract", () => {
  it("keeps generated server-side JavaScript comments on lowercase public names", async () => {
    const comments = declarationCommentText(await Bun.file(generatedTypesUrl).text());
    const stalePatterns = [
      "App.save()",
      "App.delete()",
      "App.validate()",
      "App.saveNoValidate()",
      "App.auxSave()",
      "[App.",
      "[OnModel",
      "OnRecord*",
      "OnCollection",
      "OnRecordAuthRequest",
      "RunInTransaction calls",
      "FindCollections finds",
      "SetRaw method",
      "GetUnsavedFiles",
      "ResponseWritter",
      "responseWritter",
      "search.fieldResolver",
      "template.newRegistry",
      ".Render(map",
      "Message{Name",
      "Data: []byte",
      "h := Hook",
      "fsys := os.DirFS",
      "resolvers.NewRecordFieldResolver",
      "types.Pointer",
      "dbx.Params{",
      "types.GeoPoint{",
      'map[string]any{"lat"',
      "apis.ServeConfig{",
      "HttpAddr:",
      "ShowStartBanner:",
      "record.Get",
      "record.Set",
      "record.collection().Name",
      "collection().Id",
      "e.Next()",
      "e.JSON(",
      "e.BindBody(",
      "m.WriteSSE",
      "SetOut",
      "SetErr",
      "SetHelpCommand",
      "ValidArgs",
      "* RunE:",
    ];

    expect(stalePatterns.filter((pattern) => comments.includes(pattern))).toEqual([]);
  });

  it.skipIf(!upstreamTypesAvailable)("keeps runtime bind names cased like upstream JSVM declarations", async () => {
    const local = await sourceFile(generatedTypesUrl);
    const upstream = await sourceFile(upstreamTypesPath);
    const localTop = collectTopLevelValues(local);
    const upstreamTop = collectTopLevelValues(upstream);

    expect(difference(localTop, upstreamTop).filter((name) => !pocketBunTopLevelAdditions.has(name))).toEqual([]);
    expect(difference(upstreamTop, localTop)).toEqual([]);

    const namespaceNames = sorted([...localTop].filter((name) => name.startsWith("$")));
    for (const namespaceName of namespaceNames) {
      const localNames = collectNamespaceValues(local, namespaceName);
      const upstreamNames = collectNamespaceValues(upstream, namespaceName);
      expect(
        difference(localNames, upstreamNames).filter((name) => !pocketBunNamespaceAdditions.has(`${namespaceName}.${name}`)),
      ).toEqual([]);
      expect(difference(upstreamNames, localNames)).toEqual([]);
    }

    const compatibleInterfaces: Array<[string, string]> = [
      ["", "Context"],
      ["", "SubscriptionMessage"],
      ["", "ApiError"],
      ["", "NotFoundError"],
      ["", "BadRequestError"],
      ["", "ForbiddenError"],
      ["", "UnauthorizedError"],
      ["", "TooManyRequestsError"],
      ["", "InternalServerError"],
      ["core", "App"],
      ["core", "BaseApp"],
      ["core", "Record"],
      ["core", "Collection"],
      ["core", "FieldsList"],
      ["core", "Field"],
      ["core", "NumberField"],
      ["core", "BoolField"],
      ["core", "TextField"],
      ["core", "URLField"],
      ["core", "EmailField"],
      ["core", "EditorField"],
      ["core", "PasswordField"],
      ["core", "DateField"],
      ["core", "AutodateField"],
      ["core", "JSONField"],
      ["core", "RelationField"],
      ["core", "SelectField"],
      ["core", "FileField"],
      ["core", "GeoPointField"],
      ["core", "DryRunViewResult"],
      ["core", "MetaConfig"],
      ["core", "RequestEvent"],
      ["core", "RequestInfo"],
      ["core", "ServeEvent"],
      ["core", "UIExtension"],
      ["apis", "providerInfo"],
      ["auth", "Provider"],
      ["forms", "AppleClientSecretCreate"],
      ["forms", "RecordUpsert"],
      ["forms", "TestEmailSend"],
      ["forms", "TestS3Filesystem"],
      ["hook", "Hook"],
      ["hook", "TaggedHook"],
      ["http", "Cookie"],
      ["mailer", "Message"],
      ["ozzo_validation", "Error"],
      ["router", "ApiError"],
      ["time", "Location"],
      ["types", "DateTime"],
    ];

    for (const [namespaceName, interfaceName] of compatibleInterfaces) {
      const localMembers = memberNames(collectInterfaceMembers(local, namespaceName, interfaceName));
      const upstreamMembers = memberNames(collectInterfaceMembers(upstream, namespaceName, interfaceName));
      expect(
        difference(localMembers, upstreamMembers).filter(
          (name) => !pocketBunInterfaceAdditions.has(`${namespaceName}.${interfaceName}.${name}`),
        ),
        `${namespaceName}.${interfaceName} additions`,
      ).toEqual([]);
      expect(difference(upstreamMembers, localMembers), `${namespaceName}.${interfaceName} missing`).toEqual([]);
    }
  });

  it.skipIf(!upstreamTypesAvailable)("keeps all generated declaration names in sync with audited upstream deltas", async () => {
    const local = await sourceFile(generatedTypesUrl);
    const upstream = await sourceFile(upstreamTypesPath);
    const namespaceNames = sorted(new Set([...collectNamespaceNames(local), ...collectNamespaceNames(upstream)]));

    for (const namespaceName of namespaceNames) {
      const localValues = namespaceName === "" ? collectTopLevelValues(local) : collectNamespaceValues(local, namespaceName);
      const upstreamValues =
        namespaceName === "" ? collectTopLevelValues(upstream) : collectNamespaceValues(upstream, namespaceName);
      const valueAdditions = difference(localValues, upstreamValues).filter(
        (name) =>
          !(namespaceName === "" && pocketBunTopLevelAdditions.has(name)) &&
          !pocketBunNamespaceAdditions.has(`${namespaceName}.${name}`),
      );
      expect(valueAdditions, `${namespaceName || "global"} value additions`).toEqual([]);
      expect(difference(upstreamValues, localValues), `${namespaceName || "global"} value omissions`).toEqual([]);

      const localInterfaces = collectInterfaceNames(local, namespaceName);
      const upstreamInterfaces = collectInterfaceNames(upstream, namespaceName);
      expect(
        unexpectedDelta(difference(localInterfaces, upstreamInterfaces), knownNamespaceInterfaceAdditions.get(namespaceName)),
        `${namespaceName || "global"} interface additions`,
      ).toEqual([]);
      expect(
        unexpectedDelta(difference(upstreamInterfaces, localInterfaces), knownNamespaceInterfaceOmissions.get(namespaceName)),
        `${namespaceName || "global"} interface omissions`,
      ).toEqual([]);

      for (const interfaceName of sorted([...localInterfaces].filter((name) => upstreamInterfaces.has(name)))) {
        const contractKey = `${namespaceName}.${interfaceName}`;
        if (intentionallyDifferentInterfaceContracts.has(contractKey)) {
          continue;
        }
        const localMembers = memberNames(collectInterfaceMembers(local, namespaceName, interfaceName));
        const upstreamMembers = memberNames(collectInterfaceMembers(upstream, namespaceName, interfaceName));
        expect(
          unexpectedDelta(difference(localMembers, upstreamMembers), knownInterfaceMemberAdditions.get(contractKey)),
          `${contractKey} member additions`,
        ).toEqual([]);
        expect(
          unexpectedDelta(difference(upstreamMembers, localMembers), knownInterfaceMemberOmissions.get(contractKey)),
          `${contractKey} member omissions`,
        ).toEqual([]);
      }
    }
  });

  it("provides every generated top-level and namespace bind in hook or migration scope", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const types = await sourceFile(generatedTypesUrl);
      const hookScope = makeHookScope(app);
      const migrationScope = makeMigrationScope(app);

      const missingTopLevel = sorted(collectTopLevelValues(types)).filter(
        (name) => !(name in hookScope) && !(name in migrationScope),
      );
      expect(missingTopLevel).toEqual([]);

      for (const namespaceName of sorted([...collectTopLevelValues(types)].filter((name) => name.startsWith("$")))) {
        const declared = collectNamespaceValues(types, namespaceName);
        const runtime = (hookScope[namespaceName] ?? migrationScope[namespaceName]) as Record<string, unknown> | undefined;
        const missing = sorted(declared).filter((name) => !runtime || !(name in runtime));
        expect(missing, namespaceName).toEqual([]);
      }
    } finally {
      await cleanup();
    }
  });

  it("provides generated methods and properties on concrete runtime values", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const types = await sourceFile(generatedTypesUrl);
      const scope = makeHookScope(app);
      const record = scope.$app.findFirstRecordByFilter("demo1", "1=1");
      const scenarios: InterfaceScenario[] = [
        { name: "context", namespace: "", interfaceName: "Context", value: new scope.Context() },
        { name: "$app", namespace: "core", interfaceName: "App", value: scope.$app },
        { name: "record", namespace: "core", interfaceName: "Record", value: record, properties: true },
        { name: "collection", namespace: "core", interfaceName: "Collection", value: new scope.Collection(), properties: true },
        { name: "fieldsList", namespace: "core", interfaceName: "FieldsList", value: new scope.FieldsList(), properties: true },
        {
          name: "field",
          namespace: "core",
          interfaceName: "Field",
          value: new scope.Field({ type: "text", name: "title" }),
          properties: true,
        },
        {
          name: "numberField",
          namespace: "core",
          interfaceName: "NumberField",
          value: new scope.NumberField({ name: "n" }),
          properties: true,
        },
        {
          name: "boolField",
          namespace: "core",
          interfaceName: "BoolField",
          value: new scope.BoolField({ name: "b" }),
          properties: true,
        },
        {
          name: "textField",
          namespace: "core",
          interfaceName: "TextField",
          value: new scope.TextField({ name: "t" }),
          properties: true,
        },
        {
          name: "urlField",
          namespace: "core",
          interfaceName: "URLField",
          value: new scope.URLField({ name: "u" }),
          properties: true,
        },
        {
          name: "emailField",
          namespace: "core",
          interfaceName: "EmailField",
          value: new scope.EmailField({ name: "e" }),
          properties: true,
        },
        {
          name: "editorField",
          namespace: "core",
          interfaceName: "EditorField",
          value: new scope.EditorField({ name: "ed" }),
          properties: true,
        },
        {
          name: "passwordField",
          namespace: "core",
          interfaceName: "PasswordField",
          value: new scope.PasswordField({ name: "p" }),
          properties: true,
        },
        {
          name: "dateField",
          namespace: "core",
          interfaceName: "DateField",
          value: new scope.DateField({ name: "d" }),
          properties: true,
        },
        {
          name: "autodateField",
          namespace: "core",
          interfaceName: "AutodateField",
          value: new scope.AutodateField({ name: "ad" }),
          properties: true,
        },
        {
          name: "jsonField",
          namespace: "core",
          interfaceName: "JSONField",
          value: new scope.JSONField({ name: "j" }),
          properties: true,
        },
        {
          name: "relationField",
          namespace: "core",
          interfaceName: "RelationField",
          value: new scope.RelationField({ name: "r" }),
          properties: true,
        },
        {
          name: "selectField",
          namespace: "core",
          interfaceName: "SelectField",
          value: new scope.SelectField({ name: "s" }),
          properties: true,
        },
        {
          name: "fileField",
          namespace: "core",
          interfaceName: "FileField",
          value: new scope.FileField({ name: "f" }),
          properties: true,
        },
        {
          name: "geoPointField",
          namespace: "core",
          interfaceName: "GeoPointField",
          value: new scope.GeoPointField({ name: "g" }),
          properties: true,
        },
        {
          name: "dateTime",
          namespace: "types",
          interfaceName: "DateTime",
          value: new scope.DateTime("2024-01-01 00:00:00.000Z"),
        },
        {
          name: "apiErrorAlias",
          namespace: "",
          interfaceName: "ApiError",
          value: new scope.ApiError(400, "Bad"),
          properties: true,
        },
        {
          name: "notFoundError",
          namespace: "",
          interfaceName: "NotFoundError",
          value: new scope.NotFoundError(),
          properties: true,
        },
        {
          name: "badRequestError",
          namespace: "",
          interfaceName: "BadRequestError",
          value: new scope.BadRequestError(),
          properties: true,
        },
        {
          name: "forbiddenError",
          namespace: "",
          interfaceName: "ForbiddenError",
          value: new scope.ForbiddenError(),
          properties: true,
        },
        {
          name: "unauthorizedError",
          namespace: "",
          interfaceName: "UnauthorizedError",
          value: new scope.UnauthorizedError(),
          properties: true,
        },
        {
          name: "tooManyRequestsError",
          namespace: "",
          interfaceName: "TooManyRequestsError",
          value: new scope.TooManyRequestsError(),
          properties: true,
        },
        {
          name: "internalServerError",
          namespace: "",
          interfaceName: "InternalServerError",
          value: new scope.InternalServerError(),
          properties: true,
        },
        {
          name: "apiError",
          namespace: "router",
          interfaceName: "ApiError",
          value: new scope.ApiError(400, "Bad"),
          properties: true,
        },
        {
          name: "validationError",
          namespace: "ozzo_validation",
          interfaceName: "Error",
          value: new scope.ValidationError("code", "Message"),
        },
        { name: "hook", namespace: "hook", interfaceName: "Hook", value: scope.$app.onBootstrap() },
        { name: "taggedHook", namespace: "hook", interfaceName: "TaggedHook", value: scope.$app.onRecordCreate("demo1") },
        {
          name: "mailerMessage",
          namespace: "mailer",
          interfaceName: "Message",
          value: new scope.MailerMessage(),
          properties: true,
        },
        { name: "command", namespace: "", interfaceName: "Command", value: new scope.Command(), properties: true },
        {
          name: "requestInfo",
          namespace: "core",
          interfaceName: "RequestInfo",
          value: new scope.RequestInfo(),
          properties: true,
        },
        { name: "cookie", namespace: "http", interfaceName: "Cookie", value: new scope.Cookie(), properties: true },
        {
          name: "subscriptionMessage",
          namespace: "",
          interfaceName: "SubscriptionMessage",
          value: new scope.SubscriptionMessage(),
          properties: true,
        },
        { name: "timezone", namespace: "time", interfaceName: "Location", value: new scope.Timezone("UTC") },
        {
          name: "appleForm",
          namespace: "forms",
          interfaceName: "AppleClientSecretCreate",
          value: new scope.AppleClientSecretCreateForm(scope.$app),
          properties: true,
        },
        {
          name: "recordUpsertForm",
          namespace: "forms",
          interfaceName: "RecordUpsert",
          value: new scope.RecordUpsertForm(scope.$app, record),
          properties: true,
        },
        {
          name: "testEmailSendForm",
          namespace: "forms",
          interfaceName: "TestEmailSend",
          value: new scope.TestEmailSendForm(scope.$app),
          properties: true,
        },
        {
          name: "testS3Form",
          namespace: "forms",
          interfaceName: "TestS3Filesystem",
          value: new scope.TestS3FilesystemForm(scope.$app),
          properties: true,
        },
      ];

      let requestEvent: BindScope | null = null;
      scope.routerAdd("GET", "/audit", (event: BindScope) => {
        requestEvent = event;
        return event.json(200, { ok: true });
      });
      const response = await buildServeHandler(app)(new Request("http://127.0.0.1/audit?x=1"));
      expect(response.status).toBe(200);
      expect(requestEvent).not.toBeNull();
      scenarios.push({
        name: "requestEvent",
        namespace: "core",
        interfaceName: "RequestEvent",
        value: requestEvent,
        properties: true,
      });

      for (const scenario of scenarios) {
        const members = collectInterfaceMembers(types, scenario.namespace, scenario.interfaceName);
        const missingMethods: string[] = [];
        const missingProperties: string[] = [];
        for (const [memberName, kinds] of [...members.entries()].sort(([left], [right]) => left.localeCompare(right))) {
          if (kinds.has("method") && typeof scenario.value[memberName] !== "function") {
            missingMethods.push(memberName);
          }
          if (scenario.properties && kinds.has("property") && !(memberName in scenario.value)) {
            missingProperties.push(memberName);
          }
        }
        expect(missingMethods, `${scenario.name} methods`).toEqual([]);
        expect(missingProperties, `${scenario.name} properties`).toEqual([]);
      }
    } finally {
      await cleanup();
    }
  });
});
