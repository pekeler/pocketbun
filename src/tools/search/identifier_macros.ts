// Ported from pocketbase/tools/search/identifier_macros.go @ v0.36.1 (9b036fb1)

export function resolveIdentifierMacro(name: string, now = new Date()): unknown {
  switch (name) {
    case "@now":
      return formatDateTime(now);
    case "@yesterday":
      return formatDateTime(addDays(now, -1));
    case "@tomorrow":
      return formatDateTime(addDays(now, 1));
    case "@second":
      return now.getUTCSeconds();
    case "@minute":
      return now.getUTCMinutes();
    case "@hour":
      return now.getUTCHours();
    case "@day":
      return now.getUTCDate();
    case "@month":
      return now.getUTCMonth() + 1;
    case "@weekday":
      return now.getUTCDay();
    case "@year":
      return now.getUTCFullYear();
    case "@todayStart":
      return formatDateTime(startOfDay(now));
    case "@todayEnd":
      return formatDateTime(endOfDay(now));
    case "@monthStart":
      return formatDateTime(startOfMonth(now));
    case "@monthEnd":
      return formatDateTime(endOfMonth(now));
    case "@yearStart":
      return formatDateTime(startOfYear(now));
    case "@yearEnd":
      return formatDateTime(endOfYear(now));
    default:
      return undefined;
  }
}

function formatDateTime(date: Date): string {
  const iso = date.toISOString();
  return iso.replace("T", " ").replace("Z", "Z");
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function startOfDay(date: Date): Date {
  const next = new Date(date.getTime());
  next.setUTCHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date): Date {
  const next = new Date(date.getTime());
  next.setUTCHours(23, 59, 59, 999);
  return next;
}

function startOfMonth(date: Date): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(1);
  next.setUTCHours(0, 0, 0, 0);
  return next;
}

function endOfMonth(date: Date): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + 1);
  next.setUTCHours(23, 59, 59, 999);
  next.setUTCDate(0);
  return next;
}

function startOfYear(date: Date): Date {
  const next = new Date(date.getTime());
  next.setUTCMonth(0, 1);
  next.setUTCHours(0, 0, 0, 0);
  return next;
}

function endOfYear(date: Date): Date {
  const next = new Date(date.getTime());
  next.setUTCMonth(11, 31);
  next.setUTCHours(23, 59, 59, 999);
  return next;
}
