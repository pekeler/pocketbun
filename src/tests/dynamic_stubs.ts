// Ported from pocketbase/tests/dynamic_stubs.go (OTP/MFA/logs stubs only).

import type { App } from "../core/app.ts";
import { CollectionNameSuperusers } from "../core/collection.ts";
import { MFAMethodOAuth2, MFAMethodOTP, MFAMethodPassword, NewMFA } from "../core/mfa_model.ts";
import { NewOTP } from "../core/otp_model.ts";
import { DateTime, NowDateTime } from "../tools/types/index.ts";

function cloneDateTime(dt: DateTime): DateTime {
  return new DateTime(dt.time());
}

export function StubOTPRecords(app: App): Error | null {
  try {
    const superuser2 = app.FindAuthRecordByEmail(CollectionNameSuperusers, "test2@example.com");
    superuser2.SetRaw("stubId", "superuser2");

    const superuser3 = app.FindAuthRecordByEmail(CollectionNameSuperusers, "test3@example.com");
    superuser3.SetRaw("stubId", "superuser3");

    const user1 = app.FindAuthRecordByEmail("users", "test@example.com");
    user1.SetRaw("stubId", "user1");

    const now = NowDateTime();
    const old = cloneDateTime(now).Add(-1 * 60 * 60 * 1000);

    const stubs = new Map([
      [
        superuser2,
        [
          cloneDateTime(now),
          cloneDateTime(now).Add(-1),
          cloneDateTime(old),
          cloneDateTime(now).Add(-2),
          cloneDateTime(old).Add(-1),
        ],
      ],
      [superuser3, [cloneDateTime(now).Add(-3), cloneDateTime(now).Add(-2 * 60 * 1000)]],
      [user1, [cloneDateTime(old)]],
    ]);

    for (const [record, dates] of stubs.entries()) {
      for (const [index, date] of dates.entries()) {
        const otp = NewOTP(app);
        otp.Id = `${record.GetString("stubId")}_${index}`;
        otp.SetRecordRef(record.Id);
        otp.SetCollectionRef(record.collection().id);
        otp.ProxyRecord().SetPassword("test123");
        otp.ProxyRecord().SetRaw("created", date);
        const err = app.SaveNoValidate(otp);
        if (err) {
          return err;
        }
      }
    }

    return null;
  } catch (error) {
    return error as Error;
  }
}

export function StubMFARecords(app: App): Error | null {
  try {
    const superuser2 = app.FindAuthRecordByEmail(CollectionNameSuperusers, "test2@example.com");
    superuser2.SetRaw("stubId", "superuser2");

    const superuser3 = app.FindAuthRecordByEmail(CollectionNameSuperusers, "test3@example.com");
    superuser3.SetRaw("stubId", "superuser3");

    const user1 = app.FindAuthRecordByEmail("users", "test@example.com");
    user1.SetRaw("stubId", "user1");

    const now = NowDateTime();
    const old = cloneDateTime(now).Add(-1 * 60 * 60 * 1000);

    const stubs = new Map([
      [
        superuser2,
        [
          { method: MFAMethodOTP, date: cloneDateTime(now) },
          { method: MFAMethodOTP, date: cloneDateTime(old) },
          { method: MFAMethodPassword, date: cloneDateTime(now).Add(-2 * 60 * 1000) },
          { method: MFAMethodPassword, date: cloneDateTime(now).Add(-1) },
          { method: MFAMethodOAuth2, date: cloneDateTime(old).Add(-1) },
        ],
      ],
      [
        superuser3,
        [
          { method: MFAMethodOAuth2, date: cloneDateTime(now).Add(-3) },
          { method: MFAMethodPassword, date: cloneDateTime(now).Add(-3 * 60 * 1000) },
        ],
      ],
      [user1, [{ method: MFAMethodOAuth2, date: cloneDateTime(old) }]],
    ]);

    for (const [record, items] of stubs.entries()) {
      for (const [index, data] of items.entries()) {
        const mfa = NewMFA(app);
        mfa.Id = `${record.GetString("stubId")}_${index}`;
        mfa.SetRecordRef(record.Id);
        mfa.SetCollectionRef(record.collection().id);
        mfa.SetMethod(data.method);
        mfa.ProxyRecord().SetRaw("created", data.date);
        const err = app.SaveNoValidate(mfa);
        if (err) {
          return err;
        }
      }
    }

    return null;
  } catch (error) {
    return error as Error;
  }
}

export function StubLogsData(app: App): Error | null {
  try {
    app.auxDb().run(`
      delete from {{_logs}};

      insert into {{_logs}} (
        [[id]],
        [[level]],
        [[message]],
        [[data]],
        [[created]]
      )
      values
      (
        "873f2133-9f38-44fb-bf82-c8f53b310d91",
        0,
        "test_message1",
        '{"status":200}',
        "2022-05-01 10:00:00.123Z"
      ),
      (
        "f2133873-44fb-9f38-bf82-c918f53b310d",
        8,
        "test_message2",
        '{"status":400}',
        "2022-05-02 10:00:00.123Z"
      );
    `);

    return null;
  } catch (error) {
    return error as Error;
  }
}
