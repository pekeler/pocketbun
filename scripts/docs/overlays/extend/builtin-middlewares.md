#### Builtin middlewares

The global [`$apis.*`](https://pocketbase.io/jsvm/modules/_apis.html) object exposes several middlewares that you can use as part of your application.

PocketBun also provides async alternatives for several I/O-heavy helpers (for example `$http.sendAsync(...)` and `$os.readFileAsync(...)`).

```js
// Require the request client to be unauthenticated (aka. guest).
$apis.requireGuestOnly()

// Require the request client to be authenticated
// (optionally specify a list of allowed auth collection names, default to any).
$apis.requireAuth(optCollectionNames...)

// Require the request client to be authenticated as superuser
// (this is an alias for $apis.requireAuth("_superusers")).
$apis.requireSuperuserAuth()

// Require the request client to be authenticated as superuser OR
// regular auth record with id matching the specified route parameter (default to "id").
$apis.requireSuperuserOrOwnerAuth(ownerIdParam)

// Changes the global 32MB default request body size limit (set it to 0 for no limit).
// Note that system record routes have dynamic body size limit based on their collection field types.
$apis.bodyLimit(limitBytes)

// Compresses the HTTP response using Gzip compression scheme.
$apis.gzip()

// Instructs the activity logger to log only requests that have failed/returned an error.
$apis.skipSuccessActivityLog()
```
