// Ported from pocketbase/ui/embed.go

import { resolve } from "node:path";

// DistDirFS contains the admin UI dist directory files (without the "dist" prefix).
export const DistDirFS = { root: resolve("vendor/pocketbase-admin-ui/dist") };
