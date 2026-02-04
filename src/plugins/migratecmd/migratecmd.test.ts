// Ported from pocketbase/plugins/migratecmd/migratecmd_test.go

import type { Dirent } from "node:fs";
import { describe, it } from "bun:test";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { NewAuthCollection } from "../../core/collection_model.ts";
import { OAuth2ProviderConfig } from "../../core/collection_model_auth_options.ts";
import { RequestEvent } from "../../core/event_request.ts";
import { CollectionRequestEvent } from "../../core/events.ts";
import { BoolField } from "../../core/field_bool.ts";
import { NumberField } from "../../core/field_number.ts";
import { TextField } from "../../core/field_text.ts";
import { newTestApp } from "../../tests/app.ts";
import { JSONArray, Pointer } from "../../tools/types/index.ts";
import { MustRegister, TemplateLangGo, TemplateLangJS } from "./migratecmd.ts";

const createExpectedJS = String.raw`
/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "authAlert": {
      "emailTemplate": {
        "body": "<p>Hello,</p>\n<p>We noticed a login to your {APP_NAME} account from a new location:</p>\n<p><em>{ALERT_INFO}</em></p>\n<p><strong>If this wasn't you, you should immediately change your {APP_NAME} account password to revoke access from all other locations.</strong></p>\n<p>If this was you, you may disregard this email.</p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>",
        "subject": "Login from a new location"
      },
      "enabled": true
    },
    "authRule": "",
    "authToken": {
      "duration": 604800
    },
    "confirmEmailChangeTemplate": {
      "body": "<p>Hello,</p>\n<p>Click on the button below to confirm your new email address.</p>\n<p>\n  <a class=\"btn\" href=\"{APP_URL}/_/#/auth/confirm-email-change/{TOKEN}\" target=\"_blank\" rel=\"noopener\">Confirm new email</a>\n</p>\n<p><i>If you didn't ask to change your email address, you can ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>",
      "subject": "Confirm your {APP_NAME} new email address"
    },
    "createRule": null,
    "deleteRule": null,
    "emailChangeToken": {
      "duration": 1800
    },
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "hidden": false,
        "id": "text@TEST_RANDOM",
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
        "id": "password@TEST_RANDOM",
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
        "id": "text@TEST_RANDOM",
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
        "id": "email@TEST_RANDOM",
        "name": "email",
        "onlyDomains": null,
        "presentable": false,
        "required": true,
        "system": true,
        "type": "email"
      },
      {
        "hidden": false,
        "id": "bool@TEST_RANDOM",
        "name": "emailVisibility",
        "presentable": false,
        "required": false,
        "system": true,
        "type": "bool"
      },
      {
        "hidden": false,
        "id": "bool@TEST_RANDOM",
        "name": "verified",
        "presentable": false,
        "required": false,
        "system": true,
        "type": "bool"
      }
    ],
    "fileToken": {
      "duration": 180
    },
    "id": "@TEST_RANDOM",
    "indexes": [
      "create index test on new_name (id)",
      "CREATE UNIQUE INDEX \`idx_tokenKey_@TEST_RANDOM\` ON \`new_name\` (\`tokenKey\`)",
      "CREATE UNIQUE INDEX \`idx_email_@TEST_RANDOM\` ON \`new_name\` (\`email\`) WHERE \`email\` != ''"
    ],
    "listRule": "@request.auth.id != '' && 1 > 0 || 'backtick\`test' = 0",
    "manageRule": "1 != 2",
    "mfa": {
      "duration": 1800,
      "enabled": false,
      "rule": ""
    },
    "name": "new_name",
    "oauth2": {
      "enabled": false,
      "mappedFields": {
        "avatarURL": "",
        "id": "",
        "name": "",
        "username": ""
      }
    },
    "otp": {
      "duration": 180,
      "emailTemplate": {
        "body": "<p>Hello,</p>\n<p>Your one-time password is: <strong>{OTP}</strong></p>\n<p><i>If you didn't ask for the one-time password, you can ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>",
        "subject": "OTP for {APP_NAME}"
      },
      "enabled": false,
      "length": 8
    },
    "passwordAuth": {
      "enabled": true,
      "identityFields": [
        "email"
      ]
    },
    "passwordResetToken": {
      "duration": 1800
    },
    "resetPasswordTemplate": {
      "body": "<p>Hello,</p>\n<p>Click on the button below to reset your password.</p>\n<p>\n  <a class=\"btn\" href=\"{APP_URL}/_/#/auth/confirm-password-reset/{TOKEN}\" target=\"_blank\" rel=\"noopener\">Reset password</a>\n</p>\n<p><i>If you didn't ask to reset your password, you can ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>",
      "subject": "Reset your {APP_NAME} password"
    },
    "system": true,
    "type": "auth",
    "updateRule": null,
    "verificationTemplate": {
      "body": "<p>Hello,</p>\n<p>Thank you for joining us at {APP_NAME}.</p>\n<p>Click on the button below to verify your email address.</p>\n<p>\n  <a class=\"btn\" href=\"{APP_URL}/_/#/auth/confirm-verification/{TOKEN}\" target=\"_blank\" rel=\"noopener\">Verify</a>\n</p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>",
      "subject": "Verify your {APP_NAME} email"
    },
    "verificationToken": {
      "duration": 259200
    },
    "viewRule": "id = \"1\""
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("@TEST_RANDOM");

  return app.delete(collection);
})
`;

