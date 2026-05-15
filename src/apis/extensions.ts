// Ported from pocketbase/apis/extensions.go
// Deviation: PocketBun models ui extension file systems as directory roots instead of fs.FS values.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { RequestEvent } from "../core/event_request.ts";
import type { ServeEvent } from "../core/events.ts";
import { NewNotFoundError } from "../tools/router/api_error.ts";
import { Static } from "./base.ts";
import { SkipSuccessActivityLog } from "./middlewares.ts";
import { Gzip } from "./middlewares_gzip.ts";

const defaultCSP =
  "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' http://127.0.0.1:* https://tile.openstreetmap.org data: blob:; connect-src 'self' http://127.0.0.1:* https://nominatim.openstreetmap.org; script-src 'self' http://127.0.0.1:*; frame-ancestors 'none'";

// bindUIExtensions binds the superuser UI extensions routes to the ServeEvent.Router.
export function bindUIExtensions(serveEvent: ServeEvent): void {
  const uiGroup = serveEvent.Router.group("/_").bindFunc((event) => {
    if (!event.app.IsDev() && !event.responseHeaders.get("Cache-Control")) {
      event.responseHeaders.set("Cache-Control", "max-age=1209600, stale-while-revalidate=86400");
    }

    if (!event.responseHeaders.get("Content-Security-Policy")) {
      event.responseHeaders.set("Content-Security-Policy", defaultCSP);
    }

    return event.Next();
  });
  uiGroup.bind(Gzip());

  uiGroup.get("/extensions.js", (event) => serveExtensionsMain(event, serveEvent)).bind(SkipSuccessActivityLog());
  uiGroup.get("/extensions/{name}/{path...}", (event) => serveExtensionFile(event, serveEvent));
}

async function serveExtensionsMain(event: RequestEvent, serveEvent: ServeEvent): Promise<Response> {
  let output = "";

  for (const ext of serveEvent.UIExtensions) {
    if (!ext.Name || !ext.FS) {
      serveEvent.App.Logger().Debug("Invalid UI extension configuration", "extension", ext);
      continue;
    }

    const mainJs = await readUIExtensionFile(ext.FS, "main.js");
    if (mainJs == null) {
      continue;
    }

    output += `await (async function(){${mainJs}})();`;
  }

  return event.Stream(200, "text/javascript", output);
}

async function serveExtensionFile(event: RequestEvent, serveEvent: ServeEvent): Promise<unknown> {
  const rawName = event.params.name ?? "";
  const extensionName = decodePathSegment(rawName);
  const extension = serveEvent.UIExtensions.find((item) => item.Name === extensionName);
  if (!extension?.FS) {
    return NewNotFoundError("", null);
  }

  return Static(extension.FS, false)(event);
}

async function readUIExtensionFile(fsys: string | { root: string }, filename: string): Promise<string | null> {
  const root = typeof fsys === "string" ? fsys : fsys.root;
  if (!root) {
    return null;
  }

  try {
    return await readFile(join(root, filename), "utf8");
  } catch {
    return null;
  }
}

function decodePathSegment(value: string): string {
  if (!value.includes("%")) {
    return value;
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
