#### Minimal setup

PocketBun needs Bun 1.4.0 or newer, your application files, and a writable `pb_data` directory. Run it as an unprivileged service on a loopback HTTP address and put a TLS-terminating reverse proxy in front of it. PocketBun does not provision HTTPS certificates itself.

A typical deployed application contains:

```text
myapp/
    bun.lock
    package.json
    pb_hooks/
    pb_migrations/
```

After copying the application to the server, install its production dependencies and verify that it starts:

```sh
cd /srv/pocketbun/myapp
bun install --production --frozen-lockfile
bun run pocketbun serve --http=127.0.0.1:8090
```

The paths and `pocketbun` account below are examples. Create `/etc/systemd/system/pocketbun.service` with the absolute Bun path reported by `command -v bun`:

```ini
[Unit]
Description=PocketBun
After=network.target

[Service]
Type=simple
User=pocketbun
Group=pocketbun
WorkingDirectory=/srv/pocketbun/myapp
ExecStart=/usr/local/bin/bun run pocketbun serve --http=127.0.0.1:8090
Restart=on-failure
RestartSec=5
LimitNOFILE=4096
KillMode=mixed
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
```

`KillMode=mixed` gives PocketBun's primary process time to shut down its workers cleanly, while ensuring systemd kills any process left after the timeout. Enable the service and inspect its logs with:

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now pocketbun
sudo journalctl -u pocketbun
```

Configure a reverse proxy as shown below before exposing the application publicly. You can create the first superuser from the application directory:

```sh
bun run pocketbun superuser create EMAIL PASS
```
