// PocketBun starter app created by create-pocketbun.

import { BaseApp, serveAsync } from "pocketbun";

const app = new BaseApp({ dataDir: "./pb_data", isDev: true });

await serveAsync(app, { httpAddr: "127.0.0.1:8090" });
