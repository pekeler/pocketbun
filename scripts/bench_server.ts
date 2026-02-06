// PocketBun-only: local benchmark server bootstrap with seeded data.

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DbxDatabase } from "../src/tools/dbx/database.ts";
import { BaseApp, serve } from "../index.ts";
import { RequestEventKeySkipSuccessActivityLog } from "../src/apis/middlewares.ts";
import { NewBaseCollection } from "../src/core/collection_model.ts";
import { TextField } from "../src/core/field_text.ts";
import { RecordFieldResolver } from "../src/core/record_field_resolver.ts";
import { NewRecord, Record as RecordModel, type RecordData } from "../src/core/record_model.ts";
import { profileEnabled, profileSummary } from "../src/tools/perf/profile.ts";
import { buildFilterExpr } from "../src/tools/search/filter.ts";
import { Provider } from "../src/tools/search/provider.ts";
import { DefaultFilterExprLimit } from "../src/tools/search/types.ts";

const port = Number.parseInt(process.env.POCKETBUN_BENCH_PORT ?? "8092", 10);
const recordCount = Number.parseInt(process.env.POCKETBUN_BENCH_RECORDS ?? "1000", 10);
const profileLimit = Number.parseInt(process.env.POCKETBUN_PROFILE_LIMIT ?? "30", 10);
const benchListPerPage = 30;
const benchDisableLogs = readEnvBool("POCKETBUN_BENCH_DISABLE_LOGS");
const benchQueryMetrics = readEnvBool("POCKETBUN_BENCH_QUERY_METRICS");

const dataDir = await mkdtemp(join(tmpdir(), "pocketbun-bench-"));
const app = new BaseApp({ dataDir });
app.bootstrap();
app.runAllMigrations();
if (benchDisableLogs) {
  app.settings().logs.maxDays = 0;
}

let queryCount = 0;
let queryLog: string[] = [];
const queryLogLimit = Number.parseInt(process.env.POCKETBUN_BENCH_QUERYLOG_LIMIT ?? "10", 10);
let benchCollectionId = "";
let benchCollectionName = "";
let benchItemsStmt: { all: () => { id: string; title: string }[] } | null = null;
let benchCountStmt: { get: () => { total: number } | null } | null = null;
let benchWriteStmt: { run: () => unknown } | null = null;
let benchWriteResetStmt: { run: () => unknown } | null = null;
const benchJsonPayload = `{"items":[{"id":"aaaaaaaaaaaaaaa","title":"Item 0","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 1","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 2","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 3","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 4","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 5","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 6","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 7","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 8","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 9","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 10","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 11","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 12","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 13","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 14","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 15","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 16","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 17","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 18","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 19","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 20","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 21","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 22","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 23","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 24","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 25","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 26","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 27","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 28","collectionId":"pbc_209201611","collectionName":"bench_items"},{"id":"aaaaaaaaaaaaaaa","title":"Item 29","collectionId":"pbc_209201611","collectionName":"bench_items"}],"page":1,"perPage":${benchListPerPage},"totalItems":1000,"totalPages":34}\n`;

app.OnServe().Bind({
  Id: "__benchPing__",
  Priority: 1000,
  Func: (event) => {
    const benchGroup = event.Router.Group("/_bench");
    benchGroup.GET("/ping", (reqEvent) => {
      reqEvent.Set(RequestEventKeySkipSuccessActivityLog, true);
      return reqEvent.String(200, "pong");
    });
    benchGroup.GET("/json", (reqEvent) => {
      reqEvent.Set(RequestEventKeySkipSuccessActivityLog, true);
      reqEvent.responseHeaders.set("Content-Type", "application/json");
      return reqEvent.String(200, benchJsonPayload);
    });
    benchGroup.GET("/db_list", (reqEvent) => {
      reqEvent.Set(RequestEventKeySkipSuccessActivityLog, true);
      if (!benchItemsStmt || !benchCountStmt) {
        return reqEvent.json(500, { error: "bench statements not ready" });
      }
      const skipTotal = shouldSkipTotal(reqEvent.requestUrl().searchParams.get("skipTotal"));
      const rows = benchItemsStmt.all();
      const items = rows.map((row) => ({
        id: row.id,
        title: row.title,
        collectionId: benchCollectionId,
        collectionName: benchCollectionName,
      }));
      let totalItems = -1;
      let totalPages = -1;
      if (!skipTotal) {
        const countRow = benchCountStmt.get();
        totalItems = countRow?.total ? Number(countRow.total) : 0;
        totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / benchListPerPage);
      }
      return reqEvent.json(200, {
        items,
        page: 1,
        perPage: benchListPerPage,
        totalItems,
        totalPages,
      });
    });
    benchGroup.GET("/provider_list", (reqEvent) => {
      reqEvent.Set(RequestEventKeySkipSuccessActivityLog, true);

      const resolver = new RecordFieldResolver(app, collection, null, true);
      let selectSql = `select {{${collection.name}}}.* from {{${collection.name}}}`;
      const params: unknown[] = [];
      if (collection.listRule && collection.listRule !== "") {
        const expr = buildFilterExpr(collection.listRule, resolver, DefaultFilterExprLimit);
        if (expr.sql) {
          selectSql = appendWhere(selectSql, expr.sql);
          params.push(...expr.params);
        }
      }
      resolver.setAllowHiddenFields(false);

      const provider = new Provider(resolver).query({
        select: selectSql,
        params,
      });
      if (collection.type !== "view") {
        provider.countCol("_rowid_");
      }

      const query = reqEvent.requestUrl().searchParams.toString();
      let rawResult: { items: RecordData[]; [key: string]: unknown };
      try {
        rawResult = provider.parseAndExec<RecordData>(query, app.db());
      } catch {
        return reqEvent.json(400, { error: "bad request" });
      }

      const records = rawResult.items.map((row) => RecordModel.fromRow(collection, row));
      return reqEvent.json(200, {
        ...rawResult,
        items: records,
      });
    });
    benchGroup.POST("/db_write", (reqEvent) => {
      reqEvent.Set(RequestEventKeySkipSuccessActivityLog, true);
      if (!benchWriteStmt) {
        return reqEvent.json(500, { error: "bench write statement not ready" });
      }
      benchWriteStmt.run();
      return reqEvent.json(200, { ok: true });
    });
    benchGroup.GET("/metrics", (reqEvent) => {
      reqEvent.Set(RequestEventKeySkipSuccessActivityLog, true);
      if (!benchQueryMetrics) {
        return reqEvent.json(200, {});
      }
      return reqEvent.json(200, { queryCount, queryLog });
    });
    benchGroup.POST("/reset", (reqEvent) => {
      if (benchWriteResetStmt) {
        benchWriteResetStmt.run();
      }
      queryCount = 0;
      queryLog = [];
      reqEvent.Set(RequestEventKeySkipSuccessActivityLog, true);
      return reqEvent.json(200, { ok: true });
    });
    return event.Next();
  },
});

