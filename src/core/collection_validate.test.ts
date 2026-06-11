// Ported from pocketbase/core/collection_validate_test.go

import { describe, it } from "bun:test";
import { newTestApp } from "../tests/app.ts";
import { testValidationErrors } from "../tests/validation_errors.ts";
import { CollectionNameAuthOrigins } from "./auth_origin_model.ts";
import {
  Collection,
  CollectionNameSuperusers,
  CollectionTypeBase,
  NewAuthCollection,
  NewBaseCollection,
  NewViewCollection,
} from "./collection_model.ts";
import { BoolField } from "./field_bool.ts";
import { EmailField } from "./field_email.ts";
import { PasswordField } from "./field_password.ts";
import { TextField } from "./field_text.ts";
import { NewFieldsList } from "./fields_list.ts";

describe("collection validate", () => {
  it("scenarios", async () => {
    const scenarios = [
      {
        name: "empty collection",
        collection: () => new Collection(),
        expectedErrors: ["id", "name", "type", "fields"],
      },
      {
        name: "unknown type with all invalid fields",
        collection: () => {
          const c = new Collection();
          c.id = "invalid_id ?!@#$";
          c.name = "invalid_name ?!@#$";
          c.type = "invalid_type";
          c.listRule = "missing = '123'";
          c.viewRule = "missing = '123'";
          c.createRule = "missing = '123'";
          c.updateRule = "missing = '123'";
          c.deleteRule = "missing = '123'";
          c.indexes = ["create index '' on '' ()"];
          c.ViewQuery = "invalid";
          c.AuthRule = "missing = '123'";
          return c;
        },
        expectedErrors: [
          "id",
          "name",
          "type",
          "indexes",
          "listRule",
          "viewRule",
          "createRule",
          "updateRule",
          "deleteRule",
          "fields",
        ],
      },
      {
        name: "base with invalid fields",
        collection: () => {
          const c = NewBaseCollection("invalid_name ?!@#$");
          c.indexes = ["create index '' on '' ()"];
          c.ViewQuery = "invalid";
          c.AuthRule = "missing = '123'";
          return c;
        },
        expectedErrors: ["name", "indexes"],
      },
      {
        name: "view with invalid fields",
        collection: () => {
          const c = NewViewCollection("invalid_name ?!@#$");
          c.indexes = ["create index '' on '' ()"];
          c.ViewQuery = "invalid";
          c.AuthRule = "missing = '123'";
          return c;
        },
        expectedErrors: ["indexes", "name", "fields", "viewQuery"],
      },
      {
        name: "auth with invalid fields",
        collection: () => {
          const c = NewAuthCollection("invalid_name ?!@#$");
          c.indexes = ["create index '' on '' ()"];
          c.ViewQuery = "invalid";
          c.AuthRule = "missing = '123'";
          return c;
        },
        expectedErrors: ["indexes", "name", "authRule"],
      },
      {
        name: "empty type",
        collection: () => {
          const c = NewBaseCollection("test");
          c.type = "";
          return c;
        },
        expectedErrors: ["type"],
      },
      {
        name: "unknown type",
        collection: () => {
          const c = NewBaseCollection("test");
          c.type = "unknown";
          return c;
        },
        expectedErrors: ["type"],
      },
      {
        name: "base type",
        collection: () => {
          return NewBaseCollection("test");
        },
        expectedErrors: [],
      },
      {
        name: "view type",
        collection: () => {
          const c = NewViewCollection("test");
          c.ViewQuery = "select 1 as id";
          return c;
        },
        expectedErrors: [],
      },
      {
        name: "auth type",
        collection: () => {
          return NewAuthCollection("test");
        },
        expectedErrors: [],
      },
      {
        name: "changing type",
        collection: async (app: Awaited<ReturnType<typeof newTestApp>>["app"]) => {
          const c = app.findCollectionByNameOrIdOrNull("users");
          if (!c) {
            throw new Error("Missing users collection");
          }
          c.type = CollectionTypeBase;
          return c;
        },
        expectedErrors: ["type"],
      },
      {
        name: "change from system to regular",
        collection: async (app: Awaited<ReturnType<typeof newTestApp>>["app"]) => {
          const c = app.findCollectionByNameOrIdOrNull(CollectionNameSuperusers);
          if (!c) {
            throw new Error("Missing superusers collection");
          }
          c.system = false;
          return c;
        },
        expectedErrors: ["system"],
      },
      {
        name: "change from regular to system",
        collection: async (app: Awaited<ReturnType<typeof newTestApp>>["app"]) => {
          const c = app.findCollectionByNameOrIdOrNull("demo1");
          if (!c) {
            throw new Error("Missing demo1 collection");
          }
          c.system = true;
          return c;
        },
        expectedErrors: ["system"],
      },
      {
        name: "create system",
        collection: () => {
          const c = NewBaseCollection("new_system");
          c.system = true;
          return c;
        },
        expectedErrors: [],
      },
      {
        name: "empty id",
        collection: () => {
          const c = NewBaseCollection("test");
          c.id = "";
          return c;
        },
        expectedErrors: ["id"],
      },
      {
        name: "invalid id",
        collection: () => {
          const c = NewBaseCollection("test");
          c.id = "!invalid";
          return c;
        },
        expectedErrors: ["id"],
      },
      {
        name: "existing id",
        collection: () => {
          const c = NewBaseCollection("test");
          c.id = "_pb_users_auth_";
          return c;
        },
        expectedErrors: ["id"],
      },
      {
        name: "changing id",
        collection: async (app: Awaited<ReturnType<typeof newTestApp>>["app"]) => {
          const c = app.findCollectionByNameOrIdOrNull("demo3");
          if (!c) {
            throw new Error("Missing demo3 collection");
          }
          c.id = "anything";
          return c;
        },
        expectedErrors: ["id"],
      },
      {
        name: "valid id",
        collection: () => {
          const c = NewBaseCollection("test");
          c.id = "anything";
          return c;
        },
        expectedErrors: [],
      },
      {
        name: "empty name",
        collection: () => {
          const c = NewBaseCollection("");
          c.id = "test";
          return c;
        },
        expectedErrors: ["name"],
      },
      {
        name: "invalid name",
        collection: () => {
          return NewBaseCollection("!invalid");
        },
        expectedErrors: ["name"],
      },
      {
        name: "name with _via_",
        collection: () => {
          return NewBaseCollection("a_via_b");
        },
        expectedErrors: ["name"],
      },
      {
        name: "create with existing collection name",
        collection: () => {
          return NewBaseCollection("demo1");
        },
        expectedErrors: ["name"],
      },
      {
        name: "create with existing internal table name",
        collection: () => {
          return NewBaseCollection("_collections");
        },
        expectedErrors: ["name"],
      },
      {
        name: "update with existing collection name",
        collection: async (app: Awaited<ReturnType<typeof newTestApp>>["app"]) => {
          const c = app.findCollectionByNameOrIdOrNull("users");
          if (!c) {
            throw new Error("Missing users collection");
          }
          c.name = "demo1";
          return c;
        },
        expectedErrors: ["name"],
      },
      {
        name: "update with existing internal table name",
        collection: async (app: Awaited<ReturnType<typeof newTestApp>>["app"]) => {
          const c = app.findCollectionByNameOrIdOrNull("users");
          if (!c) {
            throw new Error("Missing users collection");
          }
          c.name = "_collections";
          return c;
        },
        expectedErrors: ["name"],
      },
      {
        name: "system collection name change",
        collection: async (app: Awaited<ReturnType<typeof newTestApp>>["app"]) => {
          const c = app.findCollectionByNameOrIdOrNull(CollectionNameSuperusers);
          if (!c) {
            throw new Error("Missing superusers collection");
          }
          c.name = "superusers_new";
          return c;
        },
        expectedErrors: ["name"],
      },
      {
        name: "create with valid name",
        collection: () => {
          return NewBaseCollection("new_col");
        },
        expectedErrors: [],
      },
      {
        name: "update with valid name",
        collection: (app: Awaited<ReturnType<typeof newTestApp>>["app"]) => {
          const c = app.findCollectionByNameOrIdOrNull("demo1");
          if (!c) {
            throw new Error("Missing demo1 collection");
          }
          c.name = "demo1_new";
          return c;
        },
        expectedErrors: [],
      },
      {
        name: "invalid base rules",
        collection: () => {
          const c = NewBaseCollection("new");
          c.listRule = "!invalid";
          c.viewRule = "missing = 123";
          c.createRule = "id = 123 && missing = 456";
          c.updateRule = "@request.body.missing:changed = false";
          c.deleteRule = "(id=123";
          return c;
        },
        expectedErrors: ["listRule", "viewRule", "createRule", "updateRule", "deleteRule"],
      },
      {
        name: "valid base rules",
        collection: () => {
          const c = NewBaseCollection("new");
          const field = new TextField();
          field.Name = "f1";
          c.Fields.Add(field);
          c.listRule = "";
          c.viewRule = "f1 = 123";
          c.createRule = "id = 123 && f1 = 456";
          c.updateRule = "(id = 123 && @request.body.f1:changed = false)";
          c.deleteRule = "f1 = 123";
          return c;
        },
        expectedErrors: [],
      },
      {
        name: "view with non-nil create/update/delete rules",
        collection: () => {
          const c = NewViewCollection("new");
          c.ViewQuery = "select 1 as id, 'text' as f1";
          c.listRule = "id = 123";
          c.viewRule = "f1 = 456";
          c.createRule = "";
          c.updateRule = "";
          c.deleteRule = "";
          return c;
        },
        expectedErrors: ["createRule", "updateRule", "deleteRule"],
      },
      {
        name: "view with nil create/update/delete rules",
        collection: () => {
          const c = NewViewCollection("new");
          c.ViewQuery = "select 1 as id, 'text' as f1";
          c.listRule = "id = 1";
          c.viewRule = "f1 = 456";
          return c;
        },
        expectedErrors: [],
      },
      {
        name: "changing api rules",
        collection: (app: Awaited<ReturnType<typeof newTestApp>>["app"]) => {
          const c = app.findCollectionByNameOrIdOrNull("users");
          if (!c) {
            throw new Error("Missing users collection");
          }
          const field = new TextField();
          field.Name = "f1";
          c.Fields.Add(field);
          c.listRule = "id = 1";
          c.viewRule = "f1 = 456";
          c.createRule = "id = 123 && f1 = 456";
          c.updateRule = "(id = 123)";
          c.deleteRule = "f1 = 123";
          return c;
        },
        expectedErrors: [],
      },
      {
        name: "changing system collection api rules",
        collection: (app: Awaited<ReturnType<typeof newTestApp>>["app"]) => {
          const c = app.findCollectionByNameOrIdOrNull(CollectionNameSuperusers);
          if (!c) {
            throw new Error("Missing superusers collection");
          }
          c.listRule = "1 = 1";
          c.viewRule = "1 = 1";
          c.createRule = "1 = 1";
          c.updateRule = "1 = 1";
          c.deleteRule = "1 = 1";
          c.ManageRule = "1 = 1";
          c.AuthRule = "1 = 1";
          return c;
        },
        expectedErrors: ["listRule", "viewRule", "createRule", "updateRule", "deleteRule", "manageRule", "authRule"],
      },
      {
        name: "invalid index expression",
        collection: (app: Awaited<ReturnType<typeof newTestApp>>["app"]) => {
          const c = app.findCollectionByNameOrIdOrNull("demo1");
          if (!c) {
            throw new Error("Missing demo1 collection");
          }
          c.indexes = ["create index invalid", "create index idx_test_demo2 on anything (text)"];
          return c;
        },
        expectedErrors: ["indexes"],
      },
      {
        name: "index name used in other table",
        collection: (app: Awaited<ReturnType<typeof newTestApp>>["app"]) => {
          const c = app.findCollectionByNameOrIdOrNull("demo1");
          if (!c) {
            throw new Error("Missing demo1 collection");
          }
          c.indexes = [
            "create index `idx_test_demo1` on demo1 (id)",
            "create index `__pb_USERS_auth__username_idx` on anything (text)",
          ];
          return c;
        },
        expectedErrors: ["indexes"],
      },
      {
        name: "duplicated index names",
        collection: (app: Awaited<ReturnType<typeof newTestApp>>["app"]) => {
          const c = app.findCollectionByNameOrIdOrNull("demo1");
          if (!c) {
            throw new Error("Missing demo1 collection");
          }
          c.indexes = ["create index idx_test_demo1 on demo1 (id)", "create index idx_test_demo1 on anything (text)"];
          return c;
        },
        expectedErrors: ["indexes"],
      },
      {
        name: "duplicated index definitions",
        collection: (app: Awaited<ReturnType<typeof newTestApp>>["app"]) => {
          const c = app.findCollectionByNameOrIdOrNull("demo1");
          if (!c) {
            throw new Error("Missing demo1 collection");
          }
          c.indexes = ["create index idx_test_demo1 on demo1 (id)", "create index idx_test_demo2 on demo1 (id)"];
          return c;
        },
        expectedErrors: ["indexes"],
      },
      {
        name: "try to add index to a view collection",
        collection: (app: Awaited<ReturnType<typeof newTestApp>>["app"]) => {
          const c = app.findCollectionByNameOrIdOrNull("view1");
          if (!c) {
            throw new Error("Missing view1 collection");
          }
          c.indexes = ["create index idx_test_view1 on view1 (id)"];
          return c;
        },
        expectedErrors: ["indexes"],
      },
      {
        name: "replace old with new indexes",
        collection: (app: Awaited<ReturnType<typeof newTestApp>>["app"]) => {
          const c = app.findCollectionByNameOrIdOrNull("demo1");
          if (!c) {
            throw new Error("Missing demo1 collection");
          }
          c.indexes = ["create index idx_test_demo1 on demo1 (id)", "create index idx_test_demo2 on anything (text)"];
          return c;
        },
        expectedErrors: [],
      },
      {
        name: "old + new indexes",
        collection: (app: Awaited<ReturnType<typeof newTestApp>>["app"]) => {
          const c = app.findCollectionByNameOrIdOrNull("demo1");
          if (!c) {
            throw new Error("Missing demo1 collection");
          }
          c.indexes = [
            "CREATE INDEX `_wsmn24bux7wo113_created_idx` ON `demo1` (`created`)",
            "create index idx_test_demo1 on anything (id)",
          ];
          return c;
        },
        expectedErrors: [],
      },
      {
        name: "index for missing field",
        collection: (app: Awaited<ReturnType<typeof newTestApp>>["app"]) => {
          const c = app.findCollectionByNameOrIdOrNull("demo1");
          if (!c) {
            throw new Error("Missing demo1 collection");
          }
          c.indexes = ["create index idx_test_demo1 on anything (missing)"];
          return c;
        },
        expectedErrors: [],
      },
      {
        name: "auth collection with missing required unique indexes",
        collection: () => {
          const c = NewAuthCollection("new_auth");
          c.indexes = [];
          return c;
        },
        expectedErrors: ["indexes", "passwordAuth"],
      },
      {
        name: "auth collection with non-unique required indexes",
        collection: () => {
          const c = NewAuthCollection("new_auth");
          c.indexes = ["create index test_idx1 on new_auth (tokenKey)", "create index test_idx2 on new_auth (email)"];
          return c;
        },
        expectedErrors: ["indexes", "passwordAuth"],
      },
      {
        name: "auth collection with unique required indexes",
        collection: () => {
          const c = NewAuthCollection("new_auth");
          c.indexes = [
            "create unique index test_idx1 on new_auth (tokenKey)",
            "create unique index test_idx2 on new_auth (email)",
          ];
          return c;
        },
        expectedErrors: [],
      },
      {
        name: "removing index on system field",
        collection: async (app: Awaited<ReturnType<typeof newTestApp>>["app"]) => {
          const demo2 = app.findCollectionByNameOrIdOrNull("demo2");
          if (!demo2) {
            throw new Error("Missing demo2 collection");
          }
          const titleField = demo2.Fields.GetByName("title");
          if (!titleField) {
            throw new Error("Missing title field");
          }
          titleField.SetSystem(true);
          const saveErr = await app.Save(demo2);
          if (saveErr) {
            throw saveErr;
          }
          const refreshed = app.findCollectionByNameOrIdOrNull("demo2");
          if (!refreshed) {
            throw new Error("Missing demo2 collection after save");
          }
          refreshed.RemoveIndex("idx_unique_demo2_title");
          return refreshed;
        },
        expectedErrors: ["indexes"],
      },
      {
        name: "changing partial constraint of existing index on system field",
        collection: async (app: Awaited<ReturnType<typeof newTestApp>>["app"]) => {
          const demo2 = app.findCollectionByNameOrIdOrNull("demo2");
          if (!demo2) {
            throw new Error("Missing demo2 collection");
          }
          const titleField = demo2.Fields.GetByName("title");
          if (!titleField) {
            throw new Error("Missing title field");
          }
          titleField.SetSystem(true);
          const saveErr = await app.Save(demo2);
          if (saveErr) {
            throw saveErr;
          }
          const refreshed = app.findCollectionByNameOrIdOrNull("demo2");
          if (!refreshed) {
            throw new Error("Missing demo2 collection after save");
          }
          refreshed.RemoveIndex("idx_unique_demo2_title");
          refreshed.AddIndex("idx_new_demo2_title", true, "title", "1 = 1");
          return refreshed;
        },
        expectedErrors: [],
      },
      {
        name: "changing column sort and collate of existing index on system field",
        collection: async (app: Awaited<ReturnType<typeof newTestApp>>["app"]) => {
          const demo2 = app.findCollectionByNameOrIdOrNull("demo2");
          if (!demo2) {
            throw new Error("Missing demo2 collection");
          }
          const titleField = demo2.Fields.GetByName("title");
          if (!titleField) {
            throw new Error("Missing title field");
          }
          titleField.SetSystem(true);
          const saveErr = await app.Save(demo2);
          if (saveErr) {
            throw saveErr;
          }
          const refreshed = app.findCollectionByNameOrIdOrNull("demo2");
          if (!refreshed) {
            throw new Error("Missing demo2 collection after save");
          }
          refreshed.RemoveIndex("idx_unique_demo2_title");
          refreshed.AddIndex("idx_new_demo2_title", true, "title COLLATE test ASC", "");
          return refreshed;
        },
        expectedErrors: [],
      },
      {
        name: "adding new column to index on system field",
        collection: async (app: Awaited<ReturnType<typeof newTestApp>>["app"]) => {
          const demo2 = app.findCollectionByNameOrIdOrNull("demo2");
          if (!demo2) {
            throw new Error("Missing demo2 collection");
          }
          const titleField = demo2.Fields.GetByName("title");
          if (!titleField) {
            throw new Error("Missing title field");
          }
          titleField.SetSystem(true);
          const saveErr = await app.Save(demo2);
          if (saveErr) {
            throw saveErr;
          }
          const refreshed = app.findCollectionByNameOrIdOrNull("demo2");
          if (!refreshed) {
            throw new Error("Missing demo2 collection after save");
          }
          refreshed.RemoveIndex("idx_unique_demo2_title");
          refreshed.AddIndex("idx_new_title", false, "title, id", "");
          return refreshed;
        },
        expectedErrors: ["indexes"],
      },
      {
        name: "changing index type on system field",
        collection: async (app: Awaited<ReturnType<typeof newTestApp>>["app"]) => {
          const demo2 = app.findCollectionByNameOrIdOrNull("demo2");
          if (!demo2) {
            throw new Error("Missing demo2 collection");
          }
          const titleField = demo2.Fields.GetByName("title");
          if (!titleField) {
            throw new Error("Missing title field");
          }
          titleField.SetSystem(true);
          const saveErr = await app.Save(demo2);
          if (saveErr) {
            throw saveErr;
          }
          const refreshed = app.findCollectionByNameOrIdOrNull("demo2");
          if (!refreshed) {
            throw new Error("Missing demo2 collection after save");
          }
          refreshed.RemoveIndex("idx_unique_demo2_title");
          refreshed.AddIndex("idx_new_title", false, "title", "1=1");
          return refreshed;
        },
        expectedErrors: ["indexes"],
      },
      {
        name: "changing index on non-system field",
        collection: (app: Awaited<ReturnType<typeof newTestApp>>["app"]) => {
          const demo2 = app.findCollectionByNameOrIdOrNull("demo2");
          if (!demo2) {
            throw new Error("Missing demo2 collection");
          }
          demo2.RemoveIndex("idx_demo2_active");
          demo2.AddIndex("idx_demo2_active", true, "active", "1 = 1");
          return demo2;
        },
        expectedErrors: [],
      },
      {
        name: "empty fields",
        collection: () => {
          const c = NewBaseCollection("new_auth");
          c.Fields = NewFieldsList();
          return c;
        },
        expectedErrors: ["fields"],
      },
      {
        name: "no id primay key field",
        collection: () => {
          const c = NewBaseCollection("new_auth");
          c.Fields = NewFieldsList(Object.assign(new TextField(), { Name: "id" }));
          return c;
        },
        expectedErrors: ["fields"],
      },
      {
        name: "with id primay key field",
        collection: () => {
          const idField = Object.assign(new TextField(), {
            Name: "id",
            PrimaryKey: true,
            Required: true,
            Pattern: "\\w+",
          });
          const c = NewBaseCollection("new_auth");
          c.Fields = NewFieldsList(idField);
          return c;
        },
        expectedErrors: [],
      },
      {
        name: "duplicated field names",
        collection: () => {
          const idField = Object.assign(new TextField(), {
            Name: "id",
            PrimaryKey: true,
            Required: true,
            Pattern: "\\w+",
          });
          const field1 = Object.assign(new TextField(), { Id: "f1", Name: "Test" });
          const field2 = Object.assign(new BoolField(), { Id: "f2", Name: "test" });
          const c = NewBaseCollection("new_auth");
          c.Fields = NewFieldsList(idField, field1, field2);
          return c;
        },
        expectedErrors: ["fields"],
      },
      {
        name: "changing field type",
        collection: (app: Awaited<ReturnType<typeof newTestApp>>["app"]) => {
          const c = app.findCollectionByNameOrIdOrNull("demo1");
          if (!c) {
            throw new Error("Missing demo1 collection");
          }
          const f = c.Fields.GetByName("text");
          if (!f) {
            throw new Error("Missing text field");
          }
          const replacement = Object.assign(new BoolField(), { Id: f.GetId(), Name: f.GetName() });
          c.Fields.Add(replacement);
          return c;
        },
        expectedErrors: ["fields"],
      },
      {
        name: "renaming system field",
        collection: (app: Awaited<ReturnType<typeof newTestApp>>["app"]) => {
          const c = app.findCollectionByNameOrIdOrNull(CollectionNameAuthOrigins);
          if (!c) {
            throw new Error("Missing auth origins collection");
          }
          const f = c.Fields.GetByName("fingerprint");
          if (!f) {
            throw new Error("Missing fingerprint field");
          }
          f.SetName("fingerprint_new");
          return c;
        },
        expectedErrors: ["fields"],
      },
      {
        name: "deleting system field",
        collection: (app: Awaited<ReturnType<typeof newTestApp>>["app"]) => {
          const c = app.findCollectionByNameOrIdOrNull(CollectionNameAuthOrigins);
          if (!c) {
            throw new Error("Missing auth origins collection");
          }
          c.Fields.RemoveByName("fingerprint");
          return c;
        },
        expectedErrors: ["fields"],
      },
      {
        name: "invalid field setting",
        collection: () => {
          const c = NewBaseCollection("test_new");
          const field = new TextField();
          field.Name = "f1";
          field.Min = -10;
          c.Fields.Add(field);
          return c;
        },
        expectedErrors: ["fields"],
      },
      {
        name: "valid field setting",
        collection: () => {
          const c = NewBaseCollection("test_new");
          const field = new TextField();
          field.Name = "f1";
          field.Min = 10;
          c.Fields.Add(field);
          return c;
        },
        expectedErrors: [],
      },
      {
        name: "fields view changes should be ignored",
        collection: (app: Awaited<ReturnType<typeof newTestApp>>["app"]) => {
          const c = app.findCollectionByNameOrIdOrNull("view1");
          if (!c) {
            throw new Error("Missing view1 collection");
          }
          c.Fields = NewFieldsList();
          return c;
        },
        expectedErrors: [],
      },
      {
        name: "with reserved auth only field name (passwordConfirm)",
        collection: () => {
          const c = NewAuthCollection("new_auth");
          const field = new TextField();
          field.Name = "passwordConfirm";
          c.Fields.Add(field);
          return c;
        },
        expectedErrors: ["fields"],
      },
      {
        name: "with reserved auth only field name (oldPassword)",
        collection: () => {
          const c = NewAuthCollection("new_auth");
          const field = new TextField();
          field.Name = "oldPassword";
          c.Fields.Add(field);
          return c;
        },
        expectedErrors: ["fields"],
      },
      {
        name: "with invalid password auth field options (1)",
        collection: () => {
          const c = NewAuthCollection("new_auth");
          const field = new TextField();
          field.Name = "password";
          field.System = true;
          field.Hidden = true;
          c.Fields.Add(field);
          return c;
        },
        expectedErrors: ["fields"],
      },
      {
        name: "with valid password auth field options (2)",
        collection: () => {
          const c = NewAuthCollection("new_auth");
          const field = new PasswordField();
          field.Name = "password";
          field.System = true;
          field.Hidden = true;
          c.Fields.Add(field);
          return c;
        },
        expectedErrors: [],
      },
      {
        name: "with invalid tokenKey auth field options (1)",
        collection: () => {
          const c = NewAuthCollection("new_auth");
          const field = new TextField();
          field.Name = "tokenKey";
          field.System = true;
          c.Fields.Add(field);
          return c;
        },
        expectedErrors: ["fields"],
      },
      {
        name: "with valid tokenKey auth field options (2)",
        collection: () => {
          const c = NewAuthCollection("new_auth");
          const field = new TextField();
          field.Name = "tokenKey";
          field.System = true;
          field.Hidden = true;
          c.Fields.Add(field);
          return c;
        },
        expectedErrors: [],
      },
      {
        name: "with invalid email auth field options (1)",
        collection: () => {
          const c = NewAuthCollection("new_auth");
          const field = new TextField();
          field.Name = "email";
          field.System = true;
          c.Fields.Add(field);
          return c;
        },
        expectedErrors: ["fields"],
      },
      {
        name: "with valid email auth field options (2)",
        collection: () => {
          const c = NewAuthCollection("new_auth");
          const field = new EmailField();
          field.Name = "email";
          field.System = true;
          c.Fields.Add(field);
          return c;
        },
        expectedErrors: [],
      },
      {
        name: "with invalid verified auth field options (1)",
        collection: () => {
          const c = NewAuthCollection("new_auth");
          const field = new TextField();
          field.Name = "verified";
          field.System = true;
          c.Fields.Add(field);
          return c;
        },
        expectedErrors: ["fields"],
      },
      {
        name: "with valid verified auth field options (2)",
        collection: () => {
          const c = NewAuthCollection("new_auth");
          const field = new BoolField();
          field.Name = "verified";
          field.System = true;
          c.Fields.Add(field);
          return c;
        },
        expectedErrors: [],
      },
    ];

    for (const scenario of scenarios) {
      const { app, cleanup } = await newTestApp();
      try {
        const collection = await scenario.collection(app);
        const result = await app.Validate(collection);
        try {
          testValidationErrors(result, scenario.expectedErrors);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          throw new Error(`Scenario "${scenario.name}" failed: ${message}`);
        }
      } finally {
        await cleanup();
      }
    }
  }, 120000);
});
