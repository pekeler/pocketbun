#!/usr/bin/env bun
// PocketBun-only maintainer helper: shared benchmark-shaped scenario setup for focused profiling.

import { cp, mkdir, mkdtemp, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { CollectionNameSuperusers } from "../src/core/collection_model.ts";
import { NewRecord } from "../src/core/record_model.ts";
import { TestApp, newTestApp, type ManagedTestApp } from "../src/tests/app.ts";
import { benchmarkSchema } from "./bench_upstream_pocketbun/schema.ts";

export type AuthMode = "none" | "user" | "superuser";
export type Scenario =
  | "list-records"
  | "list-posts25k-author-check"
  | "create-organizations"
  | "create-organizations-rule"
  | "create-permissions"
  | "create-permissions-rule"
  | "create-posts10k"
  | "create-posts10k-rule"
  | "delete-posts25k"
  | "delete-posts25k-rule";

export type ScenarioPrepared = {
  afterRun?: () => Promise<void>;
  extraArgs?: string[];
  label: string;
};

const benchmarkTemplateVersion = "benchmark-template-v1";
const benchmarkTemplateDir = resolve(".tmp/profile-scenarios", benchmarkTemplateVersion);
const benchmarkMarkerFile = join(benchmarkTemplateDir, ".ready");
const benchmarkBuildCounts = {
  organizations: 100,
  permissions: 50,
  posts25k: 25_000,
  users: 100,
};

const createPostsDescription =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec sit amet sodales nisl, quis pretium nunc. Suspendisse vel auctor velit, sed luctus lectus. Phasellus rhoncus imperdiet feugiat. Duis et laoreet felis, ut facilisis enim. Quisque aliquet aliquam magna eget eleifend. Duis sed tellus nibh. Nunc ac lacus auctor, scelerisque magna congue, euismod purus. Fusce sollicitudin pharetra egestas. Quisque pulvinar augue nec aliquam placerat. Suspendisse dapibus ornare sodales.";

const postTypes = ["a", "b", "c", "d"];

const knownScenarios: ReadonlySet<Scenario> = new Set<Scenario>([
  "list-records",
  "list-posts25k-author-check",
  "create-organizations",
  "create-organizations-rule",
  "create-permissions",
  "create-permissions-rule",
  "create-posts10k",
  "create-posts10k-rule",
  "delete-posts25k",
  "delete-posts25k-rule",
]);

export function isScenario(value: string): value is Scenario {
  return knownScenarios.has(value as Scenario);
}

export function defaultAuth(scenario: Scenario): AuthMode {
  if (scenario === "list-records") {
    return "superuser";
  }
  if (
    scenario === "list-posts25k-author-check" ||
    scenario === "create-posts10k-rule" ||
    scenario === "delete-posts25k" ||
    scenario === "delete-posts25k-rule"
  ) {
    return "user";
  }
  return "none";
}

export function defaultUrl(scenario: Scenario): string {
  if (scenario === "list-posts25k-author-check") {
    return "/api/collections/posts25k/records?page=1&perPage=20";
  }
  return "/api/collections/demo2/records?page=1&perPage=30";
}

export function defaultWarmupRequests(scenario: Scenario): number {
  if (scenario === "list-records") {
    return 50;
  }
  if (scenario === "list-posts25k-author-check") {
    return 20;
  }
  return 0;
}

export async function newScenarioApp(scenario: Scenario): Promise<ManagedTestApp> {
  if (!needsBenchmarkTemplate(scenario)) {
    return newTestApp(undefined, { bindEventCounters: false });
  }

  const templateDir = await ensureBenchmarkTemplate();
  const tempDir = await mkdtemp(join(tmpdir(), "pocketbun-bench-profile-"));
  await cp(templateDir, tempDir, { recursive: true, force: true });

  const app = new TestApp({ dataDir: tempDir, encryptionEnv: "pb_test_env" });
  app.bootstrap();
  app.runAllMigrations();
  app.settings().logs.maxDays = 0;

  let cleaned = false;
  const cleanup = async () => {
    if (cleaned) {
      return;
    }
    cleaned = true;
    app.resetEventCalls();
    app.testMailer.reset();
    app.resetBootstrapState();
    await rm(tempDir, { recursive: true, force: true });
  };

  return {
    app,
    cleanup,
    [Symbol.asyncDispose]: cleanup,
  };
}

export async function prepareScenario(
  app: TestApp,
  scenario: Scenario,
  url: string,
  iterations: number | null = null,
): Promise<ScenarioPrepared> {
  if (scenario === "create-organizations" || scenario === "create-organizations-rule") {
    const rule = scenario === "create-organizations-rule" ? "@request.body.name != ''" : "";
    await prepareBenchmarkCreateScenario(app, "organizations", rule);
    return {
      label: `POST /api/collections/organizations/records (createRule=${JSON.stringify(rule)})`,
    };
  }

  if (scenario === "create-permissions" || scenario === "create-permissions-rule") {
    const rule = scenario === "create-permissions-rule" ? "@request.body.name != ''" : "";
    await prepareBenchmarkCreateScenario(app, "permissions", rule);
    return {
      label: `POST /api/collections/permissions/records (createRule=${JSON.stringify(rule)})`,
    };
  }

  if (scenario === "create-posts10k" || scenario === "create-posts10k-rule") {
    const rule = scenario === "create-posts10k-rule" ? "@request.auth.id != '' && @request.body.public:isset = true" : "";
    await setCollectionState(app, "posts10k", { createRule: rule });
    app.db().query("DELETE FROM {{posts10k}}").run();

    const authorId = firstRecordId(app, "users");
    return {
      label: `POST /api/collections/posts10k/records (createRule=${JSON.stringify(rule)})`,
      extraArgs: ["--author-id", authorId],
    };
  }

  if (scenario === "list-posts25k-author-check") {
    await setCollectionState(app, "posts25k", {
      indexes: [],
      listRule: "author = @request.auth.id",
    });
    return {
      label: `GET ${url} (listRule=${JSON.stringify("author = @request.auth.id")})`,
    };
  }

  if (scenario === "delete-posts25k" || scenario === "delete-posts25k-rule") {
    const rule = scenario === "delete-posts25k-rule" ? "@request.auth.id != ''" : "";
    await setCollectionState(app, "posts25k", { deleteRule: rule });
    const ids = randomRecordIds(app, "posts25k", iterations ?? 100);
    const idsFile = await writeIdsFile(ids);
    return {
      label: `DELETE /api/collections/posts25k/records/{id} (deleteRule=${JSON.stringify(rule)})`,
      extraArgs: ["--ids-file", idsFile],
      afterRun: async () => {
        await rm(idsFile, { force: true });
      },
    };
  }

  return {
    label: `GET ${url}`,
  };
}

function needsBenchmarkTemplate(scenario: Scenario): boolean {
  return (
    scenario === "create-posts10k" ||
    scenario === "create-posts10k-rule" ||
    scenario === "list-posts25k-author-check" ||
    scenario === "delete-posts25k" ||
    scenario === "delete-posts25k-rule"
  );
}

async function prepareBenchmarkCreateScenario(app: TestApp, collectionName: string, rule: string): Promise<void> {
  const benchmarkCollections = JSON.parse(benchmarkSchema) as Array<globalThis.Record<string, unknown>>;
  const targetCollections = benchmarkCollections.filter(
    (entry) => (typeof entry.name === "string" ? entry.name : "") === collectionName,
  );
  if (targetCollections.length === 0) {
    throw new Error(`missing benchmark collection ${collectionName}`);
  }

  const importErr = await app.ImportCollectionsByMarshaledJSON(JSON.stringify(targetCollections), false);
  if (importErr) {
    throw importErr;
  }

  await setCollectionState(app, collectionName, { createRule: rule });
  app.db().query(`DELETE FROM {{${collectionName}}}`).run();
}

async function setCollectionState(
  app: TestApp,
  collectionName: string,
  data: Partial<{
    createRule: string;
    deleteRule: string;
    indexes: string[];
    listRule: string;
  }>,
): Promise<void> {
  const collection = app.FindCollectionByNameOrId(collectionName);
  if (!collection) {
    throw new Error(`missing collection ${collectionName}`);
  }

  if (data.createRule !== undefined) {
    collection.createRule = data.createRule;
  }
  if (data.deleteRule !== undefined) {
    collection.deleteRule = data.deleteRule;
  }
  if (data.listRule !== undefined) {
    collection.listRule = data.listRule;
  }
  if (data.indexes !== undefined) {
    collection.indexes = [...data.indexes];
  }

  const saveErr = await app.Save(collection);
  if (saveErr) {
    throw saveErr;
  }
}

function firstRecordId(app: TestApp, collectionName: string): string {
  const row = app.db().query<{ id: string }, []>(`SELECT id FROM {{${collectionName}}} ORDER BY id LIMIT 1`).get();
  if (!row?.id) {
    throw new Error(`missing ${collectionName} record id`);
  }
  return String(row.id);
}

function randomRecordIds(app: TestApp, collectionName: string, count: number): string[] {
  const rows = app
    .db()
    .query<{ id: string }, []>(`SELECT id FROM {{${collectionName}}} ORDER BY random() LIMIT ${count}`)
    .all();
  return rows.map((row) => String(row.id));
}

async function writeIdsFile(ids: string[]): Promise<string> {
  const dir = resolve(".tmp/profile-scenarios");
  await mkdir(dir, { recursive: true });
  const file = join(dir, `delete-ids-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  await writeFile(file, `${JSON.stringify(ids)}\n`);
  return file;
}

async function ensureBenchmarkTemplate(): Promise<string> {
  try {
    await stat(benchmarkMarkerFile);
    return benchmarkTemplateDir;
  } catch {
    // build template below
  }

  const buildDir = `${benchmarkTemplateDir}.build-${Date.now()}`;
  await rm(buildDir, { recursive: true, force: true });
  await mkdir(dirname(buildDir), { recursive: true });
  await mkdir(buildDir, { recursive: true });

  const app = new TestApp({ dataDir: buildDir, encryptionEnv: "pb_test_env" });
  app.bootstrap();
  app.runAllMigrations();
  app.settings().logs.maxDays = 0;

  try {
    console.log(`Building benchmark profile template at ${benchmarkTemplateDir}...`);
    await ensureDefaultSuperuser(app);
    const importErr = await app.ImportCollectionsByMarshaledJSON(benchmarkSchema, false);
    if (importErr) {
      throw importErr;
    }

    clearBenchmarkCollections(app, [
      "organizations",
      "permissions",
      "users",
      "posts10k",
      "posts25k",
      "posts50k",
      "posts100k",
      "benchmarks",
    ]);

    const organizationIds = await seedOrganizations(app, benchmarkBuildCounts.organizations);
    const permissionIds = await seedPermissions(app, benchmarkBuildCounts.permissions);
    const userIds = await seedUsers(app, benchmarkBuildCounts.users, organizationIds, permissionIds);
    await seedPosts(app, "posts25k", benchmarkBuildCounts.posts25k, userIds);

    await writeFile(
      join(buildDir, ".ready"),
      `${JSON.stringify({ version: benchmarkTemplateVersion, counts: benchmarkBuildCounts }, null, 2)}\n`,
    );
  } catch (error) {
    app.resetBootstrapState();
    await rm(buildDir, { recursive: true, force: true });
    throw error;
  }

  app.resetBootstrapState();
  await rm(benchmarkTemplateDir, { recursive: true, force: true });
  await rename(buildDir, benchmarkTemplateDir);
  return benchmarkTemplateDir;
}

function clearBenchmarkCollections(app: TestApp, collectionNames: string[]): void {
  for (const collectionName of collectionNames) {
    const collection = app.FindCollectionByNameOrId(collectionName);
    if (!collection || collection.IsView()) {
      continue;
    }
    app.db().query(`DELETE FROM {{${collection.name}}}`).run();
  }
}

async function seedOrganizations(app: TestApp, total: number): Promise<string[]> {
  const collection = app.FindCollectionByNameOrId("organizations");
  const ids: string[] = [];

  for (let start = 0; start < total; start += 25) {
    const end = Math.min(total, start + 25);
    const txErr = await app.RunInTransaction(async (txApp) => {
      for (let i = start; i < end; i += 1) {
        const record = NewRecord(collection);
        record.Set("name", `bench-org-${i}`);
        const saveErr = await txApp.Save(record);
        if (saveErr) {
          return saveErr;
        }
        ids.push(record.Id);
      }
      return null;
    });
    if (txErr) {
      throw txErr;
    }
  }

  return ids;
}

async function seedPermissions(app: TestApp, total: number): Promise<string[]> {
  const collection = app.FindCollectionByNameOrId("permissions");
  const ids: string[] = [];

  for (let start = 0; start < total; start += 25) {
    const end = Math.min(total, start + 25);
    const txErr = await app.RunInTransaction(async (txApp) => {
      for (let i = start; i < end; i += 1) {
        const record = NewRecord(collection);
        record.Set("name", `bench-perm-${i}`);
        record.Set("active", i % 2 === 0);
        const saveErr = await txApp.Save(record);
        if (saveErr) {
          return saveErr;
        }
        ids.push(record.Id);
      }
      return null;
    });
    if (txErr) {
      throw txErr;
    }
  }

  return ids;
}

async function seedUsers(app: TestApp, total: number, organizationIds: string[], permissionIds: string[]): Promise<string[]> {
  const collection = app.FindCollectionByNameOrId("users");
  const ids: string[] = [];

  for (let start = 0; start < total; start += 25) {
    const end = Math.min(total, start + 25);
    const txErr = await app.RunInTransaction(async (txApp) => {
      for (let i = start; i < end; i += 1) {
        const record = NewRecord(collection);
        const name = `bench-user-${i}`;
        record.Set("email", `${name}@example.com`);
        record.Set("username", name);
        record.Set("name", name);
        record.Set("organization", organizationIds[i % organizationIds.length]);
        record.Set("permissions", [
          permissionIds[i % permissionIds.length],
          permissionIds[(i + 1) % permissionIds.length],
          permissionIds[(i + 2) % permissionIds.length],
        ]);
        record.Set("password", "1234567890");
        record.Set("passwordConfirm", "1234567890");

        const saveErr = await txApp.Save(record);
        if (saveErr) {
          return saveErr;
        }
        ids.push(record.Id);
      }
      return null;
    });
    if (txErr) {
      throw txErr;
    }
  }

  return ids;
}

async function seedPosts(app: TestApp, collectionName: string, total: number, userIds: string[]): Promise<void> {
  const collection = app.FindCollectionByNameOrId(collectionName);

  for (let start = 0; start < total; start += 250) {
    const end = Math.min(total, start + 250);
    const txErr = await app.RunInTransaction(async (txApp) => {
      for (let i = start; i < end; i += 1) {
        const record = NewRecord(collection);
        record.Set("title", `${collectionName}-${i}`);
        record.Set("description", createPostsDescription);
        record.Set("public", i % 2 !== 0);
        record.Set("type", [postTypes[i % postTypes.length], postTypes[(i + 1) % postTypes.length]]);
        record.Set("author", userIds[i % userIds.length]);
        const saveErr = await txApp.Save(record);
        if (saveErr) {
          return saveErr;
        }
      }
      return null;
    });
    if (txErr) {
      throw txErr;
    }
  }
}

async function ensureDefaultSuperuser(app: TestApp): Promise<void> {
  if (app.CountRecords(CollectionNameSuperusers) > 0) {
    return;
  }

  const superusersCollection = app.FindCollectionByNameOrId(CollectionNameSuperusers);
  const superuser = NewRecord(superusersCollection);
  superuser.Set("email", "test@example.com");
  superuser.Set("password", "1234567890");

  const saveErr = await app.Save(superuser);
  if (saveErr) {
    throw new Error(`failed to create benchmark profiling superuser: ${saveErr.message}`);
  }
}
