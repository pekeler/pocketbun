// Ported from pocketbase/apis/realtime_test.go.

import { describe, it } from "bun:test";
import { NewBaseCollection } from "../core/collection_model.ts";
import { GenerateDefaultRandomId } from "../core/db.ts";
import { BaseModel } from "../core/db_model.ts";
import { ModelEvent, ModelEventTypeDelete, ModelEventTypeUpdate } from "../core/events.ts";
import { AutodateField } from "../core/field_autodate.ts";
import { NewRecord, Record as RecordModel } from "../core/record_model.ts";
import { BaseRecordProxy } from "../core/record_proxy.ts";
import { runApiScenario, type ApiScenario } from "../tests/api.ts";
import { newTestApp } from "../tests/app.ts";
import { DefaultClient } from "../tools/subscriptions/client.ts";
import { RealtimeClientAuthKey } from "./realtime.ts";
import { buildServeHandler } from "./serve.ts";

const superuserToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY";

const userToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.ZT3F0Z3iM-xbGgSG3LEKiEzHrPHr8t8IuHLZGGNuxLo";

describe("realtime connect", () => {
  const scenarios: ApiScenario[] = [
    {
      name: "connect",
      method: "GET",
      url: "/api/realtime",
      timeoutMs: 100,
      expectedStatus: 200,
      expectedContent: ["id:", "event:PB_CONNECT", 'data:{"clientId":'],
      expectedEvents: {
        "*": 0,
        OnRealtimeConnectRequest: 1,
        OnRealtimeMessageSend: 1,
      },
      afterTest: (app) => {
        if (Object.keys(app.SubscriptionsBroker().Clients()).length !== 0) {
          throw new Error("Expected the subscribers to be removed after connection close");
        }
      },
    },
    {
      name: "PB_CONNECT interrupt",
      method: "GET",
      url: "/api/realtime",
      timeoutMs: 100,
      expectedStatus: 200,
      expectedEvents: {
        "*": 0,
        OnRealtimeConnectRequest: 1,
        OnRealtimeMessageSend: 1,
      },
      beforeTest: (app) => {
        app.OnRealtimeMessageSend().BindFunc((event) => {
          if (event.Message?.Name === "PB_CONNECT") {
            return new Error("PB_CONNECT error");
          }
          return event.Next();
        });
      },
      afterTest: (app) => {
        if (Object.keys(app.SubscriptionsBroker().Clients()).length !== 0) {
          throw new Error("Expected the subscribers to be removed after connection close");
        }
      },
    },
    {
      name: "Skipping/ignoring messages",
      method: "GET",
      url: "/api/realtime",
      timeoutMs: 100,
      expectedStatus: 200,
      expectedEvents: {
        "*": 0,
        OnRealtimeConnectRequest: 1,
        OnRealtimeMessageSend: 1,
      },
      beforeTest: (app) => {
        app.OnRealtimeMessageSend().BindFunc(() => null);
      },
      afterTest: (app) => {
        if (Object.keys(app.SubscriptionsBroker().Clients()).length !== 0) {
          throw new Error("Expected the subscribers to be removed after connection close");
        }
      },
    },
  ];

  for (const scenario of scenarios) {
    it(scenario.name ?? "scenario", async () => {
      await runApiScenario(scenario);
    });
  }
});

