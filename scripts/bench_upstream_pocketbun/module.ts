// Ported from vendor/pocketbase-benchmarks/benchmarks/run.go,
// vendor/pocketbase-benchmarks/benchmarks/test_create.go,
// vendor/pocketbase-benchmarks/benchmarks/test_auth.go,
// vendor/pocketbase-benchmarks/benchmarks/test_search.go,
// vendor/pocketbase-benchmarks/benchmarks/test_custom.go,
// vendor/pocketbase-benchmarks/benchmarks/test_delete.go,
// and vendor/pocketbase-benchmarks/main.go.

import { setTimeout as delay } from "node:timers/promises";
import type { App } from "../../src/core/app.ts";
import type { RequestEvent } from "../../src/core/event_request.ts";
import type { RecordRequestEvent, ServeEvent } from "../../src/core/events.ts";
import type { Record as RecordModel } from "../../src/core/record_model.ts";
import { CollectionNameSuperusers } from "../../src/core/collection_model.ts";
import { NewRecord } from "../../src/core/record_model.ts";
import { FireAndForget } from "../../src/tools/routine/routine.ts";
import { bench, type BenchResult } from "./bench.ts";
import { BenchRequest } from "./request.ts";
import { benchmarkSchema } from "./schema.ts";

const benchmarkStartedKey = "__benchmarkStarted";

export const colOrganizations = "organizations";
export const colPermissions = "permissions";
export const colUsers = "users";
export const colPosts10k = "posts10k";
export const colPosts25k = "posts25k";
export const colPosts50k = "posts50k";
export const colPosts100k = "posts100k";
export const colBenchmarks = "benchmarks";

const deleteIgnore = [colBenchmarks, CollectionNameSuperusers] as const;

type RunnerWriter = {
  write: (chunk: string) => void;
  afterRun?: (runErr: Error | null) => Promise<void> | void;
};

type SearchScenario = {
  comment: string;
  iterations: number;
  concurrency: number;
  collection: string;
  query: string;
  rule: string;
  indexes: string[] | null;
  extraFunc: (() => Promise<void>) | null;
};

export class Runner {
  app: App;
  baseUrl: string;
  writers: RunnerWriter[];

  constructor(app: App, baseUrl: string, writers: RunnerWriter[]) {
    this.app = app;
    this.baseUrl = baseUrl;
    this.writers = writers;
  }

  write(line: string): void {
    for (const writer of this.writers) {
      try {
        writer.write(`${line}\n`);
      } catch (error) {
        console.log("Write failure:", error);
      }
    }
  }

  async run(testNames: string[]): Promise<Error | null> {
    const tests: Record<string, () => Promise<void>> = {
      create: async () => {
        const resetErr = await this.resetSchema(true);
        if (resetErr) {
          throw new Error(`resetSchema: ${resetErr.message}`);
        }

        await this.createOrganizations();
        await this.createPermissions();
        await this.createUsers();
        await this.createPosts();
      },
      auth: async () => {
        await this.authWithPassword();
        await this.authRefresh();
      },
      search: async () => {
        await this.listRecords();
      },
      custom: async () => {
        await this.customRoute();
        await this.customHook();
      },
      delete: async () => {
        await this.deleteRecords();
      },
    };

    let runErr: Error | null = null;

    for (const rawName of testNames) {
      const name = rawName.trim();
      const exec = tests[name];
      if (!exec) {
        runErr = new Error(`missing benchmark test ${name}`);
        break;
      }

      try {
        await exec();
      } catch (error) {
        runErr = toError(error);
        break;
      }
    }

    if (!runErr) {
      this.write("---------------------------------------------------");
      this.write("Completed!");
    }

    for (const writer of this.writers) {
      if (!writer.afterRun) {
        continue;
      }

      try {
        await writer.afterRun(runErr);
      } catch (error) {
        console.log("AfterRun failure:", error);
      }
    }

    return runErr;
  }

  async cooldown(): Promise<void> {
    await delay(2_000);
  }

  async updateCollection(collectionIdOrName: string, data: Record<string, unknown>): Promise<Error | null> {
    let collection;
    try {
      collection = this.app.FindCollectionByNameOrId(collectionIdOrName);
    } catch (error) {
      return toError(error);
    }

    const patch = JSON.parse(JSON.stringify(data)) as Record<string, unknown>;

    if (Object.prototype.hasOwnProperty.call(patch, "name")) {
      collection.name = toNullableString(patch.name) ?? "";
    }

    if (Object.prototype.hasOwnProperty.call(patch, "listRule")) {
      collection.listRule = toNullableString(patch.listRule);
    }

    if (Object.prototype.hasOwnProperty.call(patch, "viewRule")) {
      collection.viewRule = toNullableString(patch.viewRule);
    }

    if (Object.prototype.hasOwnProperty.call(patch, "createRule")) {
      collection.createRule = toNullableString(patch.createRule);
    }

    if (Object.prototype.hasOwnProperty.call(patch, "updateRule")) {
      collection.updateRule = toNullableString(patch.updateRule);
    }

    if (Object.prototype.hasOwnProperty.call(patch, "deleteRule")) {
      collection.deleteRule = toNullableString(patch.deleteRule);
    }

    if (Object.prototype.hasOwnProperty.call(patch, "indexes")) {
      collection.indexes = Array.isArray(patch.indexes) ? patch.indexes.map((entry) => String(entry)) : [];
    }

    return await this.app.Save(collection);
  }

