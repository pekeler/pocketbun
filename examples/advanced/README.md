# Advanced PocketBun Example

This example wires `pb_hooks`, `pb_migrations`, and `pb_public` together and demonstrates auth, CRUD, files, realtime, and hooks.

## Run the server

From the repo root:

    cd examples/advanced
    bun install
    bun run start

The first startup applies the migrations in `examples/advanced/pb_migrations` to create the `users` auth collection and the `projects` collection.

## Create a superuser (Admin UI access)

Run once before opening the Admin UI:

    bun run superuser

Then visit:

- http://127.0.0.1:8090/_/ (Admin UI)
- http://127.0.0.1:8090/ (static file from `pb_public`)

## Create a user and log in

Create an auth record:

    curl -X POST http://127.0.0.1:8090/api/collections/users/records \
      -H "Content-Type: application/json" \
      -d '{"email":"demo@example.com","password":"pass12345","passwordConfirm":"pass12345","name":"Demo"}'

Log in and capture the `token` and the user `id` from the response:

    curl -X POST http://127.0.0.1:8090/api/collections/users/auth-with-password \
      -H "Content-Type: application/json" \
      -d '{"identity":"demo@example.com","password":"pass12345"}'

## JavaScript SDK (PocketBase JS)

This example includes a small script that uses the official PocketBase JavaScript SDK.

Run a health check:

    bun run client

Optionally, after creating the demo user above, run with credentials to authenticate and fetch projects:

    POCKETBUN_DEMO_EMAIL=demo@example.com POCKETBUN_DEMO_PASSWORD=pass12345 bun run client

## Create a project (CRUD + files + hooks)

Use the auth token and the user id as the `owner`. The hook will generate the `slug` automatically.

    curl -X POST http://127.0.0.1:8090/api/collections/projects/records \
      -H "Authorization: <TOKEN>" \
      -F "title=First Project" \
      -F "owner=<USER_ID>" \
      -F "notes=Hello from PocketBun" \
      -F "attachment=@examples/advanced/sample.txt"

Fetch the record and verify the `slug` field was set by the hook:

    curl -H "Authorization: <TOKEN>" http://127.0.0.1:8090/api/collections/projects/records/<RECORD_ID>

## Realtime (SSE)

Open a realtime connection (keep this running):

    curl -N http://127.0.0.1:8090/api/realtime

Copy the `clientId` from the `PB_CONNECT` event, then subscribe:

    curl -X POST http://127.0.0.1:8090/api/realtime \
      -H "Content-Type: application/json" \
      -d '{"clientId":"<CLIENT_ID>","subscriptions":["projects"]}'

Create or update a project and watch the realtime event stream.

## Custom route (hooks)

The hooks file also registers a custom route:

    curl http://127.0.0.1:8090/hello
