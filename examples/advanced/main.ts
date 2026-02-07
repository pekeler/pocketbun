import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BaseApp, RegisterJSVM, RegisterMigrateCmd, Static, TemplateLangJS, type ServeEvent, serve } from "../../index.ts";

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

const app = new BaseApp({ dataDir });
app.bootstrap();

RegisterJSVM(app, {
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

app.OnServe().Bind({
  Func: (e: ServeEvent) => {
    if (!e.Router.HasRoute("GET", "/{path...}")) {
      e.Router.GET("/{path...}", Static(publicDir, true));
    }
    return e.Next();
  },
  Priority: 999,
});

serve(app, { httpAddr: "127.0.0.1:8090" });