  randomRecordIds(collectionIdOrName: string, count: number): string[] {
    const collection = this.app.FindCollectionByNameOrId(collectionIdOrName);
    const rows = this.app
      .db()
      .query<{ id: string }, []>(`SELECT id FROM {{${collection.name}}} ORDER BY random() LIMIT ${count}`)
      .all();

    return rows.map((row) => String(row.id));
  }

  randomUserAuth(): { user: RecordModel; token: string } {
    const user = this.app.RecordQuery(colUsers).OrderBy("random()").Limit(1).One() as RecordModel;
    return {
      user,
      token: user.NewAuthToken(),
    };
  }

  randomSuperuserAuth(): { superuser: RecordModel; token: string } {
    const superuser = this.app.RecordQuery(CollectionNameSuperusers).Limit(1).One() as RecordModel;
    return {
      superuser,
      token: superuser.NewAuthToken(),
    };
  }

  async resetSchema(deleteData: boolean): Promise<Error | null> {
    return await this.app.RunInTransaction(async (txApp) => {
      const importErr = await txApp.ImportCollectionsByMarshaledJSON(benchmarkSchema, true);
      if (importErr) {
        return new Error(`resetSchema import failure: ${importErr.message}`);
      }

      if (!deleteData) {
        return null;
      }

      let collections;
      try {
        collections = txApp.FindAllCollections();
      } catch (error) {
        return toError(error);
      }

      for (const collection of collections) {
        if (collection.IsView() || deleteIgnore.includes(collection.name as (typeof deleteIgnore)[number])) {
          continue;
        }

        try {
          txApp.db().query(`DELETE FROM {{${collection.name}}}`).run();
        } catch (error) {
          const err = toError(error);
          return new Error(`resetSchema data delete failure for ${JSON.stringify(collection.name)}: ${err.message}`);
        }
      }

      return null;
    });
  }

  async createOrganizations(): Promise<void> {
    this.write("## Creating organizations (100)");

    let runErr: unknown;
    try {
      const scenarios = [
        { iterations: 50, concurrency: 10, collection: colOrganizations, rule: "" },
        { iterations: 50, concurrency: 10, collection: colOrganizations, rule: "@request.body.name != ''" },
      ] as const;

      for (const scenario of scenarios) {
        const updateErr = await this.updateCollection(scenario.collection, { createRule: scenario.rule });
        if (updateErr) {
          throw updateErr;
        }

        const total = this.app.CountRecords(scenario.collection);

        await this.cooldown();

        this.write(
          `#### Creating ${scenario.iterations} ${scenario.collection} [reqs:${scenario.iterations}, conc:${scenario.concurrency}, rule:\`${JSON.stringify(scenario.rule)}\`]`,
        );

        const result = await bench(
          async (i) => {
            const name = `${scenario.collection}${i + total}`;
            const request = new BenchRequest({
              Url: `${this.baseUrl}/api/collections/${scenario.collection}/records`,
              Method: "POST",
              Body: JSON.stringify({ name }),
            });
            await request.Send(null);
          },
          scenario.iterations,
          scenario.concurrency,
        );

        this.write(result.String());
      }

      this.write("");
    } catch (error) {
      runErr = error;
    }

    const resetErr = await this.resetSchema(false);
    if (resetErr) {
      throw resetErr;
    }
    if (runErr) {
      throw runErr;
    }
  }