const createExpectedGo = String.raw`
package _test_migrations

import (
	"encoding/json"

	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(app core.App) error {
		jsonData := \`{
			"authAlert": {
				"emailTemplate": {
					"body": "<p>Hello,</p>\n<p>We noticed a login to your {APP_NAME} account from a new location:</p>\n<p><em>{ALERT_INFO}</em></p>\n<p><strong>If this wasn't you, you should immediately change your {APP_NAME} account password to revoke access from all other locations.</strong></p>\n<p>If this was you, you may disregard this email.</p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>",
					"subject": "Login from a new location"
				},
				"enabled": true
			},
			"authRule": "",
			"authToken": {
				"duration": 604800
			},
			"confirmEmailChangeTemplate": {
				"body": "<p>Hello,</p>\n<p>Click on the button below to confirm your new email address.</p>\n<p>\n  <a class=\"btn\" href=\"{APP_URL}/_/#/auth/confirm-email-change/{TOKEN}\" target=\"_blank\" rel=\"noopener\">Confirm new email</a>\n</p>\n<p><i>If you didn't ask to change your email address, you can ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>",
				"subject": "Confirm your {APP_NAME} new email address"
			},
			"createRule": null,
			"deleteRule": null,
			"emailChangeToken": {
				"duration": 1800
			},
			"fields": [
				{
					"autogeneratePattern": "[a-z0-9]{15}",
					"hidden": false,
					"id": "text@TEST_RANDOM",
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
					"id": "password@TEST_RANDOM",
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
					"id": "text@TEST_RANDOM",
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
					"id": "email@TEST_RANDOM",
					"name": "email",
					"onlyDomains": null,
					"presentable": false,
					"required": true,
					"system": true,
					"type": "email"
				},
				{
					"hidden": false,
					"id": "bool@TEST_RANDOM",
					"name": "emailVisibility",
					"presentable": false,
					"required": false,
					"system": true,
					"type": "bool"
				},
				{
					"hidden": false,
					"id": "bool@TEST_RANDOM",
					"name": "verified",
					"presentable": false,
					"required": false,
					"system": true,
					"type": "bool"
				}
			],
			"fileToken": {
				"duration": 180
			},
			"id": "@TEST_RANDOM",
			"indexes": [
				"create index test on new_name (id)",
				"CREATE UNIQUE INDEX \` + "\`" + \`idx_tokenKey_@TEST_RANDOM\` + "\`" + \` ON \` + "\`" + \`new_name\` + "\`" + \` (\` + "\`" + \`tokenKey\` + "\`" + \`)",
				"CREATE UNIQUE INDEX \` + "\`" + \`idx_email_@TEST_RANDOM\` + "\`" + \` ON \` + "\`" + \`new_name\` + "\`" + \` (\` + "\`" + \`email\` + "\`" + \`) WHERE \` + "\`" + \`email\` + "\`" + \` != ''"
			],
			"listRule": "@request.auth.id != '' && 1 > 0 || 'backtick\` + "\`" + \`test' = 0",
			"manageRule": "1 != 2",
			"mfa": {
				"duration": 1800,
				"enabled": false,
				"rule": ""
			},
			"name": "new_name",
			"oauth2": {
				"enabled": false,
				"mappedFields": {
					"avatarURL": "",
					"id": "",
					"name": "",
					"username": ""
				}
			},
			"otp": {
				"duration": 180,
				"emailTemplate": {
					"body": "<p>Hello,</p>\n<p>Your one-time password is: <strong>{OTP}</strong></p>\n<p><i>If you didn't ask for the one-time password, you can ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>",
					"subject": "OTP for {APP_NAME}"
				},
				"enabled": false,
				"length": 8
			},
			"passwordAuth": {
				"enabled": true,
				"identityFields": [
					"email"
				]
			},
			"passwordResetToken": {
				"duration": 1800
			},
			"resetPasswordTemplate": {
				"body": "<p>Hello,</p>\n<p>Click on the button below to reset your password.</p>\n<p>\n  <a class=\"btn\" href=\"{APP_URL}/_/#/auth/confirm-password-reset/{TOKEN}\" target=\"_blank\" rel=\"noopener\">Reset password</a>\n</p>\n<p><i>If you didn't ask to reset your password, you can ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>",
				"subject": "Reset your {APP_NAME} password"
			},
			"system": true,
			"type": "auth",
			"updateRule": null,
			"verificationTemplate": {
				"body": "<p>Hello,</p>\n<p>Thank you for joining us at {APP_NAME}.</p>\n<p>Click on the button below to verify your email address.</p>\n<p>\n  <a class=\"btn\" href=\"{APP_URL}/_/#/auth/confirm-verification/{TOKEN}\" target=\"_blank\" rel=\"noopener\">Verify</a>\n</p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>",
				"subject": "Verify your {APP_NAME} email"
			},
			"verificationToken": {
				"duration": 259200
			},
			"viewRule": "id = \"1\""
		}\`

		collection := &core.Collection{}
		if err := json.Unmarshal([]byte(jsonData), &collection); err != nil {
			return err
		}

		return app.Save(collection)
	}, func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("@TEST_RANDOM")
		if err != nil {
			return err
		}

		return app.Delete(collection)
	})
}
`;

