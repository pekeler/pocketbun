# Porting PocketBase to Bun With an Agent: Notes From the Last Mile

![PB Logo driving on OpenAI wheels from the Golang to the Bun logo.](./pb2pb.webp)

PocketBun started from a simple motivation: keep the PocketBase developer experience, but run it natively on Bun. Not “inspired by” PocketBase. Not “similar to.” The bar we set was API compatibility: same routes, same status codes, same JSON shapes, same auth behavior, same realtime protocol, same error format, and the same Admin UI served unchanged.

That one decision drove everything else.

From **January 30, 2026** to **February 8, 2026**, we moved from a thin Bun scaffold to a near-release system with broad parity and a measured performance sprint behind us. In raw size terms, the effort turned roughly **93K lines of Go into about 100K lines of TypeScript**. (Depending on how you count tests and support code, the totals can be higher, but the order of magnitude is right.)

## The requirements we imposed on ourselves

Before writing much code, we constrained the work:

- Bun-only runtime and Bun-first primitives.
- Mechanical, traceable ports over “clean rewrites.”
- Preserve upstream structure where practical (1:1 mapping).
- Keep provenance visible (ported-from headers, upstream comments).
- Treat upstream tests as the behavioral oracle.
- Keep the Admin UI vendored and unchanged.
- Run a full quality gate continuously (`format`, `test`, `typecheck`, `lint`).

Those constraints were not overhead. They were how we avoided turning a port into a fork.

## The path from zero to “almost ship”

The project advanced in staged slices, each ending in visible behavior:

- First, a runnable server: `/_/` for Admin UI, `/api/health` parity, static serving order.
- Then bootstrap and persistence: settings, migrations, auth-aware health behavior.
- Then the heavy middle: collections, records, auth flows, validation, file handling.
- Then realtime and hooks: SSE behavior and hook-loading parity.
- Then structure hardening: restore upstream-like file mapping, port missing tests, close parity gaps.
- Then pre-release work: CI, e2e, docs/examples, upgrade workflow, and upstream audit.
- Finally, a focused performance sprint with upstream benchmark harnesses and controlled profiling.

This sequencing mattered. It kept us from optimizing abstractions we later would have removed, and from “shipping green tests” that didn’t match real behavior.

## How time actually split

Based on the dated execution log, a reasonable split is:

1. **Pure porting and parity buildout:** about **65–70%** of effort (roughly Jan 30 through Feb 5).
2. **Performance optimization:** about **25–30%** (mostly Feb 6 through Feb 8).
3. **Bug-finding and bug-fixing:** about **10–15% equivalent**, but spread across the entire period.

The categories overlap. In a port like this, “bug fix” often means “found a hidden semantic mismatch while porting” or “benchmark was measuring the wrong thing.” Still, as a planning lens, that split is useful.

## What surprised us

The first surprise: the translation itself was not the hardest part. The hardest part was preserving behavior in places where the languages carry different default assumptions.

A few examples of the pattern:

- Go’s sync-heavy internals vs Bun’s async runtime pressure.
- SQL placeholder and quoting behavior differences that look trivial until they break compatibility.
- Validation/error-code parity that depends on exact ordering, not just equivalent checks.
- Request lifecycle and middleware semantics where “almost same” still breaks tests.

The second surprise: several “server performance problems” were actually benchmark client/harness problems. We saw cases where connection churn and response-body handling in the requester created misleading deltas. Once the harness was fixed, whole classes of apparent regressions disappeared. That was a good reminder that benchmarking is software too, and buggy benchmark code produces very confident nonsense.

The third surprise: TypeScript line count inflation is real in a serious compatibility port. You gain explicit boundary code, async/sync bridging, compatibility shims, and tests. You do not get a magical “fewer lines because modern language” discount.

## Why this is a strong coding-agent task

Porting a large codebase is one of the best use cases for modern coding agents, for a simple reason: the work is high-volume, detail-heavy, and locally deterministic, but globally coordinated.

Agents are very strong at:

- Mechanical translation with structural consistency.
- Moving through many files without losing naming/origin discipline.
- Cross-checking source and tests quickly.
- Repeating verification loops without fatigue.
- Keeping a long-running plan and decision log coherent.

Where the human is still essential:

- Defining non-negotiable behavioral contracts.
- Deciding acceptable deviations.
- Interpreting noisy benchmark signals.
- Choosing what not to optimize.
- Enforcing product-level priorities over local code neatness.

In other words: agents can carry the load, but they need a tight spec and a ruthless oracle. For us, that oracle was “observable PocketBase behavior, verified by tests.”

## What made this easier

Three things kept the project moving:

- **Milestone slicing with runnable outcomes.** We always ended a phase with something externally testable.
- **Upstream-first traceability.** 1:1 mapping and source-path comments made drift visible.
- **Aggressive test porting.** We didn’t treat tests as cleanup work. They were the work.

Those choices gave us fast feedback and reduced the chance of accumulating “unknown unknowns.”

## What made this hard

Also clear in hindsight:

- **Semantic mismatches hide in edge paths.** Especially validation, hooks, auth flows, and request parsing.
- **Async conversion is not mechanical.** It can change ordering, cleanup, and backpressure behavior.
- **Performance work can eat the schedule.** It’s easy to over-optimize before correctness is locked.
- **A port is a maintenance promise.** Without structural parity, every upstream upgrade becomes expensive.

This is why we paused optimization deliberately after a measured sprint and moved remaining items to deferred follow-ups unless they became release-blocking.

## Practical lessons for anyone porting a large project

1. Pick a behavioral contract before writing code, and make it executable through tests.
2. Prefer mechanical translation first; refactor later, and only with proof.
3. Keep file/module mapping close to upstream so future diffs stay tractable.
4. Treat benchmarks as code that needs validation, not truth from the sky.
5. Separate phases: parity first, optimization second.
6. Log decisions and surprises continuously; memory is not a process.
7. Assume line count will grow. Plan for glue code, async bridges, and extra tests.
8. Decide early which differences are truly acceptable, and document only those.

## Where we are just before release

By early February 2026, we had crossed the hard part: broad compatibility behavior, substantial upstream test coverage, upgrade process defined, and a completed first optimization pass with measured results. What remains is release hardening, not foundational uncertainty.

That is probably the best signal in any port: when the conversation shifts from “Can we make this work?” to “Which finishing tradeoffs do we want to own?”

---

Christian Pekeler and Codex, 2026-02-09
