// Ported from pocketbase/apis/record_helpers_test.go.

import { describe, expect, it } from "bun:test";
import type { Record as RecordModel } from "../core/record_model.ts";
import { NewAuthOrigin } from "../core/auth_origin_model.ts";
import { CollectionNameSuperusers } from "../core/collection_model.ts";
import { RequestEvent } from "../core/event_request.ts";
import { RecordEnrichEvent } from "../core/events.ts";
import { NewMFA } from "../core/mfa_model.ts";
import { newTestApp } from "../tests/app.ts";
import { NowDateTime, Pointer } from "../tools/types/index.ts";
import { EnrichRecords, RecordAuthResponse } from "./record_helpers.ts";

describe("record helpers", () => {
  it("EnrichRecords", async () => {
    const { app: baseApp, cleanup: baseCleanup } = await newTestApp();
    try {
      const freshRecords = (records: RecordModel[]): RecordModel[] => records.map((record) => record.Fresh());

      const user = baseApp.FindAuthRecordByEmail("users", "test@example.com");
      const superuser = baseApp.FindAuthRecordByEmail(CollectionNameSuperusers, "test@example.com");

      const usersRecords = baseApp.FindRecordsByIds("users", ["4q1xlclmfloku33", "bgs820n361vj1qd"]);
      const nologinRecords = baseApp.FindRecordsByIds("nologin", ["dc49k6jgejn40h3", "oos036e9xvqeexy"]);
      const demo1Records = baseApp.FindRecordsByIds("demo1", ["al1h9ijdeojtsjy", "84nmscqy84lsi1t"]);
      const demo5Records = baseApp.FindRecordsByIds("demo5", ["la4y2w4o98acwuj", "qjeql998mtp1azp"]);

      const demo4 = baseApp.findCollectionByNameOrIdOrNull("demo4");
      if (!demo4) {
        throw new Error("Missing demo4 collection");
      }
      demo4.viewRule = Pointer("@request.context = 'expand'");
      const demo4SaveErr = await baseApp.Save(demo4);
      if (demo4SaveErr) {
        throw demo4SaveErr;
      }

      const scenarios = [
        {
          name: "[emailVisibility] guest",
          auth: null,
          records: freshRecords(usersRecords),
          queryExpand: "",
          defaultExpands: [] as string[],
          expected: ['"customField":"123"', '"test3@example.com"'],
          notExpected: ['"test@example.com"'],
        },
        {
          name: "[emailVisibility] owner",
          auth: user,
          records: freshRecords(usersRecords),
          queryExpand: "",
          defaultExpands: [] as string[],
          expected: ['"customField":"123"', '"test3@example.com"', '"test@example.com"'],
          notExpected: [] as string[],
        },
        {
          name: "[emailVisibility] manager",
          auth: user,
          records: freshRecords(nologinRecords),
          queryExpand: "",
          defaultExpands: [] as string[],
          expected: ['"customField":"123"', '"test3@example.com"', '"test@example.com"'],
          notExpected: [] as string[],
        },
        {
          name: "[emailVisibility] superuser",
          auth: superuser,
          records: freshRecords(nologinRecords),
          queryExpand: "",
          defaultExpands: [] as string[],
          expected: ['"customField":"123"', '"test3@example.com"', '"test@example.com"'],
          notExpected: [] as string[],
        },
        {
          name: "[emailVisibility + expand] recursive auth rule checks (regular user)",
          auth: user,
          records: freshRecords(demo1Records),
          queryExpand: "",
          defaultExpands: ["rel_many"],
          expected: ['"customField":"123"', '"expand":{"rel_many"', '"expand":{}', '"test@example.com"'],
          notExpected: ['"id":"bgs820n361vj1qd"', '"id":"oap640cot4yru2s"'],
        },
        {
          name: "[emailVisibility + expand] recursive auth rule checks (superuser)",
          auth: superuser,
          records: freshRecords(demo1Records),
          queryExpand: "",
          defaultExpands: ["rel_many"],
          expected: [
            '"customField":"123"',
            '"test@example.com"',
            '"expand":{"rel_many"',
            '"id":"bgs820n361vj1qd"',
            '"id":"4q1xlclmfloku33"',
            '"id":"oap640cot4yru2s"',
          ],
          notExpected: ['"expand":{}'],
        },
        {
          name: "[expand] guest (query)",
          auth: null,
          records: freshRecords(usersRecords),
          queryExpand: "rel",
          defaultExpands: [] as string[],
          expected: ['"customField":"123"', '"expand":{"rel"', '"id":"llvuca81nly1qls"', '"id":"0yxhwia2amd8gec"'],
          notExpected: ['"expand":{}'],
        },
        {
          name: "[expand] guest (default expands)",
          auth: null,
          records: freshRecords(usersRecords),
          queryExpand: "",
          defaultExpands: ["rel"],
          expected: ['"customField":"123"', '"expand":{"rel"', '"id":"llvuca81nly1qls"', '"id":"0yxhwia2amd8gec"'],
          notExpected: [] as string[],
        },
        {
          name: "[expand] @request.context=expand check",
          auth: null,
          records: freshRecords(demo5Records),
          queryExpand: "rel_one",
          defaultExpands: ["rel_many"],
          expected: [
            '"customField":"123"',
            '"expand":{}',
            '"expand":{"',
            '"rel_many":[{',
            '"rel_one":{',
            '"id":"i9naidtvr6qsgb4"',
            '"id":"qzaqccwrmva4o1n"',
          ],
          notExpected: [] as string[],
        },
      ];

      for (const scenario of scenarios) {
        const { app, cleanup } = await newTestApp();
        try {
          app.OnRecordEnrich().BindFunc((event: RecordEnrichEvent) => {
            if (event.Record) {
              event.Record.WithCustomData(true);
              event.Record.Set("customField", "123");
            }
            return event.Next();
          });

          const request = new Request(`http://localhost/?expand=${scenario.queryExpand}`);
          const requestEvent = new RequestEvent({ app, request });
          requestEvent.auth = scenario.auth;

          const err = await EnrichRecords(requestEvent, scenario.records, ...scenario.defaultExpands);
          if (err) {
            throw err;
          }

          const rawStr = JSON.stringify(scenario.records);

          for (const str of scenario.expected) {
            if (!rawStr.includes(str)) {
              throw new Error(`Expected ${JSON.stringify(str)} in ${rawStr} (${scenario.name})`);
            }
          }

          for (const str of scenario.notExpected) {
            if (rawStr.includes(str)) {
              throw new Error(`Didn't expect ${JSON.stringify(str)} in ${rawStr} (${scenario.name})`);
            }
          }
        } finally {
          await cleanup();
        }
      }
    } finally {
      await baseCleanup();
    }
  });

  it("RecordAuthResponse auth rule check", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const request = new Request("http://localhost/");
      const event = new RequestEvent({ app, request });

      const user = app.FindAuthRecordByEmail("users", "test@example.com");

      const scenarios = [
        { name: "admin only rule", rule: null, expectError: true },
        { name: "empty rule", rule: Pointer(""), expectError: false },
        { name: "false rule", rule: Pointer("1=2"), expectError: true },
        { name: "true rule", rule: Pointer("1=1"), expectError: false },
      ];

      for (const scenario of scenarios) {
        user.collection().AuthRule = scenario.rule;

        const response = await RecordAuthResponse(event, user.Fresh(), "", null);
        const body = (await response.json()) as Record<string, unknown>;

        const hasErr = response.status !== 200;
        expect(hasErr).toBe(scenario.expectError);

        if (scenario.expectError) {
          expect(response.status).toBe(403);
        } else {
          expect(response.status).toBe(200);
          if (typeof body.token !== "string") {
            throw new Error(`Expected auth token, got ${JSON.stringify(body)}`);
          }
        }

        if (app.testMailer.TotalSend() !== 0) {
          throw new Error(`Expected no emails sent, got ${app.testMailer.TotalSend()}`);
        }
      }
    } finally {
      await cleanup();
    }
  });

  it("RecordAuthResponse auth alert check", async () => {
    const testFingerprint = "d0f88d6c87767262ba8e93d6acccd784";

    const scenarios = [
      { name: "first login", devices: [] as string[], expectDevices: [testFingerprint], enabled: true, expectEmail: false },
      {
        name: "existing device",
        devices: ["1", testFingerprint],
        expectDevices: ["1", testFingerprint],
        enabled: true,
        expectEmail: false,
      },
      {
        name: "new device (< 5)",
        devices: ["1", "2"],
        expectDevices: ["1", "2", testFingerprint],
        enabled: true,
        expectEmail: true,
      },
      {
        name: "new device (>= 5)",
        devices: ["1", "2", "3", "4", "5"],
        expectDevices: ["2", "3", "4", "5", testFingerprint],
        enabled: true,
        expectEmail: true,
      },
      {
        name: "with disabled auth alert collection flag",
        devices: ["1", "2"],
        expectDevices: ["1", "2"],
        enabled: false,
        expectEmail: false,
      },
    ];

    for (const scenario of scenarios) {
      const { app, cleanup } = await newTestApp();
      try {
        const request = new Request("http://localhost/");
        const event = new RequestEvent({ app, request, remoteAddress: "192.0.2.1:1234" });

        const user = app.FindAuthRecordByEmail("users", "test@example.com");

        user.collection().MFA.Enabled = false;
        user.collection().AuthRule = Pointer("");
        user.collection().AuthAlert.Enabled = scenario.enabled;

        const deleteErr = await app.DeleteAllAuthOriginsByRecord(user);
        if (deleteErr) {
          throw deleteErr;
        }

        let mockCreated = NowDateTime().Add(-(scenario.devices.length + 1) * 1000);
        for (const fingerprint of scenario.devices) {
          mockCreated = mockCreated.Add(1000);
          const origin = NewAuthOrigin(app);
          origin.SetCollectionRef(user.collection().Id);
          origin.SetRecordRef(user.Id);
          origin.SetFingerprint(fingerprint);
          origin.ProxyRecord().SetRaw("created", mockCreated);
          origin.ProxyRecord().SetRaw("updated", mockCreated);
          const saveErr = await app.Save(origin);
          if (saveErr) {
            throw saveErr;
          }
        }

        const response = await RecordAuthResponse(event, user, "example", null);
        if (response.status !== 200) {
          throw new Error(`Failed to resolve auth response: ${response.status}`);
        }

        const expectTotalSend = scenario.expectEmail ? 1 : 0;
        if (app.testMailer.TotalSend() !== expectTotalSend) {
          throw new Error(`Expected ${expectTotalSend} sent emails, got ${app.testMailer.TotalSend()}`);
        }

        const devices = app.FindAllAuthOriginsByRecord(user);
        if (devices.length !== scenario.expectDevices.length) {
          throw new Error(`Expected ${scenario.expectDevices.length} devices, got ${devices.length}`);
        }

        const fingerprints = devices.map((device) => device.Fingerprint());
        for (const fingerprint of scenario.expectDevices) {
          if (!fingerprints.includes(fingerprint)) {
            throw new Error(`Missing device with fingerprint ${JSON.stringify(fingerprint)}: ${JSON.stringify(fingerprints)}`);
          }
        }
      } finally {
        await cleanup();
      }
    }
  });

  it("RecordAuthResponse MFA check", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const user = app.FindAuthRecordByEmail("users", "test@example.com");
      const user2 = app.FindAuthRecordByEmail("users", "test2@example.com");

      const resetMFAs = async (authRecord: RecordModel) => {
        authRecord.collection().MFA.Enabled = true;
        authRecord.collection().MFA.Duration = 5;
        authRecord.collection().MFA.Rule = "";

        const mfas = app.FindAllMFAsByRecord(authRecord);
        for (const mfa of mfas) {
          const err = await app.Delete(mfa);
          if (err) {
            throw err;
          }
        }
      };

      const totalMFAs = (authRecord: RecordModel) => app.FindAllMFAsByRecord(authRecord).length;

      const assertAuthResponse = async (
        response: Response,
        expectations: { status: number; hasMfaId: boolean; hasToken: boolean },
      ) => {
        const body = (await response.json()) as Record<string, unknown>;
        if (response.status !== expectations.status) {
          throw new Error(`Expected status ${expectations.status}, got ${response.status}`);
        }

        const token = body.token;
        if (expectations.hasToken && typeof token !== "string") {
          throw new Error(`Expected auth token, got ${JSON.stringify(body)}`);
        }
        if (!expectations.hasToken && typeof token === "string") {
          throw new Error(`Didn't expect auth token, got ${JSON.stringify(body)}`);
        }

        const mfaId = body.mfaId;
        if (expectations.hasMfaId && typeof mfaId !== "string") {
          throw new Error(`Expected mfaId, got ${JSON.stringify(body)}`);
        }
        if (!expectations.hasMfaId && typeof mfaId === "string") {
          throw new Error(`Didn't expect mfaId, got ${JSON.stringify(body)}`);
        }
      };

      {
        await resetMFAs(user);
        user.collection().MFA.Enabled = false;

        const event = new RequestEvent({ app, request: new Request("http://localhost/") });
        const response = await RecordAuthResponse(event, user, "example", null);
        await assertAuthResponse(response, { status: 200, hasMfaId: false, hasToken: true });

        if (totalMFAs(user) !== 0) {
          throw new Error(`Expected no mfa records to be created, got ${totalMFAs(user)}`);
        }
      }

      {
        await resetMFAs(user);

        const event = new RequestEvent({ app, request: new Request("http://localhost/") });
        const response = await RecordAuthResponse(event, user, "", null);
        await assertAuthResponse(response, { status: 200, hasMfaId: false, hasToken: true });

        if (totalMFAs(user) !== 0) {
          throw new Error(`Expected no mfa records to be created, got ${totalMFAs(user)}`);
        }
      }

      {
        await resetMFAs(user);
        user.collection().MFA.Rule = "1=2";

        const event = new RequestEvent({ app, request: new Request("http://localhost/") });
        const response = await RecordAuthResponse(event, user, "example", null);
        await assertAuthResponse(response, { status: 200, hasMfaId: false, hasToken: true });

        if (totalMFAs(user) !== 0) {
          throw new Error(`Expected no mfa records to be created, got ${totalMFAs(user)}`);
        }
      }

      {
        await resetMFAs(user);
        user.collection().MFA.Rule = "1=1";

        const event = new RequestEvent({ app, request: new Request("http://localhost/") });
        const response = await RecordAuthResponse(event, user, "example", null);
        await assertAuthResponse(response, { status: 401, hasMfaId: true, hasToken: false });

        if (totalMFAs(user) !== 1) {
          throw new Error(`Expected a single mfa record to be created, got ${totalMFAs(user)}`);
        }
      }

      {
        await resetMFAs(user);

        const event = new RequestEvent({ app, request: new Request("http://localhost/") });
        const response = await RecordAuthResponse(event, user, "example", null);
        await assertAuthResponse(response, { status: 401, hasMfaId: true, hasToken: false });

        if (totalMFAs(user) !== 1) {
          throw new Error(`Expected a single mfa record to be created, got ${totalMFAs(user)}`);
        }
      }

      {
        await resetMFAs(user);

        const mfa = NewMFA(app);
        mfa.SetCollectionRef(user.collection().Id);
        mfa.SetRecordRef(user.Id);
        mfa.SetMethod("example");
        const saveErr = await app.Save(mfa);
        if (saveErr) {
          throw saveErr;
        }

        const event = new RequestEvent({ app, request: new Request(`http://localhost/?mfaId=${mfa.Id}`) });
        const response = await RecordAuthResponse(event, user, "example", null);
        await assertAuthResponse(response, { status: 400, hasMfaId: false, hasToken: false });

        if (totalMFAs(user) !== 1) {
          throw new Error(`Expected only 1 mfa record (the existing one), got ${totalMFAs(user)}`);
        }
      }

      {
        await resetMFAs(user);

        const mfa = NewMFA(app);
        mfa.SetCollectionRef(user.collection().Id);
        mfa.SetRecordRef(user.Id);
        mfa.SetMethod("example1");
        const saveErr = await app.Save(mfa);
        if (saveErr) {
          throw saveErr;
        }

        const event = new RequestEvent({ app, request: new Request(`http://localhost/?mfaId=${mfa.Id}`) });
        const response = await RecordAuthResponse(event, user, "example2", null);
        await assertAuthResponse(response, { status: 200, hasMfaId: false, hasToken: true });

        if (totalMFAs(user) !== 0) {
          throw new Error(`Expected the dummy mfa record to be deleted, found ${totalMFAs(user)}`);
        }
      }

      {
        await resetMFAs(user);

        const mfa = NewMFA(app);
        mfa.SetCollectionRef(user.collection().Id);
        mfa.SetRecordRef(user.Id);
        mfa.SetMethod("example1");
        const saveErr = await app.Save(mfa);
        if (saveErr) {
          throw saveErr;
        }

        const request = new Request("http://localhost/", {
          method: "POST",
          body: JSON.stringify({ mfaId: mfa.Id }),
          headers: { "content-type": "application/json" },
        });
        const event = new RequestEvent({ app, request });
        const response = await RecordAuthResponse(event, user, "example2", null);
        await assertAuthResponse(response, { status: 200, hasMfaId: false, hasToken: true });

        if (totalMFAs(user) !== 0) {
          throw new Error(`Expected the dummy mfa record to be deleted, found ${totalMFAs(user)}`);
        }
      }

      {
        await resetMFAs(user);

        const event = new RequestEvent({ app, request: new Request("http://localhost/?mfaId=missing") });
        const response = await RecordAuthResponse(event, user, "example2", null);
        await assertAuthResponse(response, { status: 400, hasMfaId: false, hasToken: false });

        if (totalMFAs(user) !== 0) {
          throw new Error(`Expected 0 mfa records, got ${totalMFAs(user)}`);
        }
      }

      {
        await resetMFAs(user);

        const mfa = NewMFA(app);
        mfa.SetCollectionRef(user.collection().Id);
        mfa.SetRecordRef(user.Id);
        mfa.SetMethod("example1");
        const expired = NowDateTime().Add(-1 * 60 * 60 * 1000);
        mfa.ProxyRecord().SetRaw("created", expired);
        mfa.ProxyRecord().SetRaw("updated", expired);
        const saveErr = await app.Save(mfa);
        if (saveErr) {
          throw saveErr;
        }

        const event = new RequestEvent({ app, request: new Request(`http://localhost/?mfaId=${mfa.Id}`) });
        const response = await RecordAuthResponse(event, user, "example2", null);
        await assertAuthResponse(response, { status: 400, hasMfaId: false, hasToken: false });

        if (totalMFAs(user) !== 0) {
          throw new Error("Expected the expired mfa record to be deleted");
        }
      }

      {
        await resetMFAs(user);

        const mfa = NewMFA(app);
        mfa.SetCollectionRef(user2.collection().Id);
        mfa.SetRecordRef(user2.Id);
        mfa.SetMethod("example1");
        const saveErr = await app.Save(mfa);
        if (saveErr) {
          throw saveErr;
        }

        const event = new RequestEvent({ app, request: new Request(`http://localhost/?mfaId=${mfa.Id}`) });
        const response = await RecordAuthResponse(event, user, "example2", null);
        await assertAuthResponse(response, { status: 400, hasMfaId: false, hasToken: false });

        if (totalMFAs(user) !== 0) {
          throw new Error(`Expected no user mfas, got ${totalMFAs(user)}`);
        }

        if (totalMFAs(user2) !== 1) {
          throw new Error(`Expected only 1 user2 mfa, got ${totalMFAs(user2)}`);
        }
      }
    } finally {
      await cleanup();
    }
  });
});
