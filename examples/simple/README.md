# Simple PocketBun Example

This example starts a PocketBun server with a local data directory under `examples/simple/pb_data`.

## Local repo usage note

This example intentionally does not install `pocketbun` as a package dependency.
It imports `../../index.ts` directly and exposes a local CLI wrapper (`bun run pocketbun` -> `bun ../../bin/pocketbun`) to avoid recursive `node_modules` trees with Bun local file installs.

For external projects, install from npm instead:

    bun add pocketbun
    bunx pocketbun --help

Run from the repo root:

    cd examples/simple
    bun install
    bun run start

Then visit:

- http://127.0.0.1:8090/_/ for the Admin UI
- http://127.0.0.1:8090/api/health for a basic API response
