#### Using multiple workers

PocketBun runs one HTTP process by default. For a read-heavy custom TypeScript application on a machine with spare CPU cores, set `workers` when starting the server:

```ts
await serveAsync(app, {
  httpAddr: "127.0.0.1:8090",
  workers: 4,
});
```

If you use PocketBun's included executable and `pb_hooks`, use the equivalent command-line option:

```sh
bun run pocketbun --workers=4 serve --http=127.0.0.1:8090
```

Both forms start one supervising primary process and the requested number of HTTP workers. A custom TypeScript entrypoint runs once in the primary and once in each worker, so its top-level process setup must be safe to run once per process. For systemd, configure the same `workers` value in your entrypoint or add `--workers=4` to the executable's `ExecStart` command in the minimal setup above. On Windows, use a service host or container runtime to supervise the same primary process. Do not start several independent PocketBun instances against one `pb_data` directory, and do not use cluster mode to share `pb_data` over a network filesystem between hosts. Rolling back is immediate: set `workers: 1` or `--workers=1`; it does not convert application data.

On Linux, every worker serves the configured address using the operating system's shared-port support, so an existing reverse proxy can continue to use one backend address. The operating system distributes new TCP connections among workers; each keep-alive or SSE connection stays with its assigned worker.

On macOS and Windows, workers use consecutive loopback ports instead. For example, `--workers=4 serve --http=127.0.0.1:9000` uses `127.0.0.1:9000` through `127.0.0.1:9003`. Configure every private backend in your reverse proxy and do not expose the range publicly. Replace the single-backend `proxy_pass` in the NGINX example above with:

```nginx
upstream pocketbun_workers {
    server 127.0.0.1:9000;
    server 127.0.0.1:9001;
    server 127.0.0.1:9002;
    server 127.0.0.1:9003;
}
```

Then use this inside its `location` block:

```nginx
proxy_pass http://pocketbun_workers;
```

Workers improve concurrent read throughput, but they do not make SQLite writes scale linearly because SQLite still has one writer. Each worker also has its own runtime memory and SQLite cache. Start with one worker per available vCPU, measure representative traffic and memory use, and keep `--workers=1` for small or write-heavy deployments. Use multiple client or proxy connections when measuring load so one persistent connection does not hide the available workers.

Built-in rate-limit rules remain application-wide in cluster mode; the primary batches concurrent decisions instead of multiplying each rule's allowance by the number of workers.

Each worker loads hooks and has its own in-memory `app.store()` state. Bootstrap and serve hooks therefore run once in every worker; use the database or another shared service for state that must be common to the application. Migrations, temporary-file cleanup, and scheduled cron jobs run only in the leader. Record mutation hooks run in the worker that handles the write, as with a single-process deployment. Advanced hooks can inspect `process.env.POCKETBUN_CLUSTER_ROLE` (`leader` or `follower`), `process.env.POCKETBUN_CLUSTER_SLOT`, and `process.env.POCKETBUN_CLUSTER_WORKER_ID` when a role-specific behavior is genuinely needed; do not set these internal variables yourself.

Monitor and supervise the primary process rather than individual worker PIDs. Its logs report worker lifecycle changes. It replaces an unexpectedly exited worker in the same role and slot; a repeated crash loop stops the primary with a nonzero exit so your service manager can report and restart the deployment. Continue to use `GET /api/health` through the same backend or load balancer that serves application traffic.
