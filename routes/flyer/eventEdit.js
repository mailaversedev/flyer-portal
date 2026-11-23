const {
  MAILAVERSE_ORGANIZER,
  EVENT_ENROLLMENT_FIELDS,
  EVENT_TIMING_FIELDS,
  eventEnrollmentLocked,
  validateEventDetails,
} = require("../../src/utils/EventCreationUtil");
const messages = require("../../src/i18n/locales/en/common.json").eventCreation;

const eventEditError = (status, code, field) =>
  Object.assign(new Error(messages[code]), { status, code, field });

const eventCheckinConfigured = () =>
  process.env.EVENT_CHECKIN_SECRET?.length >= 32 &&
  /^https:\/\/[^/]+\/?$/.test(process.env.EVENT_PUBLIC_BASE_URL || "");

async function prepareEventEdit({ data, existing, db, transaction, now }) {
  const textFields = ["header", "adContent", "venue", "companyId", "timezone"];
  const editable = [...textFields, ...EVENT_ENROLLMENT_FIELDS.filter((field) => !textFields.includes(field))];
  const patch = Object.fromEntries(editable.filter((field) => Object.hasOwn(data, field)).map((field) => [
    field,
    textFields.includes(field) && typeof data[field] === "string" ? data[field].trim() : data[field],
  ]));

  const changed = (field) => Object.hasOwn(patch, field) && patch[field] !== existing[field];
  if (eventEnrollmentLocked(existing) && EVENT_ENROLLMENT_FIELDS.some(changed)) {
    throw eventEditError(409, "enrollmentLocked");
  }

  const nowMs = Date.parse(now);
  const timingChanged = EVENT_TIMING_FIELDS.some(changed);
  const merged = {
    ...existing,
    ...patch,
    targetBudget: null,
    scheduledAt: timingChanged && Date.parse(existing.scheduledAt) > nowMs ? existing.scheduledAt : null,
  };
  // Closed events can still receive copy edits without moving their existing dates.
  const invalid = validateEventDetails(merged, timingChanged ? nowMs : -Infinity);
  if (invalid) throw eventEditError(400, invalid.code, invalid.field);
  if (changed("confirmationRequired") && patch.confirmationRequired && !eventCheckinConfigured()) {
    throw eventEditError(503, "checkinNotConfigured", "confirmationRequired");
  }
  if (Object.hasOwn(patch, "capacity")) {
    patch.capacity = patch.capacity == null || patch.capacity === "" ? null : Number(patch.capacity);
  }
  for (const field of EVENT_TIMING_FIELDS) {
    if (field !== "timezone" && Object.hasOwn(patch, field)) {
      patch[field] = new Date(patch[field]).toISOString();
    }
  }
  if (changed("companyId")) {
    const isMailaverse = patch.companyId === MAILAVERSE_ORGANIZER.id;
    let company = MAILAVERSE_ORGANIZER;
    if (!isMailaverse) {
      if (patch.companyId.includes("/")) throw eventEditError(400, "merchantNotFound", "companyId");
      const merchant = await transaction.get(db.collection("companies").doc(patch.companyId));
      if (!merchant.exists || merchant.data()?.isActive === false) {
        throw eventEditError(400, "merchantNotFound", "companyId");
      }
      company = merchant.data();
    }
    Object.assign(patch, {
      companyName: company.name || "",
      companyDisplayName: company.companyDisplayName || company.name || "",
      companyIcon: company.icon || MAILAVERSE_ORGANIZER.icon,
      hideCompanyDetail: isMailaverse,
    });
  }
  return patch;
}

module.exports = { prepareEventEdit, eventCheckinConfigured };