  async createPermissions(): Promise<void> {
    this.write("## Creating permissions (50)");

    let runErr: unknown;
    try {
      const scenarios = [
        { iterations: 25, concurrency: 5, collection: colPermissions, rule: "" },
        { iterations: 25, concurrency: 5, collection: colPermissions, rule: "@request.body.name != ''" },
      ] as const;

      for (const scenario of scenarios) {
        const updateErr = await this.updateCollection(scenario.collection, { createRule: scenario.rule });
        if (updateErr) {
          throw updateErr;
        }

        const total = this.app.CountRecords(scenario.collection);

        await this.cooldown();

        this.write(
          `#### Creating ${scenario.iterations} ${scenario.collection} [reqs:${scenario.iterations}, conc:${scenario.concurrency}, rule:\`${JSON.stringify(scenario.rule)}\`]`,
        );

        const result = await bench(
          async (i) => {
            const name = `${scenario.collection}${i + total}`;
            const request = new BenchRequest({
              Url: `${this.baseUrl}/api/collections/${scenario.collection}/records`,
              Method: "POST",
              Body: JSON.stringify({
                name,
                active: i % 2 === 0,
              }),
            });
            await request.Send(null);
          },
          scenario.iterations,
          scenario.concurrency,
        );

        this.write(result.String());
      }

      this.write("");
    } catch (error) {
      runErr = error;
    }

    const resetErr = await this.resetSchema(false);
    if (resetErr) {
      throw resetErr;
    }
    if (runErr) {
      throw runErr;
    }
  }

  async createUsers(): Promise<void> {
    this.write("## Creating users (500 - expected to be slow due to passwordHash generation)");

    let runErr: unknown;
    try {
      const permissions = this.randomRecordIds(colPermissions, 999);
      const organizations = this.randomRecordIds(colOrganizations, 999);

      const scenarios = [
        { iterations: 250, concurrency: 50, collection: colUsers, rule: "" },
        {
          iterations: 250,
          concurrency: 50,
          collection: colUsers,
          rule: "@request.body.email != '' && @request.body.permissions:length > 0",
        },
      ] as const;

      for (const scenario of scenarios) {
        const updateErr = await this.updateCollection(scenario.collection, { createRule: scenario.rule });
        if (updateErr) {
          throw updateErr;
        }

        const total = this.app.CountRecords(scenario.collection);

        await this.cooldown();

        this.write(
          `#### Creating ${scenario.iterations} ${scenario.collection} [reqs:${scenario.iterations}, conc:${scenario.concurrency}, rule:\`${JSON.stringify(scenario.rule)}\`]`,
        );

        const result = await bench(
          async (i) => {
            const name = `${scenario.collection}${i + total}`;
            const request = new BenchRequest({
              Url: `${this.baseUrl}/api/collections/${scenario.collection}/records`,
              Method: "POST",
              Body: JSON.stringify({
                email: `${name}@example.com`,
                username: name,
                name,
                organization: pickRandom(organizations),
                permissions: [pickRandom(permissions), pickRandom(permissions), pickRandom(permissions)],
                password: "1234567890",
                passwordConfirm: "1234567890",
              }),
            });
            await request.Send(null);
          },
          scenario.iterations,
          scenario.concurrency,
        );

        this.write(result.String());
      }

      this.write("");
    } catch (error) {
      runErr = error;
    }

    const resetErr = await this.resetSchema(false);
    if (resetErr) {
      throw resetErr;
    }
    if (runErr) {
      throw runErr;
    }
  }

  async createPosts(): Promise<void> {
    this.write("## Creating posts (10k, 25k, 50k, 100k)");

    let runErr: unknown;
    try {
      const { token: userToken } = this.randomUserAuth();
      const types = ["a", "b", "c", "d"];
      const users = this.randomRecordIds(colUsers, 999);

      const scenarios = [
        { iterations: 5000, concurrency: 500, collection: colPosts10k, rule: "", token: "" },
        {
          iterations: 5000,
          concurrency: 500,
          collection: colPosts10k,
          rule: "@request.auth.id != '' && @request.body.public:isset = true",
          token: userToken,
        },
        { iterations: 12500, concurrency: 500, collection: colPosts25k, rule: "", token: "" },
        {
          iterations: 12500,
          concurrency: 500,
          collection: colPosts25k,
          rule: "@request.auth.id != '' && @request.body.public:isset = true",
          token: userToken,
        },
        { iterations: 25000, concurrency: 500, collection: colPosts50k, rule: "", token: "" },
        {
          iterations: 25000,
          concurrency: 500,
          collection: colPosts50k,
          rule: "@request.auth.id != '' && @request.body.public:isset = true",
          token: userToken,
        },
        { iterations: 50000, concurrency: 500, collection: colPosts100k, rule: "", token: "" },
        {
          iterations: 50000,
          concurrency: 500,
          collection: colPosts100k,
          rule: "@request.auth.id != '' && @request.body.public:isset = true",
          token: userToken,
        },
      ] as const;

      const description =
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec sit amet sodales nisl, quis pretium nunc. Suspendisse vel auctor velit, sed luctus lectus. Phasellus rhoncus imperdiet feugiat. Duis et laoreet felis, ut facilisis enim. Quisque aliquet aliquam magna eget eleifend. Duis sed tellus nibh. Nunc ac lacus auctor, scelerisque magna congue, euismod purus. Fusce sollicitudin pharetra egestas. Quisque pulvinar augue nec aliquam placerat. Suspendisse dapibus ornare sodales.";

      for (const scenario of scenarios) {
        const updateErr = await this.updateCollection(scenario.collection, { createRule: scenario.rule });
        if (updateErr) {
          throw updateErr;
        }

        const total = this.app.CountRecords(scenario.collection);

        await this.cooldown();

        this.write(
          `#### Creating ${scenario.iterations} ${scenario.collection} [reqs:${scenario.iterations}, conc:${scenario.concurrency}, rule:\`${JSON.stringify(scenario.rule)}\`]`,
        );

        const result = await bench(
          async (i) => {
            const name = `${scenario.collection}${i + total}`;
            const headers: Record<string, string> = {};
            if (scenario.token !== "") {
              headers.Authorization = scenario.token;
            }

            const request = new BenchRequest({
              Url: `${this.baseUrl}/api/collections/${scenario.collection}/records`,
              Method: "POST",
              Headers: headers,
              Body: JSON.stringify({
                title: name,
                description,
                public: i % 2 !== 0,
                type: [pickRandom(types), pickRandom(types)],
                author: pickRandom(users),
              }),
            });

            await request.Send(null);
          },
          scenario.iterations,
          scenario.concurrency,
        );

        this.write(result.String());
      }

      this.write("");
    } catch (error) {
      runErr = error;
    }

    const resetErr = await this.resetSchema(false);
    if (resetErr) {
      throw resetErr;
    }
    if (runErr) {
      throw runErr;
    }
  }

