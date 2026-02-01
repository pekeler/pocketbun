// Ported from pocketbase/tools/cron/schedule.go

export type SlotMap = Record<number, Record<string, never>>;

// Moment represents a parsed single time moment.
export class Moment {
  Minute: number;
  Hour: number;
  Day: number;
  Month: number;
  DayOfWeek: number;

  constructor(minute: number, hour: number, day: number, month: number, dayOfWeek: number) {
    this.Minute = minute;
    this.Hour = hour;
    this.Day = day;
    this.Month = month;
    this.DayOfWeek = dayOfWeek;
  }
}

const weekdayIndex: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function momentFromDate(date: Date, timeZone: string): Moment {
  if (!timeZone || timeZone.toUpperCase() === "UTC") {
    return new Moment(date.getUTCMinutes(), date.getUTCHours(), date.getUTCDate(), date.getUTCMonth() + 1, date.getUTCDay());
  }

  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      weekday: "short",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    });

    const parts = formatter.formatToParts(date);
    const lookup: Record<string, string> = {};
    for (const part of parts) {
      lookup[part.type] = part.value;
    }

    const weekday = lookup.weekday ?? "";
    return new Moment(
      Number(lookup.minute),
      Number(lookup.hour),
      Number(lookup.day),
      Number(lookup.month),
      weekdayIndex[weekday] ?? 0,
    );
  } catch {
    return new Moment(date.getUTCMinutes(), date.getUTCHours(), date.getUTCDate(), date.getUTCMonth() + 1, date.getUTCDay());
  }
}

// NewMoment creates a new Moment from the specified time.
export function NewMoment(date: Date, timeZone = "UTC"): Moment {
  return momentFromDate(date, timeZone);
}

// Schedule stores parsed information for each time component when a cron job should run.
export class Schedule {
  minutes: SlotMap;
  hours: SlotMap;
  days: SlotMap;
  months: SlotMap;
  daysOfWeek: SlotMap;
  #rawExpr: string;

  constructor(minutes: SlotMap, hours: SlotMap, days: SlotMap, months: SlotMap, daysOfWeek: SlotMap, rawExpr: string) {
    this.minutes = minutes;
    this.hours = hours;
    this.days = days;
    this.months = months;
    this.daysOfWeek = daysOfWeek;
    this.#rawExpr = rawExpr;
  }

  // IsDue checks whether the provided Moment satisfies the current Schedule.
  IsDue(m: Moment): boolean {
    if (!this.minutes[m.Minute]) {
      return false;
    }
    if (!this.hours[m.Hour]) {
      return false;
    }
    if (!this.days[m.Day]) {
      return false;
    }
    if (!this.daysOfWeek[m.DayOfWeek]) {
      return false;
    }
    if (!this.months[m.Month]) {
      return false;
    }
    return true;
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

  const minutes = parseCronSegment(segments[0] ?? "", 0, 59);
  const hours = parseCronSegment(segments[1] ?? "", 0, 23);
  const days = parseCronSegment(segments[2] ?? "", 1, 31);
  const months = parseCronSegment(segments[3] ?? "", 1, 12);
  const daysOfWeek = parseCronSegment(segments[4] ?? "", 0, 6);

  return new Schedule(minutes, hours, days, months, daysOfWeek, cronExpr);
}

// parseCronSegment parses a single cron expression segment and
// returns its time schedule slots.
function parseCronSegment(segment: string, min: number, max: number): SlotMap {
  const slots: SlotMap = {};
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

    for (let i = rangeMin; i <= rangeMax; i += step) {
      slots[i] = {};
    }
  }

  return slots;
}
