// Ported from pocketbase/core/db_tx_test.go.

import { describe, expect, it } from "bun:test";
import { newTestApp } from "../tests/app.ts";
import { CollectionNameSuperusers } from "./collection.ts";
import { NewRecord } from "./record.ts";

describe("db tx", () => {
  it("RunInTransaction", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      await app.RunInTransaction(async (txApp) => {
        const superuser = txApp.FindAuthRecordByEmail(CollectionNameSuperusers, "test@example.com");

        return await txApp.RunInTransaction(async (tx2App) => {
          const err = await tx2App.Delete(superuser);
          if (err) {
            return err;
          }
          return new Error("test error");
        });
      });

      let exists: ReturnType<typeof app.FindAuthRecordByEmail> | null = null;
      try {
        exists = app.FindAuthRecordByEmail(CollectionNameSuperusers, "test@example.com");
      } catch {
        exists = null;
      }
      expect(exists).not.toBeNull();

      await app.RunInTransaction(async (txApp) => {
        const superuser = txApp.FindAuthRecordByEmail(CollectionNameSuperusers, "test@example.com");

        return await txApp.RunInTransaction(async (tx2App) => {
          return await tx2App.Delete(superuser);
        });
      });

      let removed: ReturnType<typeof app.FindAuthRecordByEmail> | null = null;
      try {
        removed = app.FindAuthRecordByEmail(CollectionNameSuperusers, "test@example.com");
      } catch {
        removed = null;
      }
      expect(removed).toBeNull();
    } finally {
      await cleanup();
    }
  });

  it("Transaction hooks calls on failure", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      let createHookCalls = 0;
      let updateHookCalls = 0;
      let deleteHookCalls = 0;
      let afterCreateHookCalls = 0;
      let afterUpdateHookCalls = 0;
      let afterDeleteHookCalls = 0;

      app.OnModelCreate().BindFunc((e) => {
        createHookCalls += 1;
        return e.Next();
      });

      app.OnModelUpdate().BindFunc((e) => {
        updateHookCalls += 1;
        return e.Next();
      });

      app.OnModelDelete().BindFunc((e) => {
        deleteHookCalls += 1;
        return e.Next();
      });

      app.OnModelAfterCreateSuccess().BindFunc((e) => {
        afterCreateHookCalls += 1;
        return e.Next();
      });

      app.OnModelAfterUpdateSuccess().BindFunc((e) => {
        afterUpdateHookCalls += 1;
        return e.Next();
      });

      app.OnModelAfterDeleteSuccess().BindFunc((e) => {
        afterDeleteHookCalls += 1;
        return e.Next();
      });

      const existingModel = app.FindAuthRecordByEmail(CollectionNameSuperusers, "test@example.com");

      await app.RunInTransaction(async (txApp1) => {
        return await txApp1.RunInTransaction(async (txApp2) => {
          const newModel = NewRecord(existingModel.collection());
          newModel.SetEmail("test_new1@example.com");
          newModel.SetPassword("1234567890");
          const createErr = await txApp2.Save(newModel);
          if (createErr) {
            return createErr;
          }

          const updateErr1 = await txApp2.Save(existingModel);
          if (updateErr1) {
            return updateErr1;
          }
          const updateErr2 = await txApp2.Save(existingModel);
          if (updateErr2) {
            return updateErr2;
          }

          const deleteErr = await txApp2.Delete(newModel);
          if (deleteErr) {
            return deleteErr;
          }

          return new Error("test_tx_error");
        });
      });

      expect(createHookCalls).toBe(1);
      expect(updateHookCalls).toBe(2);
      expect(deleteHookCalls).toBe(1);
      expect(afterCreateHookCalls).toBe(0);
      expect(afterUpdateHookCalls).toBe(0);
      expect(afterDeleteHookCalls).toBe(0);
    } finally {
      await cleanup();
    }
  });

  it("Transaction hooks calls on success", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      let createHookCalls = 0;
      let updateHookCalls = 0;
      let deleteHookCalls = 0;
      let afterCreateHookCalls = 0;
      let afterUpdateHookCalls = 0;
      let afterDeleteHookCalls = 0;

      app.OnModelCreate().BindFunc((e) => {
        createHookCalls += 1;
        return e.Next();
      });

      app.OnModelUpdate().BindFunc((e) => {
        updateHookCalls += 1;
        return e.Next();
      });

      app.OnModelDelete().BindFunc((e) => {
        deleteHookCalls += 1;
        return e.Next();
      });

      app.OnModelAfterCreateSuccess().BindFunc((e) => {
        if (e.App.IsTransactional()) {
          throw new Error("Expected e.App to be non-transactional");
        }
        afterCreateHookCalls += 1;
        return e.Next();
      });

      app.OnModelAfterUpdateSuccess().BindFunc((e) => {
        if (e.App.IsTransactional()) {
          throw new Error("Expected e.App to be non-transactional");
        }
        afterUpdateHookCalls += 1;
        return e.Next();
      });

      app.OnModelAfterDeleteSuccess().BindFunc((e) => {
        if (e.App.IsTransactional()) {
          throw new Error("Expected e.App to be non-transactional");
        }
        afterDeleteHookCalls += 1;
        return e.Next();
      });

      const existingModel = app.FindAuthRecordByEmail(CollectionNameSuperusers, "test@example.com");

      await app.RunInTransaction(async (txApp1) => {
        return await txApp1.RunInTransaction(async (txApp2) => {
          const newModel = NewRecord(existingModel.collection());
          newModel.SetEmail("test_new1@example.com");
          newModel.SetPassword("1234567890");
          const createErr = await txApp2.Save(newModel);
          if (createErr) {
            return createErr;
          }

          const updateErr1 = await txApp2.Save(existingModel);
          if (updateErr1) {
            return updateErr1;
          }
          const updateErr2 = await txApp2.Save(existingModel);
          if (updateErr2) {
            return updateErr2;
          }

          const deleteErr = await txApp2.Delete(newModel);
          if (deleteErr) {
            return deleteErr;
          }

          return null;
        });
      });

      expect(createHookCalls).toBe(1);
      expect(updateHookCalls).toBe(2);
      expect(deleteHookCalls).toBe(1);
      expect(afterCreateHookCalls).toBe(1);
      expect(afterUpdateHookCalls).toBe(2);
      expect(afterDeleteHookCalls).toBe(1);
    } finally {
      await cleanup();
    }
  });

  it("Transaction from inner create hook", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      app.OnRecordCreateExecute(["demo2"]).BindFunc(async (e) => {
        const originalApp = e.App;
        return await e.App.RunInTransaction(async (txApp) => {
          e.App = txApp;
          try {
            return (await e.Next()) as Error | null;
          } finally {
            e.App = originalApp;
          }
        });
      });

      app.OnRecordAfterCreateSuccess(["demo2"]).BindFunc(async (e) => {
        if (e.App.IsTransactional()) {
          throw new Error("Expected e.App to be non-transactional");
        }

        e.App.FindFirstRecordByFilter("demo2", "1=1");
        return await e.Next();
      });

      const collection = app.FindCollectionByNameOrId("demo2");
      const record = NewRecord(collection);
      record.Set("title", "test_inner_tx");

      const err = await app.Save(record);
      if (err) {
        throw err;
      }

      const expectedHookCalls: Record<string, number> = {
        OnRecordCreateExecute: 1,
        OnRecordAfterCreateSuccess: 1,
      };
      for (const [key, total] of Object.entries(expectedHookCalls)) {
        const found = app.eventCalls[key] ?? 0;
        expect(found).toBe(total);
      }
    } finally {
      await cleanup();
    }
  });

  it("Transaction from inner update hook", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      app.OnRecordUpdateExecute(["demo2"]).BindFunc(async (e) => {
        const originalApp = e.App;
        return await e.App.RunInTransaction(async (txApp) => {
          e.App = txApp;
          try {
            return (await e.Next()) as Error | null;
          } finally {
            e.App = originalApp;
          }
        });
      });

      app.OnRecordAfterUpdateSuccess(["demo2"]).BindFunc(async (e) => {
        if (e.App.IsTransactional()) {
          throw new Error("Expected e.App to be non-transactional");
        }

        e.App.FindFirstRecordByFilter("demo2", "1=1");
        return await e.Next();
      });

      const existingModel = app.FindFirstRecordByFilter("demo2", "1=1");

      const err = await app.Save(existingModel);
      if (err) {
        throw err;
      }

      const expectedHookCalls: Record<string, number> = {
        OnRecordUpdateExecute: 1,
        OnRecordAfterUpdateSuccess: 1,
      };
      for (const [key, total] of Object.entries(expectedHookCalls)) {
        const found = app.eventCalls[key] ?? 0;
        expect(found).toBe(total);
      }
    } finally {
      await cleanup();
    }
  });

  it("Transaction from inner delete hook", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      app.OnRecordDeleteExecute(["demo2"]).BindFunc(async (e) => {
        const originalApp = e.App;
        return await e.App.RunInTransaction(async (txApp) => {
          e.App = txApp;
          try {
            return (await e.Next()) as Error | null;
          } finally {
            e.App = originalApp;
          }
        });
      });

      app.OnRecordAfterDeleteSuccess(["demo2"]).BindFunc(async (e) => {
        if (e.App.IsTransactional()) {
          throw new Error("Expected e.App to be non-transactional");
        }

        e.App.FindFirstRecordByFilter("demo2", "1=1");
        return await e.Next();
      });

      const existingModel = app.FindFirstRecordByFilter("demo2", "1=1");

      const err = await app.Delete(existingModel);
      if (err) {
        throw err;
      }

      const expectedHookCalls: Record<string, number> = {
        OnRecordDeleteExecute: 1,
        OnRecordAfterDeleteSuccess: 1,
      };
      for (const [key, total] of Object.entries(expectedHookCalls)) {
        const found = app.eventCalls[key] ?? 0;
        expect(found).toBe(total);
      }
    } finally {
      await cleanup();
    }
  });
});