  async authWithPassword(): Promise<void> {
    this.write("## User auth with password (expected to be slow due to passwordHash verification)");

    const scenarios = [
      { comment: "high concurrency", iterations: 250, concurrency: 250 },
      { comment: "small concurrency", iterations: 250, concurrency: 10 },
    ] as const;

    for (const scenario of scenarios) {
      await this.cooldown();

      this.write(
        `#### ${colUsers} auth with email/pass - ${scenario.comment} [reqs:${scenario.iterations}, conc:${scenario.concurrency}]`,
      );

      const result = await bench(
        async () => {
          const request = new BenchRequest({
            Url: `${this.baseUrl}/api/collections/${colUsers}/auth-with-password`,
            Method: "POST",
            Body: JSON.stringify({
              identity: `${colUsers}0@example.com`,
              password: "1234567890",
            }),
          });
          await request.Send(null);
        },
        scenario.iterations,
        scenario.concurrency,
      );

      this.write(result.String());
    }

    this.write("");
  }

  async authRefresh(): Promise<void> {
    this.write("## User auth refresh");

    const { token: userToken } = this.randomUserAuth();

    const scenarios = [
      { comment: "auth refresh (high concurrency)", iterations: 1000, concurrency: 1000 },
      { comment: "auth refresh (medium concurrency)", iterations: 1000, concurrency: 100 },
    ] as const;

    for (const scenario of scenarios) {
      await this.cooldown();

      this.write(`#### ${colUsers} - ${scenario.comment} [reqs:${scenario.iterations}, conc:${scenario.concurrency}]`);

      const result = await bench(
        async () => {
          const request = new BenchRequest({
            Url: `${this.baseUrl}/api/collections/${colUsers}/auth-refresh`,
            Method: "POST",
            Headers: {
              Authorization: userToken,
            },
          });

          await request.Send(null);
        },
        scenario.iterations,
        scenario.concurrency,
      );

      this.write(result.String());
    }

    this.write("");
  }