const deleteExpectedJS = String.raw`
/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("@TEST_RANDOM");

  return app.delete(collection);
}, (app) => {
  const collection = new Collection({
    "authAlert": {
      "emailTemplate": {
        "body": "<p>Hello,</p>\n<p>We noticed a login to your {APP_NAME} account from a new location:</p>\n<p><em>{ALERT_INFO}</em></p>\n<p><strong>If this wasn't you, you should immediately change your {APP_NAME} account password to revoke access from all other locations.</strong></p>\n<p>If this was you, you may disregard this email.</p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>",
        "subject": "Login from a new location"
      },
      "enabled": true
    },
    "authRule": "",
    "authToken": {
      "duration": 604800
    },
    "confirmEmailChangeTemplate": {
      "body": "<p>Hello,</p>\n<p>Click on the button below to confirm your new email address.</p>\n<p>\n  <a class=\"btn\" href=\"{APP_URL}/_/#/auth/confirm-email-change/{TOKEN}\" target=\"_blank\" rel=\"noopener\">Confirm new email</a>\n</p>\n<p><i>If you didn't ask to change your email address, you can ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>",
      "subject": "Confirm your {APP_NAME} new email address"
    },
    "createRule": null,
    "deleteRule": null,
    "emailChangeToken": {
      "duration": 1800
    },
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "hidden": false,
        "id": "text@TEST_RANDOM",
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
        "id": "password@TEST_RANDOM",
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
        "id": "text@TEST_RANDOM",
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
        "id": "email@TEST_RANDOM",
        "name": "email",
        "onlyDomains": null,
        "presentable": false,
        "required": true,
        "system": true,
        "type": "email"
      },
      {
        "hidden": false,
        "id": "bool@TEST_RANDOM",
        "name": "emailVisibility",
        "presentable": false,
        "required": false,
        "system": true,
        "type": "bool"
      },
      {
        "hidden": false,
        "id": "bool@TEST_RANDOM",
        "name": "verified",
        "presentable": false,
        "required": false,
        "system": true,
        "type": "bool"
      }
    ],
    "fileToken": {
      "duration": 180
    },
    "id": "@TEST_RANDOM",
    "indexes": [
      "create index test on test123 (id)",
      "CREATE UNIQUE INDEX \`idx_tokenKey_@TEST_RANDOM\` ON \`test123\` (\`tokenKey\`)",
      "CREATE UNIQUE INDEX \`idx_email_@TEST_RANDOM\` ON \`test123\` (\`email\`) WHERE \`email\` != ''"
    ],
    "listRule": "@request.auth.id != '' && 1 > 0 || 'backtick\`test' = 0",
    "manageRule": "1 != 2",
    "mfa": {
      "duration": 1800,
      "enabled": false,
      "rule": ""
    },
    "name": "test123",
    "oauth2": {
      "enabled": false,
      "mappedFields": {
        "avatarURL": "",
        "id": "",
        "name": "",
        "username": ""
      }
    },
    "otp": {
      "duration": 180,
      "emailTemplate": {
        "body": "<p>Hello,</p>\n<p>Your one-time password is: <strong>{OTP}</strong></p>\n<p><i>If you didn't ask for the one-time password, you can ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>",
        "subject": "OTP for {APP_NAME}"
      },
      "enabled": false,
      "length": 8
    },
    "passwordAuth": {
      "enabled": true,
      "identityFields": [
        "email"
      ]
    },
    "passwordResetToken": {
      "duration": 1800
    },
    "resetPasswordTemplate": {
      "body": "<p>Hello,</p>\n<p>Click on the button below to reset your password.</p>\n<p>\n  <a class=\"btn\" href=\"{APP_URL}/_/#/auth/confirm-password-reset/{TOKEN}\" target=\"_blank\" rel=\"noopener\">Reset password</a>\n</p>\n<p><i>If you didn't ask to reset your password, you can ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>",
      "subject": "Reset your {APP_NAME} password"
    },
    "system": false,
    "type": "auth",
    "updateRule": null,
    "verificationTemplate": {
      "body": "<p>Hello,</p>\n<p>Thank you for joining us at {APP_NAME}.</p>\n<p>Click on the button below to verify your email address.</p>\n<p>\n  <a class=\"btn\" href=\"{APP_URL}/_/#/auth/confirm-verification/{TOKEN}\" target=\"_blank\" rel=\"noopener\">Verify</a>\n</p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>",
      "subject": "Verify your {APP_NAME} email"
    },
    "verificationToken": {
      "duration": 259200
    },
    "viewRule": "id = \"1\""
  });

  return app.save(collection);
})
`;

