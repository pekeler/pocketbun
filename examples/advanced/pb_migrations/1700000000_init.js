// PocketBun-only: advanced example collections (auth + projects).

migrate(
  (app) => {
    const users = newAuthCollection("users");
    users.Fields.add(
      new TextField({ name: "name", required: true }),
      new FileField({ name: "avatar", maxSelect: 1, maxSize: 5 * 1024 * 1024 }),
    );
    users.listRule = "@request.auth.id != ''";
    users.viewRule = "@request.auth.id != ''";
    users.updateRule = "@request.auth.id = id";
    users.deleteRule = "@request.auth.id = id";
    app.save(users);

    const projects = newBaseCollection("projects");
    projects.Fields.add(
      new TextField({ name: "title", required: true, min: 3 }),
      new TextField({ name: "slug", required: true }),
      new EditorField({ name: "notes" }),
      new BoolField({ name: "done" }),
      new FileField({ name: "attachment", maxSelect: 1, maxSize: 5 * 1024 * 1024 }),
      new RelationField({ name: "owner", collectionId: users.id, maxSelect: 1, required: true }),
    );
    projects.listRule = "@request.auth.id != ''";
    projects.viewRule = "@request.auth.id != ''";
    projects.createRule = "@request.auth.id != ''";
    projects.updateRule = "@request.auth.id = owner";
    projects.deleteRule = "@request.auth.id = owner";
    app.save(projects);
  },
  (app) => {
    const projects = app.findCollectionByNameOrId("projects");
    if (projects) {
      app.delete(projects);
    }
    const users = app.findCollectionByNameOrId("users");
    if (users) {
      app.delete(users);
    }
  },
);