const collection = NewBaseCollection("bench_items");
collection.ListRule = "1=1";
collection.ViewRule = "1=1";
collection.Fields.Add(Object.assign(new TextField(), { Name: "title" }));

const collectionErr = await app.Save(collection);
if (collectionErr) {
  throw new Error(`failed to create bench collection: ${collectionErr.message}`);
}
benchCollectionId = collection.Id;
benchCollectionName = collection.Name;

for (let i = 0; i < recordCount; i += 1) {
  const record = NewRecord(collection);
  record.Set("title", `Item ${i}`);
  const err = await app.Save(record);
  if (err) {
    throw new Error(`failed to seed bench record: ${err.message}`);
  }
}

const db = app.db() as DbxDatabase;
if (benchQueryMetrics) {
  db.QueryLogFunc = (sql) => {
    queryCount += 1;
    if (queryLog.length < queryLogLimit) {
      queryLog.push(sql);
    }
  };
}
db.exec("create table if not exists bench_counter (id integer primary key, value integer not null)");
db.exec("insert or ignore into bench_counter (id, value) values (1, 0)");
benchWriteStmt = db.prepare<unknown, []>("update bench_counter set value = value + 1 where id = 1") as {
  run: () => unknown;
};
benchWriteResetStmt = db.prepare<unknown, []>("update bench_counter set value = 0 where id = 1") as {
  run: () => unknown;
};
benchItemsStmt = db.prepare<{ id: string; title: string }, []>(
  `select id, title from {{${collection.name}}} limit ${benchListPerPage}`,
) as { all: () => { id: string; title: string }[] };
benchCountStmt = db.prepare<{ total: number }, []>(`select count(*) as total from {{${collection.name}}}`) as {
  get: () => { total: number } | null;
};

const shouldSkipTotal = (raw: string | null): boolean => {
  if (!raw) {
    return false;
  }
  const normalized = raw.trim().toLowerCase();
  return ["1", "t", "true", "y", "yes", "on"].includes(normalized);
};

function readEnvBool(name: string): boolean {
  const raw = process.env[name];
  if (!raw) {
    return false;
  }
  const normalized = raw.trim().toLowerCase();
  return ["1", "t", "true", "y", "yes", "on"].includes(normalized);
}

function appendWhere(baseSql: string, clause: string): string {
  if (!clause) {
    return baseSql;
  }
  if (/\bwhere\b/i.test(baseSql)) {
    return `${baseSql} AND ${clause}`;
  }
  return `${baseSql} WHERE ${clause}`;
}

const server = serve(app, { httpAddr: `127.0.0.1:${port}` });

const shutdown = async () => {
  await server.stop();
  app.resetBootstrapState();
  if (profileEnabled()) {
    const summary = profileSummary(Number.isFinite(profileLimit) ? profileLimit : 30);
    if (summary) {
      console.log("\nPROFILE SUMMARY");
      console.log(summary);
    }
  }
  await rm(dataDir, { recursive: true, force: true });
  process.exit(0);
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

console.log(`READY ${port} ${recordCount}`);
process.stdin.resume();
