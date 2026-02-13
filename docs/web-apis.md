---
layout: default
title: PocketBun Web APIs Reference
---

# PocketBun Web APIs Reference

This page merges upstream PocketBase Web APIs reference pages.

Quick links:

- [API Records](#api-records)
- [API Realtime](#api-realtime)
- [API Files](#api-files)
- [API Collections](#api-collections)
- [API Settings](#api-settings)
- [API Logs](#api-logs)
- [API Crons](#api-crons)
- [API Backups](#api-backups)
- [API Health](#api-health)

## API Records

### CRUD actions

### Auth record actions

<div class="doc-fragment-separator" role="separator" aria-hidden="true"></div>

### List/Search records

Returns a paginated records list, supporting sorting and filtering.

Depending on the collection's `listRule` value, the access to this action may or may not have been restricted.

* You could find individual generated records API documentation in the "Dashboard > Collections > API Preview". *

```js
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

// fetch a paginated records list
const resultList = await pb.collection('posts').getList(1, 50, {
filter: 'created >= "2022-01-01 00:00:00" && someField1 != someField2',
});

// you can also fetch all records at once via getFullList
const records = await pb.collection('posts').getFullList({
sort: '-created',
});

// or fetch only the first record that matches the specified filter
const record = await pb.collection('posts').getFirstListItem('someField="test"', {
expand: 'relField1,relField2.subRelField',
});
```

API details

`GET /api/collections/`collectionIdOrName`/records`

Path parameters

| Param | Type | Description |
| --- | --- | --- |
| collectionIdOrName | String | ID or name of the records' collection. |

Query parameters

| Param | Type | Description |
| --- | --- | --- |
| page | Number | The page (aka. offset) of the paginated list (*default to 1*). |
| perPage | Number | The max returned records per page (*default to 30*). |
| sort | String | Specify the *ORDER BY* fields. Add `-` / `+` (default) in front of the attribute for DESC / ASC order, eg.: `// DESC by created and ASC by id ?sort=-created,id` **Supported record sort fields:** `@random`, `@rowid`, `id`, **and any other collection field**. |
| filter | String | Filter expression to filter/search the returned records list (in addition to the collection's `listRule`), e.g.: `?filter=(title~'abc' && created>'2022-01-01')` **Supported record filter fields:** `id`, **+ any field from the collection schema**. Filter syntax reference: - Format: `OPERAND OPERATOR OPERAND`. - `OPERAND` can be a field literal, string (single or double quoted), number, `null`, `true`, or `false`. - Operators: - `=` equal - `!=` not equal - `>` greater than - `>=` greater than or equal - `<` less than - `<=` less than or equal - `~` like/contains - `!~` not like/contains - `?=`, `?!=`, `?>`, `?>=`, `?<`, `?<=`, `?~`, `?!~` are any/at-least-one variants - Use `(...)`, `&&`, and `\|\|` to group/combine expressions. - Single line comments are supported: `// comment`. - For multi-record fields, operators are match-all by default; prefix the operator with `?` for any/at-least-one. |
| expand | String | Auto expand record relations. Ex.: `?expand=relField1,relField2.subRelField` Supports up to 6-levels depth nested relations expansion. The expanded relations will be appended to the record under the `expand` property (e.g. `"expand": object with relation payload`). Only the relations to which the request user has permissions to **view** will be expanded. |
| fields | String | Comma separated string of the fields to return in the JSON response *(by default returns all fields)*. Ex.: `?fields=*,expand.relField.name``*` targets all keys from the specific depth level.In addition, the following field modifiers are also supported: - `:excerpt(maxLength, withEllipsis?)`Returns a short plain text version of the field string value.Ex.: `?fields=*,description:excerpt(200,true)` |
| skipTotal | Boolean | If it is set the total counts query will be skipped and the response fields `totalItems` and `totalPages` will have `-1` value. This could drastically speed up the search queries when the total counters are not needed or cursor based pagination is used. For optimization purposes, it is set by default for the `getFirstListItem()` and `getFullList()` SDK methods. |

Responses

### Response examples

#### 200

```json
{
"page": 1,
"perPage": 100,
"totalItems": 2,
"totalPages": 1,
"items": [
{
"id": "ae40239d2bc4477",
"collectionId": "a98f514eb05f454",
"collectionName": "posts",
"updated": "2022-06-25 11:03:50.052",
"created": "2022-06-25 11:03:35.163",
"title": "test1"
},
{
"id": "d08dfc4f4d84419",
"collectionId": "a98f514eb05f454",
"collectionName": "posts",
"updated": "2022-06-25 11:03:45.876",
"created": "2022-06-25 11:03:45.876",
"title": "test2"
}
]
}
```

#### 400

```json
{
"status": 400,
"message": "Something went wrong while processing your request. Invalid filter.",
"data": {}
}
```

#### 403

```json
{
"status": 403,
"message": "Only superusers can filter by '@collection.*'",
"data": {}
}
```

<div class="doc-fragment-separator" role="separator" aria-hidden="true"></div>

### View record

Returns a single collection record by its ID.

Depending on the collection's `viewRule` value, the access to this action may or may not have been restricted.

* You could find individual generated records API documentation in the "Dashboard > Collections > API Preview". *

```js
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

const record1 = await pb.collection('posts').getOne('RECORD_ID', {
expand: 'relField1,relField2.subRelField',
});
```

API details

`GET /api/collections/`collectionIdOrName`/records/`recordId``

Path parameters

| Param | Type | Description |
| --- | --- | --- |
| collectionIdOrName | String | ID or name of the record's collection. |
| recordId | String | ID of the record to view. |

Query parameters

| Param | Type | Description |
| --- | --- | --- |
| expand | String | Auto expand record relations. Ex.: `?expand=relField1,relField2.subRelField` Supports up to 6-levels depth nested relations expansion. The expanded relations will be appended to the record under the `expand` property (e.g. `"expand": object with relation payload`). Only the relations to which the request user has permissions to **view** will be expanded. |
| fields | String | Comma separated string of the fields to return in the JSON response *(by default returns all fields)*. Ex.: `?fields=*,expand.relField.name``*` targets all keys from the specific depth level.In addition, the following field modifiers are also supported: - `:excerpt(maxLength, withEllipsis?)`Returns a short plain text version of the field string value.Ex.: `?fields=*,description:excerpt(200,true)` |

Responses

### Response examples

#### 200

```json
{
"id": "ae40239d2bc4477",
"collectionId": "a98f514eb05f454",
"collectionName": "posts",
"updated": "2022-06-25 11:03:50.052",
"created": "2022-06-25 11:03:35.163",
"title": "test1"
}
```

#### 403

```json
{
"status": 403,
"message": "Only superusers can perform this action.",
"data": {}
}
```

#### 404

```json
{
"status": 404,
"message": "The requested resource wasn't found.",
"data": {}
}
```

<div class="doc-fragment-separator" role="separator" aria-hidden="true"></div>

### Create record

Creates a new collection *Record*.

Depending on the collection's `createRule` value, the access to this action may or may not have been restricted.

* You could find individual generated records API documentation from the Dashboard. *

```js
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

const record = await pb.collection('demo').create({
title: 'Lorem ipsum',
});
```

API details

`POST /api/collections/`collectionIdOrName`/records`

Path parameters

| Param | Type | Description |
| --- | --- | --- |
| collectionIdOrName | String | ID or name of the record's collection. |

Body Parameters

| Param | Type | Description |
| --- | --- | --- |
| Optional id | String | **15 characters string** to store as record ID. If not set, it will be auto generated. |
| Schema fields | - | - |
| **Any field from the collection's schema.** | - | - |
| Additional auth record fields | - | - |
| Required password | String | Auth record password. |
| Required passwordConfirm | String | Auth record password confirmation. |

Body parameters could be sent as *JSON* or
*multipart/form-data*.

File upload is supported only through *multipart/form-data*.

Query parameters

| Param | Type | Description |
| --- | --- | --- |
| expand | String | Auto expand record relations. Ex.: `?expand=relField1,relField2.subRelField` Supports up to 6-levels depth nested relations expansion. The expanded relations will be appended to the record under the `expand` property (e.g. `"expand": object with relation payload`). Only the relations to which the request user has permissions to **view** will be expanded. |
| fields | String | Comma separated string of the fields to return in the JSON response *(by default returns all fields)*. Ex.: `?fields=*,expand.relField.name``*` targets all keys from the specific depth level.In addition, the following field modifiers are also supported: - `:excerpt(maxLength, withEllipsis?)`Returns a short plain text version of the field string value.Ex.: `?fields=*,description:excerpt(200,true)` |

Responses

### Response examples

#### 200

```json
{
"collectionId": "a98f514eb05f454",
"collectionName": "demo",
"id": "ae40239d2bc4477",
"updated": "2022-06-25 11:03:50.052",
"created": "2022-06-25 11:03:35.163",
"title": "Lorem ipsum"
}
```

#### 400

```json
{
"status": 400,
"message": "Failed to create record.",
"data": {
"title": {
"code": "validation_required",
"message": "Missing required value."
}
}
}
```

#### 403

```json
{
"status": 403,
"message": "Only superusers can perform this action.",
"data": {}
}
```

#### 404

```json
{
"status": 404,
"message": "The requested resource wasn't found. Missing collection context.",
"data": {}
}
```

<div class="doc-fragment-separator" role="separator" aria-hidden="true"></div>

### Update record

Updates an existing collection *Record*.

Depending on the collection's `updateRule` value, the access to this action may or may not have been restricted.

*You could find individual generated records API documentation from the Dashboard.*

```js
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

const record = await pb.collection('demo').update('YOUR_RECORD_ID', {
title: 'Lorem ipsum',
});
```

API details

`PATCH /api/collections/`collectionIdOrName`/records/`recordId``

Path parameters

| Param | Type | Description |
| --- | --- | --- |
| collectionIdOrName | String | ID or name of the record's collection. |
| recordId | String | ID of the record to update. |

Body Parameters

| Param | Type | Description |
| --- | --- | --- |
| Schema fields | - | - |
| **Any field from the collection's schema.** | - | - |
| Additional auth record fields | - | - |
| Optional oldPassword | String | Old auth record password. This field is required only when changing the record password. Superusers and auth records with "Manage" access can skip this field. |
| Optional password | String | New auth record password. |
| Optional passwordConfirm | String | New auth record password confirmation. |

Body parameters could be sent as *JSON* or
*multipart/form-data*.

File upload is supported only through *multipart/form-data*.

Query parameters

| Param | Type | Description |
| --- | --- | --- |
| expand | String | Auto expand record relations. Ex.: `?expand=relField1,relField2.subRelField` Supports up to 6-levels depth nested relations expansion. The expanded relations will be appended to the record under the `expand` property (e.g. `"expand": object with relation payload`). Only the relations to which the request user has permissions to **view** will be expanded. |
| fields | String | Comma separated string of the fields to return in the JSON response *(by default returns all fields)*. Ex.: `?fields=*,expand.relField.name``*` targets all keys from the specific depth level.In addition, the following field modifiers are also supported: - `:excerpt(maxLength, withEllipsis?)`Returns a short plain text version of the field string value.Ex.: `?fields=*,description:excerpt(200,true)` |

Responses

### Response examples

#### 200

```json
{
"collectionId": "a98f514eb05f454",
"collectionName": "demo",
"id": "ae40239d2bc4477",
"updated": "2022-06-25 11:03:50.052",
"created": "2022-06-25 11:03:35.163",
"title": "Lorem ipsum"
}
```

#### 400

```json
{
"status": 400,
"message": "Failed to create record.",
"data": {
"title": {
"code": "validation_required",
"message": "Missing required value."
}
}
}
```

#### 403

```json
{
"status": 403,
"message": "Only superusers can perform this action.",
"data": {}
}
```

#### 404

```json
{
"status": 404,
"message": "The requested resource wasn't found. Missing collection context.",
"data": {}
}
```

<div class="doc-fragment-separator" role="separator" aria-hidden="true"></div>

### Delete record

Deletes a single collection *Record* by its ID.

Depending on the collection's `deleteRule` value, the access to this action may or may not have been restricted.

* You could find individual generated records API documentation from the Dashboard. *

```js
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

await pb.collection('demo').delete('YOUR_RECORD_ID');
```

API details

`DELETE /api/collections/`collectionIdOrName`/records/`recordId``

Path parameters

| Param | Type | Description |
| --- | --- | --- |
| collectionIdOrName | String | ID or name of the record's collection. |
| recordId | String | ID of the record to delete. |

Responses

### Response examples

#### 204

```text
null
```

#### 400

```json
{
"status": 400,
"message": "Failed to delete record. Make sure that the record is not part of a required relation reference.",
"data": {}
}
```

#### 403

```json
{
"status": 403,
"message": "Only superusers can perform this action.",
"data": {}
}
```

#### 404

```json
{
"status": 404,
"message": "The requested resource wasn't found.",
"data": {}
}
```

<div class="doc-fragment-separator" role="separator" aria-hidden="true"></div>

### Batch create/update/upsert/delete records

Batch and transactional create/update/upsert/delete of multiple records in a single request.

The batch Web API need to be explicitly enabled and configured from the *Dashboard > Settings > Application*.

Because this endpoint processes the requests in a single read&write transaction, other queries may queue up and it could degrade the performance of your application if not used with proper care and configuration * (some recommendations: prefer using the smallest possible max processing time and body size limits; avoid large file uploads over slow S3 networks and custom hooks that communicate with slow external APIs).

```js
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

const batch = pb.createBatch();

batch.collection('example1').create({ ... });
batch.collection('example2').update('RECORD_ID', { ... });
batch.collection('example3').delete('RECORD_ID');
batch.collection('example4').upsert({ ... });

const result = await batch.send();
```

API details

`POST /api/batch`

Body Parameters

Body parameters could be sent as *application/json* or *multipart/form-data*. File upload is supported only via *multipart/form-data* (see below for more details).

| Param | Description |
| --- | --- |
| Required requests | Array - List of the requests to process. The supported batch request actions are: - record create - `POST /api/collections//records` - record update - `PATCH /api/collections//records/` - record upsert - `PUT /api/collections//records` (the body must have `id` field) - record delete - `DELETE /api/collections//records/` Each batch Request element have the following properties: - `url path` *(could include query parameters)* - `method` *(GET, POST, PUT, PATCH, DELETE)* - `headers` * (custom per-request `Authorization` header is not supported at the moment, aka. all batch requests have the same auth state) * - `body` **NB!** When the batch request is send as `multipart/form-data`, the regular batch action fields are expected to be submitted as serialized json under the `@jsonPayload` field and file keys need to follow the pattern `requests.N.fileField` or `requests[N].fileField` * (this is usually handled transparently by the SDKs when their specific object notation is used) *. If you don't use the SDKs or prefer manually to construct the `FormData` body, then it could look something like: `const formData = new FormData(); formData.append("@jsonPayload", JSON.stringify(, }, , }, , ] })) // file for the first request formData.append("requests.0.document", new File(...)) // file for the second request formData.append("requests.1.document", new File(...))` |

Responses

### Response examples

#### 200

```json
[
{
"status": 200,
"body": {
"collectionId": "a98f514eb05f454",
"collectionName": "demo",
"id": "ae40239d2bc4477",
"updated": "2022-06-25 11:03:50.052",
"created": "2022-06-25 11:03:35.163",
"title": "test1",
"document": "file_a98f51.txt"
}
},
{
"status": 200,
"body": {
"collectionId": "a98f514eb05f454",
"collectionName": "demo",
"id": "31y1gc447bc9602",
"updated": "2022-06-25 11:03:50.052",
"created": "2022-06-25 11:03:35.163",
"title": "test2",
"document": "file_f514eb0.txt"
}
},
]
```

#### 400

```json
{
"status": 400,
"message": "Batch transaction failed.",
"data": {
"requests": {
"1": {
"code": "batch_request_failed",
"message": "Batch request failed.",
"response": {
"status": 400,
"message": "Failed to create record.",
"data": {
"title": {
"code": "validation_min_text_constraint",
"message": "Must be at least 3 character(s).",
"params": { "min": 3 }
}
}
}
}
}
}
}
```

#### 403

```json
{
"status": 403,
"message": "Batch requests are not allowed.",
"data": {}
}
```

<div class="doc-fragment-separator" role="separator" aria-hidden="true"></div>

### List auth methods

Returns a public list with the allowed collection authentication methods.

```js
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

const result = await pb.collection('users').listAuthMethods();
```

API details

`GET /api/collections/`collectionIdOrName`/auth-methods`

Path parameters

| Param | Type | Description |
| --- | --- | --- |
| collectionIdOrName | String | ID or name of the auth collection. |

Query parameters

| Param | Type | Description |
| --- | --- | --- |
| fields | String | Comma separated string of the fields to return in the JSON response *(by default returns all fields)*. Ex.: `?fields=*,expand.relField.name``*` targets all keys from the specific depth level.In addition, the following field modifiers are also supported: - `:excerpt(maxLength, withEllipsis?)`Returns a short plain text version of the field string value.Ex.: `?fields=*,description:excerpt(200,true)` |

Responses

### Response examples

#### 200

```json
{
"password": {
"enabled": true,
"identityFields": ["email"]
},
"oauth2": {
"enabled": true,
"providers": [
{
"name": "github",
"displayName": "GitHub",
"state": "nT7SLxzXKAVMeRQJtxSYj9kvnJAvGk",
"authURL": "https://github.com/login/oauth/authorize?client_id=test&code_challenge=fcf8WAhNI6uCLJYgJubLyWXHvfs8xghoLe3zksBvxjE&code_challenge_method=S256&response_type=code&scope=read%3Auser+user%3Aemail&state=nT7SLxzXKAVMeRQJtxSYj9kvnJAvGk&redirect_uri=",
"codeVerifier": "PwBG5OKR2IyQ7siLrrcgWHFwLLLAeUrz7PS1nY4AneG",
"codeChallenge": "fcf8WAhNI6uCLJYgJubLyWXHvfs8xghoLe3zksBvxjE",
"codeChallengeMethod": "S256"
}
]
},
"mfa": {
"enabled": false,
"duration": 0
},
"otp": {
"enabled": false,
"duration": 0
}
}
```

<div class="doc-fragment-separator" role="separator" aria-hidden="true"></div>

### Auth with password

Authenticate a single auth record by combination of a password and a unique identity field (e.g. email).

```js
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

const authData = await pb.collection('users').authWithPassword(
'YOUR_USERNAME_OR_EMAIL',
'YOUR_PASSWORD',
);

// after the above you can also access the auth data from the authStore
console.log(pb.authStore.isValid);
console.log(pb.authStore.token);
console.log(pb.authStore.record.id);

// "logout" the last authenticated record
pb.authStore.clear();
```

API details

`POST /api/collections/`collectionIdOrName`/auth-with-password`

Path parameters

| Param | Type | Description |
| --- | --- | --- |
| collectionIdOrName | String | ID or name of the auth collection. |

Body Parameters

| Param | Type | Description |
| --- | --- | --- |
| Required identity | String | Auth record username or email address. |
| Required password | String | Auth record password. |
| Optional identityField | String | A specific identity field to use (by default fallbacks to the first matching one). |

Body parameters could be sent as *JSON* or
*multipart/form-data*.

Query parameters

| Param | Type | Description |
| --- | --- | --- |
| expand | String | Auto expand record relations. Ex.: `?expand=relField1,relField2.subRelField` Supports up to 6-levels depth nested relations expansion. The expanded relations will be appended to the record under the `expand` property (e.g. `"expand": object with relation payload`). Only the relations to which the request user has permissions to **view** will be expanded. |
| fields | String | Comma separated string of the fields to return in the JSON response *(by default returns all fields)*. Ex.: `?fields=*,record.expand.relField.name``*` targets all keys from the specific depth level.In addition, the following field modifiers are also supported: - `:excerpt(maxLength, withEllipsis?)`Returns a short plain text version of the field string value.Ex.: `?fields=*,record.description:excerpt(200,true)` |

Responses

### Response examples

#### 200

```json
{
"token": "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsInR5cGUiOiJhdXRoUmVjb3JkIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoyMjA4OTg1MjYxfQ.UwD8JvkbQtXpymT09d7J6fdA0aP9g4FJ1GPh_ggEkzc",
"record": {
"id": "8171022dc95a4ed",
"collectionId": "d2972397d45614e",
"collectionName": "users",
"created": "2022-06-24 06:24:18.434Z",
"updated": "2022-06-24 06:24:18.889Z",
"username": "test@example.com",
"email": "test@example.com",
"verified": false,
"emailVisibility": true,
"someCustomField": "example 123"
}
}
```

#### 400

```json
{
"status": 400,
"message": "An error occurred while submitting the form.",
"data": {
"password": {
"code": "validation_required",
"message": "Missing required value."
}
}
}
```

<div class="doc-fragment-separator" role="separator" aria-hidden="true"></div>

### Auth with OAuth2

Authenticate with an OAuth2 provider and returns a new auth token and record data.

This action usually should be called right after the provider login page redirect.

You could also check the [OAuth2 web integration example](./introduction.md#web-oauth2-integration).

```js
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

const authData = await pb.collection('users').authWithOAuth2Code(
'google',
'CODE',
'VERIFIER',
'REDIRECT_URL',
// optional data that will be used for the new account on OAuth2 sign-up
{
'name': 'test',
},
);

// after the above you can also access the auth data from the authStore
console.log(pb.authStore.isValid);
console.log(pb.authStore.token);
console.log(pb.authStore.record.id);

// "logout" the last authenticated record
pb.authStore.clear();
```

API details

`POST /api/collections/`collectionIdOrName`/auth-with-oauth2`

Path parameters

| Param | Type | Description |
| --- | --- | --- |
| collectionIdOrName | String | ID or name of the auth collection. |

Body Parameters

| Param | Type | Description |
| --- | --- | --- |
| Required provider | String | The name of the OAuth2 client provider (e.g. "google"). |
| Required code | String | The authorization code returned from the initial request. |
| Required codeVerifier | String | The code verifier sent with the initial request as part of the code_challenge. |
| Required redirectUrl | String | The redirect url sent with the initial request. |
| Optional createData | Object | Optional data that will be used when creating the auth record on OAuth2 sign-up. The created auth record must comply with the same requirements and validations in the regular **create** action. * The data can only be in `json`, aka. `multipart/form-data` and files upload currently are not supported during OAuth2 sign-ups. * |

Body parameters could be sent as *JSON* or
*multipart/form-data*.

Query parameters

| Param | Type | Description |
| --- | --- | --- |
| expand | String | Auto expand record relations. Ex.: `?expand=relField1,relField2.subRelField` Supports up to 6-levels depth nested relations expansion. The expanded relations will be appended to the record under the `expand` property (e.g. `"expand": object with relation payload`). Only the relations to which the request user has permissions to **view** will be expanded. |
| fields | String | Comma separated string of the fields to return in the JSON response *(by default returns all fields)*. Ex.: `?fields=*,record.expand.relField.name``*` targets all keys from the specific depth level.In addition, the following field modifiers are also supported: - `:excerpt(maxLength, withEllipsis?)`Returns a short plain text version of the field string value.Ex.: `?fields=*,record.description:excerpt(200,true)` |

Responses

### Response examples

#### 200

```json
{
"token": "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsInR5cGUiOiJhdXRoUmVjb3JkIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoyMjA4OTg1MjYxfQ.UwD8JvkbQtXpymT09d7J6fdA0aP9g4FJ1GPh_ggEkzc",
"record": {
"id": "8171022dc95a4ed",
"collectionId": "d2972397d45614e",
"collectionName": "users",
"created": "2022-06-24 06:24:18.434Z",
"updated": "2022-06-24 06:24:18.889Z",
"username": "test@example.com",
"email": "test@example.com",
"verified": true,
"emailVisibility": false,
"someCustomField": "example 123"
},
"meta": {
"id": "abc123",
"name": "John Doe",
"username": "john.doe",
"email": "test@example.com",
"isNew": false,
"avatarURL": "https://example.com/avatar.png",
"rawUser": {...},
"accessToken": "...",
"refreshToken": "...",
"expiry": "..."
}
}
```

#### 400

```json
{
"status": 400,
"message": "An error occurred while submitting the form.",
"data": {
"provider": {
"code": "validation_required",
"message": "Missing required value."
}
}
}
```

<div class="doc-fragment-separator" role="separator" aria-hidden="true"></div>

### Auth with OTP

Authenticate a single auth record with an one-time password (OTP).

Note that when requesting an OTP we return an `otpId` even if a user with the provided email doesn't exist as a very basic enumeration protection.

```js
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

// send OTP email to the provided auth record
const req = await pb.collection('users').requestOTP('test@example.com');

// ... show a screen/popup to enter the password from the email ...

// authenticate with the requested OTP id and the email password
const authData = await pb.collection('users').authWithOTP(req.otpId, "YOUR_OTP");

// after the above you can also access the auth data from the authStore
console.log(pb.authStore.isValid);
console.log(pb.authStore.token);
console.log(pb.authStore.record.id);

// "logout"
pb.authStore.clear();
```

API details

<div class="doc-fragment-separator" role="separator" aria-hidden="true"></div>

`POST /api/collections/`collectionIdOrName`/request-otp`

Path parameters

| Param | Type | Description |
| --- | --- | --- |
| collectionIdOrName | String | ID or name of the auth collection. |

Body Parameters

| Param | Type | Description |
| --- | --- | --- |
| Required email | String | The auth record email address to send the OTP request (if exists). |

Responses

### Response examples

#### 200

```json
{
"status": 400,
"message": "An error occurred while validating the submitted data.",
"data": {
"email": {
"code": "validation_is_email",
"message": "Must be a valid email address."
}
}
}
```

#### 429

```json
{
"status": 429,
"message": "You've send too many OTP requests, please try again later.",
"data": {}
}
```

<div class="doc-fragment-separator" role="separator" aria-hidden="true"></div>

`POST /api/collections/`collectionIdOrName`/auth-with-otp`

Path parameters

| Param | Type | Description |
| --- | --- | --- |
| collectionIdOrName | String | ID or name of the auth collection. |

Body Parameters

| Param | Type | Description |
| --- | --- | --- |
| Required otpId | String | The id of the OTP request. |
| Required password | String | The one-time password. |

Query parameters

| Param | Type | Description |
| --- | --- | --- |
| expand | String | Auto expand record relations. Ex.: `?expand=relField1,relField2.subRelField` Supports up to 6-levels depth nested relations expansion. The expanded relations will be appended to the record under the `expand` property (e.g. `"expand": object with relation payload`). Only the relations to which the request user has permissions to **view** will be expanded. |
| fields | String | Comma separated string of the fields to return in the JSON response *(by default returns all fields)*. Ex.: `?fields=*,record.expand.relField.name``*` targets all keys from the specific depth level.In addition, the following field modifiers are also supported: - `:excerpt(maxLength, withEllipsis?)`Returns a short plain text version of the field string value.Ex.: `?fields=*,record.description:excerpt(200,true)` |

Responses

### Response examples

#### 200

```json
{
"token": "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsInR5cGUiOiJhdXRoUmVjb3JkIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoyMjA4OTg1MjYxfQ.UwD8JvkbQtXpymT09d7J6fdA0aP9g4FJ1GPh_ggEkzc",
"record": {
"id": "8171022dc95a4ed",
"collectionId": "d2972397d45614e",
"collectionName": "users",
"created": "2022-06-24 06:24:18.434Z",
"updated": "2022-06-24 06:24:18.889Z",
"username": "test@example.com",
"email": "test@example.com",
"verified": false,
"emailVisibility": true,
"someCustomField": "example 123"
}
}
```

#### 400

```json
{
"status": 400,
"message": "Failed to authenticate.",
"data": {
"otpId": {
"code": "validation_required",
"message": "Missing required value."
}
}
}
```

<div class="doc-fragment-separator" role="separator" aria-hidden="true"></div>

### Auth refresh

Returns a new auth response (token and user data) for already authenticated auth record.

* This method is usually called by users on page/screen reload to ensure that the previously stored data in `pb.authStore` is still valid and up-to-date. *

```js
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

const authData = await pb.collection('users').authRefresh();

// after the above you can also access the refreshed auth data from the authStore
console.log(pb.authStore.isValid);
console.log(pb.authStore.token);
console.log(pb.authStore.record.id);
```

API details

`POST /api/collections/`collectionIdOrName`/auth-refresh Requires `Authorization:TOKEN` Path parameters Param Type Description collectionIdOrName String ID or name of the auth collection. Query parameters Param Type Description Responses`

### Response examples

#### 200

```json
{
"token": "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsInR5cGUiOiJhdXRoUmVjb3JkIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoyMjA4OTg1MjYxfQ.UwD8JvkbQtXpymT09d7J6fdA0aP9g4FJ1GPh_ggEkzc",
"record": {
"id": "8171022dc95a4ed",
"collectionId": "d2972397d45614e",
"collectionName": "users",
"created": "2022-06-24 06:24:18.434Z",
"updated": "2022-06-24 06:24:18.889Z",
"username": "test@example.com",
"email": "test@example.com",
"verified": false,
"emailVisibility": true,
"someCustomField": "example 123"
}
}
```

#### 401

```json
{
"status": 401,
"message": "The request requires valid record authorization token to be set.",
"data": {}
}
```

#### 403

```json
{
"status": 403,
"message": "The authorized record model is not allowed to perform this action.",
"data": {}
}
```

#### 404

```json
{
"status": 404,
"message": "Missing auth record context.",
"data": {}
}
```

<div class="doc-fragment-separator" role="separator" aria-hidden="true"></div>

### Verification

Sends auth record email verification request.

```js
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

await pb.collection('users').requestVerification('test@example.com');

// ---
// (optional) in your custom confirmation page:
// ---

await pb.collection('users').confirmVerification('VERIFICATION_TOKEN');
```

API details

<div class="doc-fragment-separator" role="separator" aria-hidden="true"></div>

`POST /api/collections/`collectionIdOrName`/request-verification`

Body Parameters

| Param | Type | Description |
| --- | --- | --- |
| Required email | String | The auth record email address to send the verification request (if exists). |

Responses

### Response examples

#### 204

```json
{
"status": 400,
"message": "An error occurred while validating the submitted data.",
"data": {
"email": {
"code": "validation_required",
"message": "Missing required value."
}
}
}
```

#### 204

```text
null
```

<div class="doc-fragment-separator" role="separator" aria-hidden="true"></div>

`POST /api/collections/`collectionIdOrName`/confirm-verification`

Body Parameters

| Param | Type | Description |
| --- | --- | --- |
| Required token | String | The token from the verification request email. |

Responses

### Response examples

#### 204

```json
{
"status": 400,
"message": "An error occurred while validating the submitted data.",
"data": {
"token": {
"code": "validation_required",
"message": "Missing required value."
}
}
}
```

#### 204

```text
null
```

<div class="doc-fragment-separator" role="separator" aria-hidden="true"></div>

### Password reset

Sends auth record password reset email request.

On successful password reset all previously issued auth tokens for the specific record will be automatically invalidated.

```js
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

await pb.collection('users').requestPasswordReset('test@example.com');

// ---
// (optional) in your custom confirmation page:
// ---

// note: after this call all previously issued auth tokens are invalidated
await pb.collection('users').confirmPasswordReset(
'RESET_TOKEN',
'NEW_PASSWORD',
'NEW_PASSWORD_CONFIRM',
);
```

API details

<div class="doc-fragment-separator" role="separator" aria-hidden="true"></div>

`POST /api/collections/`collectionIdOrName`/request-password-reset`

Body Parameters

| Param | Type | Description |
| --- | --- | --- |
| Required email | String | The auth record email address to send the password reset request (if exists). |

Responses

### Response examples

#### 204

```json
{
"status": 400,
"message": "An error occurred while validating the submitted data.",
"data": {
"email": {
"code": "validation_required",
"message": "Missing required value."
}
}
}
```

#### 204

```text
null
```

<div class="doc-fragment-separator" role="separator" aria-hidden="true"></div>

`POST /api/collections/`collectionIdOrName`/confirm-password-reset`

Body Parameters

| Param | Type | Description |
| --- | --- | --- |
| Required token | String | The token from the password reset request email. |
| Required password | String | The new password to set. |
| Required passwordConfirm | String | The new password confirmation. |

Responses

### Response examples

#### 204

```json
{
"status": 400,
"message": "An error occurred while validating the submitted data.",
"data": {
"token": {
"code": "validation_required",
"message": "Missing required value."
}
}
}
```

#### 204

```text
null
```

<div class="doc-fragment-separator" role="separator" aria-hidden="true"></div>

### Email change

Sends auth record email change request.

On successful email change all previously issued auth tokens for the specific record will be automatically invalidated.

```js
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

await pb.collection('users').authWithPassword('test@example.com', '1234567890');

await pb.collection('users').requestEmailChange('new@example.com');

// ---
// (optional) in your custom confirmation page:
// ---

// note: after this call all previously issued auth tokens are invalidated
await pb.collection('users').confirmEmailChange('EMAIL_CHANGE_TOKEN', 'YOUR_PASSWORD');
```

API details

<div class="doc-fragment-separator" role="separator" aria-hidden="true"></div>

`POST /api/collections/`collectionIdOrName`/request-email-change Requires `Authorization:TOKEN` Body Parameters Param Type Description Required newEmail String The new email address to send the change email request. Responses`

### Response examples

#### 204

```json
{
"status": 400,
"message": "An error occurred while validating the submitted data.",
"data": {
"newEmail": {
"code": "validation_required",
"message": "Missing required value."
}
}
}
```

#### 401

```json
{
"status": 401,
"message": "The request requires valid record authorization token to be set.",
"data": {}
}
```

#### 403

```json
{
"status": 403,
"message": "The authorized record model is not allowed to perform this action.",
"data": {}
}
```

#### 204

```text
null
```

<div class="doc-fragment-separator" role="separator" aria-hidden="true"></div>

`POST /api/collections/`collectionIdOrName`/confirm-email-change`

Body Parameters

| Param | Type | Description |
| --- | --- | --- |
| Required token | String | The token from the change email request email. |
| Required password | String | The account password to confirm the email change. |

Responses

### Response examples

#### 204

```json
{
"status": 400,
"message": "An error occurred while validating the submitted data.",
"data": {
"token": {
"code": "validation_required",
"message": "Missing required value."
}
}
}
```

#### 204

```text
null
```

<div class="doc-fragment-separator" role="separator" aria-hidden="true"></div>

### Impersonate

Impersonate allows you to authenticate as a different user by generating a **nonrefreshable** auth token.

Only superusers can perform this action.

```js
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

// authenticate as superuser
await pb.collection("_superusers").authWithPassword("test@example.com", "1234567890");

// impersonate
// (the custom token duration is optional and must be in seconds)
const impersonateClient = pb.collection("users").impersonate("USER_RECORD_ID", 3600)

// log the impersonate token and user data
console.log(impersonateClient.authStore.token);
console.log(impersonateClient.authStore.record);

// send requests as the impersonated user
impersonateClient.collection("example").getFullList();
```

API details

`POST /api/collections/`collectionIdOrName`/impersonate/`id` Requires `Authorization:TOKEN` Path parameters Param Type Description collectionIdOrName String ID or name of the auth collection. id String ID of the auth record to impersonate. Body Parameters Param Type Description Optional duration Number Optional custom JWT duration for the `exp` claim (in seconds). If not set or 0, it fallbacks to the default collection auth token duration option. Body parameters could be sent as *JSON* or *multipart/form-data*. Query parameters Param Type Description Responses`

### Response examples

#### 200

```json
{
"token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjb2xsZWN0aW9uSWQiOiJfcGJjX2MwcHdrZXNjcXMiLCJleHAiOjE3MzAzNjgxMTUsImlkIjoicXkwMmMxdDBueDBvanFuIiwicmVmcmVzaGFibGUiOmZhbHNlLCJ0eXBlIjoiYXV0aCJ9.1JOaE54TyPdDLf0mb0T6roIYeh8Y1HfJvDlYZADMN4U",
"record": {
"id": "8171022dc95a4ed",
"collectionId": "d2972397d45614e",
"collectionName": "users",
"created": "2022-06-24 06:24:18.434Z",
"updated": "2022-06-24 06:24:18.889Z",
"username": "test@example.com",
"email": "test@example.com",
"verified": false,
"emailVisibility": true,
"someCustomField": "example 123"
}
}
```

#### 400

```json
{
"status": 400,
"message": "The request requires valid record authorization token to be set.",
"data": {
"duration": {
"code": "validation_min_greater_equal_than_required",
"message": "Must be no less than 0."
}
}
}
```

#### 401

```json
{
"status": 401,
"message": "An error occurred while validating the submitted data.",
"data": {}
}
```

#### 403

```json
{
"status": 403,
"message": "The authorized record model is not allowed to perform this action.",
"data": {}
}
```

#### 404

```json
{
"status": 404,
"message": "The requested resource wasn't found.",
"data": {}
}
```
## API Realtime

The Realtime API is implemented via Server-Sent Events (SSE). Generally, it consists of 2 operations:

- establish SSE connection

- submit client subscriptions

SSE events are sent for **create**, **update** and **delete** record operations.

**You could subscribe to a single record or to an entire collection.**

When you subscribe to a **single record**, the collection's **ViewRule** will be used to determine whether the subscriber has access to receive the event message.

When you subscribe to an **entire collection**, the collection's **ListRule** will be used to determine whether the subscriber has access to receive the event message.

### Connect

`GET /api/realtime`

Establishes a new SSE connection and immediately sends a `PB_CONNECT` SSE event with the created client ID.

**NB!** The user/superuser authorization happens during the first [Set subscriptions](#set-subscriptions) call.

If the connected client doesn't receive any new messages for 5 minutes, the server will send a disconnect signal (this is to prevent forgotten/leaked connections). The connection will be automatically reestablished if the client is still active (e.g. the browser tab is still open).

### Set subscriptions

`POST /api/realtime`

Sets new active client's subscriptions (and auto unsubscribes from the previous ones).

If `Authorization` header is set, will authorize the client SSE connection with the associated user or superuser.

Body Parameters

| Param | Type | Description |
| --- | --- | --- |
| Required clientId | String | ID of the SSE client connection. |
| Optional subscriptions | Array | The new client subscriptions to set in the format: `COLLECTION_ID_OR_NAME/*` or `COLLECTION_ID_OR_NAME/RECORD_ID`. You can also attach optional query and header parameters as serialized json to a single topic using the `options` query parameter, e.g.: `COLLECTION_ID_OR_NAME/RECORD_ID?options=, "headers": }` Leave empty to unsubscribe from everything. |

Body parameters could be sent as *JSON* or
*multipart/form-data*.

Responses

All of this is seamlessly handled by the SDKs using just the `subscribe` and `unsubscribe` methods:

```js
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

// (Optionally) authenticate
await pb.collection('users').authWithPassword('test@example.com', '1234567890');

// Subscribe to changes in any record in the collection
pb.collection('example').subscribe('*', function (e) {
console.log(e.action);
console.log(e.record);
}, { /* other options like expand, custom headers, etc. */ });

// Subscribe to changes only in the specified record
pb.collection('example').subscribe('RECORD_ID', function (e) {
console.log(e.action);
console.log(e.record);
}, { /* other options like expand, custom headers, etc. */ });

// Unsubscribe
pb.collection('example').unsubscribe('RECORD_ID'); // remove all 'RECORD_ID' subscriptions
pb.collection('example').unsubscribe('*'); // remove all '*' topic subscriptions
pb.collection('example').unsubscribe(); // remove all subscriptions in the collection
```

### Response examples

#### 204

```json
{
"status": 400,
"message": "Something went wrong while processing your request.",
"data": {
"clientId": {
"code": "validation_required",
"message": "Missing required value."
}
}
}
```

#### 403

```json
{
"status": 403,
"message": "The current and the previous request authorization don't match.",
"data": {}
}
```

#### 404

```json
{
"status": 404,
"message": "Missing or invalid client id.",
"data": {}
}
```

#### 204

```text
null
```
## API Files

Files are uploaded, updated or deleted via the [Records API](#api-records).

The File API is usually used to fetch/download a file resource (with support for basic image manipulations, like generating thumbs).

<div class="doc-fragment-separator" role="separator" aria-hidden="true"></div>

### Download / Fetch file

Downloads a single file resource (aka. the URL address to the file). Example:

`}
/>

API details

**GET**

/api/files/`collectionIdOrName`/`recordId`/`filename`

Path parameters

| Param | Type | Description |
| --- | --- | --- |
| collectionIdOrName | String | ID or name of the collection whose record model contains the file resource. |
| recordId | String | ID of the record model that contains the file resource. |
| filename | String | Name of the file resource. |

Query parameters

| Param | Type | Description |
| --- | --- | --- |
| thumb | String | Get the thumb of the requested file. Supported thumb formats: - `WxH` (e.g. `100x300`) crop to `WxH` from center - `WxHt` (e.g. `100x300t`) crop to `WxH` from top - `WxHb` (e.g. `100x300b`) crop to `WxH` from bottom - `WxHf` (e.g. `100x300f`) fit inside `WxH` without cropping - `0xH` (e.g. `0x300`) resize to height while preserving aspect ratio - `Wx0` (e.g. `100x0`) resize to width while preserving aspect ratio If the thumb size is not defined in the file schema field options or the file resource is not an image (jpg, png, gif, webp), then the original file resource is returned unmodified. |
| token | String | Optional **file token** for granting access to **protected file(s)**. For an example, you can check ["Files upload and handling"](./introduction.md#protected-files). |
| download | Boolean | If it is set to a truthy value (*1*, *t*, *true*) the file will be served with `Content-Disposition: attachment` header instructing the browser to ignore the file preview for pdf, images, videos, etc. and to directly download the file. |

Responses

### Response examples

#### 200

```json
[file resource]
```

#### 400

```json
{
"status": 400,
"message": "Filesystem initialization failure.",
"data": {}
}
```

#### 404

```json
{
"status": 404,
"message": "The requested resource wasn't found.",
"data": {}
}
```

<div class="doc-fragment-separator" role="separator" aria-hidden="true"></div>

### Generate protected file token

Generates a **short-lived file token** for accessing **protected file(s)**.

The client must be superuser or auth record authenticated (aka. have regular authorization token sent with the request).

API details

`POST /api/files/token Requires `Authorization:TOKEN` Responses`

### Response examples

#### 200

```json
{
"token": "..."
}
```

#### 400

```json
{
"status": 400,
"message": "Failed to generate file token.",
"data": {}
}
```
## API Collections

### List collections

Returns a paginated Collections list.

Only superusers can perform this action.

```js
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

// fetch a paginated collections list
const pageResult = await pb.collections.getList(1, 100, {
filter: 'created >= "2022-01-01 00:00:00"',
});

// you can also fetch all collections at once via getFullList
const collections = await pb.collections.getFullList({ sort: '-created' });

// or fetch only the first collection that matches the specified filter
const collection = await pb.collections.getFirstListItem('type="auth"');
```

API details

`GET /api/collections Requires `Authorization:TOKEN` Query parameters Param Type Description page Number The page (aka. offset) of the paginated list (*default to 1*). perPage Number The max returned collections per page (*default to 30*). sort String Specify the *ORDER BY* fields. Add `-` / `+` (default) in front of the attribute for DESC / ASC order, e.g.: `// DESC by created and ASC by id ?sort=-created,id` **Supported collection sort fields:** `@random`, `id`, `created`, `updated`, `name`, `type`, `system` filter String Filter expression to filter/search the returned collections list, e.g.: `?filter=(name~'abc' && created>'2022-01-01')` **Supported collection filter fields:** `id`, `created`, `updated`, `name`, `type`, `system` Responses`

### Response examples

#### 200

```json
{
"page": 1,
"perPage": 2,
"totalItems": 10,
"totalPages": 5,
"items": [
{
"id": "_pbc_344172009",
"listRule": null,
"viewRule": null,
"createRule": null,
"updateRule": null,
"deleteRule": null,
"name": "users",
"type": "auth",
"fields": [
{
"autogeneratePattern": "[a-z0-9]{15}",
"hidden": false,
"id": "text3208210256",
"max": 15,
"min": 15,
"name": "id",
"pattern": "^[a-z0-9]+$",
"presentable": false,
"primaryKey": true,
"required": true,
"system": true,
"type": "text"
},
{
"cost": 0,
"hidden": true,
"id": "password901924565",
"max": 0,
"min": 8,
"name": "password",
"pattern": "",
"presentable": false,
"required": true,
"system": true,
"type": "password"
},
{
"autogeneratePattern": "[a-zA-Z0-9]{50}",
"hidden": true,
"id": "text2504183744",
"max": 60,
"min": 30,
"name": "tokenKey",
"pattern": "",
"presentable": false,
"primaryKey": false,
"required": true,
"system": true,
"type": "text"
},
{
"exceptDomains": null,
"hidden": false,
"id": "email3885137012",
"name": "email",
"onlyDomains": null,
"presentable": false,
"required": true,
"system": true,
"type": "email"
},
{
"hidden": false,
"id": "bool1547992806",
"name": "emailVisibility",
"presentable": false,
"required": false,
"system": true,
"type": "bool"
},
{
"hidden": false,
"id": "bool256245529",
"name": "verified",
"presentable": false,
"required": false,
"system": true,
"type": "bool"
},
{
"autogeneratePattern": "",
"hidden": false,
"id": "text1579384326",
"max": 255,
"min": 0,
"name": "name",
"pattern": "",
"presentable": false,
"primaryKey": false,
"required": false,
"system": false,
"type": "text"
},
{
"hidden": false,
"id": "file376926767",
"maxSelect": 1,
"maxSize": 0,
"mimeTypes": [
"image/jpeg",
"image/png",
"image/svg+xml",
"image/gif",
"image/webp"
],
"name": "avatar",
"presentable": false,
"protected": false,
"required": false,
"system": false,
"thumbs": null,
"type": "file"
},
{
"hidden": false,
"id": "autodate2990389176",
"name": "created",
"onCreate": true,
"onUpdate": false,
"presentable": false,
"system": false,
"type": "autodate"
},
{
"hidden": false,
"id": "autodate3332085495",
"name": "updated",
"onCreate": true,
"onUpdate": true,
"presentable": false,
"system": false,
"type": "autodate"
}
],
"indexes": [
"CREATE UNIQUE INDEX \
```

#### 400

```json
{
"status": 400,
"message": "Something went wrong while processing your request. Invalid filter.",
"data": {}
}
```

#### 401

```json
{
"status": 401,
"message": "The request requires valid record authorization token.",
"data": {}
}
```

#### 403

```json
{
"status": 403,
"message": "Only superusers can perform this action.",
"data": {}
}
```

<div class="doc-fragment-separator" role="separator" aria-hidden="true"></div>

### View collection

Returns a single Collection by its ID or name.

Only superusers can perform this action.

```js
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

const collection = await pb.collections.getOne('demo');
```

API details

`GET /api/collections/`collectionIdOrName` Requires `Authorization:TOKEN` Path parameters Param Type Description collectionIdOrName String ID or name of the collection to view. Query parameters Param Type Description Responses`

### Response examples

#### 200

```json
{
"id": "_pbc_2287844090",
"listRule": null,
"viewRule": null,
"createRule": null,
"updateRule": null,
"deleteRule": null,
"name": "posts",
"type": "base",
"fields": [
{
"autogeneratePattern": "[a-z0-9]{15}",
"hidden": false,
"id": "text3208210256",
"max": 15,
"min": 15,
"name": "id",
"pattern": "^[a-z0-9]+$",
"presentable": false,
"primaryKey": true,
"required": true,
"system": true,
"type": "text"
},
{
"autogeneratePattern": "",
"hidden": false,
"id": "text724990059",
"max": 0,
"min": 0,
"name": "title",
"pattern": "",
"presentable": false,
"primaryKey": false,
"required": false,
"system": false,
"type": "text"
},
{
"hidden": false,
"id": "autodate2990389176",
"name": "created",
"onCreate": true,
"onUpdate": false,
"presentable": false,
"system": false,
"type": "autodate"
},
{
"hidden": false,
"id": "autodate3332085495",
"name": "updated",
"onCreate": true,
"onUpdate": true,
"presentable": false,
"system": false,
"type": "autodate"
}
],
"indexes": [],
"system": false
}
```

#### 401

```json
{
"status": 401,
"message": "The request requires valid record authorization token.",
"data": {}
}
```

#### 403

```json
{
"status": 403,
"message": "The authorized record is not allowed to perform this action.",
"data": {}
}
```

#### 404

```json
{
"status": 404,
"message": "The requested resource wasn't found.",
"data": {}
}
```

<div class="doc-fragment-separator" role="separator" aria-hidden="true"></div>

### Create collection

Creates a new Collection.

Only superusers can perform this action.

```js
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

// create base collection
const base = await pb.collections.create({
name: 'exampleBase',
type: 'base',
fields: [
{
name: 'title',
type: 'text',
required: true,
min: 10,
},
{
name: 'status',
type: 'bool',
},
],
});

// create auth collection
const auth = await pb.collections.create({
name: 'exampleAuth',
type: 'auth',
createRule: 'id = @request.auth.id',
updateRule: 'id = @request.auth.id',
deleteRule: 'id = @request.auth.id',
fields: [
{
name: 'name',
type: 'text',
}
],
passwordAuth: {
enabled: true,
identityFields: ['email']
},
});

// create view collection
const view = await pb.collections.create({
name: 'exampleView',
type: 'view',
listRule: '@request.auth.id != ""',
viewRule: null,
// the schema will be autogenerated from the below query
viewQuery: 'SELECT id, name from posts',
});
```

API details

`POST /api/collections Requires `Authorization:TOKEN` Body Parameters Body parameters could be sent as *JSON* or *multipart/form-data*. ` } // OAuth2 specifies whether OAuth2 auth is enabled for the collection // and which OAuth2 providers are allowed. oauth2 (optional): providers (optional): [ ] } // PasswordAuth defines options related to the collection password authentication. passwordAuth (optional): // MFA defines options related to the Multi-factor authentication (MFA). mfa (optional): // OTP defines options related to the One-time password authentication (OTP). otp (optional): } // Token configurations. authToken (optional): passwordResetToken (optional): emailChangeToken (optional): verificationToken (optional): fileToken (optional): // Default email templates. verificationTemplate (optional): resetPasswordTemplate (optional): confirmEmailChangeTemplate (optional): }` Query parameters Param Type Description Responses`

### Response examples

#### 200

```json
{
"id": "_pbc_2287844090",
"listRule": null,
"viewRule": null,
"createRule": null,
"updateRule": null,
"deleteRule": null,
"name": "posts",
"type": "base",
"fields": [
{
"autogeneratePattern": "[a-z0-9]{15}",
"hidden": false,
"id": "text3208210256",
"max": 15,
"min": 15,
"name": "id",
"pattern": "^[a-z0-9]+$",
"presentable": false,
"primaryKey": true,
"required": true,
"system": true,
"type": "text"
},
{
"autogeneratePattern": "",
"hidden": false,
"id": "text724990059",
"max": 0,
"min": 0,
"name": "title",
"pattern": "",
"presentable": false,
"primaryKey": false,
"required": false,
"system": false,
"type": "text"
},
{
"hidden": false,
"id": "autodate2990389176",
"name": "created",
"onCreate": true,
"onUpdate": false,
"presentable": false,
"system": false,
"type": "autodate"
},
{
"hidden": false,
"id": "autodate3332085495",
"name": "updated",
"onCreate": true,
"onUpdate": true,
"presentable": false,
"system": false,
"type": "autodate"
}
],
"indexes": [],
"system": false
}
```

#### 400

```json
{
"status": 400,
"message": "An error occurred while submitting the form.",
"data": {
"title": {
"code": "validation_required",
"message": "Missing required value."
}
}
}
```

#### 401

```json
{
"status": 401,
"message": "The request requires valid record authorization token.",
"data": {}
}
```

#### 403

```json
{
"status": 403,
"message": "The authorized record is not allowed to perform this action.",
"data": {}
}
```

<div class="doc-fragment-separator" role="separator" aria-hidden="true"></div>

### Update collection

Updates a single Collection by its ID or name.

Only superusers can perform this action.

```js
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

await pb.collection("_superusers").authWithPassword('test@example.com', '123456');

const collection = await pb.collections.update('demo', {
name: 'new_demo',
listRule: 'created > "2022-01-01 00:00:00"',
});
```

API details

`PATCH /api/collections/`collectionIdOrName` Requires `Authorization:TOKEN` Path parameters Param Type Description collectionIdOrName String ID or name of the collection to view. Body Parameters Body parameters could be sent as *JSON* or *multipart/form-data*. ` } // OAuth2 specifies whether OAuth2 auth is enabled for the collection // and which OAuth2 providers are allowed. oauth2 (optional): providers (optional): [ ] } // PasswordAuth defines options related to the collection password authentication. passwordAuth (optional): // MFA defines options related to the Multi-factor authentication (MFA). mfa (optional): // OTP defines options related to the One-time password authentication (OTP). otp (optional): } // Token configurations. authToken (optional): passwordResetToken (optional): emailChangeToken (optional): verificationToken (optional): fileToken (optional): // Default email templates. verificationTemplate (optional): resetPasswordTemplate (optional): confirmEmailChangeTemplate (optional): }` Query parameters Param Type Description Responses`

### Response examples

#### 200

```json
{
"id": "_pbc_2287844090",
"listRule": null,
"viewRule": null,
"createRule": null,
"updateRule": null,
"deleteRule": null,
"name": "posts",
"type": "base",
"fields": [
{
"autogeneratePattern": "[a-z0-9]{15}",
"hidden": false,
"id": "text3208210256",
"max": 15,
"min": 15,
"name": "id",
"pattern": "^[a-z0-9]+$",
"presentable": false,
"primaryKey": true,
"required": true,
"system": true,
"type": "text"
},
{
"autogeneratePattern": "",
"hidden": false,
"id": "text724990059",
"max": 0,
"min": 0,
"name": "title",
"pattern": "",
"presentable": false,
"primaryKey": false,
"required": false,
"system": false,
"type": "text"
},
{
"hidden": false,
"id": "autodate2990389176",
"name": "created",
"onCreate": true,
"onUpdate": false,
"presentable": false,
"system": false,
"type": "autodate"
},
{
"hidden": false,
"id": "autodate3332085495",
"name": "updated",
"onCreate": true,
"onUpdate": true,
"presentable": false,
"system": false,
"type": "autodate"
}
],
"indexes": [],
"system": false
}
```

#### 400

```json
{
"status": 400,
"message": "An error occurred while submitting the form.",
"data": {
"email": {
"code": "validation_required",
"message": "Missing required value."
}
}
}
```

#### 401

```json
{
"status": 401,
"message": "The request requires valid record authorization token.",
"data": {}
}
```

#### 403

```json
{
"status": 403,
"message": "The authorized record is not allowed to perform this action.",
"data": {}
}
```

<div class="doc-fragment-separator" role="separator" aria-hidden="true"></div>

### Delete collection

Deletes a single Collection by its ID or name.

Only superusers can perform this action.

```js
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

await pb.collections.delete('demo');
```

API details

`DELETE /api/collections/`collectionIdOrName` Requires `Authorization:TOKEN` Path parameters Param Type Description collectionIdOrName String ID or name of the collection to view. Responses`

### Response examples

#### 204

```text
null
```

#### 400

```json
{
"status": 400,
"message": "Failed to delete collection. Make sure that the collection is not referenced by other collections.",
"data": {}
}
```

#### 401

```json
{
"status": 401,
"message": "The request requires valid record authorization token.",
"data": {}
}
```

#### 403

```json
{
"status": 403,
"message": "The authorized record is not allowed to perform this action.",
"data": {}
}
```

#### 404

```json
{
"status": 404,
"message": "The requested resource wasn't found.",
"data": {}
}
```

<div class="doc-fragment-separator" role="separator" aria-hidden="true"></div>

### Truncate collection

Deletes all the records of a single collection (including their related files and cascade delete enabled relations).

Only superusers can perform this action.

```js
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

await pb.collections.truncate('demo');
```

API details

`DELETE /api/collections/`collectionIdOrName`/truncate Requires `Authorization:TOKEN` Path parameters Param Type Description collectionIdOrName String ID or name of the collection to truncate. Responses`

### Response examples

#### 204

```text
null
```

#### 400

```json
{
"status": 400,
"message": "Failed to truncate collection (most likely due to required cascade delete record references).",
"data": {}
}
```

#### 401

```json
{
"status": 401,
"message": "The request requires valid record authorization token.",
"data": {}
}
```

#### 403

```json
{
"status": 403,
"message": "The authorized record is not allowed to perform this action.",
"data": {}
}
```

#### 404

```json
{
"status": 404,
"message": "The requested resource wasn't found.",
"data": {}
}
```

<div class="doc-fragment-separator" role="separator" aria-hidden="true"></div>

### Import collections

Bulk imports the provided *Collections* configuration.

Only superusers can perform this action.

```js
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

const importData = [
{
name: 'collection1',
schema: [
{
name: 'status',
type: 'bool',
},
],
},
{
name: 'collection2',
schema: [
{
name: 'title',
type: 'text',
},
],
},
];

await pb.collections.import(importData, false);
```

API details

`PUT /api/collections/import Requires `Authorization:TOKEN` Body Parameters Param Type Description Required collections Array List of collections to import (replace and create). Optional deleteMissing Boolean If *true* all existing collections and schema fields that are not present in the imported configuration **will be deleted**, including their related records data (default to *false*). Body parameters could be sent as *JSON* or *multipart/form-data*. Responses`

### Response examples

#### 204

```text
null
```

#### 400

```json
{
"status": 400,
"message": "An error occurred while submitting the form.",
"data": {
"collections": {
"code": "collections_import_failure",
"message": "Failed to import the collections configuration."
}
}
}
```

#### 401

```json
{
"status": 401,
"message": "The request requires valid record authorization token.",
"data": {}
}
```

#### 403

```json
{
"status": 403,
"message": "The authorized record is not allowed to perform this action.",
"data": {}
}
```

<div class="doc-fragment-separator" role="separator" aria-hidden="true"></div>

### Scaffolds

Returns an object with all of the collection types and their default fields *(used primarily in the Dashboard UI)*.

Only superusers can perform this action.

```js
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

const scaffolds = await pb.collections.getScaffolds();
```

API details

`GET /api/collections/meta/scaffolds Requires `Authorization:TOKEN` Responses`

### Response examples

#### 200

```json
{
"auth": {
"id": "",
"listRule": null,
"viewRule": null,
"createRule": null,
"updateRule": null,
"deleteRule": null,
"name": "",
"type": "auth",
"fields": [
{
"autogeneratePattern": "[a-z0-9]{15}",
"hidden": false,
"id": "text3208210256",
"max": 15,
"min": 15,
"name": "id",
"pattern": "^[a-z0-9]+$",
"presentable": false,
"primaryKey": true,
"required": true,
"system": true,
"type": "text"
},
{
"cost": 0,
"hidden": true,
"id": "password901924565",
"max": 0,
"min": 8,
"name": "password",
"pattern": "",
"presentable": false,
"required": true,
"system": true,
"type": "password"
},
{
"autogeneratePattern": "[a-zA-Z0-9]{50}",
"hidden": true,
"id": "text2504183744",
"max": 60,
"min": 30,
"name": "tokenKey",
"pattern": "",
"presentable": false,
"primaryKey": false,
"required": true,
"system": true,
"type": "text"
},
{
"exceptDomains": null,
"hidden": false,
"id": "email3885137012",
"name": "email",
"onlyDomains": null,
"presentable": false,
"required": true,
"system": true,
"type": "email"
},
{
"hidden": false,
"id": "bool1547992806",
"name": "emailVisibility",
"presentable": false,
"required": false,
"system": true,
"type": "bool"
},
{
"hidden": false,
"id": "bool256245529",
"name": "verified",
"presentable": false,
"required": false,
"system": true,
"type": "bool"
}
],
"indexes": [
"CREATE UNIQUE INDEX \
```

#### 401

```json
{
"status": 401,
"message": "The request requires valid record authorization token.",
"data": {}
}
```

#### 403

```json
{
"status": 403,
"message": "The authorized record is not allowed to perform this action.",
"data": {}
}
```

#### 404

```json
{
"status": 404,
"message": "The requested resource wasn't found.",
"data": {}
}
```
## API Settings

### List settings

Returns a list with all available application settings.

Secret/password fields are automatically redacted with ******** characters.

Only superusers can perform this action.

```js
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

const settings = await pb.settings.getAll();
```

API details

`GET /api/settings Requires `Authorization:TOKEN` Query parameters Param Type Description Responses`

### Response examples

#### 200

```json
{
"smtp": {
"enabled": false,
"port": 587,
"host": "smtp.example.com",
"username": "",
"authMethod": "",
"tls": true,
"localName": ""
},
"backups": {
"cron": "0 0 * * *",
"cronMaxKeep": 3,
"s3": {
"enabled": false,
"bucket": "",
"region": "",
"endpoint": "",
"accessKey": "",
"forcePathStyle": false
}
},
"s3": {
"enabled": false,
"bucket": "",
"region": "",
"endpoint": "",
"accessKey": "",
"forcePathStyle": false
},
"meta": {
"appName": "Acme",
"appURL": "https://example.com",
"senderName": "Support",
"senderAddress": "support@example.com",
"hideControls": false
},
"rateLimits": {
"rules": [
{
"label": "*:auth",
"audience": "",
"duration": 3,
"maxRequests": 2
},
{
"label": "*:create",
"audience": "",
"duration": 5,
"maxRequests": 20
},
{
"label": "/api/batch",
"audience": "",
"duration": 1,
"maxRequests": 3
},
{
"label": "/api/",
"audience": "",
"duration": 10,
"maxRequests": 300
}
],
"enabled": false
},
"trustedProxy": {
"headers": [],
"useLeftmostIP": false
},
"batch": {
"enabled": true,
"maxRequests": 50,
"timeout": 3,
"maxBodySize": 0
},
"logs": {
"maxDays": 7,
"minLevel": 0,
"logIP": true,
"logAuthId": false
}
}
```

#### 401

```json
{
"status": 401,
"message": "The request requires valid record authorization token.",
"data": {}
}
```

#### 403

```json
{
"status": 403,
"message": "The authorized record is not allowed to perform this action.",
"data": {}
}
```

<div class="doc-fragment-separator" role="separator" aria-hidden="true"></div>

### Update settings

Bulk updates application settings and returns the updated settings list.

Only superusers can perform this action.

```js
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

await pb.collection("_superusers").authWithPassword('test@example.com', '123456');

const settings = await pb.settings.update({
meta: {
appName: 'YOUR_APP',
appUrl: 'http://127.0.0.1:8090',
},
});
```

API details

`PATCH /api/settings Requires `Authorization:TOKEN` Body Parameters Param Type Description **meta** Application meta data (name, url, support email, etc.). ├─ Required *appName* String The app name. ├─ Required *appUrl* String The app public absolute url. ├─ Optional *hideControls* Boolean Hides the collection create and update controls from the Dashboard. Useful to prevent making accidental schema changes when in production environment. ├─ Required *senderName* String Transactional mails sender name. ├─ Required *senderAddress* String Transactional mails sender address. **logs** App logger settings. └─ Optional *maxDays* Number Max retention period. Set to *0* for no logs. └─ Optional *minLevel* Number Specifies the minimum log persistent level. The default log levels are: - -4: DEBUG - 0: INFO - 4: WARN - 8: ERROR └─ Optional *logIP* Boolean If enabled includes the client IP in the activity request logs. └─ Optional *logAuthId* Boolean If enabled includes the authenticated record id in the activity request logs. **backups** App data backups settings. ├─ Optional *cron* String Cron expression to schedule auto backups, e.g. `0 0 * * *`. ├─ Optional *cronMaxKeep* Number The max number of cron generated backups to keep before removing older entries. └─ Optional *s3* Object S3 configuration (the same fields as for the S3 file storage settings). **smtp** SMTP mail server settings. ├─ Optional *enabled* Boolean Enable the use of the SMTP mail server for sending emails. ├─ Required *host* String Mail server host (required if SMTP is enabled). ├─ Required *port* Number Mail server port (required if SMTP is enabled). ├─ Optional *username* String Mail server username. ├─ Optional *password* String Mail server password. ├─ Optional *tls* Boolean Whether to enforce TLS connection encryption. When *false* *StartTLS* command is send, leaving the server to decide whether to upgrade the connection or not). ├─ Optional *authMethod* String The SMTP AUTH method to use - *PLAIN* or *LOGIN* (used mainly by Microsoft). Default to *PLAIN* if empty. └─ Optional *localName* String Optional domain name or (IP address) to use for the initial EHLO/HELO exchange. If not explicitly set, `localhost` will be used. Note that some SMTP providers, such as Gmail SMTP-relay, requires a proper domain name and and will reject attempts to use localhost. **s3** S3 compatible file storage settings. ├─ Optional *enabled* Boolean Enable the use of a S3 compatible storage. ├─ Required *bucket* String S3 storage bucket (required if enabled). ├─ Required *region* String S3 storage region (required if enabled). ├─ Required *endpoint* String S3 storage public endpoint (required if enabled). ├─ Required *accessKey* String S3 storage access key (required if enabled). ├─ Required *secret* String S3 storage secret (required if enabled). └─ Optional *forcePathStyle* Boolean Forces the S3 request to use path-style addressing, e.g. "https://s3.amazonaws.com/BUCKET/KEY" instead of the default "https://BUCKET.s3.amazonaws.com/KEY". **batch** Batch logs settings. ├─ Optional *enabled* Boolean Enable the batch Web APIs. ├─ Required *maxRequests* Number The maximum allowed batch request to execute. ├─ Required *timeout* Number The max duration in seconds to wait before cancelling the batch transaction. └─ Optional *maxBodySize* Number The maximum allowed batch request body size in bytes. If not set, fallbacks to max ~128MB. **rateLimits** Rate limiter settings. ├─ Optional *enabled* Boolean Enable the builtin rate limiter. └─ Optional *rules* Array List of rate limit rules. Each rule have: - `label` - the identifier of the rule. It could be a tag, complete path or path prerefix (when ends with `/`). - `maxRequests` - the max allowed number of requests per duration. - `duration` - specifies the interval (in seconds) per which to reset the counted/accumulated rate limiter tokens.. **trustedProxy** Trusted proxy headers settings. ├─ Optional *headers* Array List of explicit trusted header(s) to check. └─ Optional *useLeftmostIP* Boolean Specifies to use the left-mostish IP from the trusted headers. Body parameters could be sent as *JSON* or *multipart/form-data*. Query parameters Param Type Description Responses`

### Response examples

#### 200

```json
{
"smtp": {
"enabled": false,
"port": 587,
"host": "smtp.example.com",
"username": "",
"authMethod": "",
"tls": true,
"localName": ""
},
"backups": {
"cron": "0 0 * * *",
"cronMaxKeep": 3,
"s3": {
"enabled": false,
"bucket": "",
"region": "",
"endpoint": "",
"accessKey": "",
"forcePathStyle": false
}
},
"s3": {
"enabled": false,
"bucket": "",
"region": "",
"endpoint": "",
"accessKey": "",
"forcePathStyle": false
},
"meta": {
"appName": "Acme",
"appURL": "https://example.com",
"senderName": "Support",
"senderAddress": "support@example.com",
"hideControls": false
},
"rateLimits": {
"rules": [
{
"label": "*:auth",
"audience": "",
"duration": 3,
"maxRequests": 2
},
{
"label": "*:create",
"audience": "",
"duration": 5,
"maxRequests": 20
},
{
"label": "/api/batch",
"audience": "",
"duration": 1,
"maxRequests": 3
},
{
"label": "/api/",
"audience": "",
"duration": 10,
"maxRequests": 300
}
],
"enabled": false
},
"trustedProxy": {
"headers": [],
"useLeftmostIP": false
},
"batch": {
"enabled": true,
"maxRequests": 50,
"timeout": 3,
"maxBodySize": 0
},
"logs": {
"maxDays": 7,
"minLevel": 0,
"logIP": true,
"logAuthId": false
}
}
```

#### 400

```json
{
"status": 400,
"message": "An error occurred while submitting the form.",
"data": {
"meta": {
"appName": {
"code": "validation_required",
"message": "Missing required value."
}
}
}
}
```

#### 401

```json
{
"status": 401,
"message": "The request requires valid record authorization token.",
"data": {}
}
```

#### 403

```json
{
"status": 403,
"message": "The authorized record is not allowed to perform this action.",
"data": {}
}
```

<div class="doc-fragment-separator" role="separator" aria-hidden="true"></div>

### Test S3 storage connection

Performs S3 storage connection test.

Only superusers can perform this action.

```js
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

await pb.settings.testS3("backups");
```

API details

`POST /api/settings/test/s3 Requires `Authorization:TOKEN` Body Parameters Param Type Description Required filesystem String The storage filesystem to test (`storage` or `backups`). Body parameters could be sent as *JSON* or *multipart/form-data*. Responses`

### Response examples

#### 204

```text
null
```

#### 400

```json
{
"status": 400,
"message": "Failed to initialize the S3 storage. Raw error:...",
"data": {}
}
```

#### 401

```json
{
"status": 401,
"message": "The request requires valid record authorization token.",
"data": {}
}
```

<div class="doc-fragment-separator" role="separator" aria-hidden="true"></div>

### Send test email

Sends a test user email.

Only superusers can perform this action.

```js
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

await pb.settings.testEmail("test@example.com", "verification");
```

API details

`POST /api/settings/test/email Requires `Authorization:TOKEN` Body Parameters Param Type Description Optional collection String The name or id of the auth collection. Fallbacks to *_superusers* if not set. Required email String The receiver of the test email. Required template String The test email template to send: `verification`, `password-reset` or `email-change`. Body parameters could be sent as *JSON* or *multipart/form-data*. Responses`

### Response examples

#### 204

```text
null
```

#### 400

```json
{
"status": 400,
"message": "Failed to send the test email.",
"data": {
"email": {
"code": "validation_required",
"message": "Missing required value."
}
}
}
```

#### 401

```json
{
"status": 401,
"message": "The request requires valid record authorization token.",
"data": {}
}
```

<div class="doc-fragment-separator" role="separator" aria-hidden="true"></div>

### Generate Apple client secret

Generates a new Apple OAuth2 client secret key.

Only superusers can perform this action.

```js
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

await pb.settings.generateAppleClientSecret(clientId, teamId, keyId, privateKey, duration)
```

API details

`POST /api/settings/apple/generate-client-secret Requires `Authorization:TOKEN` Body Parameters Param Type Description Required clientId String The identifier of your app (aka. Service ID). Required teamId String 10-character string associated with your developer account (usually could be found next to your name in the Apple Developer site). Required keyId String 10-character key identifier generated for the "Sign in with Apple" private key associated with your developer account. Required privateKey String PrivateKey is the private key associated to your app. Required duration Number Duration specifies how long the generated JWT token should be considered valid. The specified value must be in seconds and max 15777000 (~6months). Body parameters could be sent as *JSON* or *multipart/form-data*. Responses`

### Response examples

#### 200

```json
{
"secret": "..."
}
```

#### 400

```json
{
"status": 400,
"message": "Failed to generate client secret. Raw error:...",
"data": {}
}
```

#### 401

```json
{
"status": 401,
"message": "The request requires valid record authorization token.",
"data": {}
}
```
## API Logs

### List logs

Returns a paginated logs list.

Only superusers can perform this action.

```js
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

const pageResult = await pb.logs.getList(1, 20, {
filter: 'data.status >= 400'
});
```

API details

`GET /api/logs Requires `Authorization:TOKEN` Query parameters Param Type Description page Number The page (aka. offset) of the paginated list (*default to 1*). perPage Number The max returned logs per page (*default to 30*). sort String Specify the *ORDER BY* fields. Add `-` / `+` (default) in front of the attribute for DESC / ASC order, e.g.: `// DESC by the insertion rowid and ASC by level ?sort=-rowid,level` **Supported log sort fields:** `@random`, `rowid`, `id`, `created`, `updated`, `level`, `message` and any `data.*` attribute. filter String Filter expression to filter/search the returned logs list, e.g.: `?filter=(data.url~'test.com' && level>0)` **Supported log filter fields:** `id`, `created`, `updated`, `level`, `message` and any `data.*` attribute. Responses`

### Response examples

#### 200

```json
{
"page": 1,
"perPage": 20,
"totalItems": 2,
"items": [
{
"id": "ai5z3aoed6809au",
"created": "2024-10-27 09:28:19.524Z",
"data": {
"auth": "_superusers",
"execTime": 2.392327,
"method": "GET",
"referer": "http://localhost:8090/_/",
"remoteIP": "127.0.0.1",
"status": 200,
"type": "request",
"url": "/api/collections/_pbc_2287844090/records?page=1&perPage=1&filter=&fields=id",
"userAgent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
"userIP": "127.0.0.1"
},
"message": "GET /api/collections/_pbc_2287844090/records?page=1&perPage=1&filter=&fields=id",
"level": 0
},
{
"id": "26apis4s3sm9yqm",
"created": "2024-10-27 09:28:19.524Z",
"data": {
"auth": "_superusers",
"execTime": 2.392327,
"method": "GET",
"referer": "http://localhost:8090/_/",
"remoteIP": "127.0.0.1",
"status": 200,
"type": "request",
"url": "/api/collections/_pbc_2287844090/records?page=1&perPage=1&filter=&fields=id",
"userAgent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
"userIP": "127.0.0.1"
},
"message": "GET /api/collections/_pbc_2287844090/records?page=1&perPage=1&filter=&fields=id",
"level": 0
}
]
}
```

#### 400

```json
{
"status": 400,
"message": "Something went wrong while processing your request. Invalid filter.",
"data": {}
}
```

#### 401

```json
{
"status": 401,
"message": "The request requires valid record authorization token.",
"data": {}
}
```

#### 403

```json
{
"status": 403,
"message": "The authorized record is not allowed to perform this action.",
"data": {}
}
```

<div class="doc-fragment-separator" role="separator" aria-hidden="true"></div>

### View log

Returns a single log by its ID.

Only superusers can perform this action.

```js
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

await pb.collection("_superusers").authWithEmail('test@example.com', '123456');

const log = await pb.logs.getOne('LOG_ID');
```

API details

`GET /api/logs/`id` Requires `Authorization:TOKEN` Path parameters Param Type Description id String ID of the log to view. Query parameters Param Type Description Responses`

### Response examples

#### 200

```json
{
"id": "ai5z3aoed6809au",
"created": "2024-10-27 09:28:19.524Z",
"data": {
"auth": "_superusers",
"execTime": 2.392327,
"method": "GET",
"referer": "http://localhost:8090/_/",
"remoteIP": "127.0.0.1",
"status": 200,
"type": "request",
"url": "/api/collections/_pbc_2287844090/records?page=1&perPage=1&filter=&fields=id",
"userAgent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
"userIP": "127.0.0.1"
},
"message": "GET /api/collections/_pbc_2287844090/records?page=1&perPage=1&filter=&fields=id",
"level": 0
}
```

#### 401

```json
{
"status": 401,
"message": "The request requires valid record authorization token.",
"data": {}
}
```

#### 403

```json
{
"status": 403,
"message": "The authorized record is not allowed to perform this action.",
"data": {}
}
```

#### 404

```json
{
"status": 404,
"message": "The requested resource wasn't found.",
"data": {}
}
```

<div class="doc-fragment-separator" role="separator" aria-hidden="true"></div>

### Logs statistics

Returns hourly aggregated logs statistics.

Only superusers can perform this action.

```js
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

await pb.collection("_superusers").authWithPassword('test@example.com', '123456');

const stats = await pb.logs.getStats({
filter: 'data.status >= 400'
});
```

API details

`GET /api/logs/stats Requires `Authorization:TOKEN` Query parameters Param Type Description filter String Filter expression to filter/search the logs, e.g.: `?filter=(data.url~'test.com' && level>0)` **Supported log filter fields:** `rowid`, `id`, `created`, `updated`, `level`, `message` and any `data.*` attribute. Responses`

### Response examples

#### 200

```json
[
{
"total": 4,
"date": "2022-06-01 19:00:00.000"
},
{
"total": 1,
"date": "2022-06-02 12:00:00.000"
},
{
"total": 8,
"date": "2022-06-02 13:00:00.000"
}
]
```

#### 400

```json
{
"status": 400,
"message": "Something went wrong while processing your request. Invalid filter.",
"data": {}
}
```

#### 401

```json
{
"status": 401,
"message": "The request requires valid record authorization token.",
"data": {}
}
```

#### 403

```json
{
"status": 403,
"message": "The authorized record is not allowed to perform this action.",
"data": {}
}
```
## API Crons

### List cron jobs

Returns list with all registered app level cron jobs.

Only superusers can perform this action.

```js
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

const jobs = await pb.crons.getFullList();
```

API details

`GET /api/crons`

Query parameters

| Param | Type | Description |
| --- | --- | --- |
| fields | String | Comma separated string of the fields to return in the JSON response *(by default returns all fields)*. Ex.: `?fields=*,expand.relField.name``*` targets all keys from the specific depth level.In addition, the following field modifiers are also supported: - `:excerpt(maxLength, withEllipsis?)`Returns a short plain text version of the field string value.Ex.: `?fields=*,description:excerpt(200,true)` |

Responses

### Response examples

#### 200

```json
[
{
"id": "__pbDBOptimize__",
"expression": "0 0 * * *"
},
{
"id": "__pbMFACleanup__",
"expression": "0 * * * *"
},
{
"id": "__pbOTPCleanup__",
"expression": "0 * * * *"
},
{
"id": "__pbLogsCleanup__",
"expression": "0 */6 * * *"
}
]
```

#### 400

```json
{
"status": 400,
"message": "Failed to load backups filesystem.",
"data": {}
}
```

#### 401

```json
{
"status": 401,
"message": "The request requires valid record authorization token.",
"data": {}
}
```

#### 403

```json
{
"status": 403,
"message": "Only superusers can perform this action.",
"data": {}
}
```

<div class="doc-fragment-separator" role="separator" aria-hidden="true"></div>

### Run cron job

Triggers a single cron job by its id.

Only superusers can perform this action.

```js
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

await pb.crons.run('__pbLogsCleanup__');
```

API details

`POST /api/crons/`jobId` Requires `Authorization:TOKEN` Path parameters Param Type Description jobId String The identifier of the cron job to run. Responses`

### Response examples

#### 204

```text
null
```

#### 401

```json
{
"status": 401,
"message": "The request requires valid record authorization token.",
"data": {}
}
```

#### 403

```json
{
"status": 403,
"message": "The authorized record is not allowed to perform this action.",
"data": {}
}
```

#### 404

```json
{
"status": 404,
"message": "Missing or invalid cron job.",
"data": {}
}
```
## API Backups

### List backups

Returns list with all available backup files.

Only superusers can perform this action.

```js
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

const backups = await pb.backups.getFullList();
```

API details

`GET /api/backups`

Query parameters

| Param | Type | Description |
| --- | --- | --- |
| fields | String | Comma separated string of the fields to return in the JSON response *(by default returns all fields)*. Ex.: `?fields=*,expand.relField.name``*` targets all keys from the specific depth level.In addition, the following field modifiers are also supported: - `:excerpt(maxLength, withEllipsis?)`Returns a short plain text version of the field string value.Ex.: `?fields=*,description:excerpt(200,true)` |

Responses

### Response examples

#### 200

```json
[
{
"key": "pb_backup_20230519162514.zip",
"modified": "2023-05-19 16:25:57.542Z",
"size": 251316185
},
{
"key": "pb_backup_20230518162514.zip",
"modified": "2023-05-18 16:25:57.542Z",
"size": 251314010
}
]
```

#### 400

```json
{
"status": 400,
"message": "Failed to load backups filesystem.",
"data": {}
}
```

#### 401

```json
{
"status": 401,
"message": "The request requires valid record authorization token.",
"data": {}
}
```

#### 403

```json
{
"status": 403,
"message": "Only superusers can perform this action.",
"data": {}
}
```

<div class="doc-fragment-separator" role="separator" aria-hidden="true"></div>

### Create backup

Creates a new app data backup.

This action will return an error if there is another backup/restore operation already in progress.

Only superusers can perform this action.

```js
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

await pb.backups.create('new_backup.zip');
```

API details

`POST /api/backups Requires `Authorization:TOKEN` Body Parameters Param Type Description Optional name String The base name of the backup file to create. Must be in the format `[a-z0-9_-].zip` If not set, it will be auto generated. Body parameters could be sent as *JSON* or *multipart/form-data*. Responses`

### Response examples

#### 204

```text
null
```

#### 400

```json
{
"status": 400,
"message": "Try again later - another backup/restore process has already been started.",
"data": {}
}
```

#### 401

```json
{
"status": 401,
"message": "The request requires valid record authorization token.",
"data": {}
}
```

#### 403

```json
{
"status": 403,
"message": "The authorized record is not allowed to perform this action.",
"data": {}
}
```

<div class="doc-fragment-separator" role="separator" aria-hidden="true"></div>

### Upload backup

Uploads an existing backup zip file.

Only superusers can perform this action.

```js
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

await pb.backups.upload({ file: new Blob([...]) });
```

API details

`POST /api/backups/upload Requires `Authorization:TOKEN` Body Parameters Param Type Description Required file File The zip archive to upload. Uploading files is supported only via *multipart/form-data*. Responses`

### Response examples

#### 204

```text
null
```

#### 400

```json
{
"status": 400,
"message": "Something went wrong while processing your request.",
"data": {
"file": {
"code": "validation_invalid_mime_type",
"message": "\\\"test_backup.txt\\\" mime type must be one of: application/zip."
}
}
}
}
```

#### 401

```json
{
"status": 401,
"message": "The request requires valid record authorization token.",
"data": {}
}
```

#### 403

```json
{
"status": 403,
"message": "The authorized record is not allowed to perform this action.",
"data": {}
}
```

<div class="doc-fragment-separator" role="separator" aria-hidden="true"></div>

### Delete backup

Deletes a single backup by its name.

This action will return an error if the backup to delete is still being generated or part of a restore operation.

Only superusers can perform this action.

```js
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

await pb.backups.delete('pb_data_backup.zip');
```

API details

`DELETE /api/backups/`key` Requires `Authorization:TOKEN` Path parameters Param Type Description key String The key of the backup file to delete. Responses`

### Response examples

#### 204

```text
null
```

#### 400

```json
{
"status": 400,
"message": "Try again later - another backup/restore process has already been started.",
"data": {}
}
```

#### 401

```json
{
"status": 401,
"message": "The request requires valid record authorization token.",
"data": {}
}
```

#### 403

```json
{
"status": 403,
"message": "The authorized record is not allowed to perform this action.",
"data": {}
}
```

<div class="doc-fragment-separator" role="separator" aria-hidden="true"></div>

### Restore backup

Restore a single backup by its name and restarts the current running PocketBase process.

This action will return an error if there is another backup/restore operation already in progress.

Only superusers can perform this action.

```js
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

await pb.backups.restore('pb_data_backup.zip');
```

API details

`POST /api/backups/`key`/restore Requires `Authorization:TOKEN` Path parameters Param Type Description key String The key of the backup file to restore. Responses`

### Response examples

#### 204

```text
null
```

#### 400

```json
{
"status": 400,
"message": "Try again later - another backup/restore process has already been started.",
"data": {}
}
```

#### 401

```json
{
"status": 401,
"message": "The request requires valid record authorization token.",
"data": {}
}
```

#### 403

```json
{
"status": 403,
"message": "The authorized record is not allowed to perform this action.",
"data": {}
}
```

<div class="doc-fragment-separator" role="separator" aria-hidden="true"></div>

### Download backup

Downloads a single backup file.

Only superusers can perform this action.

```js
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

const token = await pb.files.getToken();

const url = pb.backups.getDownloadUrl(token, 'pb_data_backup.zip');
```

API details

**GET**

/api/backups/`key`

Path parameters

| Param | Type | Description |
| --- | --- | --- |
| key | String | The key of the backup file to download. |

Query parameters

| Param | Type | Description |
| --- | --- | --- |
| token | String | Superuser **file token** for granting access to the **backup file**. |

Responses

### Response examples

#### 200

```json
[file resource]
```

#### 400

```json
{
"status": 400,
"message": "Filesystem initialization failure.",
"data": {}
}
```

#### 404

```json
{
"status": 404,
"message": "The requested resource wasn't found.",
"data": {}
}
```
## API Health

### Health check

Returns the health status of the server.

API details

`GET/HEAD /api/health`

Query parameters

| Param | Type | Description |
| --- | --- | --- |
| fields | String | Comma separated string of the fields to return in the JSON response *(by default returns all fields)*. Ex.: `?fields=*,expand.relField.name``*` targets all keys from the specific depth level.In addition, the following field modifiers are also supported: - `:excerpt(maxLength, withEllipsis?)`Returns a short plain text version of the field string value.Ex.: `?fields=*,description:excerpt(200,true)` |

Responses

### Response examples

#### 200

```json
{
"status": 200,
"message": "API is healthy.",
"data": {
"canBackup": false
}
}
```

## Attribution

This page is adapted from [PocketBase docs](./introduction.md).
