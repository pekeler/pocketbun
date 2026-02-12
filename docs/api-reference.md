# PocketBun API Reference

This page collects API-facing reference notes in one place.

## Conventions

- Base API path: `/api/`
- Admin UI path: `/_/`
- JSON responses and status behavior are intended to match PocketBase semantics.

## Endpoint Families

### Health

- `GET /api/health`

### Auth and Records

- Record auth endpoints mirror PocketBase route structure.
- Record CRUD/query semantics follow PocketBase-compatible behavior.

### Files

- File APIs, tokenized download behavior, and thumbnail handling follow PocketBase-compatible contracts.

### Realtime

- Realtime subscriptions use SSE-compatible PocketBase patterns.

### Collections and Settings

- Collection management and settings endpoints follow PocketBase API structure.

## Query and Filtering Notes

- PocketBun preserves PocketBase-style filter/sort/expand/fields semantics.
- Compatibility tests are maintained to keep observable behavior aligned.

## CLI and Runtime Touchpoints

- API behavior is package-distributed (`pocketbun`) and Bun-native.
- There is no built-in binary self-update command.

## Source and Cross-References

- PocketBase docs (supplemental): <https://pocketbase.io/docs/>
- PocketBase site source (docs): <https://github.com/pocketbase/site>
- PocketBun upstream mapping notes: [Upstream Docs Map](./maintainers/upstream-docs-map.md)

## Attribution

PocketBun is heavily compatibility-driven with PocketBase behavior and documentation structure.
PocketBase is by Gani Georgiev: <https://github.com/pocketbase/pocketbase>.
