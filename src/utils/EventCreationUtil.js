// Shared with the event API so the form and server use the same validation rules.
const MAILAVERSE_ORGANIZER = {
  id: "mailaverse",
  name: "Mailaverse",
  icon: "https://static.wixstatic.com/media/255d46_b08eb7f7e1134cd8b8d5758d0ab3d99e~mv2.png/v1/fill/w_61,h_55,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/Mailaverse%20Logo.png",
};

const isValidTimezone = (timezone) => {
  if (typeof timezone !== "string" || !timezone || timezone.length > 80) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
    return true;
  } catch (_) {
    return false;
  }
};

// Interpret datetime-local in the selected event timezone, not the browser timezone.
const eventDateToIso = (value, timezone) => {
  if (!isValidTimezone(timezone)) throw new Error("invalidTimezone");
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    throw new Error("invalidDates");
  }
  const wallTime = Date.parse(`${value}:00Z`);
  if (!Number.isFinite(wallTime)) throw new Error("invalidDates");
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  });
  const inTimezone = (instant) => {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(({ type, value: part }) => [type, part]));
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  };
  let instant = wallTime;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const displayed = inTimezone(instant);
    if (displayed === value) return new Date(instant).toISOString();
    instant += wallTime - Date.parse(`${displayed}:00Z`);
  }
  // Reject nonexistent local times at daylight-saving transitions.
  throw new Error("invalidDates");
};

const eventDateToLocal = (value, timezone) => {
  if (!value) return "";
  if (typeof value !== "string" || !/(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return value;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || !isValidTimezone(timezone)) return value;
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date).map(({ type, value: part }) => [type, part]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
};

const validateEventDetails = (data, now = Date.now()) => {
  for (const [field, maxLength] of [["companyId", 200], ["header", 160], ["adContent", 5000], ["venue", 300]]) {
    if (typeof data[field] !== "string" || !data[field].trim() || data[field].trim().length > maxLength) {
      return { field, code: "requiredDetails" };
    }
  }
  if (!isValidTimezone(data.timezone)) return { field: "timezone", code: "invalidTimezone" };
  const dates = [data.startsAt, data.endsAt, data.applicationDeadline].map((value) =>
    typeof value === "string" && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? Date.parse(value) : NaN,
  );
  if (dates.some((date) => !Number.isFinite(date))) return { field: "dates", code: "invalidDates" };
  const [start, end, deadline] = dates;
  if (start <= now) return { field: "startsAt", code: "startFuture" };
  if (end <= start) return { field: "endsAt", code: "endAfterStart" };
  if (deadline <= now) return { field: "applicationDeadline", code: "deadlineFuture" };
  if (deadline > start) return { field: "applicationDeadline", code: "deadlineBeforeStart" };
  if (data.capacity !== "" && data.capacity != null && (!Number.isSafeInteger(Number(data.capacity)) || Number(data.capacity) < 1)) {
    return { field: "capacity", code: "invalidCapacity" };
  }
  if (data.confirmationRequired !== undefined && typeof data.confirmationRequired !== "boolean") {
    return { field: "confirmationRequired", code: "invalidConfirmation" };
  }
  const scheduledAt = data.targetBudget?.scheduledAt || data.scheduledAt;
  if (scheduledAt && (typeof scheduledAt !== "string" || !/(?:Z|[+-]\d{2}:\d{2})$/.test(scheduledAt) || !Number.isFinite(Date.parse(scheduledAt)) || Date.parse(scheduledAt) <= now || Date.parse(scheduledAt) >= deadline)) {
    return { field: "scheduledAt", code: "scheduleBeforeDeadline" };
  }
  return null;
};

module.exports = { MAILAVERSE_ORGANIZER, isValidTimezone, eventDateToIso, eventDateToLocal, validateEventDetails };