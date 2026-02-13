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

Upstream source: [/docs/api-records](https://pocketbase.io/docs/api-records/)

### Source Fragment: `api-records/+page.svelte`

### CRUD actions

### Auth record actions

### Source Fragment: `api-records/List.svelte`

### List/Search records

Returns a paginated records list, supporting sorting and filtering.

Depending on the collection's `listRule` value, the access to this action may or may not
have been restricted.

*
You could find individual generated records API documentation in the "Dashboard > Collections
> API Preview".
*

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

```dart
import 'package:pocketbase/pocketbase.dart';

            final pb = PocketBase('http://127.0.0.1:8090');

            ...

            // fetch a paginated records list
            final resultList = await pb.collection('posts').getList(
              page: 1,
              perPage: 50,
              filter: 'created >= "2022-01-01 00:00:00" && someField1 != someField2',
            );

            // you can also fetch all records at once via getFullList
            final records = await pb.collection('posts').getFullList(sort: '-created');

            // or fetch only the first record that matches the specified filter
            final record = await pb.collection('posts').getFirstListItem(
              'someField="test"',
              expand: 'relField1,relField2.subRelField',
            );
```

API details

**GET**

/api/collections/`collectionIdOrName`/records

Path parameters

Param

Type

Description

collectionIdOrName

String

ID or name of the records' collection.

Query parameters

Param

Type

Description

page

Number

The page (aka. offset) of the paginated list (*default to 1*).

perPage

Number

The max returned records per page (*default to 30*).

sort

String

Specify the *ORDER BY* fields.

Add `-` / `+` (default) in front of the attribute for DESC /
ASC order, eg.:

```text
// DESC by created and ASC by id
                                ?sort=-created,id
```

**Supported record sort fields:**

`@random`, `@rowid`, `id`,
**and any other collection field**.

filter

String

Filter expression to filter/search the returned records list (in addition to the
collection's `listRule`), e.g.:

```text
?filter=(title~'abc' && created>'2022-01-01')
```

**Supported record filter fields:**

`id`, **+ any field from the collection schema**.

- `expand` query parameter

- `fields` query parameter

Responses

(responseTab = response.code)}
>

### Source Fragment: `api-records/View.svelte`

### View record

Returns a single collection record by its ID.

Depending on the collection's `viewRule` value, the access to this action may or may not
have been restricted.

*
You could find individual generated records API documentation in the "Dashboard > Collections
> API Preview".
*

```js
import PocketBase from 'pocketbase';

            const pb = new PocketBase('http://127.0.0.1:8090');

            ...

            const record1 = await pb.collection('posts').getOne('RECORD_ID', {
                expand: 'relField1,relField2.subRelField',
            });
```

```dart
import 'package:pocketbase/pocketbase.dart';

            final pb = PocketBase('http://127.0.0.1:8090');

            ...

            final record1 = await pb.collection('posts').getOne('RECORD_ID',
              expand: 'relField1,relField2.subRelField',
            );
```

API details

**GET**

/api/collections/`collectionIdOrName`/records/`recordId`

Path parameters

Param

Type

Description

collectionIdOrName

String

ID or name of the record's collection.

recordId

String

ID of the record to view.

Query parameters

Param

Type

Description

- `expand` query parameter

- `fields` query parameter

Responses

(responseTab = response.code)}
>

### Source Fragment: `api-records/Create.svelte`

### Create record

Creates a new collection *Record*.

Depending on the collection's `createRule` value, the access to this action may or may not
have been restricted.

* You could find individual generated records API documentation from the Dashboard. *

```js
import PocketBase from 'pocketbase';

            const pb = new PocketBase('http://127.0.0.1:8090');

            ...

            const record = await pb.collection('demo').create({
                title: 'Lorem ipsum',
            });
```

```dart
import 'package:pocketbase/pocketbase.dart';

            final pb = PocketBase('http://127.0.0.1:8090');

            ...

            final record = await pb.collection('demo').create(body: {
                'title': 'Lorem ipsum',
            });
```

API details

**POST**

/api/collections/`collectionIdOrName`/records

Path parameters

Param

Type

Description

collectionIdOrName

String

ID or name of the record's collection.

Body Parameters

Param

Type

Description

Optional

id

String

**15 characters string** to store as record ID.

If not set, it will be auto generated.

Schema fields

**Any field from the collection's schema.**

Additional auth record fields

Required

password

String

Auth record password.

Required

passwordConfirm

String

Auth record password confirmation.

Body parameters could be sent as *JSON* or
*multipart/form-data*.

File upload is supported only through *multipart/form-data*.

Query parameters

Param

Type

Description

- `expand` query parameter

- `fields` query parameter

Responses

(responseTab = response.code)}
>

### Source Fragment: `api-records/Update.svelte`

### Update record

Updates an existing collection *Record*.

Depending on the collection's `updateRule` value, the access to this action may or may not
have been restricted.

*You could find individual generated records API documentation from the Dashboard.*

```js
import PocketBase from 'pocketbase';

            const pb = new PocketBase('http://127.0.0.1:8090');

            ...

            const record = await pb.collection('demo').update('YOUR_RECORD_ID', {
                title: 'Lorem ipsum',
            });
```

```dart
import 'package:pocketbase/pocketbase.dart';

            final pb = PocketBase('http://127.0.0.1:8090');

            ...

            final record = await pb.collection('demo').update('YOUR_RECORD_ID', body: {
                'title': 'Lorem ipsum',
            });
```

API details

**PATCH**

/api/collections/`collectionIdOrName`/records/`recordId`

Path parameters

Param

Type

Description

collectionIdOrName

String

ID or name of the record's collection.

recordId

String

ID of the record to update.

Body Parameters

Param

Type

Description

Schema fields

**Any field from the collection's schema.**

Additional auth record fields

Optional

oldPassword

String

Old auth record password.

This field is required only when changing the record password. Superusers and auth records
with "Manage" access can skip this field.

Optional

password

String

New auth record password.

Optional

passwordConfirm

String

New auth record password confirmation.

Body parameters could be sent as *JSON* or
*multipart/form-data*.

File upload is supported only through *multipart/form-data*.

Query parameters

Param

Type

Description

- `expand` query parameter

- `fields` query parameter

Responses

(responseTab = response.code)}
>

### Source Fragment: `api-records/Delete.svelte`

### Delete record

Deletes a single collection *Record* by its ID.

Depending on the collection's `deleteRule` value, the access to this action may or may not
have been restricted.

* You could find individual generated records API documentation from the Dashboard. *

```js
import PocketBase from 'pocketbase';

            const pb = new PocketBase('http://127.0.0.1:8090');

            ...

            await pb.collection('demo').delete('YOUR_RECORD_ID');
```

```dart
import 'package:pocketbase/pocketbase.dart';

            final pb = PocketBase('http://127.0.0.1:8090');

            ...

            await pb.collection('demo').delete('YOUR_RECORD_ID');
```

API details

**DELETE**

/api/collections/`collectionIdOrName`/records/`recordId`

Path parameters

Param

Type

Description

collectionIdOrName

String

ID or name of the record's collection.

recordId

String

ID of the record to delete.

Responses

(responseTab = response.code)}
>

