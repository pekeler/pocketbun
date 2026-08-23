---
layout: default
title: PocketBun Going To Production
permalink: /going-to-production.html
---

# PocketBun Going To Production

Quick links:

- [Deployment strategies](#deployment-strategies)
  - [Minimal setup](#minimal-setup)
  - [Using reverse proxy](#using-reverse-proxy)
- [Backup and Restore](#backup-and-restore)
- [Recommendations](#recommendations)
  - [Use SMTP mail server](#use-smtp-mail-server)
  - [Enable MFA for superusers](#enable-mfa-for-superusers)
  - [Enable rate limiter](#enable-rate-limiter)
  - [Increase the open file descriptors limit](#increase-the-open-file-descriptors-limit)
  - [Enable settings encryption](#enable-settings-encryption)

## Going to production

### Deployment strategies

#### Minimal setup

One of the best PocketBun features is that it's completely portable. This means that deployment can stay simple: upload your app files, ensure Bun is installed on the server, and run the PocketBun CLI.

Here is an example of starting a production HTTPS server (auto managed TLS with Let's Encrypt) on a clean Ubuntu 22.04 installation.

-

Consider the following app directory structure:

```html
myapp/
    pb_migrations/
    pb_hooks/
    package.json
```

-

Upload your app files and anything else required by your application to your remote server, for example using **rsync**:

```js
rsync -avz -e ssh /local/path/to/myapp root@YOUR_SERVER_IP:/root/pb
```

-

Start a SSH session with your server:

```js
ssh root@YOUR_SERVER_IP
```

-

Start the application (specifying a domain name will issue a Let's encrypt certificate for it)

```js
[root@dev ~]$ cd /root/pb/myapp && bun run pocketbun serve yourdomain.com
```

Notice that in the above example we are logged in as **root** which allows us to bind to the **privileged 80 and 443 ports**. For **non-root** users usually you'll need special privileges to be able to do that. You have several options depending on your OS - `authbind`, `setcap`, `iptables`, `sysctl`, etc. Here is an example using `setcap`:

```js
[myuser@dev ~]$ sudo setcap 'cap_net_bind_service=+ep' $(which bun)
```

-

(Optional) Systemd service

You can skip step 3 and create a **Systemd service** to allow your application to start/restart on its own. Here is an example service file (usually created in `/lib/systemd/system/pocketbun.service`):

```js
[Unit]
Description = pocketbun

[Service]
Type             = simple
User             = root
Group            = root
LimitNOFILE      = 4096
Restart          = always
RestartSec       = 5s
StandardOutput   = append:/root/pb/std.log
StandardError    = append:/root/pb/std.log
WorkingDirectory = /root/pb/myapp
ExecStart        = cd /root/pb/myapp && bun run pocketbun serve yourdomain.com

[Install]
WantedBy = multi-user.target
```

After that we just have to enable it and start the service using `systemctl`:

```js
[root@dev ~]$ systemctl enable pocketbun.service
[root@dev ~]$ systemctl start pocketbun
```

You can find a link to the Web UI installer in the `/root/pb/std.log`, but alternatively you can also create the first superuser explicitly via the `superuser` PocketBun command:

```js
[root@dev ~]$ cd /root/pb/myapp && bun run pocketbun superuser create EMAIL PASS
```

#### Using reverse proxy

If you plan on hosting multiple applications on a single server or need finer network controls, you can always put PocketBun behind a reverse proxy such as *NGINX*, *Apache*, *Caddy*, etc. * Just note that when using a reverse proxy you may need to set up the "User IP proxy headers" in the PocketBun settings so that the application can extract and log the actual visitor/client IP (the headers are usually `X-Real-IP`, `X-Forwarded-For`). *

Here is a minimal *NGINX* example configuration:

```html
server {
    listen 80;
    server_name example.com;
    client_max_body_size 10M;

    location / {
        # check http://nginx.org/en/docs/http/ngx_http_upstream_module.html#keepalive
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        proxy_read_timeout 360s;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # enable if you are serving under a subpath location
        #
        # note that it is better to use a subdomain when possible because of
        # the same-origin isolation for localStorage and other resources
        # rewrite /yourSubpath/(.*) /$1  break;

        proxy_pass http://127.0.0.1:8090;
    }
}
```

Corresponding *Caddy* configuration is:

```html
example.com {
    request_body {
        max_size 10MB
    }
    reverse_proxy 127.0.0.1:8090 {
        transport http {
            read_timeout 360s
        }
    }
}
```

#### Using multiple workers

PocketBun runs one HTTP process by default. For a read-heavy application on a machine with spare CPU cores, opt in to multiple workers:

```sh
bun run pocketbun --workers=2 serve --http=127.0.0.1:8090
```

The command starts one supervising primary process and the requested number of HTTP workers. Supervise that primary with systemd, Docker, or your normal service manager; do not start several independent PocketBun instances against the same `pb_data` directory. Rolling back is immediate: set `--workers=1`; it does not convert application data.

On Linux, every worker serves the configured address using the operating system's shared-port support, so an existing reverse proxy can continue to use one backend address. On macOS and Windows, workers use consecutive loopback ports instead. For example, `--workers=4 serve --http=127.0.0.1:9000` uses `127.0.0.1:9000` through `127.0.0.1:9003`; put those private backends behind a reverse proxy or load balancer and do not expose the range publicly.

Workers improve concurrent read throughput, but they do not make SQLite writes scale linearly because SQLite still has one writer. Each worker also has its own runtime memory and SQLite cache. Start with the number of physical CPU cores that your workload can use, measure representative traffic, and keep `--workers=1` for small or write-heavy deployments. Long-lived connections such as SSE realtime streams stay on one worker for their lifetime; ordinary keep-alive connections do too, so use multiple client or proxy connections when measuring load.
### Backup and Restore

To backup/restore your application it is enough to manually copy/replace your `pb_data` directory *(for transactional safety make sure that the application is not running)*.

To make things slightly easier, PocketBun v0.16+ comes with builtin backups and restore APIs that could be accessed from the Dashboard ( *Settings* > *Backups* ):

![Backups settings screenshot](./assets/upstream/screenshots/backups.png)

Backups can be stored locally (default) or in a S3 compatible storage (*it is recommended to use a separate bucket only for the backups). The generated backup represents a full snapshot as ZIP archive of your `pb_data` directory (including the locally stored uploaded files but excluding any local backups or files uploaded to S3).

During the backup's ZIP generation the application will be temporary set in read-only mode.

Depending on the size of your `pb_data` this could be a very slow operation and it is advised in case of large `pb_data` (e.g. 2GB+) to consider a different backup strategy * (see an example backup.sh script that combines `sqlite3 .backup` + `rsync`) *.

### Recommendations

highly recommended

#### Use SMTP mail server

By default, PocketBun uses the internal Unix `sendmail` command for sending emails. While it's OK for development, it's not very useful for production, because your emails most likely will get marked as spam or even fail to deliver.

To avoid deliverability issues, consider using a local SMTP server or an external mail service like [MailerSend](https://www.mailersend.com/), [Brevo](https://www.brevo.com/), [SendGrid](https://sendgrid.com/), [Mailgun](https://www.mailgun.com/), [AWS SES](https://aws.amazon.com/ses/), etc.

Once you've decided on a mail service, you could configure the PocketBun SMTP settings from the * Dashboard > Settings > Mail settings *:

![SMTP settings screenshot](./assets/upstream/screenshots/smtp-settings.png)

highly recommended

#### Enable MFA for superusers

As an additional layer of security you can enable the MFA and OTP options for the `_superusers` collection, which will enforce an additional one-time password (email code) requirement when authenticating as superuser.

In case of email deliverability issues, you can also generate an OTP manually using the `pocketbun superuser otp yoursuperuser@example.com` command.

![Superusers MFA settings screenshot](./assets/upstream/screenshots/superusers_mfa.png)

highly recommended

#### Enable rate limiter

To minimize the risk of API abuse (e.g. excessive auth or record create requests) it is recommended to set up a rate limiter.

PocketBun v0.23.0+ comes with a simple builtin rate limiter that should cover most of the cases but you are also free to use any external one via reverse proxy if you need more advanced options.

You can configure the builtin rate limiter from the * Dashboard > Settings > Application: *

![Rate limit settings screenshot](./assets/upstream/screenshots/rate-limit-settings.png)

optional

#### Increase the open file descriptors limit

The below instructions are for Linux but other operating systems have similar mechanism.

Unix uses *"file descriptors"* also for network connections and most systems have a default limit of ~ 1024. If your application has a lot of concurrent realtime connections, it is possible that at some point you would get an error such as: `Too many open files`.

One way to mitigate this is to check your current account resource limits by running `ulimit -a` and find the parameter you want to change. For example, if you want to increase the open files limit (*-n*), you could run `ulimit -n 4096` before starting PocketBun.

optional
#### Enable settings encryption

It is fine to ignore the below if you are not sure whether you need it.

By default, PocketBun stores the applications settings in the database as plain JSON text, including the SMTP password and S3 storage credentials.

While this is not a security issue on its own (PocketBun applications live entirely on a single server and it is expected only authorized users to have access to your server and application data), in some situations it may be a good idea to store the settings encrypted in case someone get their hands on your database file (e.g. from an external stored backup).

To store your PocketBun settings encrypted:

-
Create a new environment variable and **set a random 32 characters** string as its value.

e.g. add
`export PB_ENCRYPTION_KEY=""`
in your shell profile file

-
Start the application with `--encryptionEnv=YOUR_ENV_VAR` flag.

e.g. `pocketbun serve --encryptionEnv=PB_ENCRYPTION_KEY`

## Attribution

This page is adapted from [PocketBase docs](https://pocketbase.io/docs/going-to-production/).
