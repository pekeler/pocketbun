// PocketBun-only: tests async App helper fallbacks for optional filesystem methods.

import { describe, expect, it } from "bun:test";
import type { App } from "./app.ts";
import { newBackupsFilesystemAsync, newFilesystemAsync } from "./app.ts";

type FilesystemApp = Pick<App, "NewFilesystem" | "NewBackupsFilesystem"> & {
  NewFilesystemAsync?: () => Promise<ReturnType<App["NewFilesystem"]>>;
  NewBackupsFilesystemAsync?: () => Promise<ReturnType<App["NewBackupsFilesystem"]>>;
};

describe("app async filesystem helpers", () => {
  it("prefers NewFilesystemAsync when available", async () => {
    const syncFilesystem = { source: "sync" } as unknown as ReturnType<App["NewFilesystem"]>;
    const asyncFilesystem = { source: "async" } as unknown as ReturnType<App["NewFilesystem"]>;
    const app: FilesystemApp = {
      NewFilesystem: () => syncFilesystem,
      NewFilesystemAsync: async () => asyncFilesystem,
      NewBackupsFilesystem: () => syncFilesystem as unknown as ReturnType<App["NewBackupsFilesystem"]>,
    };

    const result = await newFilesystemAsync(app as App);

    expect(result).toBe(asyncFilesystem);
  });

  it("falls back to NewFilesystem when NewFilesystemAsync is unavailable", async () => {
    const syncFilesystem = { source: "sync" } as unknown as ReturnType<App["NewFilesystem"]>;
    const app: FilesystemApp = {
      NewFilesystem: () => syncFilesystem,
      NewBackupsFilesystem: () => syncFilesystem as unknown as ReturnType<App["NewBackupsFilesystem"]>,
    };

    const result = await newFilesystemAsync(app as App);

    expect(result).toBe(syncFilesystem);
  });

  it("prefers NewBackupsFilesystemAsync when available", async () => {
    const syncFilesystem = { source: "sync" } as unknown as ReturnType<App["NewBackupsFilesystem"]>;
    const asyncFilesystem = { source: "async" } as unknown as ReturnType<App["NewBackupsFilesystem"]>;
    const app: FilesystemApp = {
      NewFilesystem: () => syncFilesystem as unknown as ReturnType<App["NewFilesystem"]>,
      NewBackupsFilesystem: () => syncFilesystem,
      NewBackupsFilesystemAsync: async () => asyncFilesystem,
    };

    const result = await newBackupsFilesystemAsync(app as App);

    expect(result).toBe(asyncFilesystem);
  });

  it("falls back to NewBackupsFilesystem when NewBackupsFilesystemAsync is unavailable", async () => {
    const syncFilesystem = { source: "sync" } as unknown as ReturnType<App["NewBackupsFilesystem"]>;
    const app: FilesystemApp = {
      NewFilesystem: () => syncFilesystem as unknown as ReturnType<App["NewFilesystem"]>,
      NewBackupsFilesystem: () => syncFilesystem,
    };

    const result = await newBackupsFilesystemAsync(app as App);

    expect(result).toBe(syncFilesystem);
  });
});