### Source Fragment: `api-records/Batch.svelte`

### Batch create/update/upsert/delete records

Batch and transactional create/update/upsert/delete of multiple records in a single request.

The batch Web API need to be explicitly enabled and configured from the
*Dashboard > Settings > Application*.

Because this endpoint processes the requests in a single read&write transaction, other queries
may queue up and it could degrade the performance of your application if not used with proper
care and configuration
*
(some recommendations: prefer using the smallest possible max processing time and body
size limits; avoid large file uploads over slow S3 networks and custom hooks that
communicate with slow external APIs)
.

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

```dart
import 'package:pocketbase/pocketbase.dart';

            final pb = PocketBase('http://127.0.0.1:8090');

            ...

            final batch = pb.createBatch();

            batch.collection('example1').create(body: { ... });
            batch.collection('example2').update('RECORD_ID', body: { ... });
            batch.collection('example3').delete('RECORD_ID');
            batch.collection('example4').upsert(body: { ... });

            final result = await batch.send();
```

API details

**POST**

/api/batch

Body Parameters

Body parameters could be sent as *application/json* or *multipart/form-data*.

File upload is supported only via *multipart/form-data* (see below for more details).

Param

Description

Required

requests

Array

- List of the requests to process.

The supported batch request actions are:

- record create - `POST /api/collections//records`

-
record update -
`PATCH /api/collections//records/`

-
record upsert - `PUT /api/collections//records`

(the body must have `id` field)

-
record delete -
`DELETE /api/collections//records/`

Each batch Request element have the following properties:

- `url path` *(could include query parameters)*

- `method` *(GET, POST, PUT, PATCH, DELETE)*

-
`headers`

*
(custom per-request `Authorization` header is not supported at the moment,
aka. all batch requests have the same auth state)
*

- `body`

**NB!** When the batch request is send as
`multipart/form-data`, the regular batch action fields are expected to be
submitted as serialized json under the `@jsonPayload` field and file keys
need to follow the pattern `requests.N.fileField` or
`requests[N].fileField`
*
(this is usually handled transparently by the SDKs when their specific object
notation is used)
*.

If you don't use the SDKs or prefer manually to construct the `FormData`
body, then it could look something like:

```javascript
const formData = new FormData();

                                formData.append("@jsonPayload", JSON.stringify({
                                    requests: [
                                        {
                                            method: "POST",
                                            url: "/api/collections/example/records?expand=user",
                                            body: { title: "test1" },
                                        },
                                        {
                                            method: "PATCH",
                                            url: "/api/collections/example/records/RECORD_ID",
                                            body: { title: "test2" },
                                        },
                                        {
                                            method: "DELETE",
                                            url: "/api/collections/example/records/RECORD_ID",
                                        },
                                    ]
                                }))

                                // file for the first request
                                formData.append("requests.0.document", new File(...))

                                // file for the second request
                                formData.append("requests.1.document", new File(...))
```

Responses

(responseTab = response.code)}
>

### Source Fragment: `api-records/AuthMethods.svelte`

### List auth methods

Returns a public list with the allowed collection authentication methods.

```js
import PocketBase from 'pocketbase';

            const pb = new PocketBase('http://127.0.0.1:8090');

            ...

            const result = await pb.collection('users').listAuthMethods();
```

```dart
import 'package:pocketbase/pocketbase.dart';

            final pb = PocketBase('http://127.0.0.1:8090');

            ...

            final result = await pb.collection('users').listAuthMethods();
```

API details

**GET**

/api/collections/`collectionIdOrName`/auth-methods

Path parameters

Param

Type

Description

collectionIdOrName

String

ID or name of the auth collection.

Query parameters

Param

Type

Description

- `fields` query parameter

Responses

(responseTab = response.code)}
>

### Source Fragment: `api-records/AuthWithPassword.svelte`

### Auth with password

Authenticate a single auth record by combination of a password and a unique identity field (e.g.
email).

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

```dart
import 'package:pocketbase/pocketbase.dart';

            final pb = PocketBase('http://127.0.0.1:8090');

            ...

            final authData = await pb.collection('users').authWithPassword(
              'YOUR_USERNAME_OR_EMAIL',
              'YOUR_PASSWORD',
            );

            // after the above you can also access the auth data from the authStore
            print(pb.authStore.isValid);
            print(pb.authStore.token);
            print(pb.authStore.record.id);

            // "logout" the last authenticated record
            pb.authStore.clear();
```

API details

**POST**

/api/collections/`collectionIdOrName`/auth-with-password

Path parameters

Param

Type

Description

collectionIdOrName

String

ID or name of the auth collection.

Body Parameters

Param

Type

Description

Required

identity

String

Auth record username or email address.

Required

password

String

Auth record password.

Optional

identityField

String

A specific identity field to use (by default fallbacks to the first matching one).

Body parameters could be sent as *JSON* or
*multipart/form-data*.

Query parameters

Param

Type

Description

- `expand` query parameter

- `fields` query parameter

Responses

(responseTab = response.code)}
>

### Source Fragment: `api-records/AuthWithOAuth2.svelte`

### Auth with OAuth2

Authenticate with an OAuth2 provider and returns a new auth token and record data.

This action usually should be called right after the provider login page redirect.

You could also check the

OAuth2 web integration example
.

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

```dart
import 'package:pocketbase/pocketbase.dart';

            final pb = PocketBase('http://127.0.0.1:8090');

            ...

            final authData = await pb.collection('users').authWithOAuth2Code(
              'google',
              'CODE',
              'VERIFIER',
              'REDIRECT_URL',
              // optional data that will be used for the new account on OAuth2 sign-up
              createData: {
                'name': 'test',
              },
            );

            // after the above you can also access the auth data from the authStore
            print(pb.authStore.isValid);
            print(pb.authStore.token);
            print(pb.authStore.record.id);

            // "logout" the last authenticated record
            pb.authStore.clear();
```

API details

**POST**

/api/collections/`collectionIdOrName`/auth-with-oauth2

Path parameters

Param

Type

Description

collectionIdOrName

String

ID or name of the auth collection.

Body Parameters

Param

Type

Description

Required

provider

String

The name of the OAuth2 client provider (e.g. "google").

Required

code

String

The authorization code returned from the initial request.

Required

codeVerifier

String

The code verifier sent with the initial request as part of the code_challenge.

Required

redirectUrl

String

The redirect url sent with the initial request.

Optional

createData

Object

Optional data that will be used when creating the auth record on OAuth2 sign-up.

The created auth record must comply with the same requirements and validations in the
regular **create** action.

*
The data can only be in `json`, aka. `multipart/form-data` and
files upload currently are not supported during OAuth2 sign-ups.
*

Body parameters could be sent as *JSON* or
*multipart/form-data*.

Query parameters

Param

Type

Description

- `expand` query parameter

- `fields` query parameter

Responses

(responseTab = response.code)}
>

### Source Fragment: `api-records/AuthWithOTP.svelte`

### Auth with OTP

Authenticate a single auth record with an one-time password (OTP).

Note that when requesting an OTP we return an `otpId` even if a user with the provided email
doesn't exist as a very basic enumeration protection.

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