const deleteExpectedGo = String.raw`
package _test_migrations

import (
	"encoding/json"

	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("@TEST_RANDOM")
		if err != nil {
			return err
		}

		return app.Delete(collection)
	}, func(app core.App) error {
		jsonData := \`{
			"authAlert": {
				"emailTemplate": {
					"body": "<p>Hello,</p>\n<p>We noticed a login to your {APP_NAME} account from a new location:</p>\n<p><em>{ALERT_INFO}</em></p>\n<p><strong>If this wasn't you, you should immediately change your {APP_NAME} account password to revoke access from all other locations.</strong></p>\n<p>If this was you, you may disregard this email.</p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>",
					"subject": "Login from a new location"
				},
				"enabled": true
			},
			"authRule": "",
			"authToken": {
				"duration": 604800
			},
			"confirmEmailChangeTemplate": {
				"body": "<p>Hello,</p>\n<p>Click on the button below to confirm your new email address.</p>\n<p>\n  <a class=\"btn\" href=\"{APP_URL}/_/#/auth/confirm-email-change/{TOKEN}\" target=\"_blank\" rel=\"noopener\">Confirm new email</a>\n</p>\n<p><i>If you didn't ask to change your email address, you can ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>",
				"subject": "Confirm your {APP_NAME} new email address"
			},
			"createRule": null,
			"deleteRule": null,
			"emailChangeToken": {
				"duration": 1800
			},
			"fields": [
				{
					"autogeneratePattern": "[a-z0-9]{15}",
					"hidden": false,
					"id": "text@TEST_RANDOM",
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
					"id": "password@TEST_RANDOM",
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
					"id": "text@TEST_RANDOM",
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
					"id": "email@TEST_RANDOM",
					"name": "email",
					"onlyDomains": null,
					"presentable": false,
					"required": true,
					"system": true,
					"type": "email"
				},
				{
					"hidden": false,
					"id": "bool@TEST_RANDOM",
					"name": "emailVisibility",
					"presentable": false,
					"required": false,
					"system": true,
					"type": "bool"
				},
				{
					"hidden": false,
					"id": "bool@TEST_RANDOM",
					"name": "verified",
					"presentable": false,
					"required": false,
					"system": true,
					"type": "bool"
				}
			],
			"fileToken": {
				"duration": 180
			},
			"id": "@TEST_RANDOM",
			"indexes": [
				"create index test on test123 (id)",
				"CREATE UNIQUE INDEX \` + "\`" + \`idx_tokenKey_@TEST_RANDOM\` + "\`" + \` ON \` + "\`" + \`test123\` + "\`" + \` (\` + "\`" + \`tokenKey\` + "\`" + \`)",
				"CREATE UNIQUE INDEX \` + "\`" + \`idx_email_@TEST_RANDOM\` + "\`" + \` ON \` + "\`" + \`test123\` + "\`" + \` (\` + "\`" + \`email\` + "\`" + \`) WHERE \` + "\`" + \`email\` + "\`" + \` != ''"
			],
			"listRule": "@request.auth.id != '' && 1 > 0 || 'backtick\` + "\`" + \`test' = 0",
			"manageRule": "1 != 2",
			"mfa": {
				"duration": 1800,
				"enabled": false,
				"rule": ""
			},
			"name": "test123",
			"oauth2": {
				"enabled": false,
				"mappedFields": {
					"avatarURL": "",
					"id": "",
					"name": "",
					"username": ""
				}
			},
			"otp": {
				"duration": 180,
				"emailTemplate": {
					"body": "<p>Hello,</p>\n<p>Your one-time password is: <strong>{OTP}</strong></p>\n<p><i>If you didn't ask for the one-time password, you can ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>",
					"subject": "OTP for {APP_NAME}"
				},
				"enabled": false,
				"length": 8
			},
			"passwordAuth": {
				"enabled": true,
				"identityFields": [
					"email"
				]
			},
			"passwordResetToken": {
				"duration": 1800
			},
			"resetPasswordTemplate": {
				"body": "<p>Hello,</p>\n<p>Click on the button below to reset your password.</p>\n<p>\n  <a class=\"btn\" href=\"{APP_URL}/_/#/auth/confirm-password-reset/{TOKEN}\" target=\"_blank\" rel=\"noopener\">Reset password</a>\n</p>\n<p><i>If you didn't ask to reset your password, you can ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>",
				"subject": "Reset your {APP_NAME} password"
			},
			"system": false,
			"type": "auth",
			"updateRule": null,
			"verificationTemplate": {
				"body": "<p>Hello,</p>\n<p>Thank you for joining us at {APP_NAME}.</p>\n<p>Click on the button below to verify your email address.</p>\n<p>\n  <a class=\"btn\" href=\"{APP_URL}/_/#/auth/confirm-verification/{TOKEN}\" target=\"_blank\" rel=\"noopener\">Verify</a>\n</p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>",
				"subject": "Verify your {APP_NAME} email"
			},
			"verificationToken": {
				"duration": 259200
			},
			"viewRule": "id = \"1\""
		}\`

		collection := &core.Collection{}
		if err := json.Unmarshal([]byte(jsonData), &collection); err != nil {
			return err
		}

		return app.Save(collection)
	})
}
`;