  async listRecords(): Promise<void> {
    this.write("## List records");

    let runErr: unknown;
    try {
      const { user, token: userToken } = this.randomUserAuth();

      const scenarios: SearchScenario[] = [
        {
          comment: "getOne for auth refresh comparison (medium concurrency)",
          iterations: 1000,
          concurrency: 100,
          collection: colUsers,
          query: `/${user.Id}`,
          rule: "",
          indexes: null,
          extraFunc: null,
        },
        {
          comment: "getOne for auth refresh comparison (high concurrency)",
          iterations: 1000,
          concurrency: 1000,
          collection: colUsers,
          query: `/${user.Id}`,
          rule: "",
          indexes: null,
          extraFunc: null,
        },
      ];

      const collections = [colPosts10k, colPosts25k, colPosts50k, colPosts100k];

      for (const collection of collections) {
        scenarios.push(
          {
            comment: "simpleA (many requests, no rules, no concurrency)",
            iterations: 1000,
            concurrency: 1,
            collection,
            query: "?perPage=20",
            rule: "",
            indexes: [],
            extraFunc: null,
          },
          {
            comment: "simpleB (many requests, no rules, high concurrency)",
            iterations: 1000,
            concurrency: 1000,
            collection,
            query: "?perPage=20",
            rule: "",
            indexes: [],
            extraFunc: null,
          },
          {
            comment: "simpleC (many requests, no rules, high concurrency, skipTotal)",
            iterations: 1000,
            concurrency: 1000,
            collection,
            query: "?perPage=20&skipTotal=1",
            rule: "",
            indexes: [],
            extraFunc: null,
          },
          {
            comment: `mixed read and write (simpleA list with additional 300 concurrent random ${collection} updates running in the background)`,
            iterations: 1000,
            concurrency: 1000,
            collection,
            query: "?perPage=20",
            rule: "",
            indexes: [],
            extraFunc: async () => {
              const ids = this.randomRecordIds(collection, 300);
              const result = await bench(
                async (index) => {
                  const id = ids[index]!;
                  const request = new BenchRequest({
                    Url: `${this.baseUrl}/api/collections/${collection}/records/${id}`,
                    Method: "PATCH",
                    Body: JSON.stringify({ title: `update${id}` }),
                    Headers: {
                      Authorization: userToken,
                    },
                  });
                  await request.Send(null);
                },
                ids.length,
                -1,
              );
              if (result.Errors.length > 0) {
                throw result.Errors[0];
              }
            },
          },
          {
            comment: "expand author",
            iterations: 100,
            concurrency: 10,
            collection,
            query: "?perPage=20&expand=author",
            rule: "",
            indexes: [],
            extraFunc: null,
          },
          {
            comment: "expand author (limited fields)",
            iterations: 100,
            concurrency: 10,
            collection,
            query: "?perPage=20&expand=author&fields=id,collectionId,expand.author.id",
            rule: "",
            indexes: [],
            extraFunc: null,
          },
          {
            comment: "expand author.permissions",
            iterations: 100,
            concurrency: 10,
            collection,
            query: "?perPage=20&expand=author.permissions",
            rule: "",
            indexes: [],
            extraFunc: null,
          },
          {
            comment: "expand author.permissions (limited fields)",
            iterations: 100,
            concurrency: 10,
            collection,
            query:
              "?perPage=20&expand=author.permissions&fields=id,collectionId,expand.author.id,expand.author.expand.permissions.id",
            rule: "",
            indexes: [],
            extraFunc: null,
          },
          {
            comment: "simple auth rule",
            iterations: 100,
            concurrency: 10,
            collection,
            query: "?perPage=20",
            rule: "@request.auth.id != ''",
            indexes: [],
            extraFunc: null,
          },
          {
            comment: "author check (no index)",
            iterations: 100,
            concurrency: 10,
            collection,
            query: "?perPage=20",
            rule: "author = @request.auth.id",
            indexes: [],
            extraFunc: null,
          },
          {
            comment: "author check (with index)",
            iterations: 100,
            concurrency: 10,
            collection,
            query: "?perPage=20",
            rule: "author = @request.auth.id",
            indexes: [`create index \`idx_author_${collection}\` on ${collection} (author)`],
            extraFunc: null,
          },
          {
            comment: "author check (with index and skipTotal)",
            iterations: 100,
            concurrency: 10,
            collection,
            query: "?perPage=20&skipTotal=1",
            rule: "author = @request.auth.id",
            indexes: [`create index \`idx_author_${collection}\` on ${collection} (author)`],
            extraFunc: null,
          },
          {
            comment: "author.id (extra join) check (no index)",
            iterations: 100,
            concurrency: 10,
            collection,
            query: "?perPage=20",
            rule: "author.id = @request.auth.id",
            indexes: [],
            extraFunc: null,
          },
          {
            comment: "author.id (extra join) check (with index)",
            iterations: 100,
            concurrency: 10,
            collection,
            query: "?perPage=20",
            rule: "author.id = @request.auth.id",
            indexes: [`create index \`idx_author_${collection}\` on ${collection} (author)`],
            extraFunc: null,
          },
          {
            comment: "author.id (extra join) check (with index and skipTotal)",
            iterations: 100,
            concurrency: 10,
            collection,
            query: "?perPage=20&skipTotal=1",
            rule: "author.id = @request.auth.id",
            indexes: [`create index \`idx_author_${collection}\` on ${collection} (author)`],
            extraFunc: null,
          },
          {
            comment: "loose large text search (no index)",
            iterations: 100,
            concurrency: 10,
            collection,
            query: "?perPage=20",
            rule: "description ~ 'ipsum dolor'",
            indexes: [],
            extraFunc: null,
          },
          {
            comment: "loose large text search (with index)",
            iterations: 100,
            concurrency: 10,
            collection,
            query: "?perPage=20",
            rule: "description ~ 'ipsum dolor'",
            indexes: [`create index \`idx_descriptions_${collection}\` on ${collection} (description)`],
            extraFunc: null,
          },
          {
            comment: "loose large text search (with index and skipTotal)",
            iterations: 100,
            concurrency: 10,
            collection,
            query: "?perPage=20&skipTotal=1",
            rule: "description ~ 'ipsum dolor'",
            indexes: [`create index \`idx_descriptions_${collection}\` on ${collection} (description)`],
            extraFunc: null,
          },
          {
            comment: "multiple select :each (no index, match-all)",
            iterations: 100,
            concurrency: 10,
            collection,
            query: "?perPage=20",
            rule: "type:each != 'c'",
            indexes: [],
            extraFunc: null,
          },
          {
            comment: "multiple select :each (no index, match-all, skipTotal)",
            iterations: 100,
            concurrency: 10,
            collection,
            query: "?perPage=20&skipTotal=1",
            rule: "type:each != 'c'",
            indexes: [],
            extraFunc: null,
          },
          {
            comment: "multiple select :each (no index, at-least-one)",
            iterations: 100,
            concurrency: 10,
            collection,
            query: "?perPage=20",
            rule: "type:each ?!= 'c'",
            indexes: [],
            extraFunc: null,
          },
          {
            comment: "multiple select :each (no index, at-least-one, skipTotal)",
            iterations: 100,
            concurrency: 10,
            collection,
            query: "?perPage=20&skipTotal=1",
            rule: "type:each ?!= 'c'",
            indexes: [],
            extraFunc: null,
          },
          {
            comment: "nested single relations lookup (no indexes)",
            iterations: 100,
            concurrency: 10,
            collection,
            query: "?perPage=20",
            rule: "author.organization.name != 'test'",
            indexes: [],
            extraFunc: null,
          },
          {
            comment: "nested single relations lookup (no indexes, skipTotal)",
            iterations: 100,
            concurrency: 10,
            collection,
            query: "?perPage=20&skipTotal=1",
            rule: "author.organization.name != 'test'",
            indexes: [],
            extraFunc: null,
          },
          {
            comment: "nested multiple relations lookup (no indexes, match-all)",
            iterations: 100,
            concurrency: 10,
            collection,
            query: "?perPage=20",
            rule: "author.permissions.active = true",
            indexes: [],
            extraFunc: null,
          },
          {
            comment: "nested multiple relations lookup (no indexes, match-all, skipTotal)",
            iterations: 100,
            concurrency: 10,
            collection,
            query: "?perPage=20&skipTotal=1",
            rule: "author.permissions.active = true",
            indexes: [],
            extraFunc: null,
          },
          {
            comment: "nested multiple relations lookup (no indexes, at-least-one)",
            iterations: 100,
            concurrency: 10,
            collection,
            query: "?perPage=20",
            rule: "author.permissions.active ?= true",
            indexes: [],
            extraFunc: null,
          },
          {
            comment: "nested multiple relations lookup (no indexes, at-least-one, skipTotal)",
            iterations: 100,
            concurrency: 10,
            collection,
            query: "?perPage=20&skipTotal=1",
            rule: "author.permissions.active ?= true",
            indexes: [],
            extraFunc: null,
          },
        );
      }

      for (const scenario of scenarios) {
        const resetErr = await this.resetSchema(false);
        if (resetErr) {
          throw resetErr;
        }

        const collectionData: Record<string, unknown> = {
          listRule: scenario.rule,
        };
        if (scenario.indexes !== null) {
          collectionData.indexes = scenario.indexes;
        }

        const updateErr = await this.updateCollection(scenario.collection, collectionData);
        if (updateErr) {
          throw updateErr;
        }

        await this.cooldown();

        this.write(
          `#### ${scenario.collection} - ${scenario.comment} [reqs:${scenario.iterations}, conc:${scenario.concurrency}, rule:\`${JSON.stringify(scenario.rule)}\`, query:\`${scenario.query}\`]`,
        );

        const runBench = async (): Promise<BenchResult> => {
          return await bench(
            async () => {
              const request = new BenchRequest({
                Url: `${this.baseUrl}/api/collections/${scenario.collection}/records${scenario.query}`,
                Method: "GET",
                Headers: {
                  Authorization: userToken,
                },
              });

              await request.Send(null);
            },
            scenario.iterations,
            scenario.concurrency,
          );
        };

        if (scenario.extraFunc) {
          const [result] = await Promise.all([runBench(), scenario.extraFunc()]);
          this.write(result.String());
        } else {
          const result = await runBench();
          this.write(result.String());
        }
      }

      this.write("");
    } catch (error) {
      runErr = error;
    }

    const resetErr = await this.resetSchema(false);
    if (resetErr) {
      throw resetErr;
    }
    if (runErr) {
      throw runErr;
    }
  }