```dart
import 'package:pocketbase/pocketbase.dart';

            final pb = PocketBase('http://127.0.0.1:8090');

            ...

            // send OTP email to the provided auth record
            final req = await pb.collection('users').requestOTP('test@example.com');

            // ... show a screen/popup to enter the password from the email ...

            // authenticate with the requested OTP id and the email password
            final authData = await pb.collection('users').authWithOTP(req.otpId, "YOUR_OTP");

            // after the above you can also access the auth data from the authStore
            print(pb.authStore.isValid);
            print(pb.authStore.token);
            print(pb.authStore.record.id);

            // "logout"
            pb.authStore.clear();
```

API details

(activeApiTab = i)}>

### Source Fragment: `api-records/AuthWithOTPRequestApi.svelte`

**POST**

/api/collections/`collectionIdOrName`/request-otp

Path parameters

Param

Type

Description

collectionIdOrName

String

ID or name of the auth collection.

Body Parameters

Param

Type

Description

Required

email

String

The auth record email address to send the OTP request (if exists).

Responses

(responseTab = response.code)}
>

### Source Fragment: `api-records/AuthWithOTPAuthApi.svelte`

**POST**

/api/collections/`collectionIdOrName`/auth-with-otp

Path parameters

Param

Type

Description

collectionIdOrName

String

ID or name of the auth collection.

Body Parameters

Param

Type

Description

Required

otpId

String

The id of the OTP request.

Required

password

String

The one-time password.

Query parameters

Param

Type

Description

- `expand` query parameter

- `fields` query parameter

Responses

(responseTab = response.code)}
>

### Source Fragment: `api-records/AuthRefresh.svelte`

### Auth refresh

Returns a new auth response (token and user data) for already authenticated auth record.

*
This method is usually called by users on page/screen reload to ensure that the previously
stored data in `pb.authStore` is still valid and up-to-date.
*

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

```dart
import 'package:pocketbase/pocketbase.dart';

            final pb = PocketBase('http://127.0.0.1:8090');

            ...

            final authData = await pb.collection('users').authRefresh();

            // after the above you can also access the refreshed auth data from the authStore
            print(pb.authStore.isValid);
            print(pb.authStore.token);
            print(pb.authStore.record.id);
```

API details

**POST**

/api/collections/`collectionIdOrName`/auth-refresh

Requires `Authorization:TOKEN`

Path parameters

Param

Type

Description

collectionIdOrName

String

ID or name of the auth collection.

Query parameters

Param

Type

Description

- `expand` query parameter

- `fields` query parameter

Responses

(responseTab = response.code)}
>

### Source Fragment: `api-records/Verification.svelte`

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

```dart
import 'package:pocketbase/pocketbase.dart';

            final pb = PocketBase('http://127.0.0.1:8090');

            ...

            await pb.collection('users').requestVerification('test@example.com');

            // ---
            // (optional) in your custom confirmation page:
            // ---

            await pb.collection('users').confirmVerification('VERIFICATION_TOKEN');
```

API details

(activeApiTab = i)}>

### Source Fragment: `api-records/VerificationRequestApi.svelte`

**POST**

/api/collections/`collectionIdOrName`/request-verification

Body Parameters

Param

Type

Description

Required

email

String

The auth record email address to send the verification request (if exists).

Responses

(responseTab = response.code)}
>

### Source Fragment: `api-records/VerificationConfirmApi.svelte`

**POST**

/api/collections/`collectionIdOrName`/confirm-verification

Body Parameters

Param

Type

Description

Required

token

String

The token from the verification request email.

Responses

(responseTab = response.code)}
>

### Source Fragment: `api-records/PasswordReset.svelte`

### Password reset

Sends auth record password reset email request.

On successful password reset all previously issued auth tokens for the specific record will be
automatically invalidated.

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

```dart
import 'package:pocketbase/pocketbase.dart';

            final pb = PocketBase('http://127.0.0.1:8090');

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

(activeApiTab = i)}>

### Source Fragment: `api-records/PasswordResetRequestApi.svelte`

**POST**

/api/collections/`collectionIdOrName`/request-password-reset

Body Parameters

Param

Type

Description

Required

email

String

The auth record email address to send the password reset request (if exists).

Responses

(responseTab = response.code)}
>

### Source Fragment: `api-records/PasswordResetConfirmApi.svelte`

**POST**

/api/collections/`collectionIdOrName`/confirm-password-reset

Body Parameters

Param

Type

Description

Required

token

String

The token from the password reset request email.

Required

password

String

The new password to set.

Required

passwordConfirm

String

The new password confirmation.

Responses

(responseTab = response.code)}
>

### Source Fragment: `api-records/EmailChange.svelte`

### Email change

Sends auth record email change request.

On successful email change all previously issued auth tokens for the specific record will be
automatically invalidated.

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

```dart
import 'package:pocketbase/pocketbase.dart';

            final pb = PocketBase('http://127.0.0.1:8090');

            ...

            await pb.collection('users').authWithPassword('test@example.com', '1234567890');

            await pb.collection('users').requestEmailChange('new@example.com');

            ...

            // ---
            // (optional) in your custom confirmation page:
            // ---

            // note: after this call all previously issued auth tokens are invalidated
            await pb.collection('users').confirmEmailChange('EMAIL_CHANGE_TOKEN', 'YOUR_PASSWORD');
```

API details

(activeApiTab = i)}>

### Source Fragment: `api-records/EmailChangeRequestApi.svelte`

**POST**

/api/collections/`collectionIdOrName`/request-email-change

Requires `Authorization:TOKEN`

Body Parameters

Param

Type

Description

Required

newEmail

String

The new email address to send the change email request.

Responses

(responseTab = response.code)}
>

### Source Fragment: `api-records/EmailChangeConfirmApi.svelte`

**POST**

/api/collections/`collectionIdOrName`/confirm-email-change

Body Parameters

Param

Type

Description

Required

token

String

The token from the change email request email.

Required

password

String

The account password to confirm the email change.

Responses

(responseTab = response.code)}
>

### Source Fragment: `api-records/Impersonate.svelte`

### Impersonate

Impersonate allows you to authenticate as a different user by generating a
**nonrefreshable** auth token.

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

```dart
import 'package:pocketbase/pocketbase.dart';

            final pb = PocketBase('http://127.0.0.1:8090');

            ...

            // authenticate as superuser
            await pb.collection("_superusers").authWithPassword("test@example.com", "1234567890");

            // impersonate
            // (the custom token duration is optional and must be in seconds)
            final impersonateClient = pb.collection("users").impersonate("USER_RECORD_ID", 3600)

            // log the impersonate token and user data
            print(impersonateClient.authStore.token);
            print(impersonateClient.authStore.record);

            // send requests as the impersonated user
            impersonateClient.collection("example").getFullList();