const updateExpectedJS = String.raw`
/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("@TEST_RANDOM")

  // update collection data
  unmarshal({
    "createRule": "id = \"nil_update\"",
    "deleteRule": null,
    "fileToken": {
      "duration": 10
    },
    "indexes": [
      "create index test1 on test123_update (f1_name)",
      "CREATE UNIQUE INDEX \`idx_tokenKey_@TEST_RANDOM\` ON \`test123_update\` (\`tokenKey\`)",
      "CREATE UNIQUE INDEX \`idx_email_@TEST_RANDOM\` ON \`test123_update\` (\`email\`) WHERE \`email\` != ''"
    ],
    "listRule": "@request.auth.id != ''",
    "name": "test123_update",
    "oauth2": {
      "enabled": true
    },
    "updateRule": "id = \"2_update\""
  }, collection)

  // remove field
  collection.fields.removeById("f3_id")

  // add field
  collection.fields.addAt(8, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "f4_id",
    "max": 0,
    "min": 0,
    "name": "f4_name",
    "pattern": "\`test backtick\`123",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // update field
  collection.fields.addAt(7, new Field({
    "hidden": false,
    "id": "f2_id",
    "max": null,
    "min": 10,
    "name": "f2_name_new",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("@TEST_RANDOM")

  // update collection data
  unmarshal({
    "createRule": null,
    "deleteRule": "id = \"3\"",
    "fileToken": {
      "duration": 180
    },
    "indexes": [
      "create index test1 on test123 (f1_name)",
      "CREATE UNIQUE INDEX \`idx_tokenKey_@TEST_RANDOM\` ON \`test123\` (\`tokenKey\`)",
      "CREATE UNIQUE INDEX \`idx_email_@TEST_RANDOM\` ON \`test123\` (\`email\`) WHERE \`email\` != ''"
    ],
    "listRule": "@request.auth.id != '' && 1 != 2",
    "name": "test123",
    "oauth2": {
      "enabled": false
    },
    "updateRule": "id = \"2\""
  }, collection)

  // add field
  collection.fields.addAt(8, new Field({
    "hidden": false,
    "id": "f3_id",
    "name": "f3_name",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // remove field
  collection.fields.removeById("f4_id")

  // update field
  collection.fields.addAt(7, new Field({
    "hidden": false,
    "id": "f2_id",
    "max": null,
    "min": 10,
    "name": "f2_name",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
})

`;

