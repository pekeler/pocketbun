// Ported from pocketbase/tools/cron/schedule.go

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

// NewSchedule creates a new Schedule from a cron expression.
//
// A cron expression could be a macro OR 5 segments separated by space,
// representing: minute, hour, day of the month, month and day of the week.
//
// The following segment formats are supported:
//   - wildcard: *
//   - range:    1-30
//   - step:     */n or 1-30/n
//   - list:     1,2,3,10-20/n
//
// The following macros are supported:
//   - @yearly (or @annually)
//   - @monthly
//   - @weekly
//   - @daily (or @midnight)
//   - @hourly
export function NewSchedule(cronExpr: string): Schedule {
  const mapped = macros[cronExpr];
  if (mapped) {
    cronExpr = mapped;
  }

  const segments = cronExpr.split(" ");
  if (segments.length !== 5) {
    throw new Error("invalid cron expression - must be a valid macro or to have exactly 5 space separated segments");
  }

  validateCronSegment(segments[0] ?? "", 0, 59);
  validateCronSegment(segments[1] ?? "", 0, 23);
  validateCronSegment(segments[2] ?? "", 1, 31);
  validateCronSegment(segments[3] ?? "", 1, 12);
  validateCronSegment(segments[4] ?? "", 0, 6);

  return new Schedule(cronExpr);
}

// validateCronSegment parses a single cron expression segment and
// validates its time schedule slots.
function validateCronSegment(segment: string, min: number, max: number): void {
  const list = segment.split(",");

  for (const part of list) {
    const stepParts = part.split("/");

    let step: number;
    switch (stepParts.length) {
      case 1:
        step = 1;
        break;
      case 2: {
        const parsedStep = Number(stepParts[1]);
        if (!Number.isFinite(parsedStep)) {
          throw new Error("invalid segment step format - must be in the format */n or 1-30/n");
        }
        if (parsedStep < 1 || parsedStep > max) {
          throw new Error(`invalid segment step boundary - the step must be between 1 and the ${max}`);
        }
        step = parsedStep;
        break;
      }
      default:
        throw new Error("invalid segment step format - must be in the format */n or 1-30/n");
    }

    let rangeMin: number;
    let rangeMax: number;
    if ((stepParts[0] ?? "") === "*") {
      rangeMin = min;
      rangeMax = max;
    } else {
      const rangeParts = (stepParts[0] ?? "").split("-");
      if (rangeParts.some((part) => part === "")) {
        throw new Error("invalid segment range format - the range must have 1 or 2 parts");
      }
      switch (rangeParts.length) {
        case 1: {
          if (step !== 1) {
            throw new Error("invalid segement step - step > 1 could be used only with the wildcard or range format");
          }
          const parsed = Number(rangeParts[0]);
          if (!Number.isFinite(parsed)) {
            throw new Error("invalid segment value - must be between the min and max of the segment");
          }
          if (parsed < min || parsed > max) {
            throw new Error("invalid segment value - must be between the min and max of the segment");
          }
          rangeMin = parsed;
          rangeMax = rangeMin;
          break;
        }
        case 2: {
          const parsedMin = Number(rangeParts[0]);
          if (!Number.isFinite(parsedMin)) {
            throw new Error("invalid segment range minimum - must be between the min and max of the segment");
          }
          if (parsedMin < min || parsedMin > max) {
            throw new Error(`invalid segment range minimum - must be between ${min} and ${max}`);
          }
          rangeMin = parsedMin;

          const parsedMax = Number(rangeParts[1]);
          if (!Number.isFinite(parsedMax)) {
            throw new Error("invalid segment range maximum - must be between the min and max of the segment");
          }
          if (parsedMax < parsedMin || parsedMax > max) {
            throw new Error(`invalid segment range maximum - must be between ${rangeMin} and ${max}`);
          }
          rangeMax = parsedMax;
          break;
        }
        default:
          throw new Error("invalid segment range format - the range must have 1 or 2 parts");
      }
    }
    void rangeMin;
    void rangeMax;
    void step;
  }
}
