export function dateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function newYorkMarketContext(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const weekday = get("weekday");
  const minutes = Number(get("hour")) * 60 + Number(get("minute"));
  return {
    sessionDate: dateInTimeZone(now, "America/New_York"),
    weekday,
    isWeekday: weekday !== "Sat" && weekday !== "Sun",
    isAfterCloseBuffer: minutes >= 16 * 60 + 10,
  };
}

/** The latest date whose regular close has had time to publish, including overnight retries. */
export function completedSessionCutoff(now = new Date()): string {
  const context = newYorkMarketContext(now);
  if (context.isAfterCloseBuffer) return context.sessionDate;
  const previous = new Date(`${context.sessionDate}T12:00:00Z`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  return previous.toISOString().slice(0, 10);
}

/** Include the entire New York ledger day, respecting daylight saving time. */
export function sessionEndTimestamp(sessionDate: string): string {
  const nextNoon = new Date(`${sessionDate}T12:00:00Z`);
  nextNoon.setUTCDate(nextNoon.getUTCDate() + 1);
  const hour = Number(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", hour: "2-digit", hourCycle: "h23",
  }).format(nextNoon));
  return new Date(nextNoon.getTime() - hour * 3_600_000 - 1).toISOString();
}
