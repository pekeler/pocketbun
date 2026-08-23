#### Using multiple workers

PocketBun runs one HTTP process by default. For a read-heavy application on a machine with spare CPU cores, opt in to multiple workers:

```sh
bun run pocketbun --workers=2 serve --http=127.0.0.1:8090
```

The command starts one supervising primary process and the requested number of HTTP workers. Supervise that primary with systemd, Docker, or your normal service manager; do not start several independent PocketBun instances against the same `pb_data` directory. Rolling back is immediate: set `--workers=1`; it does not convert application data.

On Linux, every worker serves the configured address using the operating system's shared-port support, so an existing reverse proxy can continue to use one backend address. On macOS and Windows, workers use consecutive loopback ports instead. For example, `--workers=4 serve --http=127.0.0.1:9000` uses `127.0.0.1:9000` through `127.0.0.1:9003`; put those private backends behind a reverse proxy or load balancer and do not expose the range publicly.

Workers improve concurrent read throughput, but they do not make SQLite writes scale linearly because SQLite still has one writer. Each worker also has its own runtime memory and SQLite cache. Start with the number of physical CPU cores that your workload can use, measure representative traffic, and keep `--workers=1` for small or write-heavy deployments. Long-lived connections such as SSE realtime streams stay on one worker for their lifetime; ordinary keep-alive connections do too, so use multiple client or proxy connections when measuring load.

Each worker loads hooks and has its own in-memory `app.store()` state. Bootstrap and serve hooks therefore run once in every worker; use the database or another shared service for state that must be common to the application. Migrations, temporary-file cleanup, and scheduled cron jobs run only in the leader. Record mutation hooks run in the worker that handles the write, as with a single-process deployment. Advanced hooks can inspect `process.env.POCKETBUN_CLUSTER_ROLE` (`leader` or `follower`) and `process.env.POCKETBUN_CLUSTER_SLOT` when a role-specific behavior is genuinely needed; do not set these internal variables yourself.

Monitor and supervise the primary process rather than individual worker PIDs. It replaces an unexpectedly exited worker in the same role and slot; a repeated crash loop stops the primary with a nonzero exit so your service manager can report and restart the deployment. Continue to use `GET /api/health` through the same backend or load balancer that serves application traffic.
