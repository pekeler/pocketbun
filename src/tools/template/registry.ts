// Ported from pocketbase/tools/template/registry.go

import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { Store } from "../store/store.ts";
import { buildRenderer, type TemplateFunc, type TemplateFuncs, type TemplateSource, SafeString, Renderer } from "./renderer.ts";

export function NewRegistry(): Registry {
  return new Registry();
}

// Registry defines a templates registry that is safe to be used by multiple goroutines.
//
// Use the Registry.Load* methods to load templates into the registry.
export class Registry {
  cache: Store<string, Renderer>;
  funcs: TemplateFuncs;

  constructor() {
    this.cache = new Store<string, Renderer>();
    this.funcs = {
      raw: (str: string) => new SafeString(String(str)),
    };
  }

  // AddFuncs registers new global template functions.
  //
  // The key of each map entry is the function name that will be used in the templates.
  // If a function with the map entry name already exists it will be replaced with the new one.
  //
  // The value of each map entry is a function that must have either a
  // single return value, or two return values of which the second has type error.
  AddFuncs(funcs: Record<string, TemplateFunc>): Registry {
    for (const [name, fn] of Object.entries(funcs)) {
      this.funcs[name] = fn;
    }

    return this;
  }

  // LoadFiles caches (if not already) the specified filenames set as a
  // single template and returns a ready to use Renderer instance.
  //
  // There must be at least 1 filename specified.
  LoadFiles(...filenames: string[]): Renderer {
    const key = filenames.join(",");

    let found = this.cache.get(key);
    if (!found) {
      found = this.loadFilesInternal(filenames);
      this.cache.set(key, found);
    }

    return found;
  }

  // LoadString caches (if not already) the specified inline string as a
  // single template and returns a ready to use Renderer instance.
  LoadString(text: string): Renderer {
    let found = this.cache.get(text);

    if (!found) {
      const sources: TemplateSource[] = [{ name: "", content: text }];
      found = buildRenderer(sources, this.funcs);
      this.cache.set(text, found);
    }

    return found;
  }

  // LoadFS caches (if not already) the specified fs and globPatterns
  // pair as single template and returns a ready to use Renderer instance.
  //
  // There must be at least 1 file matching the provided globPattern(s)
  // (note that most file names serves as glob patterns matching themselves).
  LoadFS(fsys: unknown, ...globPatterns: string[]): Renderer {
    const key = String(fsys) + globPatterns.join(",");

    let found = this.cache.get(key);
    if (!found) {
      found = this.loadFSInternal(fsys, globPatterns);
      this.cache.set(key, found);
    }

    return found;
  }

  private loadFilesInternal(filenames: string[]): Renderer {
    if (filenames.length === 0) {
      return new Renderer(null, new Error("missing template filenames"));
    }

    try {
      const sources: TemplateSource[] = filenames.map((filename) => ({
        name: basename(filename),
        content: readFileSync(filename, "utf8"),
      }));

      return buildRenderer(sources, this.funcs);
    } catch (error) {
      return new Renderer(null, error as Error);
    }
  }

  private loadFSInternal(fsys: unknown, globPatterns: string[]): Renderer {
    try {
      if (globPatterns.length === 0) {
        return new Renderer(null, new Error("missing template patterns"));
      }

      const root = resolveFSRoot(fsys);
      const files = resolveFSMatches(root, globPatterns);

      if (files.length === 0) {
        return new Renderer(null, new Error("no template files matched"));
      }

      const sources: TemplateSource[] = files.map((file) => ({
        name: basename(file),
        content: readFileSync(join(root, file), "utf8"),
      }));

      return buildRenderer(sources, this.funcs);
    } catch (error) {
      return new Renderer(null, error as Error);
    }
  }
}

function resolveFSRoot(fsys: unknown): string {
  if (typeof fsys === "string") {
    return fsys;
  }

  if (fsys && typeof fsys === "object") {
    const candidate = fsys as { root?: string; dir?: string };
    if (typeof candidate.root === "string") {
      return candidate.root;
    }
    if (typeof candidate.dir === "string") {
      return candidate.dir;
    }
  }

  throw new Error("invalid fs root");
}

function resolveFSMatches(root: string, patterns: string[]): string[] {
  const entries = readdirSync(root, { withFileTypes: true })
    .filter((entry) => !entry.isDirectory())
    .map((entry) => entry.name);

  const matches: string[] = [];
  let missing = false;

  for (const pattern of patterns) {
    const hasWildcard = pattern.includes("*") || pattern.includes("?") || pattern.includes("[");
    let found: string[] = [];

    if (!hasWildcard) {
      try {
        const full = join(root, pattern);
        const stat = statSync(full);
        if (!stat.isDirectory()) {
          found = [pattern];
        }
      } catch {
        found = [];
      }
    } else {
      const regex = globToRegex(pattern);
      found = entries.filter((entry) => regex.test(entry));
    }

    if (found.length === 0) {
      missing = true;
    } else {
      matches.push(...found);
    }
  }

  if (missing) {
    throw new Error("no template files matched");
  }

  return Array.from(new Set(matches));
}

function globToRegex(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|\\]/g, "\\$&");
  const pattern = "^" + escaped.replace(/\*/g, ".*").replace(/\?/g, ".") + "$";
  return new RegExp(pattern);
}
