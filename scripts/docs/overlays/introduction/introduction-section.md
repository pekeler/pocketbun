## Introduction

Please keep in mind that PocketBun is still under active development and full backward compatibility is not guaranteed before reaching v1.0.0. PocketBun is NOT recommended for production critical applications yet, unless you are fine with reading the [changelog](/blob/master/CHANGELOG.md) and applying some manual migration steps from time to time.

PocketBun is an open source backend consisting of embedded database (SQLite) with realtime subscriptions, builtin auth management, convenient dashboard UI and simple REST-ish API. It can be used as a standalone application and can be extended with JavaScript.

The easiest way to get started is to install PocketBun with Bun package manager:

- `bun add pocketbun` to add it to an existing project.
- `bun create pocketbun my-app` to start a new project template.

After installation, you can start the application by running `pocketbun serve`.

**And that's it!** The first time it will generate an installer link that should be automatically opened in the browser to set up your first superuser account (you can also create the first superuser manually via `pocketbun superuser create EMAIL PASS`) .

The started web server has the following default routes:

- [`http://127.0.0.1:8090`](http://127.0.0.1:8090) - if `pb_public` directory exists, serves the static content from it (html, css, images, etc.)
- [`http://127.0.0.1:8090/_/`](http://127.0.0.1:8090/_/) - superusers dashboard
- [`http://127.0.0.1:8090/api/`](http://127.0.0.1:8090/api/) - REST-ish API

By default, PocketBun will create and manage 2 new directories in the current working directory:

- `pb_data` - stores your application data, uploaded files, etc. (usually should be added in `.gitignore`).
- `pb_migrations` - contains JS migration files with your collection changes (can be safely committed in your repository).

You can even write custom migration scripts. For more info check the [JS migrations docs](./extend.md#migrations).

You could find all available commands and their options by running `pocketbun --help` or `pocketbun [command] --help`
