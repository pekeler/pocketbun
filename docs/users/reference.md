---
layout: default
title: Extend PocketBun Reference
permalink: /reference.html
---

# Extend PocketBun Reference

This page is generated from PocketBun JSVM TypeScript declarations and serves as the API reference for the Extend PocketBun docs.

Quick links:

- [Variables](#variables)
- [Functions](#functions)
- [Classes](#classes)
- [Namespaces](#namespaces)

## Variables

- [`__hooks`](#hooks)
- [`$app`](#app)
- [`$template`](#template)
- [`Record`](#record)
- [`RequestInfo`](#requestinfo)

---

### __hooks

Global helper variable that contains the absolute path to the app pb_hooks directory.

```ts
declare var __hooks: string;
```

---

### $app

`$app` is the current running PocketBun instance that is globally
available in each .pb.js file.

_Note that this variable is available only in pb_hooks context._

```ts
declare var $app: PocketBase;
```

---

### $template

`$template` is a global helper to load and cache HTML templates on the fly.

The templates uses the standard Go [html/template](https://pkg.go.dev/html/template)
and [text/template](https://pkg.go.dev/text/template) package syntax.

Example:

```js
const html = $template.loadFiles(
    "views/layout.html",
    "views/content.html",
).render({"name": "John"})
```

```ts
declare var $template: template.Registry;
```

---

### Record

Record model class.

```js
const collection = $app.findCollectionByNameOrId("article")

const record = new Record(collection, {
    title: "Lorem ipsum"
})

// or set field values after the initialization
record.set("description", "...")
```

```ts
declare const Record: {
  new (collection?: core.Collection, data?: { [key: string]: any }): core.Record;

  // note: declare as "newable" const due to conflict with the Record TS utility type
};
```

---

### RequestInfo

RequestInfo defines a single core.RequestInfo instance, usually used
as part of various filter checks.

Example:

```js
const authRecord = $app.findAuthRecordByEmail("users", "test@example.com")

const info = new RequestInfo({
    auth:    authRecord,
    body:    {"name": 123},
    headers: {"x-token": "..."},
})

const record = $app.findFirstRecordByData("articles", "slug", "hello")

const canAccess = $app.canAccessRecord(record, info, "@request.auth.id != '' && @request.body.name = 123")
```

```ts
declare const RequestInfo: {
  new (info?: Partial<core.RequestInfo>): core.RequestInfo;

  // note: declare as "newable" const due to conflict with the RequestInfo TS node type
};
```

---

## Functions

- [`cronAdd`](#cronadd)
- [`cronRemove`](#cronremove)
- [`routerAdd`](#routeradd)
- [`routerUse`](#routeruse)
- [`readerToString`](#readertostring)
- [`toString`](#tostring)
- [`toBytes`](#tobytes)
- [`sleep`](#sleep)
- [`arrayOf`](#arrayof)
- [`nullString`](#nullstring)
- [`nullInt`](#nullint)
- [`nullFloat`](#nullfloat)
- [`nullBool`](#nullbool)
- [`nullArray`](#nullarray)
- [`nullObject`](#nullobject)
- [`migrate`](#migrate)

---

### cronAdd

CronAdd registers a new cron job.

If a cron job with the specified name already exist, it will be
replaced with the new one.

Example:

```js
// prints "Hello world!" on every 30 minutes
cronAdd("hello", "*\/30 * * * *", () => {
    console.log("Hello world!")
})
```

_Note that this method is available only in pb_hooks context._

```ts
declare function cronAdd(jobId: string, cronExpr: string, handler: () => void): void;
```

---

### cronRemove

CronRemove removes a single registered cron job by its name.

Example:

```js
cronRemove("hello")
```

_Note that this method is available only in pb_hooks context._

```ts
declare function cronRemove(jobId: string): void;
```

---

### routerAdd

RouterAdd registers a new route definition.

Example:

```js
routerAdd("GET", "/hello", (e) => {
    return e.json(200, {"message": "Hello!"})
}, $apis.requireAuth())
```

_Note that this method is available only in pb_hooks context._

```ts
declare function routerAdd(
  method: string,
  path: string,
  handler: (e: core.RequestEvent) => void,
  ...middlewares: Array<string | ((e: core.RequestEvent) => void) | Middleware>
): void;
```

---

### routerUse

RouterUse registers one or more global middlewares that are executed
along the handler middlewares after a matching route is found.

Example:

```js
routerUse((e) => {
  console.log(e.request.url.path)
  return e.next()
})
```

_Note that this method is available only in pb_hooks context._

```ts
declare function routerUse(...middlewares: Array<string | ((e: core.RequestEvent) => void) | Middleware>): void;
```

---

### readerToString

This method is superseded by toString.

Deprecated.

```ts
declare function readerToString(reader: any, maxBytes?: number): string;
```

---

### toString

toString stringifies the specified value.

Support optional second maxBytes argument to limit the max read bytes
when the value is a io.Reader (default to 32MB).

Types that don't have explicit string representation are json serialized.

Example:

```js
// io.Reader
const ex1 = toString(e.request.body)

// slice of bytes
const ex2 = toString([104 101 108 108 111]) // "hello"

// null
const ex3 = toString(null) // ""
```

```ts
declare function toString(val: any, maxBytes?: number): string;
```

---

### toBytes

toBytes converts the specified value into a bytes slice.

Support optional second maxBytes argument to limit the max read bytes
when the value is a io.Reader (default to 32MB).

Types that don't have Go slice representation (bool, objects, etc.)
are serialized to UTF8 string and its bytes slice is returned.

Example:

```js
// io.Reader
const ex1 = toBytes(e.request.body)

// string
const ex2 = toBytes("hello") // [104 101 108 108 111]

// object (the same as the string '{"test":1}')
const ex3 = toBytes({"test":1}) // [123 34 116 101 115 116 34 58 49 125]

// null
const ex4 = toBytes(null) // []
```

```ts
declare function toBytes(val: any, maxBytes?: number): Array<number>;
```

---

### sleep

sleep pauses the current goroutine for at least the specified user duration (in ms).
A zero or negative duration returns immediately.

Example:

```js
sleep(250) // sleeps for 250ms
```

```ts
declare function sleep(milliseconds: number): void;
```

---

### arrayOf

arrayOf creates a placeholder array of the specified models.
Usually used to populate DB result into an array of models.

Example:

```js
const records = arrayOf(new Record)

$app.recordQuery("articles").limit(10).all(records)
```

```ts
declare function arrayOf<T>(model: T): Array<T>;
```

---

### nullString

nullString creates an empty Go string pointer usually used for
describing a **nullable** `DynamicModel` string value.

```ts
declare function nullString(): string;
```

---

### nullInt

nullInt creates an empty Go int64 pointer usually used for
describing a **nullable** `DynamicModel` int value.

```ts
declare function nullInt(): number;
```

---

### nullFloat

nullFloat creates an empty Go float64 pointer usually used for
describing a **nullable** `DynamicModel` float value.

```ts
declare function nullFloat(): number;
```

---

### nullBool

nullBool creates an empty Go bool pointer usually used for
describing a **nullable** `DynamicModel` bool value.

```ts
declare function nullBool(): boolean;
```

---

### nullArray

nullArray creates an empty Go types.JSONArray pointer usually used for
describing a **nullable** `DynamicModel` JSON array value.

```ts
declare function nullArray(): Array<any>;
```

---

### nullObject

nullObject creates an empty Go types.JSONMap pointer usually used for
describing a **nullable** `DynamicModel` JSON object value.

```ts
declare function nullObject(): { get(key: string): any; set(key: string, value: any): void };
```

---

### migrate

Migrate defines a single migration upgrade/downgrade action.

_Note that this method is available only in pb_migrations context._

```ts
declare function migrate(up: (txApp: CoreApp) => void, down?: (txApp: CoreApp) => void): void;
```

---

## Classes

- [`DynamicModel`](#dynamicmodel)
- [`Context`](#context)
- [`Collection`](#collection)
- [`FieldsList`](#fieldslist)
- [`Field`](#field)
- [`NumberField`](#numberfield)
- [`BoolField`](#boolfield)
- [`TextField`](#textfield)
- [`URLField`](#urlfield)
- [`EmailField`](#emailfield)
- [`EditorField`](#editorfield)
- [`PasswordField`](#passwordfield)
- [`DateField`](#datefield)
- [`AutodateField`](#autodatefield)
- [`JSONField`](#jsonfield)
- [`RelationField`](#relationfield)
- [`SelectField`](#selectfield)
- [`FileField`](#filefield)
- [`GeoPointField`](#geopointfield)
- [`MailerMessage`](#mailermessage)
- [`Command`](#command)
- [`Middleware`](#middleware)
- [`Timezone`](#timezone)
- [`DateTime`](#datetime)
- [`ValidationError`](#validationerror)
- [`Cookie`](#cookie)
- [`SubscriptionMessage`](#subscriptionmessage)
- [`AppleClientSecretCreateForm`](#appleclientsecretcreateform)
- [`RecordUpsertForm`](#recordupsertform)
- [`TestEmailSendForm`](#testemailsendform)
- [`TestS3FilesystemForm`](#tests3filesystemform)
- [`ApiError`](#apierror)
- [`NotFoundError`](#notfounderror)
- [`BadRequestError`](#badrequesterror)
- [`ForbiddenError`](#forbiddenerror)
- [`UnauthorizedError`](#unauthorizederror)
- [`TooManyRequestsError`](#toomanyrequestserror)
- [`InternalServerError`](#internalservererror)

---

### DynamicModel

DynamicModel creates a new dynamic model with fields from the provided data shape.

Caveats:
- In order to use 0 as double/float initialization number you have to negate it (`-0`).
- You need to use lowerCamelCase when accessing the model fields (e.g. `model.roles` and not `model.Roles` even if in the model shape and in the DB table the column is capitalized).
- Objects are loaded into types.JSONMap, meaning that they need to be accessed with `get(key)` (e.g. `model.meta.get('something')`).
- For describing nullable types you can use the `null*()` helpers - `nullString()`, `nullInt()`, `nullFloat()`, `nullBool()`, `nullArray()`, `nullObject()`.

Example:

```js
const model = new DynamicModel({
    name:       ""     // or nullString() if nullable
    age:        0,     // or nullInt() if nullable
    totalSpent: -0,    // or nullFloat() if nullable
    active:     false, // or nullBool() if nullable
    Roles:      [],    // or nullArray() if nullable; maps to "Roles" in the DB/JSON but the prop would be accessible via "model.roles"
    meta:       {},    // or nullObject() if nullable
})
```

```ts
declare class DynamicModel {
  [key: string]: any;
  constructor(shape?: { [key: string]: any });
}
```

---

### Context

Context creates a new empty Go context.Context.

This is usually used as part of some Go transitive bindings.

Example:

```js
const blank = new Context()

// with single key-value pair
const base = new Context(null, "a", 123)
console.log(base.value("a")) // 123

// extend with additional key-value pair
const sub = new Context(base, "b", 456)
console.log(sub.value("a")) // 123
console.log(sub.value("b")) // 456
```

```ts
declare class Context implements context.Context {
  constructor(parentCtx?: Context, key?: any, value?: any);
}
```

---

### Collection

Collection model class.

```js
const collection = new Collection({
    type:       "base",
    name:       "article",
    listRule:   "@request.auth.id != '' || status = 'public'",
    viewRule:   "@request.auth.id != '' || status = 'public'",
    deleteRule: "@request.auth.id != ''",
    fields: [
        {
            name: "title",
            type: "text",
            required: true,
            min: 6,
            max: 100,
        },
        {
            name: "description",
            type: "text",
        },
    ]
})
```

```ts
declare class Collection implements core.Collection {
  constructor(data?: Partial<Collection>);
}
```

---

### FieldsList

FieldsList model class, usually used to define the Collection.fields.

```ts
declare class FieldsList implements core.FieldsList {
  constructor(data?: Partial<core.FieldsList>);
}
```

---

### Field

Field model class, usually used as part of the FieldsList model.

```ts
declare class Field implements core.Field {
  constructor(data?: Partial<core.Field>);
}
```

---

### NumberField

{@inheritDoc core.NumberField}

```ts
declare class NumberField implements core.NumberField {
  constructor(data?: Partial<core.NumberField>);
}
```

---

### BoolField

{@inheritDoc core.BoolField}

```ts
declare class BoolField implements core.BoolField {
  constructor(data?: Partial<core.BoolField>);
}
```

---

### TextField

{@inheritDoc core.TextField}

```ts
declare class TextField implements core.TextField {
  constructor(data?: Partial<core.TextField>);
}
```

---

### URLField

{@inheritDoc core.URLField}

```ts
declare class URLField implements core.URLField {
  constructor(data?: Partial<core.URLField>);
}
```

---

### EmailField

{@inheritDoc core.EmailField}

```ts
declare class EmailField implements core.EmailField {
  constructor(data?: Partial<core.EmailField>);
}
```

---

### EditorField

{@inheritDoc core.EditorField}

```ts
declare class EditorField implements core.EditorField {
  constructor(data?: Partial<core.EditorField>);
}
```

---

### PasswordField

{@inheritDoc core.PasswordField}

```ts
declare class PasswordField implements core.PasswordField {
  constructor(data?: Partial<core.PasswordField>);
}
```

---

### DateField

{@inheritDoc core.DateField}

```ts
declare class DateField implements core.DateField {
  constructor(data?: Partial<core.DateField>);
}
```

---

### AutodateField

{@inheritDoc core.AutodateField}

```ts
declare class AutodateField implements core.AutodateField {
  constructor(data?: Partial<core.AutodateField>);
}
```

---

### JSONField

{@inheritDoc core.JSONField}

```ts
declare class JSONField implements core.JSONField {
  constructor(data?: Partial<core.JSONField>);
}
```

---

### RelationField

{@inheritDoc core.RelationField}

```ts
declare class RelationField implements core.RelationField {
  constructor(data?: Partial<core.RelationField>);
}
```

---

### SelectField

{@inheritDoc core.SelectField}

```ts
declare class SelectField implements core.SelectField {
  constructor(data?: Partial<core.SelectField>);
}
```

---

### FileField

{@inheritDoc core.FileField}

```ts
declare class FileField implements core.FileField {
  constructor(data?: Partial<core.FileField>);
}
```

---

### GeoPointField

{@inheritDoc core.GeoPointField}

```ts
declare class GeoPointField implements core.GeoPointField {
  constructor(data?: Partial<core.GeoPointField>);
}
```

---

### MailerMessage

MailerMessage defines a single email message.

```js
const message = new MailerMessage({
    from: {
        address: $app.settings().meta.senderAddress,
        name:    $app.settings().meta.senderName,
    },
    to:      [{address: "test@example.com"}],
    subject: "YOUR_SUBJECT...",
    html:    "YOUR_HTML_BODY...",
})

$app.newMailClient().send(message)
```

```ts
declare class MailerMessage implements mailer.Message {
  constructor(message?: Partial<mailer.Message>);
}
```

---

### Command

Command defines a single console command.

Example:

```js
const command = new Command({
    use: "hello",
    run: (cmd, args) => { console.log("Hello world!") },
})

$app.rootCmd.addCommand(command);
```

```ts
declare class Command implements cobra.Command {
  constructor(cmd?: Partial<cobra.Command>);
}
```

---

### Middleware

Middleware defines a single request middleware handler.

This class is usually used when you want to explicitly specify a priority to your custom route middleware.

Example:

```js
routerUse(new Middleware((e) => {
  console.log(e.request.url.path)
  return e.next()
}, -10))
```

```ts
declare class Middleware {
  constructor(func: string | ((e: core.RequestEvent) => void), priority?: number, id?: string);
}
```

---

### Timezone

Timezone returns the timezone location with the given name.

The name is expected to be a location name corresponding to a file
in the IANA Time Zone database, such as "America/New_York".

If the name is "Local", LoadLocation returns Local.

If the name is "", invalid or "UTC", returns UTC.

The constructor is equivalent to calling the Go `time.LoadLocation(name)` method.

Example:

```js
const zone = new Timezone("America/New_York")
$app.cron().setTimezone(zone)
```

```ts
declare class Timezone implements time.Location {
  constructor(name?: string);
}
```

---

### DateTime

DateTime defines a single DateTime type instance.
The returned date is always represented in UTC.

Example:

```js
const dt0 = new DateTime() // now

// full datetime string
const dt1 = new DateTime('2023-07-01 00:00:00.000Z')

// datetime string with default "parse in" timezone location
//
// similar to new DateTime('2023-07-01 00:00:00 +01:00') or new DateTime('2023-07-01 00:00:00 +02:00')
// but accounts for the daylight saving time (DST)
const dt2 = new DateTime('2023-07-01 00:00:00', 'Europe/Amsterdam')
```

```ts
declare class DateTime implements types.DateTime {
  constructor(date?: string, defaultParseInLocation?: string);
}
```

---

### ValidationError

ValidationError defines a single formatted data validation error,
usually used as part of an error response.

```js
new ValidationError("invalid_title", "Title is not valid")
```

```ts
declare class ValidationError implements ozzo_validation.Error {
  constructor(code?: string, message?: string);
}
```

---

### Cookie

A Cookie represents an HTTP cookie as sent in the Set-Cookie header of an
HTTP response.

Example:

```js
routerAdd("POST", "/example", (c) => {
    c.setCookie(new Cookie({
        name:     "example_name",
        value:    "example_value",
        path:     "/",
        domain:   "example.com",
        maxAge:   10,
        secure:   true,
        httpOnly: true,
        sameSite: 3,
    }))

    return c.redirect(200, "/");
})
```

```ts
declare class Cookie implements http.Cookie {
  constructor(options?: Partial<http.Cookie>);
}
```

---

### SubscriptionMessage

SubscriptionMessage defines a realtime subscription payload.

Example:

```js
onRealtimeConnectRequest((e) => {
    e.client.send(new SubscriptionMessage({
        name: "example",
        data: '{"greeting": "Hello world"}'
    }))
})
```

```ts
declare class SubscriptionMessage implements subscriptions.Message {
  constructor(options?: Partial<subscriptions.Message>);
}
```

---

### AppleClientSecretCreateForm

```ts
declare class AppleClientSecretCreateForm implements forms.AppleClientSecretCreate {
  constructor(app: CoreApp);
}
```

---

### RecordUpsertForm

```ts
declare class RecordUpsertForm implements forms.RecordUpsert {
  constructor(app: CoreApp, record: core.Record);
}
```

---

### TestEmailSendForm

```ts
declare class TestEmailSendForm implements forms.TestEmailSend {
  constructor(app: CoreApp);
}
```

---

### TestS3FilesystemForm

```ts
declare class TestS3FilesystemForm implements forms.TestS3Filesystem {
  constructor(app: CoreApp);
}
```

---

### ApiError

```ts
declare class ApiError implements router.ApiError {
  constructor(status?: number, message?: string, data?: any);
}
```

---

### NotFoundError

NotFounderor returns 404 ApiError.

```ts
declare class NotFoundError implements router.ApiError {
  constructor(message?: string, data?: any);
}
```

---

### BadRequestError

BadRequestError returns 400 ApiError.

```ts
declare class BadRequestError implements router.ApiError {
  constructor(message?: string, data?: any);
}
```

---

### ForbiddenError

ForbiddenError returns 403 ApiError.

```ts
declare class ForbiddenError implements router.ApiError {
  constructor(message?: string, data?: any);
}
```

---

### UnauthorizedError

UnauthorizedError returns 401 ApiError.

```ts
declare class UnauthorizedError implements router.ApiError {
  constructor(message?: string, data?: any);
}
```

---

### TooManyRequestsError

TooManyRequestsError returns 429 ApiError.

```ts
declare class TooManyRequestsError implements router.ApiError {
  constructor(message?: string, data?: any);
}
```

---

### InternalServerError

InternalServerError returns 429 ApiError.

```ts
declare class InternalServerError implements router.ApiError {
  constructor(message?: string, data?: any);
}
```

---

## Namespaces

- [`$dbx`](#dbx)
- [`$mails`](#mails)
- [`$security`](#security)
- [`$filesystem`](#filesystem)
- [`$filepath`](#filepath)
- [`$os`](#os)
- [`$apis`](#apis)
- [`$http`](#http)

---

### $dbx

`$dbx` defines common utility for working with the DB abstraction.
For examples and guides please check the [Database guide](./extend.md#database).

```ts
declare namespace $dbx {
  /**
   * {@inheritDoc dbx.HashExp}
   */
  export function hashExp(pairs: { [key: string]: any }): dbx.Expression;

  let _in: dbx._in;
  export { _in as in };

  export let exp: dbx.newExp;
  export let not: dbx.not;
  export let and: dbx.and;
  export let or: dbx.or;
  export let notIn: dbx.notIn;
  export let like: dbx.like;
  export let orLike: dbx.orLike;
  export let notLike: dbx.notLike;
  export let orNotLike: dbx.orNotLike;
  export let exists: dbx.exists;
  export let notExists: dbx.notExists;
  export let between: dbx.between;
  export let notBetween: dbx.notBetween;
}
```

---

### $mails

`$mails` defines helpers to send common
auth records emails like verification, password reset, etc.

```ts
declare namespace $mails {
  let sendRecordPasswordReset: mails.sendRecordPasswordReset;
  let sendRecordVerification: mails.sendRecordVerification;
  let sendRecordChangeEmail: mails.sendRecordChangeEmail;
  let sendRecordOTP: mails.sendRecordOTP;
  let sendRecordAuthAlert: mails.sendRecordAuthAlert;
}
```

---

### $security

`$security` defines low level helpers for creating
and parsing JWTs, random string generation, AES encryption, etc.

```ts
declare namespace $security {
  let randomString: security.randomString;
  let randomStringWithAlphabet: security.randomStringWithAlphabet;
  let randomStringByRegex: security.randomStringByRegex;
  let pseudorandomString: security.pseudorandomString;
  let pseudorandomStringWithAlphabet: security.pseudorandomStringWithAlphabet;
  let encrypt: security.encrypt;
  let decrypt: security.decrypt;
  let hs256: security.hs256;
  let hs512: security.hs512;
  let equal: security.equal;
  let md5: security.md5;
  let sha256: security.sha256;
  let sha512: security.sha512;

  /**
   * {@inheritDoc security.newJWT}
   */
  export function createJWT(payload: { [key: string]: any }, signingKey: string, secDuration: number): string;

  /**
   * {@inheritDoc security.parseUnverifiedJWT}
   */
  export function parseUnverifiedJWT(token: string): { [key: string]: any };

  /**
   * {@inheritDoc security.parseJWT}
   */
  export function parseJWT(token: string, verificationKey: string): { [key: string]: any };
}
```

---

### $filesystem

`$filesystem` defines common helpers for working
with the PocketBun filesystem abstraction.

```ts
declare namespace $filesystem {
  let fileFromPath: filesystem.newFileFromPath;
  /**
   * PocketBun-only async variant of fileFromPath.
   */
  export function fileFromPathAsync(path: string): Promise<filesystem.File>;
  let fileFromBytes: filesystem.newFileFromBytes;
  let fileFromMultipart: filesystem.newFileFromMultipart;

  /**
   * Initializes a new S3-only filesystem instance
   * (make sure to call `close()` after you are done working with it).
   *
   * Most users should prefer `$app.newFilesystem()` which will
   * construct a local or S3 filesystem based on the configured application settings.
   */
  let s3: filesystem.newS3;

  /**
   * Initializes a new local-only filesystem instance
   * (make sure to call `close()` after you are done working with it).
   *
   * Most users should prefer `$app.newFilesystem()` which will
   * construct a local or S3 filesystem based on the configured application settings.
   */
  let local: filesystem.newLocal;

  /**
   * fileFromURL creates a new File from the provided url by
   * downloading the resource and creating a BytesReader.
   *
   * Example:
   *
   * ```js
   * // with default max timeout of 120sec
   * const file1 = $filesystem.fileFromURL("https://...")
   *
   * // with custom timeout of 15sec
   * const file2 = $filesystem.fileFromURL("https://...", 15)
   * ```
   */
  export function fileFromURL(url: string, secTimeout?: number): filesystem.File;
  /**
   * PocketBun-only async variant of fileFromURL.
   */
  export function fileFromURLAsync(url: string, secTimeout?: number): Promise<filesystem.File>;
}
```

---

### $filepath

`$filepath` defines common helpers for manipulating filename
paths in a way compatible with the target operating system-defined file paths.

```ts
declare namespace $filepath {
  export let base: filepath.base;
  export let clean: filepath.clean;
  export let dir: filepath.dir;
  export let ext: filepath.ext;
  export let fromSlash: filepath.fromSlash;
  export let glob: filepath.glob;
  export let isAbs: filepath.isAbs;
  export let join: filepath.join;
  export let match: filepath.match;
  export let rel: filepath.rel;
  export let split: filepath.split;
  export let splitList: filepath.splitList;
  export let toSlash: filepath.toSlash;
  export let walk: filepath.walk;
  export let walkDir: filepath.walkDir;
}
```

---

### $os

`$os` defines common helpers for working with the OS level primitives
(eg. deleting directories, executing shell commands, etc.).

```ts
declare namespace $os {
  /**
   * Legacy alias for $os.cmd().
   */
  export let exec: exec.command;

  /**
   * Prepares an external OS command.
   *
   * Example:
   *
   * ```js
   * // prepare the command to execute
   * const cmd = $os.cmd('ls', '-sl')
   *
   * // execute the command and return its standard output as string
   * const output = toString(cmd.output());
   * ```
   */
  export let cmd: exec.command;

  /**
   * Args hold the command-line arguments, starting with the program name.
   */
  export let args: Array<string>;

  export let exit: os.exit;
  export let getenv: os.getenv;
  export let dirFS: os.dirFS;
  export let readFile: os.readFile;
  export function readFileAsync(name: string): Promise<string | Array<number>>;
  export let writeFile: os.writeFile;
  export function writeFileAsync(name: string, data: string | Array<number>): Promise<void>;
  export let stat: os.stat;
  export function statAsync(name: string): Promise<unknown>;
  export let readDir: os.readDir;
  export function readDirAsync(name: string): Promise<Array<unknown>>;
  export let tempDir: os.tempDir;
  export let truncate: os.truncate;
  export function truncateAsync(name: string, size: number): Promise<void>;
  export let getwd: os.getwd;
  export let mkdir: os.mkdir;
  export function mkdirAsync(name: string): Promise<void>;
  export let mkdirAll: os.mkdirAll;
  export function mkdirAllAsync(path: string): Promise<void>;
  export let rename: os.rename;
  export function renameAsync(oldpath: string, newpath: string): Promise<void>;
  export let remove: os.remove;
  export function removeAsync(path: string): Promise<void>;
  export let removeAll: os.removeAll;
  export function removeAllAsync(path: string): Promise<void>;
  export let openRoot: os.openRoot;
  export let openInRoot: os.openInRoot;
}
```

---

### $apis

`$apis` defines commonly used PocketBun api helpers and middlewares.

```ts
declare namespace $apis {
  /**
   * Route handler to serve static directory content (html, js, css, etc.).
   *
   * If a file resource is missing and indexFallback is set, the request
   * will be forwarded to the base index.html (useful for SPA).
   */
  export function static(dir: string, indexFallback: boolean): (e: core.RequestEvent) => void;

  let requireGuestOnly: apis.requireGuestOnly;
  let requireAuth: apis.requireAuth;
  let requireSuperuserAuth: apis.requireSuperuserAuth;
  let requireSuperuserOrOwnerAuth: apis.requireSuperuserOrOwnerAuth;
  let skipSuccessActivityLog: apis.skipSuccessActivityLog;
  let gzip: apis.gzip;
  let bodyLimit: apis.bodyLimit;
  let enrichRecord: apis.enrichRecord;
  let enrichRecords: apis.enrichRecords;

  /**
   * RecordAuthResponse writes standardized json record auth response
   * into the specified request event.
   *
   * The authMethod argument specify the name of the current authentication method (eg. password, oauth2, etc.)
   * that it is used primarily as an auth identifier during MFA and for login alerts.
   *
   * Set authMethod to empty string if you want to ignore the MFA checks and the login alerts
   * (can be also adjusted additionally via the onRecordAuthRequest hook).
   */
  export function recordAuthResponse(e: core.RequestEvent, authRecord: core.Record, authMethod: string, meta?: any): void;
}
```

---

### $http

`$http` defines common methods for working with HTTP requests.

```ts
declare namespace $http {
  /**
   * Sends a single HTTP request.
   *
   * Example:
   *
   * ```js
   * const res = $http.send({
   *     method:  "POST",
   *     url:     "https://example.com",
   *     body:    JSON.stringify({"title": "test"}),
   *     headers: { 'Content-Type': 'application/json' }
   * })
   *
   * console.log(res.statusCode) // the response HTTP status code
   * console.log(res.headers)    // the response headers (eg. res.headers['X-Custom'][0])
   * console.log(res.cookies)    // the response cookies (eg. res.cookies.sessionId.value)
   * console.log(res.body)       // the response body as raw bytes slice
   * console.log(res.json)       // the response body as parsed json array or map
   * ```
   */
  function send(config: {
    url: string;
    body?: string | FormData;
    method?: string; // default to "GET"
    headers?: { [key: string]: string };
    timeout?: number; // default to 120

    // @deprecated please use body instead
    data?: { [key: string]: any };
  }): {
    statusCode: number;
    headers: { [key: string]: Array<string> };
    cookies: { [key: string]: http.Cookie };
    json: any;
    body: Array<number>;

    // @deprecated please use toString(result.body) instead
    raw: string;
  };

  /**
   * PocketBun-only async variant of send().
   */
  function sendAsync(config: {
    url: string;
    body?: string | FormData;
    method?: string; // default to "GET"
    headers?: { [key: string]: string };
    timeout?: number; // default to 120

    // @deprecated please use body instead
    data?: { [key: string]: any };
  }): Promise<{
    statusCode: number;
    headers: { [key: string]: Array<string> };
    cookies: { [key: string]: http.Cookie };
    json: any;
    body: Array<number>;

    // @deprecated please use toString(result.body) instead
    raw: string;
  }>;
}
```

## Attribution

This page is generated from `src/plugins/jsvm/internal/types/generated/types.d.ts`.