```

API details

**POST**

/api/collections/`collectionIdOrName`/impersonate/`id`

Requires `Authorization:TOKEN`

Path parameters

Param

Type

Description

collectionIdOrName

String

ID or name of the auth collection.

id

String

ID of the auth record to impersonate.

Body Parameters

Param

Type

Description

Optional

duration

Number

Optional custom JWT duration for the `exp` claim (in seconds).

If not set or 0, it fallbacks to the default collection auth token duration option.

Body parameters could be sent as *JSON* or
*multipart/form-data*.

Query parameters

Param

Type

Description

- `expand` query parameter

- `fields` query parameter

Responses

(responseTab = response.code)}
>
## API Realtime

Upstream source: [/docs/api-realtime](https://pocketbase.io/docs/api-realtime/)

The Realtime API is implemented via Server-Sent Events (SSE). Generally, it consists of 2 operations:

- establish SSE connection

- submit client subscriptions

SSE events are sent for **create**, **update**
and **delete** record operations.

**You could subscribe to a single record or to an entire collection.**

When you subscribe to a **single record**, the collection's
**ViewRule** will be used to determine whether the subscriber has access to receive the
event message.

When you subscribe to an **entire collection**, the collection's
**ListRule** will be used to determine whether the subscriber has access to receive the
event message.

### Connect

**GET**

/api/realtime

Establishes a new SSE connection and immediately sends a `PB_CONNECT` SSE event with the
created client ID.

**NB!** The user/superuser authorization happens during the first

Set subscriptions

call.

If the connected client doesn't receive any new messages for 5 minutes, the server will send a
disconnect signal (this is to prevent forgotten/leaked connections). The connection will be
automatically reestablished if the client is still active (e.g. the browser tab is still open).

### Set subscriptions

**POST**

/api/realtime

Sets new active client's subscriptions (and auto unsubscribes from the previous ones).

If `Authorization` header is set, will authorize the client SSE connection with the
associated user or superuser.

Body Parameters

Param

Type

Description

Required

clientId

String

ID of the SSE client connection.

Optional

subscriptions

Array

The new client subscriptions to set in the format:

`COLLECTION_ID_OR_NAME/*` or
`COLLECTION_ID_OR_NAME/RECORD_ID`.

You can also attach optional query and header parameters as serialized json to a
single topic using the `options`
query parameter, e.g.:

```text
COLLECTION_ID_OR_NAME/RECORD_ID?options={"query": {"abc": "123"}, "headers": {"x-token": "..."}}
```

Leave empty to unsubscribe from everything.

Body parameters could be sent as *JSON* or
*multipart/form-data*.

Responses

(responseTab = response.code)}
>

All of this is seamlessly handled by the SDKs using just the `subscribe` and
`unsubscribe` methods:

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

```dart
import 'package:pocketbase/pocketbase.dart';

        final pb = PocketBase('http://127.0.0.1:8090');

        ...

        // (Optionally) authenticate
        await pb.collection('users').authWithPassword('test@example.com', '1234567890');

        // Subscribe to changes in any record in the collection
        pb.collection('example').subscribe('*', (e) {
            print(e.action);
            print(e.record);
        }, /* other options like expand, custom headers, etc. */);

        // Subscribe to changes only in the specified record
        pb.collection('example').subscribe('RECORD_ID', (e) {
            print(e.action);
            print(e.record);
        }, /* other options like expand, custom headers, etc. */);

        // Unsubscribe
        pb.collection('example').unsubscribe('RECORD_ID'); // remove all 'RECORD_ID' subscriptions
        pb.collection('example').unsubscribe('*'); // remove all '*' topic subscriptions
        pb.collection('example').unsubscribe(); // remove all subscriptions in the collection
```
## API Files

Upstream source: [/docs/api-files](https://pocketbase.io/docs/api-files/)

### Source Fragment: `api-files/+page.svelte`

Files are uploaded, updated or deleted via the

Records API
.

The File API is usually used to fetch/download a file resource (with support for basic image
manipulations, like generating thumbs).

### Source Fragment: `api-files/Download.svelte`

### Download / Fetch file

Downloads a single file resource (aka. the URL address to the file). Example:

`}
/>

API details

**GET**

/api/files/`collectionIdOrName`/`recordId`/`filename`

Path parameters

Param

Type

Description

collectionIdOrName

String

ID or name of the collection whose record model contains the file resource.

recordId

String

ID of the record model that contains the file resource.

filename

String

Name of the file resource.

Query parameters

Param

Type

Description

thumb

String

Get the thumb of the requested file.

Supported thumb formats are based on file field options.

If the thumb size is not defined in the file schema field options or the file resource is not
an image (jpg, png, gif, webp), then the original file resource is returned unmodified.

token

String

Optional **file token** for granting access to
**protected file(s)**.

For an example, you can check

"Files upload and handling"
.

download

Boolean

If it is set to a truthy value (*1*, *t*, *true*) the file will be
served with `Content-Disposition: attachment` header instructing the browser to
ignore the file preview for pdf, images, videos, etc. and to directly download the file.

Responses

(responseTab = response.code)}
>

### Source Fragment: `api-files/Token.svelte`

### Generate protected file token

Generates a **short-lived file token** for accessing
**protected file(s)**.

The client must be superuser or auth record authenticated (aka. have regular authorization token
sent with the request).

API details

**POST**

/api/files/token

Requires `Authorization:TOKEN`

Responses

(responseTab = response.code)}
>
## API Collections

Upstream source: [/docs/api-collections](https://pocketbase.io/docs/api-collections/)

### Source Fragment: `api-collections/List.svelte`

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

```dart
import 'package:pocketbase/pocketbase.dart';

            final pb = PocketBase('http://127.0.0.1:8090');

            ...

            await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

            // fetch a paginated collections list
            final pageResult = await pb.collections.getList(
                page: 1,
                perPage: 100,
                filter: 'created >= "2022-01-01 00:00:00"',
            );

            // you can also fetch all collections at once via getFullList
            final collections = await pb.collections.getFullList(sort: '-created');

            // or fetch only the first collection that matches the specified filter
            final collection = await pb.collections.getFirstListItem('type="auth"');
```

API details

**GET**

/api/collections

Requires `Authorization:TOKEN`

Query parameters

Param

Type

Description

page

Number

The page (aka. offset) of the paginated list (*default to 1*).

perPage

Number

The max returned collections per page (*default to 30*).

sort

String

Specify the *ORDER BY* fields.

Add `-` / `+` (default) in front of the attribute for DESC /
ASC order, e.g.:

```text
// DESC by created and ASC by id
                                ?sort=-created,id
```

**Supported collection sort fields:**

`@random`, `id`, `created`,
`updated`, `name`, `type`,
`system`

filter

String

Filter expression to filter/search the returned collections list, e.g.:

```text
?filter=(name~'abc' && created>'2022-01-01')
```

**Supported collection filter fields:**

`id`, `created`, `updated`,
`name`, `type`, `system`

- `fields` query parameter

Responses

(responseTab = response.code)}
>

### Source Fragment: `api-collections/View.svelte`

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

```dart
import 'package:pocketbase/pocketbase.dart';

            final pb = PocketBase('http://127.0.0.1:8090');

            ...

            await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

            final collection = await pb.collections.getOne('demo');
```

API details

**GET**

/api/collections/`collectionIdOrName`

Requires `Authorization:TOKEN`

Path parameters

Param

Type

Description

collectionIdOrName

String

ID or name of the collection to view.

Query parameters

Param

Type

Description

- `fields` query parameter

Responses

(responseTab = response.code)}
>

### Source Fragment: `api-collections/Create.svelte`

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