  async customRoute(): Promise<void> {
    this.write("## Go vs JS route execution");

    const { token: superuserToken } = this.randomSuperuserAuth();

    const scenarios = [
      { comment: "JS route (high concurrency)", iterations: 500, concurrency: 500, path: "/js" },
      { comment: "Go route (high concurrency)", iterations: 500, concurrency: 500, path: "/go" },
      { comment: "JS route (medium concurrency)", iterations: 500, concurrency: 50, path: "/js" },
      { comment: "Go route (medium concurrency)", iterations: 500, concurrency: 50, path: "/go" },
      { comment: "JS route (no concurrency)", iterations: 500, concurrency: 1, path: "/js" },
      { comment: "Go route (no concurrency)", iterations: 500, concurrency: 1, path: "/go" },
    ] as const;

    for (const scenario of scenarios) {
      await this.cooldown();

      this.write(`#### ${scenario.comment} [reqs:${scenario.iterations}, conc:${scenario.concurrency}]`);

      const result = await bench(
        async () => {
          const request = new BenchRequest({
            Url: `${this.baseUrl}${scenario.path}`,
            Method: "GET",
            Headers: {
              Authorization: superuserToken,
            },
          });
          await request.Send(null);
        },
        scenario.iterations,
        scenario.concurrency,
      );

      this.write(result.String());
    }

    this.write("");
  }

