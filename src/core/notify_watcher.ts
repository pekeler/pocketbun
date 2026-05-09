// Ported from pocketbase/core/notify_watcher.go
// Deviation: Bun/Node fs.watch replaces upstream fsnotify while preserving the observable reload behavior.

import { mkdirSync, readdirSync, rmSync, statSync, watch, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { App } from "./app.ts";
import type { CollectionEvent, ModelEvent } from "./events.ts";
import { pseudorandomString } from "../tools/security/random.ts";
import { LocalNotifyDirName } from "./base_paths.ts";
import { ParamsKeySettings, ParamsTableName } from "./settings_model.ts";

const systemHookIdNotifyWatcher = "__pbNotifyWatcherSystemHook__";

type NotifyWatcher = {
  close(): void;
};

export function registerNotifyWatcherHooks(app: App): void {
  let notifyWatcher: NotifyWatcher | null = null;

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

function createNotifyDirWatcher(app: App, instanceId: string, localNotifyDirPath: string): NotifyWatcher {
  mkdirSync(localNotifyDirPath, { recursive: true });

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const seen = new Map<string, string>();
  const stopDebounceTimer = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  };

  const signature = (filename: string): string | null => {
    try {
      const stats = statSync(join(localNotifyDirPath, filename));
      return `${stats.mtimeMs}:${stats.size}`;
    } catch {
      return null;
    }
  };

  const markSeen = (filename: string): void => {
    const current = signature(filename);
    if (current === null) {
      seen.delete(filename);
      return;
    }
    seen.set(filename, current);
  };

  const scheduleReload = (filename: string): void => {
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
  };

  for (const filename of safeReaddir(localNotifyDirPath)) {
    markSeen(filename);
  }

  const watcher = watch(localNotifyDirPath, (_eventType, rawFilename) => {
    const filename = rawFilename ? basename(String(rawFilename)) : "";
    if (filename) {
      markSeen(filename);
    }
    scheduleReload(filename);
  });

  const pollTimer = setInterval(() => {
    const filenames = safeReaddir(localNotifyDirPath);
    const currentNames = new Set(filenames);

    for (const filename of filenames) {
      const current = signature(filename);
      if (current === null) {
        continue;
      }

      const previous = seen.get(filename);
      if (previous === current) {
        continue;
      }

      seen.set(filename, current);
      scheduleReload(filename);
    }

    for (const filename of seen.keys()) {
      if (!currentNames.has(filename)) {
        seen.delete(filename);
      }
    }
  }, 100);
  pollTimer.unref?.();

  watcher.on("error", (error) => {
    stopDebounceTimer();
    if (app.IsDev()) {
      // eslint-disable-next-line no-console
      console.error("Notify dir watch error:", error);
    }
  });

  watcher.on("close", stopDebounceTimer);

  return {
    close() {
      watcher.close();
      clearInterval(pollTimer);
      stopDebounceTimer();
    },
  };
}

function writeNotifyFile(app: App, filePath: string): void {
  try {
    // Bun/Node fs.watch can coalesce a create+remove pair into a missed event
    // on macOS, so keep the marker file and rewrite it for later changes.
    writeFileSync(filePath, `${Date.now()}:${pseudorandomString(6)}`);
  } catch (error) {
    app.Logger().Warn("Failed to write watcher file", "error", error, "file", filePath);
  }
}

function safeReaddir(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}