```dart
import 'package:pocketbase/pocketbase.dart';

            final pb = PocketBase('http://127.0.0.1:8090');

            ...

            await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

            // create base collection
            final base = await pb.collections.create(body: {
                'name': 'exampleBase',
                'type': 'base',
                'fields': [
                    {
                        'name': 'title',
                        'type': 'text',
                        'required': true,
                        'min': 10,
                    },
                    {
                        'name': 'status',
                        'type': 'bool',
                    },
                ],
            });

            // create auth collection
            final auth = await pb.collections.create(body: {
                'name': 'exampleAuth',
                'type': 'auth',
                'createRule': 'id = @request.auth.id',
                'updateRule': 'id = @request.auth.id',
                'deleteRule': 'id = @request.auth.id',
                'fields': [
                    {
                        'name': 'name',
                        'type': 'text',
                    }
                ],
                'passwordAuth': {
                    'enabled': true,
                    'identityFields': ['email']
                },
            });

            // create view collection
            final view = await pb.collections.create(body: {
                'name': 'exampleView',
                'type': 'view',
                'listRule': '@request.auth.id != ""',
                'viewRule': null,
                // the schema will be autogenerated from the below query
                'viewQuery': 'SELECT id, name from posts',
            });
```

API details

**POST**

/api/collections

Requires `Authorization:TOKEN`

Body Parameters

Body parameters could be sent as *JSON* or *multipart/form-data*.

```text
{
            // 15 characters string to store as collection ID.
            // If not set, it will be auto generated.
            id (optional): string

            // Unique collection name (used as a table name for the records table).
            name (required):  string

            // Type of the collection.
            // If not set, the collection type will be "base" by default.
            type (optional): "base" | "view" | "auth"

            // List with the collection fields.
            // This field is optional and autopopulated for "view" collections based on the viewQuery.
            fields (required|optional): Array<Field>

            // The collection indexes and unique constraints.
            // Note that "view" collections don't support indexes.
            indexes (optional): Array<string>

            // Marks the collection as "system" to prevent being renamed, deleted or modify its API rules.
            system (optional): boolean

            // CRUD API rules
            listRule (optional):   null|string
            viewRule (optional):   null|string
            createRule (optional): null|string
            updateRule (optional): null|string
            deleteRule (optional): null|string

            // -------------------------------------------------------
            // view options
            // -------------------------------------------------------

            viewQuery (required):  string

            // -------------------------------------------------------
            // auth options
            // -------------------------------------------------------

            // API rule that gives admin-like permissions to allow fully managing the auth record(s),
            // e.g. changing the password without requiring to enter the old one, directly updating the
            // verified state or email, etc. This rule is executed in addition to the createRule and updateRule.
            manageRule (optional): null|string

            // API rule that could be used to specify additional record constraints applied after record
            // authentication and right before returning the auth token response to the client.
            //
            // For example, to allow only verified users you could set it to "verified = true".
            //
            // Set it to empty string to allow any Auth collection record to authenticate.
            //
            // Set it to null to disallow authentication altogether for the collection.
            authRule (optional): null|string

            // AuthAlert defines options related to the auth alerts on new device login.
            authAlert (optional): {
                enabled (optional): boolean
                emailTemplate (optional): {
                    subject (required): string
                    body (required):    string
                }
            }

            // OAuth2 specifies whether OAuth2 auth is enabled for the collection
            // and which OAuth2 providers are allowed.
            oauth2 (optional): {
                enabled (optional): boolean
                mappedFields (optional): {
                    id (optional):        string
                    name (optional):      string
                    username (optional):  string
                    avatarURL (optional): string
                }
                providers (optional): [
                    {
                        name (required):         string
                        clientId (required):     string
                        clientSecret (required): string
                        authURL (optional):      string
                        tokenURL (optional):     string
                        userInfoURL (optional):  string
                        displayName (optional):  string
                        pkce (optional):         null|boolean
                        extra (optional):        null|Object<string,any>
                    }
                ]
            }

            // PasswordAuth defines options related to the collection password authentication.
            passwordAuth (optional): {
                enabled (optional):        boolean
                identityFields (required): Array<string>
            }

            // MFA defines options related to the Multi-factor authentication (MFA).
            mfa (optional):{
                enabled (optional):  boolean
                duration (required): number
                rule (optional):     string
            }

            // OTP defines options related to the One-time password authentication (OTP).
            otp (optional): {
                enabled (optional):  boolean
                duration (required): number
                length (required):   number
                emailTemplate (optional): {
                    subject (required): string
                    body (required):    string
                }
            }

            // Token configurations.
            authToken (optional): {
                duration (required): number
                secret (required):   string
            }
            passwordResetToken (optional): {
                duration (required): number
                secret (required):   string
            }
            emailChangeToken (optional): {
                duration (required): number
                secret (required):   string
            }
            verificationToken (optional): {
                duration (required): number
                secret (required):   string
            }
            fileToken (optional): {
                duration (required): number
                secret (required):   string
            }

            // Default email templates.
            verificationTemplate (optional): {
                subject (required): string
                body (required):    string
            }
            resetPasswordTemplate (optional): {
                subject (required): string
                body (required):    string
            }
            confirmEmailChangeTemplate (optional): {
                subject (required): string
                body (required):    string
            }
        }
```

Query parameters

Param

Type

Description

- `fields` query parameter

Responses

(responseTab = response.code)}
>

### Source Fragment: `api-collections/Update.svelte`

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

```dart
import 'package:pocketbase/pocketbase.dart';

            final pb = PocketBase('http://127.0.0.1:8090');

            ...

            await pb.collection("_superusers").authWithPassword('test@example.com', '123456');

            final collection = await pb.collections.update('demo', body: {
                'name': 'new_demo',
                'listRule': 'created > "2022-01-01 00:00:00"',
            });
```

API details

**PATCH**

/api/collections/`collectionIdOrName`

Requires `Authorization:TOKEN`

Path parameters

Param

Type

Description

collectionIdOrName

String

ID or name of the collection to view.

Body Parameters

Body parameters could be sent as *JSON* or *multipart/form-data*.