describe("realtime subscribe", () => {
  const client = new DefaultClient();

  const resetClient = () => {
    client.Unsubscribe();
    client.Set(RealtimeClientAuthKey, null);
  };

  const validSubscriptionsLimit = Array.from({ length: 1000 }, (_, i) => JSON.stringify(i));
  const invalidSubscriptionsLimit = Array.from({ length: 1001 }, (_, i) => JSON.stringify(i));

  const scenarios: ApiScenario[] = [
    {
      name: "missing client",
      method: "POST",
      url: "/api/realtime",
      body: `{"clientId":"missing","subscriptions":["test1", "test2"]}`,
      expectedStatus: 404,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "empty data",
      method: "POST",
      url: "/api/realtime",
      body: "{}",
      expectedStatus: 400,
      expectedContent: ['"data":{', '"clientId":{"code":"validation_required"'],
      notExpectedContent: ['"subscriptions"'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "existing client with invalid subscriptions limit",
      method: "POST",
      url: "/api/realtime",
      body: `{"clientId":"${client.Id()}","subscriptions":[${invalidSubscriptionsLimit.join(",")}]}`,
      beforeTest: (app) => {
        app.SubscriptionsBroker().Register(client);
      },
      afterTest: () => {
        resetClient();
      },
      expectedStatus: 400,
      expectedContent: ['"data":{', '"subscriptions":{"code":"validation_length_too_long"'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "existing client with valid subscriptions limit",
      method: "POST",
      url: "/api/realtime",
      body: `{"clientId":"${client.Id()}","subscriptions":[${validSubscriptionsLimit.join(",")}]}`,
      expectedStatus: 204,
      expectedEvents: { "*": 0, OnRealtimeSubscribeRequest: 1 },
      beforeTest: (app) => {
        client.Subscribe("test0");
        app.SubscriptionsBroker().Register(client);
      },
      afterTest: () => {
        if (Object.keys(client.Subscriptions()).length !== validSubscriptionsLimit.length) {
          throw new Error(`Expected ${validSubscriptionsLimit.length} subscriptions`);
        }
        if (client.HasSubscription("test0")) {
          throw new Error("Expected old subscriptions to be replaced");
        }
        resetClient();
      },
    },
    {
      name: "existing client with invalid topic length",
      method: "POST",
      url: "/api/realtime",
      body: `{"clientId":"${client.Id()}","subscriptions":["abc","${"a".repeat(2501)}"]}`,
      beforeTest: (app) => {
        app.SubscriptionsBroker().Register(client);
      },
      afterTest: () => {
        resetClient();
      },
      expectedStatus: 400,
      expectedContent: ['"data":{', '"subscriptions":{"1":{"code":"validation_length_too_long"'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "existing client with valid topic length",
      method: "POST",
      url: "/api/realtime",
      body: `{"clientId":"${client.Id()}","subscriptions":["abc","${"a".repeat(2500)}"]}`,
      expectedStatus: 204,
      expectedEvents: { "*": 0, OnRealtimeSubscribeRequest: 1 },
      beforeTest: (app) => {
        client.Subscribe("test0");
        app.SubscriptionsBroker().Register(client);
      },
      afterTest: () => {
        if (Object.keys(client.Subscriptions()).length !== 2) {
          throw new Error("Expected 2 subscriptions");
        }
        if (client.HasSubscription("test0")) {
          throw new Error("Expected old subscriptions to be replaced");
        }
        resetClient();
      },
    },
    {
      name: "existing client - empty subscriptions",
      method: "POST",
      url: "/api/realtime",
      body: `{"clientId":"${client.Id()}","subscriptions":[]}`,
      expectedStatus: 204,
      expectedEvents: { "*": 0, OnRealtimeSubscribeRequest: 1 },
      beforeTest: (app) => {
        client.Subscribe("test0");
        app.SubscriptionsBroker().Register(client);
      },
      afterTest: () => {
        if (Object.keys(client.Subscriptions()).length !== 0) {
          throw new Error("Expected no subscriptions");
        }
        resetClient();
      },
    },
    {
      name: "existing client - 2 new subscriptions",
      method: "POST",
      url: "/api/realtime",
      body: `{"clientId":"${client.Id()}","subscriptions":["test1","test2"]}`,
      expectedStatus: 204,
      expectedEvents: { "*": 0, OnRealtimeSubscribeRequest: 1 },
      beforeTest: (app) => {
        client.Subscribe("test0");
        app.SubscriptionsBroker().Register(client);
      },
      afterTest: () => {
        const expectedSubs = ["test1", "test2"];
        if (Object.keys(client.Subscriptions()).length !== expectedSubs.length) {
          throw new Error("Expected updated subscriptions");
        }
        for (const sub of expectedSubs) {
          if (!client.HasSubscription(sub)) {
            throw new Error(`Missing ${sub} subscription`);
          }
        }
        resetClient();
      },
    },
    {
      name: "existing client - guest -> authorized superuser",
      method: "POST",
      url: "/api/realtime",
      body: `{"clientId":"${client.Id()}","subscriptions":["test1","test2"]}`,
      headers: { Authorization: superuserToken },
      expectedStatus: 204,
      expectedEvents: { "*": 0, OnRealtimeSubscribeRequest: 1 },
      beforeTest: (app) => {
        app.SubscriptionsBroker().Register(client);
      },
      afterTest: () => {
        const authRecord = client.Get(RealtimeClientAuthKey) as RecordModel | null;
        if (!authRecord || !authRecord.IsSuperuser()) {
          throw new Error("Expected superuser auth record");
        }
        resetClient();
      },
    },
    {
      name: "existing client - guest -> authorized regular auth record",
      method: "POST",
      url: "/api/realtime",
      body: `{"clientId":"${client.Id()}","subscriptions":["test1","test2"]}`,
      headers: { Authorization: userToken },
      expectedStatus: 204,
      expectedEvents: { "*": 0, OnRealtimeSubscribeRequest: 1 },
      beforeTest: (app) => {
        app.SubscriptionsBroker().Register(client);
      },
      afterTest: () => {
        const authRecord = client.Get(RealtimeClientAuthKey) as RecordModel | null;
        if (!authRecord) {
          throw new Error("Expected regular user auth record");
        }
        resetClient();
      },
    },
    {
      name: "existing client - same auth",
      method: "POST",
      url: "/api/realtime",
      body: `{"clientId":"${client.Id()}","subscriptions":["test1","test2"]}`,
      headers: { Authorization: userToken },
      expectedStatus: 204,
      expectedEvents: { "*": 0, OnRealtimeSubscribeRequest: 1 },
      beforeTest: (app) => {
        const user = app.FindAuthRecordByEmail("users", "test@example.com");
        client.Set(RealtimeClientAuthKey, user);
        app.SubscriptionsBroker().Register(client);
      },
      afterTest: () => {
        const authRecord = client.Get(RealtimeClientAuthKey) as RecordModel | null;
        if (!authRecord) {
          throw new Error("Expected auth record model");
        }
        resetClient();
      },
    },
    {
      name: "existing client - mismatched auth",
      method: "POST",
      url: "/api/realtime",
      body: `{"clientId":"${client.Id()}","subscriptions":["test1","test2"]}`,
      headers: { Authorization: userToken },
      expectedStatus: 403,
      expectedContent: ['"data":{}'],
      beforeTest: (app) => {
        const user = app.FindAuthRecordByEmail("users", "test2@example.com");
        client.Set(RealtimeClientAuthKey, user);
        app.SubscriptionsBroker().Register(client);
      },
      afterTest: () => {
        const authRecord = client.Get(RealtimeClientAuthKey) as RecordModel | null;
        if (!authRecord) {
          throw new Error("Expected auth record model");
        }
        resetClient();
      },
    },
    {
      name: "existing client - unauthorized client",
      method: "POST",
      url: "/api/realtime",
      body: `{"clientId":"${client.Id()}","subscriptions":["test1","test2"]}`,
      expectedStatus: 403,
      expectedContent: ['"data":{}'],
      beforeTest: (app) => {
        const user = app.FindAuthRecordByEmail("users", "test2@example.com");
        client.Set(RealtimeClientAuthKey, user);
        app.SubscriptionsBroker().Register(client);
      },
      afterTest: () => {
        const authRecord = client.Get(RealtimeClientAuthKey) as RecordModel | null;
        if (!authRecord) {
          throw new Error("Expected auth record model");
        }
        resetClient();
      },
    },
  ];

  for (const scenario of scenarios) {
    it(scenario.name ?? "scenario", async () => {
      await runApiScenario(scenario);
    });
  }
});

describe("realtime auth record events", () => {
  it("unsets auth state on auth record delete", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      buildServeHandler(app);

      const authRecord1 = app.FindAuthRecordByEmail("users", "test@example.com");
      const authRecord2 = app.FindAuthRecordByEmail("users", "test2@example.com");

      const client1 = new DefaultClient();
      client1.Set(RealtimeClientAuthKey, authRecord1);
      app.SubscriptionsBroker().Register(client1);

      const client2 = new DefaultClient();
      client2.Set(RealtimeClientAuthKey, authRecord1);
      app.SubscriptionsBroker().Register(client2);

      const client3 = new DefaultClient();
      client3.Set(RealtimeClientAuthKey, authRecord2);
      app.SubscriptionsBroker().Register(client3);

      const event = new ModelEvent(app, authRecord1, ModelEventTypeDelete);
      app.OnModelAfterDeleteSuccess().Trigger(event);

      const totalClients = Object.keys(app.SubscriptionsBroker().Clients()).length;
      if (totalClients !== 3) {
        throw new Error(`Expected 3 subscription clients, found ${totalClients}`);
      }

      if (client1.Get(RealtimeClientAuthKey) != null) {
        throw new Error("[client1] Expected the auth state to be unset");
      }

      if (client2.Get(RealtimeClientAuthKey) != null) {
        throw new Error("[client2] Expected the auth state to be unset");
      }

      const auth3 = client3.Get(RealtimeClientAuthKey) as RecordModel | null;
      if (!auth3 || auth3.Id !== authRecord2.Id) {
        throw new Error("[client3] Expected the auth state to be left unchanged");
      }
    } finally {
      await cleanup();
    }
  });

  it("updates auth state on auth record update", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      buildServeHandler(app);

      const authRecord1 = app.FindAuthRecordByEmail("users", "test@example.com");
      const client = new DefaultClient();
      client.Set(RealtimeClientAuthKey, authRecord1);
      app.SubscriptionsBroker().Register(client);

      const authRecord2 = app.FindAuthRecordByEmail("users", "test@example.com");
      authRecord2.SetEmail("new@example.com");

      const event = new ModelEvent(app, authRecord2, ModelEventTypeUpdate);
      app.OnModelAfterUpdateSuccess().Trigger(event);

      const clientAuth = client.Get(RealtimeClientAuthKey) as RecordModel | null;
      if (!clientAuth || clientAuth.Email() !== authRecord2.Email()) {
        throw new Error(`Expected authRecord with email ${authRecord2.Email()}`);
      }
    } finally {
      await cleanup();
    }
  });

  it("unsets auth state on tokenKey refresh", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      buildServeHandler(app);

      const authRecord1 = app.FindAuthRecordByEmail("users", "test@example.com");
      const client = new DefaultClient();
      client.Set(RealtimeClientAuthKey, authRecord1);
      app.SubscriptionsBroker().Register(client);

      const authRecord2 = app.FindAuthRecordByEmail("users", "test@example.com");
      authRecord2.RefreshTokenKey();

      const saveErr = await app.Save(authRecord2);
      if (saveErr) {
        throw saveErr;
      }

      const clientAuth = client.Get(RealtimeClientAuthKey) as RecordModel | null;
      if (clientAuth != null) {
        throw new Error(`Expected authRecord to be unset, got ${clientAuth.Email()}`);
      }
    } finally {
      await cleanup();
    }
  });

  it("unsets auth state on auth collection secret change", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      buildServeHandler(app);

      const usersCollection = app.FindCollectionByNameOrId("users");
      const clientsCollection = app.FindCollectionByNameOrId("clients");

      const authRecord1 = app.FindAuthRecordByEmail(usersCollection, "test@example.com");
      const client1 = new DefaultClient();
      client1.Set(RealtimeClientAuthKey, authRecord1);

      const authRecord2 = app.FindAuthRecordByEmail(usersCollection, "test@example.com");
      const client2 = new DefaultClient();
      client2.Set(RealtimeClientAuthKey, authRecord2);

      const authRecord3 = app.FindAuthRecordByEmail(clientsCollection, "test@example.com");
      const client3 = new DefaultClient();
      client3.Set(RealtimeClientAuthKey, authRecord3);

      app.SubscriptionsBroker().Register(client1);
      app.SubscriptionsBroker().Register(client2);
      app.SubscriptionsBroker().Register(client3);

      usersCollection.AuthToken.Secret = "a".repeat(30);
      const usersSaveErr = await app.Save(usersCollection);
      if (usersSaveErr) {
        throw usersSaveErr;
      }

      clientsCollection.ListRule = null;
      const clientsSaveErr = await app.Save(clientsCollection);
      if (clientsSaveErr) {
        throw clientsSaveErr;
      }

      if (client1.Get(RealtimeClientAuthKey) != null) {
        throw new Error("[client1] Expected the auth state to be unset");
      }
      if (client2.Get(RealtimeClientAuthKey) != null) {
        throw new Error("[client2] Expected the auth state to be unset");
      }

      const auth3 = client3.Get(RealtimeClientAuthKey) as RecordModel | null;
      if (!auth3 || auth3.Id !== authRecord3.Id) {
        throw new Error("[client3] Expected the auth state to be left unchanged");
      }
    } finally {
      await cleanup();
    }
  });

  it("unsets auth state on auth collection delete event", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      buildServeHandler(app);

      const usersCollection = app.FindCollectionByNameOrId("users");
      const clientsCollection = app.FindCollectionByNameOrId("clients");

      const authRecord1 = app.FindAuthRecordByEmail(usersCollection, "test@example.com");
      const client1 = new DefaultClient();
      client1.Set(RealtimeClientAuthKey, authRecord1);

      const authRecord2 = app.FindAuthRecordByEmail(usersCollection, "test@example.com");
      const client2 = new DefaultClient();
      client2.Set(RealtimeClientAuthKey, authRecord2);

      const authRecord3 = app.FindAuthRecordByEmail(clientsCollection, "test@example.com");
      const client3 = new DefaultClient();
      client3.Set(RealtimeClientAuthKey, authRecord3);

      app.SubscriptionsBroker().Register(client1);
      app.SubscriptionsBroker().Register(client2);
      app.SubscriptionsBroker().Register(client3);

      const event = new ModelEvent(app, usersCollection, ModelEventTypeDelete);
      const err = await app.OnModelAfterDeleteSuccess().Trigger(event);
      if (err) {
        throw err;
      }

      if (client1.Get(RealtimeClientAuthKey) != null) {
        throw new Error("[client1] Expected the auth state to be unset");
      }
      if (client2.Get(RealtimeClientAuthKey) != null) {
        throw new Error("[client2] Expected the auth state to be unset");
      }

      const auth3 = client3.Get(RealtimeClientAuthKey) as RecordModel | null;
      if (!auth3 || auth3.Id !== authRecord3.Id) {
        throw new Error("[client3] Expected the auth state to be left unchanged");
      }
    } finally {
      await cleanup();
    }
  });
});

