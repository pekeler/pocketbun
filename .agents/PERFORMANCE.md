# PocketBun Performance Playbook

This file is intentionally short and practical. Use it for changes that affect request-time performance.

## Non-Negotiables
- **Compatibility first:** preserve PocketBase observable behavior (status codes, JSON shape, auth/realtime semantics).
- **Measure first:** optimize only when you can point to a hotspot.
- **Verify after:** record before/after numbers and run the full validation suite.

## Hot Path Rules
- Avoid avoidable allocations inside loops:
  - combine `map`/`filter` chains into one pass in hot code.
  - avoid per-iteration temporary arrays/objects.
- Move invariants outside loops:
  - precompute regexes, `Set`s, query fragments, and constants once.
- Use the right membership structure:
  - repeated lookup against a changing/long list: use `Set`/`Map`.
  - one-off or very small checks: array checks are fine.
- Avoid `Object.keys()` / `Object.values()` when only checking emptiness or reading the first key.
- If output size is known, pre-size arrays with `[]` + `length` and assign by index.

## Parsing and String Handling
- Keep parsers allocation-light on hot paths (query/filter/sort parsing, bool casts, etc.).
- Do not assume one construct is faster (`switch` vs `includes`, etc.); benchmark on Bun for the real input shape.

## Database and I/O
- Keep bun:sqlite fast path patterns:
  - prepared/reused statements where appropriate,
  - transactions for grouped writes,
  - minimal selected columns on read paths.
- Keep existing DB pragmas and request middleware behavior unless there is measured evidence to change.
- Stream large responses/files instead of materializing full payloads when practical.

## Caching
- Prefer bounded caches only (size-limited and/or TTL).
- Avoid unbounded global maps.
- Cache keys should be cheap to compute on request paths.

## Change Workflow
1. Identify hotspot (profile/benchmark, then inspect code).
   - For whole-process Bun profiles against the real PocketBun CLI, you can use:
     - `bun run profile:cpu -- serve --dev`
     - `bun run profile:heap -- serve --dev`
   - These write Bun's markdown-friendly reports under `.tmp/profile-cpu/` or `.tmp/profile-heap/`.
   - For a narrower in-process request profile around a real server load window, use:
     - `bun run profile:inspector:list -- --duration-ms 3000 --concurrency 16`
   - This writes a Chrome DevTools-compatible `.cpuprofile` under `.tmp/profile-inspector/`.
   - For repeat local A/B throughput checks where the command itself should stay stable for approvals, edit `scripts/agent_script.ts` and rerun:
     - `bun run agent-script`
   - The default agent script should point at `scripts/measure_records_scenario.ts`, which starts a temporary app/server and drives the selected benchmark-shaped HTTP scenario without inspector overhead.
2. Compare with upstream implementation to avoid compatibility drift.
3. Make the smallest effective change.
4. Add or update tests when behavior-sensitive.
5. Run:
   - `bun run format:fix`
   - `bun test --concurrent`
   - `bun run typecheck`
   - `bun run lint`
6. Document before/after metric and benchmark command in PR/commit notes.

## Avoid
- Architecture-level changes without a measured bottleneck (cluster/process managers, external cache infra, etc.).
- Micro-optimizations that reduce clarity but do not move measured results.