```text
{
            // Unique collection name (used as a table name for the records table).
            name (required):  string

            // List with the collection fields.
            // This field is optional and autopopulated for "view" collections based on the viewQuery.
            fields (required|optional): Array<Field>

            // The collection indexes and unique constriants.
            // Note that "view" collections don't support indexes.
            indexes (optional): Array<string>

            // Marks the collection as "system" to prevent being renamed, deleted or modify its API rules.
            system (optional): boolean

            // CRUD API rules
            listRule (optional):   null|string
            viewRule (optional):   null|string
            createRule (optional): null|string
            updateRule (optional): null|string
            deleteRule (optional): null|string

            // -------------------------------------------------------
            // view options
            // -------------------------------------------------------

            viewQuery (required):  string

            // -------------------------------------------------------
            // auth options
            // -------------------------------------------------------

            // API rule that gives admin-like permissions to allow fully managing the auth record(s),
            // e.g. changing the password without requiring to enter the old one, directly updating the
            // verified state or email, etc. This rule is executed in addition to the createRule and updateRule.
            manageRule (optional): null|string

            // API rule that could be used to specify additional record constraints applied after record
            // authentication and right before returning the auth token response to the client.
            //
            // For example, to allow only verified users you could set it to "verified = true".
            //
            // Set it to empty string to allow any Auth collection record to authenticate.
            //
            // Set it to null to disallow authentication altogether for the collection.
            authRule (optional): null|string

            // AuthAlert defines options related to the auth alerts on new device login.
            authAlert (optional): {
                enabled (optional): boolean
                emailTemplate (optional): {
                    subject (required): string
                    body (required):    string
                }
            }

            // OAuth2 specifies whether OAuth2 auth is enabled for the collection
            // and which OAuth2 providers are allowed.
            oauth2 (optional): {
                enabled (optional): boolean
                mappedFields (optional): {
                    id (optional):        string
                    name (optional):      string
                    username (optional):  string
                    avatarURL (optional): string
                }
                providers (optional): [
                    {
                        name (required):         string
                        clientId (required):     string
                        clientSecret (required): string
                        authURL (optional):      string
                        tokenURL (optional):     string
                        userInfoURL (optional):  string
                        displayName (optional):  string
                        pkce (optional):         null|boolean
                        extra (optional):        null|Object<string,any>
                    }
                ]
            }

            // PasswordAuth defines options related to the collection password authentication.
            passwordAuth (optional): {
                enabled (optional):        boolean
                identityFields (required): Array<string>
            }

            // MFA defines options related to the Multi-factor authentication (MFA).
            mfa (optional):{
                enabled (optional):  boolean
                duration (required): number
                rule (optional):     string
            }

            // OTP defines options related to the One-time password authentication (OTP).
            otp (optional): {
                enabled (optional):  boolean
                duration (required): number
                length (required):   number
                emailTemplate (optional): {
                    subject (required): string
                    body (required):    string
                }
            }

            // Token configurations.
            authToken (optional): {
                duration (required): number
                secret (required):   string
            }
            passwordResetToken (optional): {
                duration (required): number
                secret (required):   string
            }
            emailChangeToken (optional): {
                duration (required): number
                secret (required):   string
            }
            verificationToken (optional): {
                duration (required): number
                secret (required):   string
            }
            fileToken (optional): {
                duration (required): number
                secret (required):   string
            }

            // Default email templates.
            verificationTemplate (optional): {
                subject (required): string
                body (required):    string
            }
            resetPasswordTemplate (optional): {
                subject (required): string
                body (required):    string
            }
            confirmEmailChangeTemplate (optional): {
                subject (required): string
                body (required):    string
            }
        }
```

Query parameters

Param

Type

Description

- `fields` query parameter

Responses

(responseTab = response.code)}
>

### Source Fragment: `api-collections/Delete.svelte`

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

```dart
import 'package:pocketbase/pocketbase.dart';

            final pb = PocketBase('http://127.0.0.1:8090');

            ...

            await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

            await pb.collections.delete('demo');
```

API details

**DELETE**

/api/collections/`collectionIdOrName`

Requires `Authorization:TOKEN`

Path parameters

Param

Type

Description

collectionIdOrName

String

ID or name of the collection to view.

Responses

(responseTab = response.code)}
>

### Source Fragment: `api-collections/Truncate.svelte`

### Truncate collection

Deletes all the records of a single collection (including their related files and cascade delete
enabled relations).

Only superusers can perform this action.

```js
import PocketBase from 'pocketbase';

            const pb = new PocketBase('http://127.0.0.1:8090');

            ...

            await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

            await pb.collections.truncate('demo');
```

```dart
import 'package:pocketbase/pocketbase.dart';

            final pb = PocketBase('http://127.0.0.1:8090');

            ...

            await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

            await pb.collections.truncate('demo');
```

API details

**DELETE**

/api/collections/`collectionIdOrName`/truncate

Requires `Authorization:TOKEN`

Path parameters

Param

Type

Description

collectionIdOrName

String

ID or name of the collection to truncate.

Responses

(responseTab = response.code)}
>

### Source Fragment: `api-collections/Import.svelte`

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

```dart
import 'package:pocketbase/pocketbase.dart';

            final pb = PocketBase('http://127.0.0.1:8090');

            ...

            await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

            final importData = [
                CollectionModel(
                    name: "collection1",
                    schema: [
                        SchemaField(name: "status", type: "bool"),
                    ],
                ),
                CollectionModel(
                    name: "collection2",
                    schema: [
                        SchemaField(name: "title", type: "text"),
                    ],
                ),
            ];

            await pb.collections.import(importData, deleteMissing: false);
```

API details

**PUT**

/api/collections/import

Requires `Authorization:TOKEN`

Body Parameters

Param

Type

Description

Required

collections

Array

List of collections to import (replace and create).

Optional

deleteMissing

Boolean

If *true* all existing collections and schema fields that are not present in the
imported configuration **will be deleted**, including their related records
data (default to
*false*).

Body parameters could be sent as *JSON* or
*multipart/form-data*.

Responses

(responseTab = response.code)}
>

### Source Fragment: `api-collections/Scaffolds.svelte`

### Scaffolds

Returns an object with all of the collection types and their default fields
*(used primarily in the Dashboard UI)*.

Only superusers can perform this action.

```js
import PocketBase from 'pocketbase';

            const pb = new PocketBase('http://127.0.0.1:8090');

            ...

            await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

            const scaffolds = await pb.collections.getScaffolds();
```

```dart
import 'package:pocketbase/pocketbase.dart';

            final pb = PocketBase('http://127.0.0.1:8090');

            ...

            await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

            final scaffolds = await pb.collections.getScaffolds();
```

API details

**GET**

/api/collections/meta/scaffolds

Requires `Authorization:TOKEN`

Responses

(responseTab = response.code)}
>
## API Settings

Upstream source: [/docs/api-settings](https://pocketbase.io/docs/api-settings/)

### Source Fragment: `api-settings/List.svelte`

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

```dart
import 'package:pocketbase/pocketbase.dart';

            final pb = PocketBase('http://127.0.0.1:8090');

            ...

            await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

            final settings = await pb.settings.getAll();
```

API details

**GET**

/api/settings

Requires `Authorization:TOKEN`

Query parameters

Param

Type

Description

- `fields` query parameter

Responses

(responseTab = response.code)}
>

### Source Fragment: `api-settings/Update.svelte`

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

```dart
import 'package:pocketbase/pocketbase.dart';

            final pb = PocketBase('http://127.0.0.1:8090');

            ...

            await pb.collection("_superusers").authWithPassword('test@example.com', '123456');

            final settings = await pb.settings.update(body: {
                'meta': {
                  'appName': 'YOUR_APP',
                  'appUrl': 'http://127.0.0.1:8090',
                },
            });
```

API details

**PATCH**

/api/settings

Requires `Authorization:TOKEN`

Body Parameters

Param

Type

Description

**meta**

Application meta data (name, url, support email, etc.).

├─

Required

*appName*

String

The app name.

├─

Required

*appUrl*

String

The app public absolute url.

├─

Optional

*hideControls*

Boolean

Hides the collection create and update controls from the Dashboard.

Useful to prevent making accidental schema changes when in production environment.

├─

Required

*senderName*

String

Transactional mails sender name.

├─

Required

*senderAddress*

String

