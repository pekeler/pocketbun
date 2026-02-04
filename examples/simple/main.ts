import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BaseApp, serve } from "../../index.ts";

const rootDir = dirname(fileURLToPath(import.meta.url));
const dataDir = join(rootDir, "pb_data");

const app = new BaseApp({ dataDir });
app.bootstrap();

serve(app, { httpAddr: "127.0.0.1:8090" });
