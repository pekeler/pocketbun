// Ported from pocketbase/tools/osutils/dir.go

import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { existInSlice } from "../list/list.ts";

// MoveDirContent moves the src dir content, that is not listed in the exclude list,
// to dest dir (it will be created if missing).
//
// The rootExclude argument is used to specify a list of src root entries to exclude.
//
// Note that this method doesn't delete the old src dir.
//
// It is an alternative to os.Rename() for the cases where we can't
// rename/delete the src dir (see https://github.com/pocketbase/pocketbase/issues/2519).
export function MoveDirContent(src: string, dest: string, ...rootExclude: string[]): void {
  const entries = readdirSync(src, { withFileTypes: true });

  // make sure that the dest dir exist
  let manuallyCreatedDestDir = false;
  if (!existsSync(dest)) {
    mkdirSync(dest);
    manuallyCreatedDestDir = true;
  }

  const moved = new Map<string, string>();

  const tryRollback = (): Error[] => {
    const errs: Error[] = [];

    for (const [oldPath, newPath] of moved.entries()) {
      try {
        renameSync(newPath, oldPath);
      } catch (error) {
        errs.push(error as Error);
      }
    }

    // try to delete manually the created dest dir if all moved files were restored
    if (manuallyCreatedDestDir && errs.length === 0) {
      try {
        rmSync(dest);
      } catch (error) {
        errs.push(error as Error);
      }
    }

    return errs;
  };

  for (const entry of entries) {
    const basename = entry.name;

    if (existInSlice(basename, rootExclude)) {
      continue;
    }

    const oldPath = join(src, basename);
    const newPath = join(dest, basename);

    try {
      renameSync(oldPath, newPath);
    } catch (error) {
      const rollbackErrors = tryRollback();
      if (rollbackErrors.length > 0) {
        rollbackErrors.push(error as Error);
        throw new AggregateError(rollbackErrors, rollbackErrors.map((err) => err.message).join("\n"));
      }
      throw error as Error;
    }

    moved.set(oldPath, newPath);
  }
}
