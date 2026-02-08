// Ported from pocketbase/core/settings_query.go

import type { App } from "./app.ts";
import { ParseDateTime, DateTime } from "../tools/types/index.ts";
import { JSONRaw } from "../tools/types/json_raw.ts";
import { BaseModel } from "./db_model.ts";
import { SettingsReloadEvent } from "./events.ts";
import { ParamsKeySettings, ParamsTableName } from "./settings_model.ts";

type ParamRow = {
  id?: string;
  value?: string | Uint8Array;
  created?: string;
  updated?: string;
};

export class Param extends BaseModel {
  Created: DateTime = new DateTime();
  Updated: DateTime = new DateTime();
  Value: JSONRaw = new JSONRaw();

  TableName(): string {
    return ParamsTableName;
  }
}

// ReloadSettings initializes and reloads the stored application settings.
//
// If no settings were stored it will persist the current app ones.
export function ReloadSettings(app: App): Error | null {
  const row = app.db().query("select id, value, created, updated from _params where id = ?").get(ParamsKeySettings) as
    | ParamRow
    | undefined;

  if (!row?.id) {
    app.settings().MarkAsNew();
    return app.SaveSync(app.settings());
  }

  const param = new Param();
  param.Id = row.id ?? "";
  if (row.created) {
    param.Created = ParseDateTime(row.created);
  }
  if (row.updated) {
    param.Updated = ParseDateTime(row.updated);
  }
  const valueErr = param.Value.Scan(row.value);
  if (valueErr) {
    return valueErr;
  }

  const event = new SettingsReloadEvent(app);
  const result = app.OnSettingsReload().Trigger(event, () => app.settings().loadParam(app, param));
  if (result instanceof Promise) {
    void result.catch((err) => app.Logger().Warn("Failed to reload settings", "error", err));
    return null;
  }
  if (result instanceof Error) {
    return result;
  }
  return null;
}

// ReloadSettingsAsync initializes and reloads the stored application settings.
//
// If no settings were stored it will persist the current app ones.
//
// Deviation: PocketBun-only async alternative that avoids sync-only save/reload flows
// during async startup paths.
export async function ReloadSettingsAsync(app: App): Promise<Error | null> {
  const row = app.db().query("select id, value, created, updated from _params where id = ?").get(ParamsKeySettings) as
    | ParamRow
    | undefined;

  if (!row?.id) {
    app.settings().MarkAsNew();
    return app.Save(app.settings());
  }

  const param = new Param();
  param.Id = row.id ?? "";
  if (row.created) {
    param.Created = ParseDateTime(row.created);
  }
  if (row.updated) {
    param.Updated = ParseDateTime(row.updated);
  }
  const valueErr = param.Value.Scan(row.value);
  if (valueErr) {
    return valueErr;
  }

  const event = new SettingsReloadEvent(app);
  const result = app.OnSettingsReload().Trigger(event, () => app.settings().loadParam(app, param));
  if (result instanceof Promise) {
    const triggerErr = await result;
    return triggerErr instanceof Error ? triggerErr : null;
  }
  if (result instanceof Error) {
    return result;
  }
  return null;
}