const updateExpectedGo = String.raw`
package _test_migrations

import (
	"encoding/json"

	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("@TEST_RANDOM")
		if err != nil {
			return err
		}

		// update collection data
		if err := json.Unmarshal([]byte(\`{
			"createRule": "id = \\\"nil_update\\\"",
			"deleteRule": null,
			"fileToken": {
				"duration": 10
			},
			"indexes": [
				"create index test1 on test123_update (f1_name)",
				"CREATE UNIQUE INDEX \` + "\`" + \`idx_tokenKey_@TEST_RANDOM\` + "\`" + \` ON \` + "\`" + \`test123_update\` + "\`" + \` (\` + "\`" + \`tokenKey\` + "\`" + \`)",
				"CREATE UNIQUE INDEX \` + "\`" + \`idx_email_@TEST_RANDOM\` + "\`" + \` ON \` + "\`" + \`test123_update\` + "\`" + \` (\` + "\`" + \`email\` + "\`" + \`) WHERE \` + "\`" + \`email\` + "\`" + \` != ''"
			],
			"listRule": "@request.auth.id != ''",
			"name": "test123_update",
			"oauth2": {
				"enabled": true
			},
			"updateRule": "id = \\\"2_update\\\""
		}\`), &collection); err != nil {
			return err
		}

		// remove field
		collection.Fields.RemoveById("f3_id")

		// add field
		if err := collection.Fields.AddMarshaledJSONAt(8, []byte(\`{
			"autogeneratePattern": "",
			"hidden": false,
			"id": "f4_id",
			"max": 0,
			"min": 0,
			"name": "f4_name",
			"pattern": "\` + "\`" + \`test backtick\` + "\`" + \`123",
			"presentable": false,
			"primaryKey": false,
			"required": false,
			"system": false,
			"type": "text"
		}\`)); err != nil {
			return err
		}

		// update field
		if err := collection.Fields.AddMarshaledJSONAt(7, []byte(\`{
			"hidden": false,
			"id": "f2_id",
			"max": null,
			"min": 10,
			"name": "f2_name_new",
			"onlyInt": false,
			"presentable": false,
			"required": false,
			"system": false,
			"type": "number"
		}\`)); err != nil {
			return err
		}

		return app.Save(collection)
	}, func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("@TEST_RANDOM")
		if err != nil {
			return err
		}

		// update collection data
		if err := json.Unmarshal([]byte(\`{
			"createRule": null,
			"deleteRule": "id = \\\"3\\\"",
			"fileToken": {
				"duration": 180
			},
			"indexes": [
				"create index test1 on test123 (f1_name)",
				"CREATE UNIQUE INDEX \` + "\`" + \`idx_tokenKey_@TEST_RANDOM\` + "\`" + \` ON \` + "\`" + \`test123\` + "\`" + \` (\` + "\`" + \`tokenKey\` + "\`" + \`)",
				"CREATE UNIQUE INDEX \` + "\`" + \`idx_email_@TEST_RANDOM\` + "\`" + \` ON \` + "\`" + \`test123\` + "\`" + \` (\` + "\`" + \`email\` + "\`" + \`) WHERE \` + "\`" + \`email\` + "\`" + \` != ''"
			],
			"listRule": "@request.auth.id != '' && 1 != 2",
			"name": "test123",
			"oauth2": {
				"enabled": false
			},
			"updateRule": "id = \\\"2\\\""
		}\`), &collection); err != nil {
			return err
		}

		// add field
		if err := collection.Fields.AddMarshaledJSONAt(8, []byte(\`{
			"hidden": false,
			"id": "f3_id",
			"name": "f3_name",
			"presentable": false,
			"required": false,
			"system": false,
			"type": "bool"
		}\`)); err != nil {
			return err
		}

		// remove field
		collection.Fields.RemoveById("f4_id")

		// update field
		if err := collection.Fields.AddMarshaledJSONAt(7, []byte(\`{
			"hidden": false,
			"id": "f2_id",
			"max": null,
			"min": 10,
			"name": "f2_name",
			"onlyInt": false,
			"presentable": false,
			"required": false,
			"system": false,
			"type": "number"
		}\`)); err != nil {
			return err
		}

		return app.Save(collection)
	})
}
`;

