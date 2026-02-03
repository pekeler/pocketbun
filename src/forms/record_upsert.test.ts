// Ported from pocketbase/forms/record_upsert_test.go

import { describe, it } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { App } from "../core/app.ts";
import { NewRecord, type Record as RecordModel } from "../core/record_model.ts";
import { newTestApp } from "../tests/app.ts";
import { testValidationErrors } from "../tests/validation_errors.ts";
import { NewFileFromBytes } from "../tools/filesystem/file.ts";
import { RecordUpsert } from "./record_upsert.ts";

describe("RecordUpsert", () => {
  it("loads record data", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const demo1Col = app.findCollectionByNameOrId("demo1");
      if (!demo1Col) {
        throw new Error("Missing demo1 collection");
      }

      const usersCol = app.findCollectionByNameOrId("users");
      if (!usersCol) {
        throw new Error("Missing users collection");
      }

      const file = NewFileFromBytes(new TextEncoder().encode("test"), "test.txt");

      const scenarios: Array<{
        name: string;
        data: Record<string, unknown>;
        record: RecordModel;
        managerAccessLevel?: boolean;
        superuserAccessLevel?: boolean;
        expected: string[];
        notExpected?: string[];
      }> = [
        {
          name: "base collection record",
          data: {
            text: "test_text",
            custom: "123",
            number: "456",
            "select_many+": ["optionB", "optionC"],
            created: "2022-01:01 10:00:00.000Z",
            oldPassword: "123",
            password: "456",
            passwordConfirm: "789",
          },
          record: NewRecord(demo1Col),
          expected: [
            '"text":"test_text"',
            '"number":456',
            '"select_many":["optionB","optionC"]',
            '"created":""',
            '"updated":""',
            '"json":null',
          ],
          notExpected: ['"custom"', '"password"', '"oldPassword"', '"passwordConfirm"', '"select_many-"', '"select_many+"'],
        },
        {
          name: "auth collection record",
          data: {
            email: "test@example.com",
            oldPassword: "123",
            password: "456",
            passwordConfirm: "789",
          },
          record: NewRecord(usersCol),
          expected: ['"email":"test@example.com"', '"password":"456"'],
          notExpected: ['"oldPassword"', '"passwordConfirm"'],
        },
        {
          name: "hidden fields (manager)",
          data: {
            email: "test@example.com",
            tokenKey: "abc",
            password: "456",
            oldPassword: "123",
            passwordConfirm: "789",
          },
          managerAccessLevel: true,
          record: NewRecord(usersCol),
          expected: ['"email":"test@example.com"', '"tokenKey":""', '"password":"456"'],
          notExpected: ['"oldPassword"', '"passwordConfirm"'],
        },
        {
          name: "hidden fields (superuser)",
          data: {
            email: "test@example.com",
            tokenKey: "abc",
            password: "456",
            oldPassword: "123",
            passwordConfirm: "789",
          },
          superuserAccessLevel: true,
          record: NewRecord(usersCol),
          expected: ['"email":"test@example.com"', '"tokenKey":"abc"', '"password":"456"'],
          notExpected: ['"oldPassword"', '"passwordConfirm"'],
        },
        {
          name: "with file field",
          data: {
            file_one: file,
            url: file,
          },
          record: NewRecord(demo1Col),
          expected: ['"file_one":{', '"originalName":"test.txt"', '"url":""'],
        },
      ];

      for (const scenario of scenarios) {
        const form = new RecordUpsert(app, scenario.record);
        if (scenario.managerAccessLevel) {
          form.GrantManagerAccess();
        }
        if (scenario.superuserAccessLevel) {
          form.GrantSuperuserAccess();
        }

        if (!form.HasManageAccess() && (scenario.managerAccessLevel || scenario.superuserAccessLevel)) {
          throw new Error("Expected the form to have manage access level (manager or superuser)");
        }

        form.Load(scenario.data);

        const loaded = { ...scenario.record.FieldsData(), ...scenario.record.CustomData() };
        const rawStr = JSON.stringify(loaded);

        for (const expected of scenario.expected) {
          if (!rawStr.includes(expected)) {
            throw new Error(`Couldn't find ${expected} in ${rawStr}`);
          }
        }

        for (const notExpected of scenario.notExpected ?? []) {
          if (rawStr.includes(notExpected)) {
            throw new Error(`Didn't expect ${notExpected} in ${rawStr}`);
          }
        }
      }
    } finally {
      await cleanup();
    }
  });

  it("dry submit failure", async () => {
    const runTest = async (testApp: App) => {
      const col = testApp.findCollectionByNameOrId("demo1");
      if (!col) {
        throw new Error("Missing demo1 collection");
      }

      const originalId = "imy661ixudk5izi";
      let record = testApp.FindRecordById(col, originalId);
      const oldRaw = JSON.stringify(record);

      const file = NewFileFromBytes(new TextEncoder().encode("test"), "test.txt");

      const form = new RecordUpsert(testApp, record);
      form.Load({
        text: "test_update",
        file_one: file,
        select_one: "!invalid",
      });

      let calls = "";
      testApp.OnRecordValidate([col.Name]).BindFunc((e) => {
        calls += "a";
        return e.Next();
      });

      const result = await form.DrySubmit(() => {
        calls += "b";
        return new Error("error...");
      });

      if (!result) {
        throw new Error("Expected DrySubmit error, got nil");
      }

      if (calls !== "b") {
        throw new Error(`Expected calls "b", got "${calls}"`);
      }

      record = testApp.FindRecordById(col, originalId);
      const newRaw = JSON.stringify(record);

      if (oldRaw !== newRaw) {
        throw new Error(`Expected record ${oldRaw} got ${newRaw}`);
      }

      testFilesCount(testApp, record, 0);
    };

    const { app, cleanup } = await newTestApp();
    try {
      await runTest(app);
    } finally {
      await cleanup();
    }

    const { app: txApp, cleanup: txCleanup } = await newTestApp();
    try {
      const err = await txApp.RunInTransaction(async (inner) => {
        await runTest(inner);
        return null;
      });
      if (err) {
        throw err;
      }
    } finally {
      await txCleanup();
    }
  });

  it("dry submit create success", async () => {
    const runTest = async (testApp: App) => {
      const col = testApp.findCollectionByNameOrId("demo1");
      if (!col) {
        throw new Error("Missing demo1 collection");
      }

      const record = NewRecord(col);

      const file = NewFileFromBytes(new TextEncoder().encode("test"), "test.txt");

      const form = new RecordUpsert(testApp, record);
      form.Load({
        id: "test",
        text: "test_update",
        file_one: file,
        select_one: "!invalid",
      });

      let calls = "";
      testApp.OnRecordValidate([col.Name]).BindFunc((e) => {
        calls += "a";
        return e.Next();
      });

      const result = await form.DrySubmit(() => {
        calls += "b";
        return null;
      });

      if (result) {
        throw new Error(`Expected DrySubmit success, got error: ${result.message}`);
      }

      if (calls !== "b") {
        throw new Error(`Expected calls "b", got "${calls}"`);
      }

      let found = true;
      try {
        testApp.FindRecordById(col, record.Id);
      } catch {
        found = false;
      }

      if (found) {
        throw new Error("Expected the created record to be deleted");
      }

      testFilesCount(testApp, record, 0);
    };

    const { app, cleanup } = await newTestApp();
    try {
      await runTest(app);
    } finally {
      await cleanup();
    }

    const { app: txApp, cleanup: txCleanup } = await newTestApp();
    try {
      const err = await txApp.RunInTransaction(async (inner) => {
        await runTest(inner);
        return null;
      });
      if (err) {
        throw err;
      }
    } finally {
      await txCleanup();
    }
  });

  it("dry submit update success", async () => {
    const runTest = async (testApp: App) => {
      const col = testApp.findCollectionByNameOrId("demo1");
      if (!col) {
        throw new Error("Missing demo1 collection");
      }

      let record = testApp.FindRecordById(col, "imy661ixudk5izi");
      const oldRaw = JSON.stringify(record);

      const file = NewFileFromBytes(new TextEncoder().encode("test"), "test.txt");

      const form = new RecordUpsert(testApp, record);
      form.Load({
        text: "test_update",
        file_one: file,
      });

      let calls = "";
      testApp.OnRecordValidate([col.Name]).BindFunc((e) => {
        calls += "a";
        return e.Next();
      });

      const result = await form.DrySubmit(() => {
        calls += "b";
        return null;
      });

      if (result) {
        throw new Error(`Expected DrySubmit success, got error: ${result.message}`);
      }

      if (calls !== "b") {
        throw new Error(`Expected calls "b", got "${calls}"`);
      }

      record = testApp.FindRecordById(col, record.Id);
      const newRaw = JSON.stringify(record);

      if (oldRaw !== newRaw) {
        throw new Error(`Expected record ${oldRaw} got ${newRaw}`);
      }

      testFilesCount(testApp, record, 0);
    };

    const { app, cleanup } = await newTestApp();
    try {
      await runTest(app);
    } finally {
      await cleanup();
    }

    const { app: txApp, cleanup: txCleanup } = await newTestApp();
    try {
      const err = await txApp.RunInTransaction(async (inner) => {
        await runTest(inner);
        return null;
      });
      if (err) {
        throw err;
      }
    } finally {
      await txCleanup();
    }
  });

  it("submit validations", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const demo2Col = app.findCollectionByNameOrId("demo2");
      if (!demo2Col) {
        throw new Error("Missing demo2 collection");
      }

      const demo2Rec = app.FindRecordById(demo2Col, "llvuca81nly1qls");

      const usersCol = app.findCollectionByNameOrId("users");
      if (!usersCol) {
        throw new Error("Missing users collection");
      }

      const userRec = app.FindRecordById(usersCol, "4q1xlclmfloku33");

      const scenarios: Array<{
        name: string;
        record: RecordModel;
        data: Record<string, unknown>;
        managerAccess?: boolean;
        expectedErrors: string[];
      }> = [
        {
          name: "new base collection record with empty data",
          record: NewRecord(demo2Col),
          data: {},
          expectedErrors: ["title"],
        },
        {
          name: "new base collection record with invalid data",
          record: NewRecord(demo2Col),
          data: {
            title: "",
            custom: "abc",
            oldPassword: "123",
            password: "456",
            passwordConfirm: "789",
          },
          expectedErrors: ["title"],
        },
        {
          name: "new base collection record with valid data",
          record: NewRecord(demo2Col),
          data: {
            title: "abc",
            custom: "abc",
            oldPassword: "123",
            password: "456",
            passwordConfirm: "789",
          },
          expectedErrors: [],
        },
        {
          name: "existing base collection record with empty data",
          record: demo2Rec,
          data: {},
          expectedErrors: [],
        },
        {
          name: "existing base collection record with invalid data",
          record: demo2Rec,
          data: {
            title: "",
          },
          expectedErrors: ["title"],
        },
        {
          name: "existing base collection record with valid data",
          record: demo2Rec,
          data: {
            title: "abc",
          },
          expectedErrors: [],
        },
        {
          name: "new auth collection record with empty data",
          record: NewRecord(usersCol),
          data: {},
          expectedErrors: ["password", "passwordConfirm"],
        },
        {
          name: "new auth collection record with invalid record and invalid form data (without manager acess)",
          record: NewRecord(usersCol),
          data: {
            verified: true,
            emailVisibility: true,
            email: "test@example.com",
            password: "456",
            passwordConfirm: "789",
            username: "!invalid",
            tokenKey: "a".repeat(2),
            custom: "abc",
            oldPassword: "123",
          },
          expectedErrors: ["verified", "passwordConfirm"],
        },
        {
          name: "new auth collection record with invalid record and valid form data (without manager acess)",
          record: NewRecord(usersCol),
          data: {
            verified: false,
            emailVisibility: true,
            email: "test@example.com",
            password: "456",
            passwordConfirm: "456",
            username: "!invalid",
            tokenKey: "a".repeat(2),
            custom: "abc",
            oldPassword: "123",
          },
          expectedErrors: ["password", "username"],
        },
        {
          name: "new auth collection record with invalid record and invalid form data (with manager acess)",
          record: NewRecord(usersCol),
          managerAccess: true,
          data: {
            verified: true,
            emailVisibility: true,
            email: "test@example.com",
            password: "456",
            passwordConfirm: "789",
            username: "!invalid",
            tokenKey: "a".repeat(2),
            custom: "abc",
            oldPassword: "123",
          },
          expectedErrors: ["passwordConfirm"],
        },
        {
          name: "new auth collection record with invalid record and valid form data (with manager acess)",
          record: NewRecord(usersCol),
          managerAccess: true,
          data: {
            verified: true,
            emailVisibility: true,
            email: "test@example.com",
            password: "456",
            passwordConfirm: "456",
            username: "!invalid",
            tokenKey: "a".repeat(2),
            custom: "abc",
            oldPassword: "123",
          },
          expectedErrors: ["password", "username"],
        },
        {
          name: "new auth collection record with valid data",
          record: NewRecord(usersCol),
          data: {
            emailVisibility: true,
            email: "test_new@example.com",
            password: "1234567890",
            passwordConfirm: "1234567890",
            tokenKey: "a".repeat(2),
            custom: "abc",
            oldPassword: "123",
          },
          expectedErrors: [],
        },
        {
          name: "new auth collection record with valid data and duplicated email",
          record: NewRecord(usersCol),
          data: {
            email: "test@example.com",
            password: "1234567890",
            passwordConfirm: "1234567890",
            tokenKey: "a".repeat(2),
            custom: "abc",
            oldPassword: "123",
          },
          expectedErrors: ["email"],
        },
        {
          name: "existing auth collection record with empty data",
          record: userRec,
          data: {},
          expectedErrors: [],
        },
        {
          name: "existing auth collection record with invalid record data and invalid form data (without manager access)",
          record: userRec,
          data: {
            verified: true,
            email: "test_new@example.com",
            oldPassword: "123",
            password: "456",
            passwordConfirm: "789",
            username: "!invalid",
            tokenKey: "a".repeat(2),
            custom: "abc",
          },
          expectedErrors: ["verified", "email", "oldPassword", "passwordConfirm"],
        },
        {
          name: "existing auth collection record with invalid record data and valid form data (without manager access)",
          record: userRec,
          data: {
            oldPassword: "1234567890",
            password: "12345678901",
            passwordConfirm: "12345678901",
            username: "!invalid",
            tokenKey: "a".repeat(2),
            custom: "abc",
          },
          expectedErrors: ["username"],
        },
        {
          name: "existing auth collection record with invalid record data and invalid form data (with manager access)",
          record: userRec,
          managerAccess: true,
          data: {
            verified: true,
            email: "test_new@example.com",
            oldPassword: "123",
            password: "456",
            passwordConfirm: "789",
            username: "!invalid",
            tokenKey: "a".repeat(2),
            custom: "abc",
          },
          expectedErrors: ["passwordConfirm"],
        },
        {
          name: "existing auth collection record with invalid record data and valid form data (with manager access)",
          record: userRec,
          managerAccess: true,
          data: {
            verified: true,
            email: "test_new@example.com",
            oldPassword: "1234567890",
            password: "12345678901",
            passwordConfirm: "12345678901",
            username: "!invalid",
            tokenKey: "a".repeat(2),
            custom: "abc",
          },
          expectedErrors: ["username"],
        },
        {
          name: "existing auth collection record with base valid data",
          record: userRec,
          data: {
            name: "test",
          },
          expectedErrors: [],
        },
        {
          name: "existing auth collection record with valid password and invalid oldPassword data",
          record: userRec,
          data: {
            name: "test",
            oldPassword: "invalid",
            password: "1234567890",
            passwordConfirm: "1234567890",
          },
          expectedErrors: ["oldPassword"],
        },
        {
          name: "existing auth collection record with valid password data",
          record: userRec,
          data: {
            name: "test",
            oldPassword: "1234567890",
            password: "0987654321",
            passwordConfirm: "0987654321",
          },
          expectedErrors: [],
        },
      ];

      for (const scenario of scenarios) {
        const { app: testApp, cleanup: scenarioCleanup } = await newTestApp();
        try {
          const form = new RecordUpsert(testApp, scenario.record.Original());
          if (scenario.managerAccess) {
            form.GrantManagerAccess();
          }
          form.Load(scenario.data);

          const result = await form.Submit();
          testValidationErrors(result, scenario.expectedErrors);
        } finally {
          await scenarioCleanup();
        }
      }
    } finally {
      await cleanup();
    }
  });

  it("submit failure", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const col = app.findCollectionByNameOrId("demo1");
      if (!col) {
        throw new Error("Missing demo1 collection");
      }

      let record = app.FindRecordById(col, "imy661ixudk5izi");
      const file = NewFileFromBytes(new TextEncoder().encode("test"), "test.txt");

      const form = new RecordUpsert(app, record);
      form.Load({
        text: "test_update",
        file_one: file,
        select_one: "invalid",
      });

      let validateCalls = 0;
      app.OnRecordValidate([col.Name]).BindFunc((e) => {
        validateCalls += 1;
        return e.Next();
      });

      const result = await form.Submit();

      if (!result) {
        throw new Error("Expected Submit error, got nil");
      }

      if (validateCalls !== 1) {
        throw new Error(`Expected validateCalls 1, got ${validateCalls}`);
      }

      record = app.FindRecordById(col, record.Id);

      if (record.GetString("text") === "test_update") {
        throw new Error(`Expected record.text to remain the same, got ${record.GetString("text")}`);
      }

      if (record.GetString("select_one") !== "") {
        throw new Error(`Expected record.select_one to remain the same, got ${record.GetString("select_one")}`);
      }

      if (record.GetString("file_one") !== "") {
        throw new Error(`Expected record.file_one to remain the same, got ${record.GetString("file_one")}`);
      }

      testFilesCount(app, record, 0);
    } finally {
      await cleanup();
    }
  });

  it("submit success", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const col = app.findCollectionByNameOrId("demo1");
      if (!col) {
        throw new Error("Missing demo1 collection");
      }

      let record = app.FindRecordById(col, "imy661ixudk5izi");
      const file = NewFileFromBytes(new TextEncoder().encode("test"), "test.txt");

      const form = new RecordUpsert(app, record);
      form.Load({
        text: "test_update",
        file_one: file,
        select_one: "optionC",
      });

      let validateCalls = 0;
      app.OnRecordValidate([col.Name]).BindFunc((e) => {
        validateCalls += 1;
        return e.Next();
      });

      const result = await form.Submit();

      if (result) {
        throw new Error(`Expected Submit success, got error: ${result.message}`);
      }

      if (validateCalls !== 1) {
        throw new Error(`Expected validateCalls 1, got ${validateCalls}`);
      }

      record = app.FindRecordById(col, record.Id);

      if (record.GetString("text") !== "test_update") {
        throw new Error(`Expected record.text "test_update", got ${record.GetString("text")}`);
      }

      if (record.GetString("select_one") !== "optionC") {
        throw new Error(`Expected record.select_one "optionC", got ${record.GetString("select_one")}`);
      }

      if (record.GetString("file_one") !== file.Name) {
        throw new Error(`Expected record.file_one "${file.Name}", got ${record.GetString("file_one")}`);
      }

      testFilesCount(app, record, 2);
    } finally {
      await cleanup();
    }
  });

  describe("passwords sync", () => {
    it("new user without password", async () => {
      const { app, cleanup } = await newTestApp();
      try {
        const users = app.findCollectionByNameOrId("users");
        if (!users) {
          throw new Error("Missing users collection");
        }

        const record = NewRecord(users);
        const form = new RecordUpsert(app, record);

        const err = await form.Submit();
        testValidationErrors(err, ["password", "passwordConfirm"]);
      } finally {
        await cleanup();
      }
    });

    it("new user with manual password", async () => {
      const { app, cleanup } = await newTestApp();
      try {
        const users = app.findCollectionByNameOrId("users");
        if (!users) {
          throw new Error("Missing users collection");
        }

        const record = NewRecord(users);
        const form = new RecordUpsert(app, record);

        record.SetPassword("1234567890");

        const err = await form.Submit();
        if (err) {
          throw new Error(`Expected no errors, got ${err.message}`);
        }
      } finally {
        await cleanup();
      }
    });

    it("new user with random password", async () => {
      const { app, cleanup } = await newTestApp();
      try {
        const users = app.findCollectionByNameOrId("users");
        if (!users) {
          throw new Error("Missing users collection");
        }

        const record = NewRecord(users);
        const form = new RecordUpsert(app, record);

        record.SetRandomPassword();

        const err = await form.Submit();
        if (err) {
          throw new Error(`Expected no errors, got ${err.message}`);
        }
      } finally {
        await cleanup();
      }
    });

    it("update user with no password change", async () => {
      const { app, cleanup } = await newTestApp();
      try {
        const users = app.findCollectionByNameOrId("users");
        if (!users) {
          throw new Error("Missing users collection");
        }

        const record = app.FindAuthRecordByEmail(users, "test@example.com");
        const oldHash = record.GetString("password:hash");

        const form = new RecordUpsert(app, record);

        const err = await form.Submit();
        if (err) {
          throw new Error(`Expected no errors, got ${err.message}`);
        }

        const newHash = record.GetString("password:hash");
        if (!newHash || newHash !== oldHash) {
          throw new Error("Expected no password change");
        }
      } finally {
        await cleanup();
      }
    });

    it("update user with manual password change", async () => {
      const { app, cleanup } = await newTestApp();
      try {
        const users = app.findCollectionByNameOrId("users");
        if (!users) {
          throw new Error("Missing users collection");
        }

        const record = app.FindAuthRecordByEmail(users, "test@example.com");
        const oldHash = record.GetString("password:hash");

        const form = new RecordUpsert(app, record);

        record.SetPassword("1234567890");

        const err = await form.Submit();
        if (err) {
          throw new Error(`Expected no errors, got ${err.message}`);
        }

        const newHash = record.GetString("password:hash");
        if (!newHash || newHash === oldHash) {
          throw new Error("Expected password change");
        }
      } finally {
        await cleanup();
      }
    });

    it("update user with random password change", async () => {
      const { app, cleanup } = await newTestApp();
      try {
        const users = app.findCollectionByNameOrId("users");
        if (!users) {
          throw new Error("Missing users collection");
        }

        const record = app.FindAuthRecordByEmail(users, "test@example.com");
        const oldHash = record.GetString("password:hash");

        const form = new RecordUpsert(app, record);

        record.SetRandomPassword();

        const err = await form.Submit();
        if (err) {
          throw new Error(`Expected no errors, got ${err.message}`);
        }

        const newHash = record.GetString("password:hash");
        if (!newHash || newHash === oldHash) {
          throw new Error("Expected password change");
        }
      } finally {
        await cleanup();
      }
    });
  });
});

function testFilesCount(app: App, record: RecordModel, count: number): void {
  const storageDir = join(app.dataDir(), "storage", record.collection().Id, record.Id);
  let entries: string[] = [];
  try {
    entries = readdirSync(storageDir);
  } catch {
    entries = [];
  }
  if (entries.length !== count) {
    throw new Error(`Expected ${count} entries, got ${entries.length}\n${entries.join(", ")}`);
  }
}
