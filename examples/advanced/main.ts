import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BaseApp,
  MustRegisterServerJSAsync,
  RequireGuestOnly,
  RegisterMigrateCmd,
  Static,
  TemplateLangJS,
  type ServeEvent,
  serveAsync,
} from "../../index.ts";

const rootDir = dirname(fileURLToPath(import.meta.url));
const dataDir = join(rootDir, "pb_data");
const hooksDir = join(rootDir, "pb_hooks");
const migrationsDir = join(rootDir, "pb_migrations");
const publicDir = join(rootDir, "pb_public");

await Promise.all([
  mkdir(dataDir, { recursive: true }),
  mkdir(hooksDir, { recursive: true }),
  mkdir(migrationsDir, { recursive: true }),
  mkdir(publicDir, { recursive: true }),
]);

const app = new BaseApp({ dataDir, isDev: true });

// PocketBun-only async variant to avoid sync fs startup work in server-side JavaScript setup.
// Use the throwing helper so hook loading errors are surfaced immediately.
await MustRegisterServerJSAsync(app, {
  HooksDir: hooksDir,
  HooksWatch: true,
  HooksPoolSize: 5,
  MigrationsDir: migrationsDir,
});

RegisterMigrateCmd(app, null, {
  Dir: migrationsDir,
  Automigrate: true,
  TemplateLang: TemplateLangJS,
});

app.onServe().bind({
  func: (e: ServeEvent) => {
    e.Router.GET("/hello-from-main", (requestEvent) => {
      return requestEvent.JSON(200, { message: "Hello from BaseApp route." });
    }).bind(RequireGuestOnly());

    if (!e.Router.HasRoute("GET", "/{path...}")) {
      e.Router.GET("/{path...}", Static(publicDir, true));
    }
    return e.Next();
  },
  priority: 999,
});

await serveAsync(app, { httpAddr: "127.0.0.1:8090" });
