import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BaseApp,
  mustRegisterServerJSAsync,
  requireGuestOnly,
  registerMigrateCmd,
  serveStatic,
  templateLangJS,
  type ServeEvent,
  serveAsync,
} from "../../index.ts";

const rootDir = dirname(fileURLToPath(import.meta.url));
const dataDir = join(rootDir, "pb_data");
const hooksDir = join(rootDir, "pb_hooks");
const migrationsDir = join(rootDir, "pb_migrations");
const publicDir = join(rootDir, "pb_public");
const isProduction = process.argv.includes("--production");

await Promise.all([
  mkdir(dataDir, { recursive: true }),
  mkdir(hooksDir, { recursive: true }),
  mkdir(migrationsDir, { recursive: true }),
  mkdir(publicDir, { recursive: true }),
]);

const app = new BaseApp({ dataDir, isDev: !isProduction });

// PocketBun-only async variant to avoid sync fs startup work in server-side JavaScript setup.
// Use the throwing helper so hook loading errors are surfaced immediately.
await mustRegisterServerJSAsync(app, {
  hooksDir,
  hooksWatch: !isProduction,
  hooksPoolSize: 5,
  migrationsDir,
});

registerMigrateCmd(app, null, {
  dir: migrationsDir,
  automigrate: true,
  templateLang: templateLangJS,
});

app.onServe().bind({
  func: (e: ServeEvent) => {
    e.router.get("/hello-from-main", (requestEvent) => {
      return requestEvent.json(200, { message: "Hello from BaseApp route." });
    }).bind(requireGuestOnly());

    if (!e.router.hasRoute("GET", "/{path...}")) {
      e.router.get("/{path...}", serveStatic(publicDir, true));
    }
    return e.next();
  },
  priority: 999,
});

await serveAsync(app, { httpAddr: "127.0.0.1:8090", workers: isProduction ? 2 : 1 });
