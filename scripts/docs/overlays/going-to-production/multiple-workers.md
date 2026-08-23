#### Using multiple workers

PocketBun runs one HTTP process by default. For a read-heavy application on a machine with spare CPU cores, opt in to multiple workers:

```sh
bun run pocketbun --workers=2 serve --http=127.0.0.1:8090
```

The command starts one supervising primary process and the requested number of HTTP workers. Supervise that primary with systemd, Docker, or your normal service manager; do not start several independent PocketBun instances against the same `pb_data` directory. Rolling back is immediate: set `--workers=1`; it does not convert application data.

On Linux, every worker serves the configured address using the operating system's shared-port support, so an existing reverse proxy can continue to use one backend address. On macOS and Windows, workers use consecutive loopback ports instead. For example, `--workers=4 serve --http=127.0.0.1:9000` uses `127.0.0.1:9000` through `127.0.0.1:9003`; put those private backends behind a reverse proxy or load balancer and do not expose the range publicly.

Workers improve concurrent read throughput, but they do not make SQLite writes scale linearly because SQLite still has one writer. Each worker also has its own runtime memory and SQLite cache. Start with the number of physical CPU cores that your workload can use, measure representative traffic, and keep `--workers=1` for small or write-heavy deployments. Long-lived connections such as SSE realtime streams stay on one worker for their lifetime; ordinary keep-alive connections do too, so use multiple client or proxy connections when measuring load.
