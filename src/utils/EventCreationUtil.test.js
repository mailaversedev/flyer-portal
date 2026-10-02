const { eventDateToIso, eventDateToLocal, validateEventDetails, isValidTimezone } = require("./EventCreationUtil");

test("accepts UTC and valid timezone aliases", () => {
  ["UTC", "Asia/Kolkata", "US/Eastern", "Asia/Hong_Kong"].forEach((timezone) => expect(isValidTimezone(timezone)).toBe(true));
  expect(isValidTimezone("Invalid/Timezone")).toBe(false);
});

test("interprets event wall-clock dates in the selected timezone", () => {
  expect(eventDateToIso("2099-10-10T12:00", "Asia/Hong_Kong")).toBe("2099-10-10T04:00:00.000Z");
  expect(eventDateToIso("2099-10-10T12:00", "UTC")).toBe("2099-10-10T12:00:00.000Z");
  expect(eventDateToIso("2027-07-10T12:00", "America/New_York")).toBe("2027-07-10T16:00:00.000Z");
  expect(eventDateToLocal("2099-10-10T04:00:00.000Z", "Asia/Hong_Kong")).toBe("2099-10-10T12:00");
});

test("rejects nonexistent dates and daylight-saving wall-clock times", () => {
  expect(() => eventDateToIso("2027-03-14T02:30", "America/New_York")).toThrow("invalidDates");
  expect(() => eventDateToIso("2099-02-30T12:00", "UTC")).toThrow("invalidDates");
});

test("reports invalid date order and deadline independently", () => {
  const data = { companyId: "mailaverse", header: "Event", adContent: "Details", venue: "Venue", timezone: "UTC", startsAt: "2099-10-10T12:00:00Z", endsAt: "2099-10-10T14:00:00Z", applicationDeadline: "2099-10-09T12:00:00Z" };
  expect(validateEventDetails(data)).toBeNull();
  expect(validateEventDetails({ ...data, endsAt: data.startsAt })).toEqual({ field: "endsAt", code: "endAfterStart" });
  expect(validateEventDetails({ ...data, applicationDeadline: data.endsAt })).toEqual({ field: "applicationDeadline", code: "deadlineBeforeStart" });
});