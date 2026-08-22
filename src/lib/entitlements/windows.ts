export interface QuotaWindow {
  periodStart: Date;
  periodEnd: Date;
}

export function calendarMonthWindow(now: Date = new Date()): QuotaWindow {
  const periodStart = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    1,
  );
  const periodEnd = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth() + 1,
    1,
  );
  return { periodStart: new Date(periodStart), periodEnd: new Date(periodEnd) };
}

export function utcDayWindow(now: Date = new Date()): QuotaWindow {
  const periodStart = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const periodEnd = periodStart + 24 * 60 * 60 * 1000;
  return { periodStart: new Date(periodStart), periodEnd: new Date(periodEnd) };
}

export function windowContains(
  window: QuotaWindow,
  at: Date = new Date(),
): boolean {
  return at >= window.periodStart && at < window.periodEnd;
}