describe("realtime custom auth model events", () => {
  class CustomUser extends BaseModel {
    Email = "";

    TableName(): string {
      return "users";
    }
  }

  const findCustomUserByEmail = (app: Awaited<ReturnType<typeof newTestApp>>["app"], email: string): CustomUser => {
    const row = app.db().query("select id, email from {{users}} where [[email]] = ?").get(email) as
      | Record<string, unknown>
      | undefined;
    if (!row) {
      throw new Error("record not found");
    }

    const model = new CustomUser();
    if (typeof row.id === "string") {
      model.Id = row.id;
    }
    if (typeof row.email === "string") {
      model.Email = row.email;
    }
    model.PostScan();

    return model;
  };

  it("unsets auth state on custom auth record delete", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      buildServeHandler(app);

      const authRecord1 = app.FindAuthRecordByEmail("users", "test@example.com");
      const authRecord2 = app.FindAuthRecordByEmail("users", "test2@example.com");

      const client1 = new DefaultClient();
      client1.Set(RealtimeClientAuthKey, authRecord1);
      app.SubscriptionsBroker().Register(client1);

      const client2 = new DefaultClient();
      client2.Set(RealtimeClientAuthKey, authRecord1);
      app.SubscriptionsBroker().Register(client2);

      const client3 = new DefaultClient();
      client3.Set(RealtimeClientAuthKey, authRecord2);
      app.SubscriptionsBroker().Register(client3);

      const customUser = findCustomUserByEmail(app, authRecord1.Email());
      const deleteErr = await app.Delete(customUser);
      if (deleteErr) {
        throw deleteErr;
      }

      const totalClients = Object.keys(app.SubscriptionsBroker().Clients()).length;
      if (totalClients !== 3) {
        throw new Error(`Expected 3 subscription clients, found ${totalClients}`);
      }

      if (client1.Get(RealtimeClientAuthKey) != null) {
        throw new Error("[client1] Expected the auth state to be unset");
      }

      if (client2.Get(RealtimeClientAuthKey) != null) {
        throw new Error("[client2] Expected the auth state to be unset");
      }

      const auth3 = client3.Get(RealtimeClientAuthKey) as RecordModel | null;
      if (!auth3 || auth3.Id !== authRecord2.Id) {
        throw new Error("[client3] Expected the auth state to be left unchanged");
      }
    } finally {
      await cleanup();
    }
  });

  it("updates auth state on custom auth record update", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      buildServeHandler(app);

      const authRecord = app.FindAuthRecordByEmail("users", "test@example.com");
      const client = new DefaultClient();
      client.Set(RealtimeClientAuthKey, authRecord);
      app.SubscriptionsBroker().Register(client);

      const customUser = findCustomUserByEmail(app, "test@example.com");
      customUser.Email = "new@example.com";

      const saveErr = await app.Save(customUser);
      if (saveErr) {
        throw saveErr;
      }

      const clientAuth = client.Get(RealtimeClientAuthKey) as RecordModel | null;
      if (!clientAuth || clientAuth.Email() !== customUser.Email) {
        throw new Error(`Expected authRecord with email ${customUser.Email}`);
      }
    } finally {
      await cleanup();
    }
  });
});

