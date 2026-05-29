// Ported from pocketbase/core/system_alert_test.go

import { describe, it } from "bun:test";
import { newTestApp } from "../tests/app.ts";
import { CollectionNameSuperusers } from "./collection_model.ts";
import { sendSystemAlert, sendSystemAlertToAllSuperusers } from "./system_alert.ts";

describe("system alerts", () => {
  it("sendSystemAlert", async () => {
    const managed = await newTestApp();
    const app = managed.app;
    try {
      const superuser = app.FindAuthRecordByEmail(CollectionNameSuperusers, "test@example.com");

      const err = await sendSystemAlert(app, superuser, "test_subject", "test_details");
      if (err) {
        throw err;
      }

      if (app.testMailer.TotalSend() !== 1) {
        throw new Error(`Expected 1 mail send call, got ${app.testMailer.TotalSend()}`);
      }

      const message = app.testMailer.LastMessage();
      if (!message.Subject.includes("test_subject")) {
        throw new Error(`Missing "test_subject" in Message.Subject:\n${message.Subject}`);
      }
      if (!message.HTML.includes("test_details")) {
        throw new Error(`Missing "test_details" in Message.HTML:\n${message.HTML}`);
      }
      if (message.To.length !== 1 || message.To[0]?.Address !== "test@example.com") {
        throw new Error(`Expected To address "test@example.com", got ${JSON.stringify(message.To)}`);
      }
    } finally {
      await managed.cleanup();
    }
  });

  it("sendSystemAlertToAllSuperusers", async () => {
    const managed = await newTestApp();
    const app = managed.app;
    try {
      const expected = app.FindAllRecords(CollectionNameSuperusers).length;

      const err = await sendSystemAlertToAllSuperusers(app, "test_subject", "test_details");
      if (err) {
        throw err;
      }

      if (app.testMailer.TotalSend() !== expected) {
        throw new Error(`Expected ${expected} mail send call(s), got ${app.testMailer.TotalSend()}`);
      }

      for (const message of app.testMailer.Messages()) {
        if (!message.Subject.includes("test_subject")) {
          throw new Error(`Missing "test_subject" in Message.Subject:\n${message.Subject}`);
        }
        if (!message.HTML.includes("test_details")) {
          throw new Error(`Missing "test_details" in Message.HTML:\n${message.HTML}`);
        }
      }
    } finally {
      await managed.cleanup();
    }
  });
});
