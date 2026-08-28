# Advanced PocketBun Example

This example wires `pb_hooks`, `pb_migrations`, and `pb_public` together and demonstrates auth, CRUD, files, realtime, and hooks.

## Local repo usage note

This example is for repo-local development, so it does not install `pocketbun` as a dependency.
It uses the local source (`../../index.ts`) and a local CLI wrapper (`bun run pocketbun` -> `bun ../../bin/pocketbun`).

For external projects, install from npm instead:

    bun add pocketbun
    bunx pocketbun --help

## Run the server

From the repo root:

    cd examples/advanced
    bun install
    bun run start

The first startup applies the migrations in `examples/advanced/pb_migrations` to create the `users` auth collection and the `projects` collection.

## Production mode

To disable development and hook-watching behavior and start two workers:

    bun run start:production

Two workers are illustrative; choose a worker count that fits your deployment. On Linux, both workers share `127.0.0.1:8090`. On macOS and Windows, they listen on `127.0.0.1:8090` and `127.0.0.1:8091` and require a reverse proxy. See the [production guide](../../docs/users/going-to-production.md#using-multiple-workers) for deployment details.

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

In terminal A, open a realtime connection and keep it running:

    curl -N http://127.0.0.1:8090/api/realtime

Copy the `clientId` from the `PB_CONNECT` event.

In terminal B, subscribe with the same auth token from "Create a user and log in":

    curl -X POST http://127.0.0.1:8090/api/realtime \
      -H "Authorization: <TOKEN>" \
      -H "Content-Type: application/json" \
      -d '{"clientId":"<CLIENT_ID>","subscriptions":["projects/*"]}'

The subscribe request returns `204 No Content` immediately. The SSE stream stays open in terminal A.

Create or update a project and watch the realtime event stream in terminal A.

## Custom route (hooks)

The hooks file registers `GET /hello` via `routerAdd(...)` and attaches
route middleware as additional `routerAdd(...)` arguments. It demonstrates both
custom middleware and a built-in middleware (`$apis.requireGuestOnly()`), so
authenticated callers are rejected.

Guest request:

    curl http://127.0.0.1:8090/hello

Authenticated request (expected to fail):

    curl -H "Authorization: <TOKEN>" http://127.0.0.1:8090/hello

## Custom route (programmatic `onServe`)

`examples/advanced/main.ts` also shows the code-first `BaseApp` style using
`e.router.get(...).bind(...)` with a built-in middleware imported from
`pocketbun` (`requireGuestOnly`).

Guest request:

    curl http://127.0.0.1:8090/hello-from-main

Authenticated request (expected to fail):

    curl -H "Authorization: <TOKEN>" http://127.0.0.1:8090/hello-from-main
