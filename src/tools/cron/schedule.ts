// Ported from pocketbase/tools/cron/schedule.go
//
// Deviation: PocketBun delegates cron expression validation to Bun's native
// parser so app cron setup can use the same grammar Bun.cron(...) executes.

// Schedule stores a validated cron expression in normalized form.
export class Schedule {
  #rawExpr: string;

  constructor(rawExpr: string) {
    this.#rawExpr = rawExpr;
  }

  Expression(): string {
    return this.#rawExpr;
  }
}

const macros: Record<string, string> = {
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
  "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@hourly": "0 * * * *",
};

const bunWithCronParser = Bun as unknown as {
  cron: {
    parse: (cronExpr: string) => Date;
  };
};

const bunCronParse = bunWithCronParser.cron.parse.bind(bunWithCronParser.cron);

// NewSchedule creates a new Schedule from a cron expression.
//
// The accepted syntax matches Bun.cron(...), including standard 5-field cron
// expressions, macros such as @daily/@hourly, named months/weekdays, and
// Sunday represented as either 0 or 7.
export function NewSchedule(cronExpr: string): Schedule {
  cronExpr = cronExpr.trim();

  const mapped = macros[cronExpr];
  if (mapped) {
    cronExpr = mapped;
  } else {
    cronExpr = cronExpr.split(/\s+/).join(" ");
  }

  bunCronParse(cronExpr);

  return new Schedule(cronExpr);
}
