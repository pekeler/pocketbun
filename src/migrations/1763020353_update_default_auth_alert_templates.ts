// Ported from pocketbase/migrations/1763020353_update_default_auth_alert_templates.go @ v0.36.1 (9b036fb1)

import type { App } from "../core/app.ts";
import { SystemMigrations } from "../core/migrations_runner.ts";

const FILE_NAME = "1763020353_update_default_auth_alert_templates.go";

const oldAuthAlertTemplate = `<p>Hello,</p>
<p>We noticed a login to your {APP_NAME} account from a new location.</p>
<p>If this was you, you may disregard this email.</p>
<p><strong>If this wasn't you, you should immediately change your {APP_NAME} account password to revoke access from all other locations.</strong></p>
<p>
  Thanks,<br/>
  {APP_NAME} team
</p>`;

const newAuthAlertTemplate = `<p>Hello,</p>
<p>We noticed a login to your {APP_NAME} account from a new location:</p>
<p><em>{ALERT_INFO}</em></p>
<p><strong>If this wasn't you, you should immediately change your {APP_NAME} account password to revoke access from all other locations.</strong></p>
<p>If this was you, you may disregard this email.</p>
<p>
  Thanks,<br/>
  {APP_NAME} team
</p>`;

SystemMigrations.register(up, down, FILE_NAME);

function up(app: App): void {
  updateAuthAlertTemplate(app, oldAuthAlertTemplate, newAuthAlertTemplate);
}

function down(app: App): void {
  updateAuthAlertTemplate(app, newAuthAlertTemplate, oldAuthAlertTemplate);
}

function updateAuthAlertTemplate(app: App, from: string, to: string): void {
  const db = app.db();
  const rows = db.query("select id, options from _collections where type = 'auth'").all() as Array<{
    id: string;
    options: string;
  }>;

  for (const row of rows) {
    const options = parseJson<Record<string, unknown>>(row.options, {});
    const authAlert = (options.authAlert as Record<string, unknown> | undefined) ?? {};
    const emailTemplate = (authAlert.emailTemplate as Record<string, unknown> | undefined) ?? {};
    if (emailTemplate.body !== from) {
      continue;
    }

    emailTemplate.body = to;
    authAlert.emailTemplate = emailTemplate;
    options.authAlert = authAlert;

    db.query("update _collections set options = ? where id = ?").run(
      JSON.stringify(options),
      row.id,
    );
  }
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  if (value && typeof value === "object") {
    return value as T;
  }
  return fallback;
}