Transactional mails sender address.

**logs**

App logger settings.

└─

Optional

*maxDays*

Number

Max retention period. Set to *0* for no logs.

└─

Optional

*minLevel*

Number

Specifies the minimum log persistent level.

The default log levels are:

- -4: DEBUG

- 0: INFO

- 4: WARN

- 8: ERROR

└─

Optional

*logIP*

Boolean

If enabled includes the client IP in the activity request logs.

└─

Optional

*logAuthId*

Boolean

If enabled includes the authenticated record id in the activity request logs.

**backups**

App data backups settings.

├─

Optional

*cron*

String

Cron expression to schedule auto backups, e.g. `0 0 * * *`.

├─

Optional

*cronMaxKeep*

Number

The max number of cron generated backups to keep before removing older entries.

└─

Optional

*s3*

Object

S3 configuration (the same fields as for the S3 file storage settings).

**smtp**

SMTP mail server settings.

├─

Optional

*enabled*

Boolean

Enable the use of the SMTP mail server for sending emails.

├─

Required

*host*

String

Mail server host (required if SMTP is enabled).

├─

Required

*port*

Number

Mail server port (required if SMTP is enabled).

├─

Optional

*username*

String

Mail server username.

├─

Optional

*password*

String

Mail server password.

├─

Optional

*tls*

Boolean

Whether to enforce TLS connection encryption.

When *false* *StartTLS* command is send, leaving the server to decide whether
to upgrade the connection or not).

├─

Optional

*authMethod*

String

The SMTP AUTH method to use - *PLAIN* or *LOGIN* (used mainly by Microsoft).

Default to *PLAIN* if empty.

└─

Optional

*localName*

String

Optional domain name or (IP address) to use for the initial EHLO/HELO exchange.

If not explicitly set, `localhost` will be used.

Note that some SMTP providers, such as Gmail SMTP-relay, requires a proper domain name and
and will reject attempts to use localhost.

**s3**

S3 compatible file storage settings.

├─

Optional

*enabled*

Boolean

Enable the use of a S3 compatible storage.

├─

Required

*bucket*

String

S3 storage bucket (required if enabled).

├─

Required

*region*

String

S3 storage region (required if enabled).

├─

Required

*endpoint*

String

S3 storage public endpoint (required if enabled).

├─

Required

*accessKey*

String

S3 storage access key (required if enabled).

├─

Required

*secret*

String

S3 storage secret (required if enabled).

└─

Optional

*forcePathStyle*

Boolean

Forces the S3 request to use path-style addressing, e.g.
"https://s3.amazonaws.com/BUCKET/KEY" instead of the default
"https://BUCKET.s3.amazonaws.com/KEY".

**batch**

Batch logs settings.

├─

Optional

*enabled*

Boolean

Enable the batch Web APIs.

├─

Required

*maxRequests*

Number

The maximum allowed batch request to execute.

├─

Required

*timeout*

Number

The max duration in seconds to wait before cancelling the batch transaction.

└─

Optional

*maxBodySize*

Number

The maximum allowed batch request body size in bytes.

If not set, fallbacks to max ~128MB.

**rateLimits**

Rate limiter settings.

├─

Optional

*enabled*

Boolean

Enable the builtin rate limiter.

└─

Optional

*rules*

Array

List of rate limit rules. Each rule have:

-
`label` - the identifier of the rule.

It could be a tag, complete path or path prerefix (when ends with `/`).

- `maxRequests` - the max allowed number of requests per duration.

-
`duration` - specifies the interval (in seconds) per which to reset the
counted/accumulated rate limiter tokens..

**trustedProxy**

Trusted proxy headers settings.

├─

Optional

*headers*

Array

List of explicit trusted header(s) to check.

└─

Optional

*useLeftmostIP*

Boolean

Specifies to use the left-mostish IP from the trusted headers.

Body parameters could be sent as *JSON* or
*multipart/form-data*.

Query parameters

Param

Type

Description

- `fields` query parameter

Responses

(responseTab = response.code)}
>

### Source Fragment: `api-settings/TestS3.svelte`

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

```dart
import 'package:pocketbase/pocketbase.dart';

            final pb = PocketBase('http://127.0.0.1:8090');

            ...

            await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

            await pb.settings.testS3("backups");
```

API details

**POST**

/api/settings/test/s3

Requires `Authorization:TOKEN`

Body Parameters

Param

Type

Description

Required

filesystem

String

The storage filesystem to test (`storage` or `backups`).

Body parameters could be sent as *JSON* or
*multipart/form-data*.

Responses

(responseTab = response.code)}
>

### Source Fragment: `api-settings/TestEmail.svelte`

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

```dart
import 'package:pocketbase/pocketbase.dart';

            final pb = PocketBase('http://127.0.0.1:8090');

            ...

            await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

            await pb.settings.testEmail("test@example.com", "verification");
```

API details

**POST**

/api/settings/test/email

Requires `Authorization:TOKEN`

Body Parameters

Param

Type

Description

Optional

collection

String

The name or id of the auth collection. Fallbacks to *_superusers* if not set.

Required

email

String

The receiver of the test email.

Required

template

String

The test email template to send:

`verification`,
`password-reset` or
`email-change`.

Body parameters could be sent as *JSON* or
*multipart/form-data*.

Responses

(responseTab = response.code)}
>

### Source Fragment: `api-settings/AppleGenerateClientSecret.svelte`

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

```dart
import 'package:pocketbase/pocketbase.dart';

            final pb = PocketBase('http://127.0.0.1:8090');

            ...

            await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

            await pb.settings.generateAppleClientSecret(clientId, teamId, keyId, privateKey, duration)
```

API details

**POST**

/api/settings/apple/generate-client-secret

Requires `Authorization:TOKEN`

Body Parameters

Param

Type

Description

Required

clientId

String

The identifier of your app (aka. Service ID).

Required

teamId

String

10-character string associated with your developer account (usually could be found next to
your name in the Apple Developer site).

Required

keyId

String

10-character key identifier generated for the "Sign in with Apple" private key associated
with your developer account.

Required

privateKey

String

PrivateKey is the private key associated to your app.

Required

duration

Number

Duration specifies how long the generated JWT token should be considered valid.

The specified value must be in seconds and max 15777000 (~6months).

Body parameters could be sent as *JSON* or
*multipart/form-data*.

Responses

(responseTab = response.code)}
>
## API Logs

Upstream source: [/docs/api-logs](https://pocketbase.io/docs/api-logs/)

### Source Fragment: `api-logs/List.svelte`

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

```dart
import 'package:pocketbase/pocketbase.dart';

            final pb = PocketBase('http://127.0.0.1:8090');

            ...

            await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

            final pageResult = await pb.logs.getList(
                page: 1,
                perPage: 20,
                filter: 'data.status >= 400',
            );
```

API details

**GET**

/api/logs

Requires `Authorization:TOKEN`

Query parameters

Param

Type

Description

page

Number

The page (aka. offset) of the paginated list (*default to 1*).

perPage

Number

The max returned logs per page (*default to 30*).

sort

String

Specify the *ORDER BY* fields.

Add `-` / `+` (default) in front of the attribute for DESC /
ASC order, e.g.:

```text
// DESC by the insertion rowid and ASC by level
                                ?sort=-rowid,level
```

**Supported log sort fields:**

`@random`, `rowid`, `id`, `created`,
`updated`, `level`, `message` and any
`data.*` attribute.

filter

String

Filter expression to filter/search the returned logs list, e.g.:

```text
?filter=(data.url~'test.com' && level>0)
```

**Supported log filter fields:**

`id`, `created`, `updated`,
`level`, `message` and any `data.*` attribute.

- `fields` query parameter

Responses

(responseTab = response.code)}
>

