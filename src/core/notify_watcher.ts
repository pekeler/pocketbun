// Ported from pocketbase/core/notify_watcher.go
// Deviation: Bun/Node fs.watch replaces upstream fsnotify while preserving the observable reload behavior.

import { mkdirSync, rmSync, watch, writeFileSync, type FSWatcher } from "node:fs";
import { basename, join } from "node:path";
import type { App } from "./app.ts";
import type { CollectionEvent, ModelEvent } from "./events.ts";
import { pseudorandomString } from "../tools/security/random.ts";
import { LocalNotifyDirName } from "./base_paths.ts";
import { ParamsKeySettings, ParamsTableName } from "./settings_model.ts";

const systemHookIdNotifyWatcher = "__pbNotifyWatcherSystemHook__";

export function registerNotifyWatcherHooks(app: App): void {
  let notifyWatcher: FSWatcher | null = null;

  const instanceId = `@${pseudorandomString(10)}`;
  const localNotifyDirPath = join(app.dataDir(), LocalNotifyDirName);
  const settingsFile = join(localNotifyDirPath, `settings${instanceId}`);
  const collectionsFile = join(localNotifyDirPath, `collections${instanceId}`);

  // init
  app.OnBootstrap().Bind({
    Id: systemHookIdNotifyWatcher,
    Func: (event) => {
      const result = event.Next();
      const afterNext = (err: unknown) => {
        if (err instanceof Error) {
          return err;
        }

        if (notifyWatcher) {
          notifyWatcher.close();
        }

        try {
          notifyWatcher = createNotifyDirWatcher(event.App, instanceId, localNotifyDirPath);
        } catch (error) {
          event.App.Logger().Warn("Notify dir watcher failure.", "error", error);
        }

        return null;
      };

      return result instanceof Promise ? result.then(afterNext) : afterNext(result);
    },
    Priority: -998,
  });

  // cleanup
  app.OnTerminate().Bind({
    Id: systemHookIdNotifyWatcher,
    Func: (event) => {
      if (notifyWatcher) {
        notifyWatcher.close();
        notifyWatcher = null;
      }

      rmSync(settingsFile, { force: true });
      rmSync(collectionsFile, { force: true });

      return event.Next();
    },
    Priority: -998,
  });

  const settingsNotify = (event: ModelEvent) => {
    const result = event.Next();
    const afterNext = (err: unknown) => {
      if (err instanceof Error || event.Model?.PK() !== ParamsKeySettings) {
        return err;
      }

      if (notifyWatcher) {
        writeNotifyFile(event.App, settingsFile);
      }

      return null;
    };

    return result instanceof Promise ? result.then(afterNext) : afterNext(result);
  };

  app.OnModelAfterCreateSuccess([ParamsTableName]).Bind({
    Id: systemHookIdNotifyWatcher,
    Func: settingsNotify,
    Priority: 999,
  });
  app.OnModelAfterUpdateSuccess([ParamsTableName]).Bind({
    Id: systemHookIdNotifyWatcher,
    Func: settingsNotify,
    Priority: 999,
  });

  const collectionsNotify = (event: CollectionEvent) => {
    const result = event.Next();
    const afterNext = (err: unknown) => {
      if (err instanceof Error) {
        return err;
      }

      if (notifyWatcher) {
        writeNotifyFile(event.App, collectionsFile);
      }

      return null;
    };

    return result instanceof Promise ? result.then(afterNext) : afterNext(result);
  };

  app.OnCollectionAfterCreateSuccess().Bind({
    Id: systemHookIdNotifyWatcher,
    Func: collectionsNotify,
    Priority: 999,
  });
  app.OnCollectionAfterUpdateSuccess().Bind({
    Id: systemHookIdNotifyWatcher,
    Func: collectionsNotify,
    Priority: 999,
  });
  app.OnCollectionAfterDeleteSuccess().Bind({
    Id: systemHookIdNotifyWatcher,
    Func: collectionsNotify,
    Priority: 999,
  });
}

function createNotifyDirWatcher(app: App, instanceId: string, localNotifyDirPath: string): FSWatcher {
  mkdirSync(localNotifyDirPath, { recursive: true });

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const stopDebounceTimer = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  };

  const watcher = watch(localNotifyDirPath, (_eventType, rawFilename) => {
    const filename = rawFilename ? String(rawFilename) : "";
    if (!filename || filename.endsWith(instanceId) || !app.isBootstrapped()) {
      return;
    }

    stopDebounceTimer();

    debounceTimer = setTimeout(() => {
      const name = basename(filename);
      if (name.startsWith("settings@")) {
        app.Logger().Debug("Reloading settings after notify event");
        const err = app.ReloadSettings();
        if (err) {
          app.Logger().Warn("Failed to reload app settings after notify", "error", err);
        }
        return;
      }

      if (name.startsWith("collections@")) {
        app.Logger().Debug("Reloading cached collections after notify event");
        const err = app.ReloadCachedCollections();
        if (err) {
          app.Logger().Warn("Failed to reload cached collections after notify", "error", err);
        }
      }
    }, 50);
  });

  watcher.on("error", (error) => {
    stopDebounceTimer();
    if (app.IsDev()) {
      // eslint-disable-next-line no-console
      console.error("Notify dir watch error:", error);
    }
  });

  watcher.on("close", stopDebounceTimer);

  return watcher;
}

function writeNotifyFile(app: App, filePath: string): void {
  try {
    writeFileSync(filePath, "");
  } catch (error) {
    app.Logger().Warn("Failed to write watcher file", "error", error, "file", filePath);
  }

  rmSync(filePath, { force: true });
}