  async customHook(): Promise<void> {
    this.write("## Go vs JS hooks execution");

    const { token: superuserToken } = this.randomSuperuserAuth();

    const scenarios = [
      {
        comment: "JS OnRecordBeforeUpdateRequest hook handler",
        updateCount: 100,
        concurrency: 10,
        collection: colPosts10k,
        tempName: "js",
      },
      {
        comment: "Go OnRecordBeforeUpdateRequest hook handler",
        updateCount: 100,
        concurrency: 10,
        collection: colPosts10k,
        tempName: "go",
      },
    ] as const;

    for (const scenario of scenarios) {
      const updateErr = await this.updateCollection(scenario.collection, { name: scenario.tempName });
      if (updateErr) {
        throw updateErr;
      }

      const idsToUpdate = this.randomRecordIds(scenario.tempName, scenario.updateCount);

      await this.cooldown();

      this.write(`#### ${scenario.comment} - [reqs:${idsToUpdate.length}, conc:${scenario.concurrency}]`);

      let result: BenchResult | null = null;
      let benchErr: Error | null = null;

      try {
        result = await bench(
          async (i) => {
            const id = idsToUpdate[i];
            if (!id) {
              throw new Error(`missing update id at index ${i}`);
            }

            const request = new BenchRequest({
              Url: `${this.baseUrl}/api/collections/${scenario.tempName}/records/${id}`,
              Method: "PATCH",
              Body: JSON.stringify({ title: "hook_update" }),
              Headers: {
                Authorization: superuserToken,
              },
            });

            await request.Send(null);
          },
          idsToUpdate.length,
          scenario.concurrency,
        );
      } catch (error) {
        benchErr = toError(error);
      }

      const resetErr = await this.resetSchema(false);
      if (resetErr) {
        throw resetErr;
      }

      if (benchErr) {
        throw benchErr;
      }

      if (!result) {
        throw new Error(`missing benchmark result for ${scenario.tempName}`);
      }

      this.write(result.String());
    }

    this.write("");
  }