describe("realtime record resolve", () => {
  it("broadcasts record events for records and custom models", async () => {
    const testCollectionName = "realtime_test_collection";
    const testRecordId = GenerateDefaultRandomId();

    class CustomModelResolve extends BaseModel {
      #tableName: string;
      Created = "";

      constructor(tableName: string) {
        super();
        this.#tableName = tableName;
      }

      TableName(): string {
        return this.#tableName;
      }
    }

    type Scenario = {
      name: string;
      op: (testApp: Awaited<ReturnType<typeof newTestApp>>["app"]) => Promise<void> | void;
    };

    const scenarios: Scenario[] = [
      {
        name: "core.Record",
        op: async (testApp) => {
          const collection = testApp.findCollectionByNameOrId(testCollectionName);
          if (!collection) {
            throw new Error("Missing test collection");
          }

          const record = NewRecord(collection);
          record.Id = testRecordId;

          let err = await testApp.Save(record);
          if (err) {
            throw err;
          }

          err = await testApp.Save(record);
          if (err) {
            throw err;
          }

          err = await testApp.Delete(record);
          if (err) {
            throw err;
          }
        },
      },
      {
        name: "core.RecordProxy",
        op: async (testApp) => {
          const collection = testApp.findCollectionByNameOrId(testCollectionName);
          if (!collection) {
            throw new Error("Missing test collection");
          }

          const record = NewRecord(collection);

          class Proxy extends BaseRecordProxy {}

          const proxy = new Proxy();
          proxy.SetProxyRecord(record);
          proxy.Id = testRecordId;

          let err = await testApp.Save(proxy);
          if (err) {
            throw err;
          }

          err = await testApp.Save(proxy);
          if (err) {
            throw err;
          }

          err = await testApp.Delete(proxy);
          if (err) {
            throw err;
          }
        },
      },
      {
        name: "custom model struct",
        op: async (testApp) => {
          const model = new CustomModelResolve(testCollectionName);
          model.Id = testRecordId;

          let err = await testApp.Save(model);
          if (err) {
            throw err;
          }

          model.Created = "123";
          err = await testApp.Save(model);
          if (err) {
            throw err;
          }

          err = await testApp.Delete(model);
          if (err) {
            throw err;
          }
        },
      },
    ];

    for (const scenario of scenarios) {
      const { app, cleanup } = await newTestApp();
      try {
        buildServeHandler(app);

        const testCollection = NewBaseCollection(testCollectionName);
        const createdField = new AutodateField();
        createdField.Name = "created";
        createdField.OnCreate = true;
        createdField.OnUpdate = true;
        testCollection.Fields.Add(createdField);
        testCollection.listRule = "";
        testCollection.viewRule = "";
        const createErr = await app.Save(testCollection);
        if (createErr) {
          throw createErr;
        }

        const client0 = new DefaultClient();
        client0.Subscribe(`${testCollectionName}/*`);
        client0.Discard();

        const client1 = new DefaultClient();
        client1.Subscribe(`${testCollectionName}/*`);

        const client2 = new DefaultClient();
        client2.Subscribe(`${testCollectionName}/${testRecordId}`);

        const client3 = new DefaultClient();
        client3.Subscribe("demo1/*");

        app.SubscriptionsBroker().Register(client0);
        app.SubscriptionsBroker().Register(client1);
        app.SubscriptionsBroker().Register(client2);
        app.SubscriptionsBroker().Register(client3);

        const expected: Record<string, string[]> = {
          [client1.Id()]: ["create", "update", "delete"],
          [client2.Id()]: ["create", "update", "delete"],
        };

        const notificationsPromise = collectNotifications([client0, client1, client2, client3], 250);

        await scenario.op(app);

        const notifications = await notificationsPromise;

        if (Object.keys(expected).length !== Object.keys(notifications).length) {
          throw new Error(
            `Expected ${Object.keys(expected).length} notified clients, got ${Object.keys(notifications).length}`,
          );
        }

        for (const [id, events] of Object.entries(expected)) {
          const seen = notifications[id] ?? [];
          if (events.length !== seen.length) {
            throw new Error(`[${id}] Expected ${events.length} events, got ${seen.length}`);
          }
          for (const event of events) {
            if (!seen.includes(event)) {
              throw new Error(`[${id}] Missing expected event ${event}`);
            }
          }
        }
      } finally {
        await cleanup();
      }
    }
  });
});