### Source Fragment: `api-logs/View.svelte`

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

```dart
import 'package:pocketbase/pocketbase.dart';

            final pb = PocketBase('http://127.0.0.1:8090');

            ...

            await pb.collection("_superusers").authWithEmail('test@example.com', '123456');

            final log = await pb.logs.getOne('LOG_ID');
```

API details

**GET**

/api/logs/`id`

Requires `Authorization:TOKEN`

Path parameters

Param

Type

Description

id

String

ID of the log to view.

Query parameters

Param

Type

Description

- `fields` query parameter

Responses

(responseTab = response.code)}
>

### Source Fragment: `api-logs/Stats.svelte`

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

```dart
import 'package:pocketbase/pocketbase.dart';

            final pb = PocketBase('http://127.0.0.1:8090');

            ...

            await pb.collection("_superusers").authWithPassword('test@example.com', '123456');

            final stats = await pb.logs.getStats(
                filter: 'data.status >= 400'
            );
```

API details

**GET**

/api/logs/stats

Requires `Authorization:TOKEN`

Query parameters

Param

Type

Description

filter

String

Filter expression to filter/search the logs, e.g.:

```text
?filter=(data.url~'test.com' && level>0)
```

**Supported log filter fields:**

`rowid`, `id`, `created`,
`updated`, `level`, `message` and any
`data.*` attribute.

- `fields` query parameter

Responses

(responseTab = response.code)}
>
## API Crons

Upstream source: [/docs/api-crons](https://pocketbase.io/docs/api-crons/)

### Source Fragment: `api-crons/List.svelte`

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

```dart
import 'package:pocketbase/pocketbase.dart';

            final pb = PocketBase('http://127.0.0.1:8090');

            ...

            await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

            final jobs = await pb.crons.getFullList();
```

API details

**GET**

/api/crons

Query parameters

Param

Type

Description

- `fields` query parameter

Responses

(responseTab = response.code)}
>

### Source Fragment: `api-crons/Run.svelte`

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

```dart
import 'package:pocketbase/pocketbase.dart';

            final pb = PocketBase('http://127.0.0.1:8090');

            ...

            await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

            await pb.crons.run('__pbLogsCleanup__');
```

API details

**POST**

/api/crons/`jobId`

Requires `Authorization:TOKEN`

Path parameters

Param

Type

Description

jobId

String

The identifier of the cron job to run.

Responses

(responseTab = response.code)}
>
## API Backups

Upstream source: [/docs/api-backups](https://pocketbase.io/docs/api-backups/)

### Source Fragment: `api-backups/List.svelte`

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

```dart
import 'package:pocketbase/pocketbase.dart';

            final pb = PocketBase('http://127.0.0.1:8090');

            ...

            await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

            final backups = await pb.backups.getFullList();
```

API details

**GET**

/api/backups

Query parameters

Param

Type

Description

- `fields` query parameter

Responses

(responseTab = response.code)}
>

### Source Fragment: `api-backups/Create.svelte`

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

```dart
import 'package:pocketbase/pocketbase.dart';

            final pb = PocketBase('http://127.0.0.1:8090');

            ...

            await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

            await pb.backups.create('new_backup.zip');
```

API details

**POST**

/api/backups

Requires `Authorization:TOKEN`

Body Parameters

Param

Type

Description

Optional

name

String

The base name of the backup file to create.

Must be in the format `[a-z0-9_-].zip`

If not set, it will be auto generated.

Body parameters could be sent as *JSON* or
*multipart/form-data*.

Responses

(responseTab = response.code)}
>

### Source Fragment: `api-backups/Upload.svelte`

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

```dart
import 'package:pocketbase/pocketbase.dart';

            final pb = PocketBase('http://127.0.0.1:8090');

            ...

            await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

            await pb.backups.upload(http.MultipartFile.fromBytes('file', ...));
```

API details

**POST**

/api/backups/upload

Requires `Authorization:TOKEN`

Body Parameters

Param

Type

Description

Required

file

File

The zip archive to upload.

Uploading files is supported only via *multipart/form-data*.

Responses

(responseTab = response.code)}
>

### Source Fragment: `api-backups/Delete.svelte`

### Delete backup

Deletes a single backup by its name.

This action will return an error if the backup to delete is still being generated or part of a
restore operation.

Only superusers can perform this action.

```js
import PocketBase from 'pocketbase';

            const pb = new PocketBase('http://127.0.0.1:8090');

            ...

            await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

            await pb.backups.delete('pb_data_backup.zip');
```

```dart
import 'package:pocketbase/pocketbase.dart';

            final pb = PocketBase('http://127.0.0.1:8090');

            ...

            await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

            await pb.backups.delete('pb_data_backup.zip');
```

API details

**DELETE**

/api/backups/`key`

Requires `Authorization:TOKEN`

Path parameters

Param

Type

Description

key

String

The key of the backup file to delete.

Responses

(responseTab = response.code)}
>

### Source Fragment: `api-backups/Restore.svelte`

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

```dart
import 'package:pocketbase/pocketbase.dart';

            final pb = PocketBase('http://127.0.0.1:8090');

            ...

            await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

            await pb.backups.restore('pb_data_backup.zip');
```

API details

**POST**

/api/backups/`key`/restore

Requires `Authorization:TOKEN`

Path parameters

Param

Type

Description

key

String

The key of the backup file to restore.

Responses

(responseTab = response.code)}
>

### Source Fragment: `api-backups/Download.svelte`

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

```dart
import 'package:pocketbase/pocketbase.dart';

            final pb = PocketBase('http://127.0.0.1:8090');

            ...

            await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

            final token = await pb.files.getToken();

            final url = pb.backups.getDownloadUrl(token, 'pb_data_backup.zip');
```

API details

**GET**

/api/backups/`key`

Path parameters

Param

Type

Description

key

String

The key of the backup file to download.

Query parameters

Param

Type

Description

token

String

Superuser **file token** for granting access to the
**backup file**.

Responses

(responseTab = response.code)}
>
## API Health

Upstream source: [/docs/api-health](https://pocketbase.io/docs/api-health/)

### Source Fragment: `api-health/Health.svelte`

### Health check

Returns the health status of the server.

API details

**GET/HEAD**

/api/health

Query parameters

Param

Type

Description

- `fields` query parameter

Responses

(responseTab = response.code)}
>

## Attribution

This page is adapted from PocketBase docs and regenerated from upstream source files in `pocketbase/site`.

- PocketBase docs: <https://pocketbase.io/docs/>
- PocketBase project by Gani Georgiev: <https://github.com/pocketbase/pocketbase>
- Upstream docs source map: [Upstream Docs Map](./maintainers/upstream-docs-map.md)