  async deleteRecords(): Promise<void> {
    this.write("## Deleting records");

    let runErr: unknown;
    try {
      const { token: userToken } = this.randomUserAuth();

      const scenarios = [
        { comment: "simple (no cascade, no rule)", deleteCount: 100, concurrency: 10, collection: colPosts10k, rule: "" },
        {
          comment: "simple (no cascade, with rule)",
          deleteCount: 100,
          concurrency: 10,
          collection: colPosts10k,
          rule: "@request.auth.id != ''",
        },
        { comment: "simple (no cascade, no rule)", deleteCount: 100, concurrency: 10, collection: colPosts25k, rule: "" },
        {
          comment: "simple (no cascade, with rule)",
          deleteCount: 100,
          concurrency: 10,
          collection: colPosts25k,
          rule: "@request.auth.id != ''",
        },
        { comment: "simple (no cascade, no rule)", deleteCount: 100, concurrency: 10, collection: colPosts50k, rule: "" },
        {
          comment: "simple (no cascade, with rule)",
          deleteCount: 100,
          concurrency: 10,
          collection: colPosts50k,
          rule: "@request.auth.id != ''",
        },
        { comment: "simple (no cascade, no rule)", deleteCount: 100, concurrency: 10, collection: colPosts100k, rule: "" },
        {
          comment: "simple (no cascade, with rule)",
          deleteCount: 100,
          concurrency: 10,
          collection: colPosts100k,
          rule: "@request.auth.id != ''",
        },
        {
          comment: "with cascade deleting all associated posts",
          deleteCount: 100,
          concurrency: 10,
          collection: colUsers,
          rule: "",
        },
        {
          comment: "with cascade deleting all users and associated posts",
          deleteCount: 100,
          concurrency: 10,
          collection: colOrganizations,
          rule: "",
        },
      ] as const;

      for (const scenario of scenarios) {
        const updateErr = await this.updateCollection(scenario.collection, { deleteRule: scenario.rule });
        if (updateErr) {
          throw updateErr;
        }

        const idsToDelete = this.randomRecordIds(scenario.collection, scenario.deleteCount);

        await this.cooldown();

        this.write(
          `#### deleting ${idsToDelete.length} ${scenario.collection} - ${scenario.comment} [conc:${scenario.concurrency}, rule:\`${JSON.stringify(scenario.rule)}\`]`,
        );

        const result = await bench(
          async (i) => {
            const id = idsToDelete[i];
            if (!id) {
              throw new Error(`missing delete id at index ${i}`);
            }

            const request = new BenchRequest({
              Url: `${this.baseUrl}/api/collections/${scenario.collection}/records/${id}`,
              Method: "DELETE",
              Headers: {
                Authorization: userToken,
              },
            });

            await request.Send(null);
          },
          idsToDelete.length,
          scenario.concurrency,
        );

        this.write(result.String());
      }

      this.write("");
    } catch (error) {
      runErr = error;
    }

    const resetErr = await this.resetSchema(false);
    if (resetErr) {
      throw resetErr;
    }
    if (runErr) {
      throw runErr;
    }
  }
}

function customMiddleware(e: RequestEvent): unknown {
  e.Set("total", 20);
  return e.Next();
}

export function registerBenchmarkModule(app: App, baseUrl: string): void {
  app.OnServe().BindFunc((se: ServeEvent) => {
    app.settings().logs.maxDays = 0;

    se.Router.GET("/benchmarks", (e: RequestEvent) => {
      if (e.app.store().has(benchmarkStartedKey)) {
        return e.String(200, "Another benchmark is already running, please check later...");
      }

      e.app.store().set(benchmarkStartedKey, true);

      let toRunRaw = e.requestUrl().searchParams.get("run") ?? "";
      if (toRunRaw === "") {
        toRunRaw = "create,auth,search,custom,delete";
      }

      const toRun = toRunRaw.split(",");
      let resultBuffer = "";

      const runner = new Runner(app, baseUrl, [
        {
          write: (chunk) => {
            process.stdout.write(chunk);
          },
        },
        {
          write: (chunk) => {
            resultBuffer += chunk;
          },
          afterRun: async (runErr) => {
            let collection;
            try {
              collection = e.app.FindCollectionByNameOrId(colBenchmarks);
            } catch (error) {
              console.log(`Missing benchmarks collection probably due to failed schema import - ${String(error)} (${runErr})`);
              return;
            }

            const record = NewRecord(collection);
            record.Set("tests", toRunRaw);
            record.Set("result", resultBuffer);
            if (runErr) {
              record.Set("error", runErr.message);
            }

            const saveErr = await e.app.Save(record);
            if (saveErr) {
              console.log("Failed to save benchmark record:", saveErr);
            }
          },
        },
      ]);

      // run tests in the background because some host providers
      // don't allow long persistence connections.
      FireAndForget(async () => {
        const runErr = await runner.run(toRun);
        if (runErr) {
          console.log("Run error:", runErr);
        }
        app.store().remove(benchmarkStartedKey);
      });

      return e.String(
        200,
        "Benchmarks started - you can check the results later in the console or in the benchmarks collection.",
      );
    });

    se.Router.GET("/go", (e: RequestEvent) => {
      const totalRaw = e.Get("total");
      const total = typeof totalRaw === "number" && Number.isFinite(totalRaw) ? totalRaw : 20;

      const records = e.app.FindRecordsByFilter(colPosts10k, "title != ''", "-created", total, 0);
      return e.JSON(200, records);
    }).BindFunc(customMiddleware);

    return se.Next();
  });

  app.OnRecordUpdateRequest(["go"]).BindFunc((e: RecordRequestEvent) => {
    if (e.Record && e.Record.GetString("title") !== "") {
      e.Record.Set("title", "go_update");
    }
    return e.Next();
  });
}

function pickRandom(list: string[]): string {
  if (list.length === 0) {
    throw new Error("pickRandom list must not be empty");
  }

  const index = Math.floor(Math.random() * list.length);
  return list[index] ?? list[0] ?? "";
}

function toNullableString(value: unknown): string | null {
  if (value == null) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }

  return null;
}

function toError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }

  return new Error(String(value));
}