async function collectNotifications(clients: DefaultClient[], timeoutMs: number): Promise<Record<string, string[]>> {
  const decoder = new TextDecoder();
  const notifications: Record<string, string[]> = {};

  const entries = clients.map((client, index) => ({
    client,
    index,
    iterator: client.Channel()[Symbol.asyncIterator](),
  }));

  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<{ type: "timeout" }>((resolve) => {
    timeoutHandle = setTimeout(() => resolve({ type: "timeout" }), timeoutMs);
  });

  const pending = entries.map((entry) => nextChannelPromise(entry));

  while (true) {
    const result = await Promise.race([timeoutPromise, ...pending]);
    if (result.type === "timeout") {
      break;
    }

    if (result.result.done) {
      pending[result.entry.index] = neverPromise();
      continue;
    }

    const payload = decodeMessage(decoder, result.result.value as { Data: Uint8Array });
    if (payload?.action) {
      if (!notifications[result.entry.client.Id()]) {
        notifications[result.entry.client.Id()] = [];
      }
      notifications[result.entry.client.Id()]?.push(payload.action);
    }

    pending[result.entry.index] = nextChannelPromise(result.entry);
  }

  if (timeoutHandle) {
    clearTimeout(timeoutHandle);
  }

  return notifications;
}

type ChannelEntry = {
  client: DefaultClient;
  index: number;
  iterator: AsyncIterator<unknown>;
};

type ChannelResult = {
  type: "message";
  entry: ChannelEntry;
  result: IteratorResult<unknown>;
};

function nextChannelPromise(entry: ChannelEntry): Promise<ChannelResult> {
  return entry.iterator.next().then((result) => ({ type: "message", entry, result }));
}

function neverPromise(): Promise<ChannelResult> {
  return new Promise(() => undefined);
}

type MessagePayload = { action?: string } | null;

function decodeMessage(decoder: TextDecoder, message: { Data: Uint8Array }): MessagePayload {
  try {
    const text = decoder.decode(message.Data);
    const data = JSON.parse(text) as { action?: string };
    return data;
  } catch {
    return null;
  }
}