describe("migratecmd automigrate", () => {
  it("collection create", async () => {
    const scenarios = [
      { lang: TemplateLangJS, expectedTemplate: createExpectedJS },
      { lang: TemplateLangGo, expectedTemplate: createExpectedGo },
    ];

    for (const scenario of scenarios) {
      const { app, cleanup } = await newTestApp();

      const migrationsDir = join(app.DataDir(), "_test_migrations");

      MustRegister(app, null, {
        TemplateLang: scenario.lang,
        Automigrate: true,
        Dir: migrationsDir,
      });

      app.bootstrap();

      const collection = NewAuthCollection("new_name");
      collection.System = true;
      collection.ListRule = Pointer("@request.auth.id != '' && 1 > 0 || 'backtick`test' = 0");
      collection.ViewRule = Pointer('id = "1"');
      collection.indexes = new JSONArray("create index test on new_name (id)");
      collection.ManageRule = Pointer("1 != 2");
      //  should be ignored
      collection.OAuth2.Providers = [
        Object.assign(new OAuth2ProviderConfig(), {
          Name: "gitlab",
          ClientId: "abc",
          ClientSecret: "123",
        }),
      ];
      const testSecret = "a".repeat(30);
      collection.AuthToken.Secret = testSecret;
      collection.FileToken.Secret = testSecret;
      collection.EmailChangeToken.Secret = testSecret;
      collection.PasswordResetToken.Secret = testSecret;
      collection.VerificationToken.Secret = testSecret;

      const requestEvent = new RequestEvent({ app, request: new Request("http://127.0.0.1") });
      const event = new CollectionRequestEvent(requestEvent, collection);
      const result = await app.OnCollectionCreateRequest().Trigger(event, async (e) => e.App.Save(e.Collection));
      if (result instanceof Error) {
        throw new Error(`Failed to save the created dummy collection, got: ${result.message}`);
      }

      const files = await readdir(migrationsDir, { withFileTypes: true });
      if (files.length !== 1) {
        throw new Error(`Expected 1 file to be generated, got ${files.length}`);
      }

      const expectedName = `_created_new_name.${scenario.lang}`;
      if (!files[0]?.name.includes(expectedName)) {
        throw new Error(`Expected filename to contains ${JSON.stringify(expectedName)}, got ${JSON.stringify(files[0]?.name)}`);
      }

      const fullPath = join(migrationsDir, files[0]?.name ?? "");
      const content = await readFile(fullPath, "utf8");
      const contentStr = normalizeGeneratedTemplate(content.trim());
      const expectedTemplate = normalizeExpectedTemplate(scenario.expectedTemplate);
      if (contentStr !== expectedTemplate) {
        throw new Error(`Expected template \n${scenario.expectedTemplate}\ngot \n${content.trim()}`);
      }

      await cleanup();
    }
  });

  it("collection delete", async () => {
    const scenarios = [
      { lang: TemplateLangJS, expectedTemplate: deleteExpectedJS },
      { lang: TemplateLangGo, expectedTemplate: deleteExpectedGo },
    ];

    for (const scenario of scenarios) {
      const { app, cleanup } = await newTestApp();

      const migrationsDir = join(app.DataDir(), "_test_migrations");

      // create dummy collection
      const collection = NewAuthCollection("test123");
      collection.ListRule = Pointer("@request.auth.id != '' && 1 > 0 || 'backtick`test' = 0");
      collection.ViewRule = Pointer('id = "1"');
      collection.indexes = new JSONArray("create index test on test123 (id)");
      collection.ManageRule = Pointer("1 != 2");
      //  should be ignored
      collection.OAuth2.Providers = [
        Object.assign(new OAuth2ProviderConfig(), {
          Name: "gitlab",
          ClientId: "abc",
          ClientSecret: "123",
        }),
      ];
      const testSecret = "a".repeat(30);
      collection.AuthToken.Secret = testSecret;
      collection.FileToken.Secret = testSecret;
      collection.EmailChangeToken.Secret = testSecret;
      collection.PasswordResetToken.Secret = testSecret;
      collection.VerificationToken.Secret = testSecret;

      const saveErr = await app.Save(collection);
      if (saveErr) {
        throw new Error(`Failed to save dummy collection, got ${saveErr.message}`);
      }

      MustRegister(app, null, {
        TemplateLang: scenario.lang,
        Automigrate: true,
        Dir: migrationsDir,
      });
      app.bootstrap();

      const requestEvent = new RequestEvent({ app, request: new Request("http://127.0.0.1") });
      const event = new CollectionRequestEvent(requestEvent, collection);
      const result = await app.OnCollectionDeleteRequest().Trigger(event, async (e) => e.App.Delete(e.Collection));
      if (result instanceof Error) {
        throw new Error(`Failed to delete dummy collection, got ${result.message}`);
      }

      const files = await readdir(migrationsDir, { withFileTypes: true });
      if (files.length !== 1) {
        throw new Error(`Expected 1 file to be generated, got ${files.length}`);
      }

      const expectedName = `_deleted_test123.${scenario.lang}`;
      if (!files[0]?.name.includes(expectedName)) {
        throw new Error(`Expected filename to contains ${JSON.stringify(expectedName)}, got ${JSON.stringify(files[0]?.name)}`);
      }

      const fullPath = join(migrationsDir, files[0]?.name ?? "");
      const content = await readFile(fullPath, "utf8");
      const contentStr = normalizeGeneratedTemplate(content.trim());
      const expectedTemplate = normalizeExpectedTemplate(scenario.expectedTemplate);
      if (contentStr !== expectedTemplate) {
        throw new Error(`Expected template \n${scenario.expectedTemplate}\ngot \n${content.trim()}`);
      }

      await cleanup();
    }
  });

  it("collection update", async () => {
    const scenarios = [
      { lang: TemplateLangJS, expectedTemplate: updateExpectedJS },
      { lang: TemplateLangGo, expectedTemplate: updateExpectedGo },
    ];

    for (const scenario of scenarios) {
      const { app, cleanup } = await newTestApp();

      const migrationsDir = join(app.DataDir(), "_test_migrations");

      // create dummy collection
      const collection = NewAuthCollection("test123");
      collection.ListRule = Pointer("@request.auth.id != '' && 1 != 2");
      collection.ViewRule = Pointer('id = "1"');
      collection.UpdateRule = Pointer('id = "2"');
      collection.CreateRule = null;
      collection.DeleteRule = Pointer('id = "3"');
      collection.indexes = new JSONArray("create index test1 on test123 (f1_name)");
      collection.ManageRule = Pointer("1 != 2");
      const f1 = new TextField();
      f1.Id = "f1_id";
      f1.Name = "f1_name";
      f1.Required = true;
      collection.Fields.Add(f1);

      const f2 = new NumberField();
      f2.Id = "f2_id";
      f2.Name = "f2_name";
      f2.Min = Pointer(10);
      collection.Fields.Add(f2);

      const f3 = new BoolField();
      f3.Id = "f3_id";
      f3.Name = "f3_name";
      collection.Fields.Add(f3);

      const saveErr = await app.Save(collection);
      if (saveErr) {
        throw new Error(`Failed to save dummy collection, got ${saveErr.message}`);
      }

      MustRegister(app, null, {
        TemplateLang: scenario.lang,
        Automigrate: true,
        Dir: migrationsDir,
      });
      app.bootstrap();

      // update the dummy collection
      collection.Name = "test123_update";
      collection.ListRule = Pointer("@request.auth.id != ''");
      collection.ViewRule = Pointer('id = "1"');
      collection.UpdateRule = Pointer('id = "2_update"');
      collection.CreateRule = Pointer('id = "nil_update"');
      collection.DeleteRule = null;
      collection.indexes = new JSONArray("create index test1 on test123_update (f1_name)");
      collection.Fields.RemoveById("f3_id");
      const f4 = new TextField();
      f4.Id = "f4_id";
      f4.Name = "f4_name";
      f4.Pattern = "`test backtick`123";
      collection.Fields.Add(f4);
      const f2Field = collection.Fields.GetById("f2_id");
      f2Field?.SetName("f2_name_new");
      collection.OAuth2.Enabled = true;
      collection.FileToken.Duration = 10;
      //  should be ignored
      collection.OAuth2.Providers = [
        Object.assign(new OAuth2ProviderConfig(), {
          Name: "gitlab",
          ClientId: "abc",
          ClientSecret: "123",
        }),
      ];
      const testSecret = "b".repeat(30);
      collection.AuthToken.Secret = testSecret;
      collection.FileToken.Secret = testSecret;
      collection.EmailChangeToken.Secret = testSecret;
      collection.PasswordResetToken.Secret = testSecret;
      collection.VerificationToken.Secret = testSecret;

      const requestEvent = new RequestEvent({ app, request: new Request("http://127.0.0.1") });
      const event = new CollectionRequestEvent(requestEvent, collection);
      const result = await app.OnCollectionUpdateRequest().Trigger(event, async (e) => e.App.Save(e.Collection));
      if (result instanceof Error) {
        throw new Error(`Failed to save dummy collection changes, got ${result.message}`);
      }

      const files = await readdir(migrationsDir, { withFileTypes: true });
      if (files.length !== 1) {
        throw new Error(`Expected 1 file to be generated, got ${files.length}`);
      }

      const expectedName = `_updated_test123.${scenario.lang}`;
      if (!files[0]?.name.includes(expectedName)) {
        throw new Error(`Expected filename to contains ${JSON.stringify(expectedName)}, got ${JSON.stringify(files[0]?.name)}`);
      }

      const fullPath = join(migrationsDir, files[0]?.name ?? "");
      const content = await readFile(fullPath, "utf8");
      const contentStr = normalizeGeneratedTemplate(content.trim());
      const expectedTemplate = normalizeExpectedTemplate(scenario.expectedTemplate);
      if (contentStr !== expectedTemplate) {
        throw new Error(`Expected template \n${scenario.expectedTemplate}\ngot \n${content.trim()}`);
      }

      await cleanup();
    }
  });

  it("collection no changes", async () => {
    const scenarios = [TemplateLangJS, TemplateLangGo];

    for (const lang of scenarios) {
      const { app, cleanup } = await newTestApp();

      const migrationsDir = join(app.DataDir(), "_test_migrations");

      const collection = NewAuthCollection("test123");
      const saveErr = await app.Save(collection);
      if (saveErr) {
        throw new Error(`Failed to save dummy collection, got ${saveErr.message}`);
      }

      MustRegister(app, null, {
        TemplateLang: lang,
        Automigrate: true,
        Dir: migrationsDir,
      });
      app.bootstrap();

      //  should be ignored
      collection.OAuth2.Providers = [
        Object.assign(new OAuth2ProviderConfig(), {
          Name: "gitlab",
          ClientId: "abc",
          ClientSecret: "123",
        }),
      ];
      const testSecret = "b".repeat(30);
      collection.AuthToken.Secret = testSecret;
      collection.FileToken.Secret = testSecret;
      collection.EmailChangeToken.Secret = testSecret;
      collection.PasswordResetToken.Secret = testSecret;
      collection.VerificationToken.Secret = testSecret;

      const requestEvent = new RequestEvent({ app, request: new Request("http://127.0.0.1") });
      const event = new CollectionRequestEvent(requestEvent, collection);
      const result = await app.OnCollectionUpdateRequest().Trigger(event, async (e) => e.App.Save(e.Collection));
      if (result instanceof Error) {
        throw new Error(`Failed to save dummy collection update, got ${result.message}`);
      }

      let files: Dirent[] = [];
      try {
        files = await readdir(migrationsDir, { withFileTypes: true });
      } catch (err) {
        const error = err as NodeJS.ErrnoException;
        if (error.code !== "ENOENT") {
          throw err;
        }
      }
      if (files.length !== 0) {
        throw new Error(`Expected 0 files to be generated, got ${files.length}`);
      }

      await cleanup();
    }
  });
});

function normalizeExpectedTemplate(template: string): string {
  const normalized = template
    .trim()
    .replaceAll("\\`", "`")
    .replaceAll(/\\\\+"/g, '\\"');
  return normalizeTemplateText(normalized);
}

function normalizeGeneratedTemplate(value: string): string {
  return normalizeTemplateText(value.trim());
}

function normalizeTemplateText(value: string): string {
  return value
    .replaceAll(/pbc_\d+/g, "@TEST_RANDOM")
    .replaceAll(/text\d+/g, "text@TEST_RANDOM")
    .replaceAll(/password\d+/g, "password@TEST_RANDOM")
    .replaceAll(/email\d+/g, "email@TEST_RANDOM")
    .replaceAll(/bool\d+/g, "bool@TEST_RANDOM");
}
