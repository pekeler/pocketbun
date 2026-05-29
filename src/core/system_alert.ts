// Ported from pocketbase/core/system_alert.go

import type { Message } from "../tools/mailer/mailer.ts";
import type { App } from "./app.ts";
import type { Record as RecordModel } from "./record_model.ts";
import { CollectionNameSuperusers } from "./collection_model.ts";

const systemAlertHTML = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <style>
        body, html {
            padding: 0;
            margin: 0;
            border: 0;
            color: #16161a;
            background: #fff;
            font-size: 14px;
            line-height: 20px;
            font-weight: normal;
            font-family: Source Sans Pro, sans-serif, emoji;
        }
        body {
            padding: 20px 30px;
        }
        p {
            display: block;
            margin: 10px 0;
            font-family: inherit;
        }
        small {
            font-size: 12px;
            line-height: 16px;
        }
        strong {
            font-weight: bold;
        }
        em, i {
            font-style: italic;
        }
        a {
            color: inherit;
        }
        .alert {
            padding: 15px;
            background: #e4e8ec;
            border-radius: 5px;
            white-space: pre-wrap;
        }
    </style>
</head>
<body>
    <p>{{.AppName}} system alert occurred:</p>
    <p class="alert"><strong>{{.AlertDetails}}</strong></p>
    <p>For more information you could explore the logs in the dashboard of your application.</p>
</body>
</html>`;

// sendSystemAlertToAllSuperusers sends a system error alert to all superusers.
//
// note: unexported upstream for now until there is clarity around the planned log level alerts.
export async function sendSystemAlertToAllSuperusers(app: App, subject: string, details: string): Promise<Error | null> {
  let superusers: RecordModel[];
  try {
    superusers = app.FindAllRecords(CollectionNameSuperusers);
  } catch (error) {
    return error as Error;
  }

  const alertErrors: Error[] = [];
  for (const superuser of superusers) {
    const err = await sendSystemAlert(app, superuser, subject, details);
    if (err) {
      alertErrors.push(err);
    }
  }

  return joinErrors(alertErrors);
}

// sendSystemAlert sends a system error alert to a single superuser.
//
// note: unexported upstream for now until there is clarity around the planned log level alerts.
export async function sendSystemAlert(
  app: App,
  superuser: RecordModel,
  subject: string,
  details: string,
): Promise<Error | null> {
  if (!superuser.IsSuperuser()) {
    return new Error("system alerts can be sent only to superusers");
  }

  if (!subject || !details) {
    return new Error("system alerts subject and details are required");
  }

  const html = systemAlertHTML
    .split("{{.AppName}}")
    .join(escapeHTML(app.settings().meta.appName))
    .split("{{.AlertDetails}}")
    .join(escapeHTML(details));

  const message: Message = {
    From: {
      Name: app.settings().meta.senderName,
      Address: app.settings().meta.senderAddress,
    },
    To: [{ Address: superuser.Email() }],
    Bcc: [],
    Cc: [],
    Subject: `[${app.settings().meta.appName} system alert] ${escapeHTML(subject)}`,
    HTML: html,
    Text: "",
  };

  const result = await app.NewMailClient().Send(message);
  return result instanceof Error ? result : null;
}

function joinErrors(errors: Error[]): Error | null {
  if (errors.length === 0) {
    return null;
  }
  if (errors.length === 1) {
    return errors[0]!;
  }
  return new AggregateError(errors, errors.map((err) => err.message).join("\n"));
}

function escapeHTML(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&#34;").replace(/'/g, "&#39;");
}
