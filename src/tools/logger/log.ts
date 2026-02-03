// Ported from pocketbase/tools/logger/log.go

import type { Level } from "../../internal/compat/slog.ts";
import type { JSONMap } from "../types/json_map.ts";

// Log is similar to slog.Record but contains the log attributes as
// preformatted JSON map.
export type Log = {
  Time: Date;
  Data: JSONMap<unknown>;
  Message: string;
  Level: Level;
};
