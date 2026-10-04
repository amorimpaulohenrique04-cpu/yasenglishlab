export function localAvailabilityToIso(date: string, time: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match || !timeMatch) throw new RangeError("Invalid availability date or time.");
  const [, year, month, day] = match;
  const [, hour, minute] = timeMatch;
  const target = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );
  const checkFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const dateParts = checkFormatter.formatToParts(new Date(target));
  const part = (parts: Intl.DateTimeFormatPart[], type: string) =>
    Number(parts.find((item) => item.type === type)?.value);
  if (
    part(dateParts, "year") !== Number(year) ||
    part(dateParts, "month") !== Number(month) ||
    part(dateParts, "day") !== Number(day) ||
    Number(hour) > 23 ||
    Number(minute) > 59
  ) {
    throw new RangeError("Invalid availability date or time.");
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Recife",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  let instant = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = formatter.formatToParts(new Date(instant));
    const localAsUtc = Date.UTC(
      part(parts, "year"),
      part(parts, "month") - 1,
      part(parts, "day"),
      part(parts, "hour"),
      part(parts, "minute"),
    );
    instant += target - localAsUtc;
  }
  return new Date(instant).toISOString();
}
