const test = require("node:test");
const assert = require("node:assert/strict");

const { MAILAVERSE_ORGANIZER } = require("../src/utils/EventCreationUtil");

const validBody = (overrides = {}) => ({
  companyId: "merchant-test",
  header: "Test event",
  adContent: "Event description",
  venue: "Test venue",
  startsAt: "2099-06-10T10:00:00Z",
  endsAt: "2099-06-10T12:00:00Z",
  applicationDeadline: "2099-06-09T10:00:00Z",
  timezone: "UTC",
  capacity: "25",
  confirmationRequired: false,
  coverPhoto: "https://example.invalid/event-cover.png",
  ...overrides,
});

function harness(createEventsRouter, options = {}) {
  const company = options.company || {
    name: "Test merchant",
    companyDisplayName: "Merchant display name",
    icon: "https://example.invalid/merchant-icon.png",
    isActive: true,
  };
  const lookups = [];
  const writes = [];
  const db = {
    collection(name) {
      if (name === "companies") {
        return {
          doc(id) {
            lookups.push(id);
            return {
              async get() {
                return { exists: options.exists !== false, data: () => company };
              },
            };
          },
        };
      }
      assert.equal(name, "flyers", "Unexpected database collection");
      return {
        async add(flyer) {
          writes.push(flyer);
          return { id: "event-test-id" };
        },
      };
    },
  };
  const router = createEventsRouter({ db });
  const layer = router.stack.find((entry) =>
    entry.route?.path === "/flyer/events" && entry.route.methods.post,
  );
  assert.ok(layer, "POST /flyer/events must be registered");
  const handler = layer.route.stack[layer.route.stack.length - 1].handle;
  return {
    company,
    lookups,
    writes,
    async invoke(body = validBody(), user = { role: "super-admin", userId: "admin-test" }) {
      const res = {
        statusCode: 200,
        payload: undefined,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.payload = payload; return this; },
      };
      await handler({ body, user }, res);
      assert.ok(res.payload, "Handler must send a JSON response");
      return res;
    },
  };
}

function assertRejected(res, fixture, status, field, code) {
  assert.equal(res.statusCode, status);
  assert.equal(res.payload.success, false);
  if (field !== undefined) assert.equal(res.payload.field, field);
  if (code !== undefined) assert.equal(res.payload.code, code);
  assert.equal(fixture.writes.length, 0, "Rejected events must not be persisted");
}

test("POST /flyer/events regression tests", { concurrency: false }, async (t) => {
  // Resolve without loading auth: real Firebase initialization must never run.
  const authPath = require.resolve("../routes/auth");
  const routerPath = require.resolve("../routes/flyer/events");
  const savedAuth = require.cache[authPath];
  const savedRouter = require.cache[routerPath];
  const envNames = ["EVENT_CHECKIN_SECRET", "EVENT_PUBLIC_BASE_URL"];
  const savedEnv = envNames.map((name) => [name, process.env[name]]);
  require.cache[authPath] = {
    id: authPath,
    filename: authPath,
    loaded: true,
    exports: {
      authenticateToken() {
        assert.fail("Direct invocation must skip authentication middleware");
      },
    },
  };
  delete require.cache[routerPath];
  for (const name of envNames) delete process.env[name];

  try {
    const createEventsRouter = require(routerPath);
    const serial = { concurrency: false };

    await t.test("valid merchant and UTC do not depend on supportedValuesOf", serial, async () => {
      const descriptor = Object.getOwnPropertyDescriptor(Intl, "supportedValuesOf");
      Object.defineProperty(Intl, "supportedValuesOf", {
        configurable: true,
        value() { assert.fail("Timezone validation must not use supportedValuesOf"); },
      });
      try {
        const fixture = harness(createEventsRouter);
        const res = await fixture.invoke(validBody({
          companyId: " merchant-test ", header: " Test event ",
          adContent: " Event description ", venue: " Test venue ",
        }));
        assert.equal(res.statusCode, 201);
        assert.equal(res.payload.success, true);
        assert.equal(res.payload.flyerId, "event-test-id");
        assert.deepEqual(fixture.lookups, ["merchant-test"]);
        assert.equal(fixture.writes.length, 1);
        const stored = fixture.writes[0];
        assert.equal(stored.type, "event");
        assert.equal(stored.timezone, "UTC");
        assert.equal(stored.header, "Test event");
        assert.equal(stored.adContent, "Event description");
        assert.equal(stored.venue, "Test venue");
        assert.equal(stored.companyName, fixture.company.name);
        assert.equal(stored.companyDisplayName, fixture.company.companyDisplayName);
        assert.equal(stored.companyIcon, fixture.company.icon);
        assert.equal(stored.hideCompanyDetail, false);
        assert.equal(stored.capacity, 25);
        assert.equal(stored.startsAt, "2099-06-10T10:00:00.000Z");
        assert.equal(stored.endsAt, "2099-06-10T12:00:00.000Z");
        assert.equal(stored.applicationDeadline, "2099-06-09T10:00:00.000Z");
        assert.equal(stored.applicantCount, 0);
        assert.equal(stored.confirmedCount, 0);
        assert.equal(stored.noReward, true);
        assert.deepEqual(res.payload.data, { id: "event-test-id", ...stored });
      } finally {
        if (descriptor) Object.defineProperty(Intl, "supportedValuesOf", descriptor);
        else delete Intl.supportedValuesOf;
      }
    });

    await t.test("Mailaverse sentinel uses default icon without company lookup", serial, async () => {
      const fixture = harness(createEventsRouter);
      const res = await fixture.invoke(validBody({ companyId: "mailaverse" }));
      assert.equal(res.statusCode, 201);
      assert.deepEqual(fixture.lookups, []);
      assert.equal(fixture.writes.length, 1);
      assert.equal(fixture.writes[0].companyId, "mailaverse");
      assert.equal(fixture.writes[0].companyName, MAILAVERSE_ORGANIZER.name);
      assert.equal(fixture.writes[0].companyIcon, MAILAVERSE_ORGANIZER.icon);
      assert.equal(fixture.writes[0].hideCompanyDetail, true);
    });

    for (const override of [undefined, "https://example.invalid/override-icon.png"]) {
      await t.test(override ? "HTTPS organizer icon override is stored" : "merchant missing icon uses default fallback", serial, async () => {
        const fixture = harness(createEventsRouter, { company: { name: "No icon merchant", isActive: true } });
        const res = await fixture.invoke(validBody(override ? { companyIcon: override } : {}));
        assert.equal(res.statusCode, 201);
        assert.equal(fixture.writes.length, 1);
        assert.equal(fixture.writes[0].companyIcon, override || MAILAVERSE_ORGANIZER.icon);
        assert.equal(fixture.writes[0].companyDisplayName, "No icon merchant");
        assert.equal(fixture.writes[0].hideCompanyDetail, false);
      });
    }

    const dateCases = [
      ["endBeforeStart", { endsAt: "2099-06-10T09:00:00Z" }, "endsAt", "endAfterStart"],
      ["end equals start", { endsAt: "2099-06-10T10:00:00Z" }, "endsAt", "endAfterStart"],
      ["deadline after start", { applicationDeadline: "2099-06-10T11:00:00Z" }, "applicationDeadline", "deadlineBeforeStart"],
      ["deadline in past", { applicationDeadline: "2000-01-01T00:00:00Z" }, "applicationDeadline", "deadlineFuture"],
      ["date missing timezone offset", { startsAt: "2099-06-10T10:00:00" }, "dates", "invalidDates"],
    ];
    for (const [name, overrides, field, code] of dateCases) {
      await t.test(name, serial, async () => {
        const fixture = harness(createEventsRouter);
        assertRejected(await fixture.invoke(validBody(overrides)), fixture, 400, field, code);
        assert.deepEqual(fixture.lookups, []);
      });
    }

    for (const coverPhoto of [undefined, "", "http://example.invalid/cover.png", "blob:test-upload"]) {
      await t.test(`rejects missing or non-uploaded HTTPS cover: ${String(coverPhoto)}`, serial, async () => {
        const fixture = harness(createEventsRouter);
        assertRejected(await fixture.invoke(validBody({ coverPhoto })), fixture, 400, "coverPhoto");
        assert.deepEqual(fixture.lookups, []);
      });
    }

    await t.test("Asia/Kolkata alias is a valid timezone", serial, async () => {
      const fixture = harness(createEventsRouter);
      const res = await fixture.invoke(validBody({ timezone: "Asia/Kolkata" }));
      assert.equal(res.statusCode, 201);
      assert.equal(fixture.writes.length, 1);
      assert.equal(fixture.writes[0].timezone, "Asia/Kolkata");
    });

    for (const options of [{ company: { name: "Inactive merchant", isActive: false } }, { exists: false }]) {
      await t.test(options.exists === false ? "missing merchant is rejected" : "inactive merchant is rejected", serial, async () => {
        const fixture = harness(createEventsRouter, options);
        const res = await fixture.invoke();
        assertRejected(res, fixture, 400, "companyId");
        assert.equal(res.payload.message, "Active merchant not found");
        assert.deepEqual(fixture.lookups, ["merchant-test"]);
      });
    }

    await t.test("schedule before deadline persists only allowlisted targeting and forces noReward", serial, async () => {
      const fixture = harness(createEventsRouter);
      const res = await fixture.invoke(validBody({
        noReward: false, budget: 999999, status: "draft", applicantCount: 500,
        scheduledAt: "2099-06-07T10:00:00Z",
        targetBudget: {
          district: "Test district", propertyEstate: "Test estate", targetedGroup: "Test group",
          aiTargeted: true, noSpecific: true, noReward: false,
          scheduledAt: "2099-06-08T10:00:00+00:00",
          budget: 999999, reward: 999999, totalBudget: 999999, unknown: "ignore me",
        },
      }));
      assert.equal(res.statusCode, 201);
      assert.equal(fixture.writes.length, 1);
      const stored = fixture.writes[0];
      assert.equal(stored.scheduledAt, "2099-06-08T10:00:00.000Z");
      assert.deepEqual(stored.targetBudget, {
        district: "Test district", propertyEstate: "Test estate", targetedGroup: "Test group",
        aiTargeted: true, noSpecific: true, noReward: true,
        scheduledAt: "2099-06-08T10:00:00.000Z",
      });
      assert.equal(stored.noReward, true);
      assert.equal(stored.status, "active");
      assert.equal(stored.applicantCount, 0);
      assert.equal(Object.hasOwn(stored, "budget"), false);
    });

    await t.test("top-level scheduledAt is persisted when targeting has no schedule", serial, async () => {
      const fixture = harness(createEventsRouter);
      const res = await fixture.invoke(validBody({ scheduledAt: "2099-06-08T10:00:00Z" }));
      assert.equal(res.statusCode, 201);
      assert.equal(fixture.writes[0].scheduledAt, "2099-06-08T10:00:00.000Z");
      assert.equal(fixture.writes[0].targetBudget.scheduledAt, fixture.writes[0].scheduledAt);
    });

    for (const scheduledAt of ["not-a-date", "2000-01-01T00:00:00Z", "2099-06-09T10:00:00Z", "2099-06-10T10:00:00Z"]) {
      for (const location of ["scheduledAt", "targetBudget"]) {
        await t.test(`bad ${location} schedule: ${scheduledAt}`, serial, async () => {
          const fixture = harness(createEventsRouter);
          const overrides = location === "targetBudget" ? { targetBudget: { scheduledAt } } : { scheduledAt };
          assertRejected(await fixture.invoke(validBody(overrides)), fixture, 400, "scheduledAt", "scheduleBeforeDeadline");
          assert.deepEqual(fixture.lookups, []);
        });
      }
    }

    await t.test("non-superadmin receives 403 before validation or database access", serial, async () => {
      const fixture = harness(createEventsRouter);
      const res = await fixture.invoke({}, { role: "admin", userId: "merchant-admin-test" });
      assertRejected(res, fixture, 403);
      assert.equal(res.payload.message, "Super admin access is required");
      assert.deepEqual(fixture.lookups, []);
    });

    const checkinCases = [
      ["missing configuration", undefined, undefined],
      ["short secret", "test-only-short", "https://example.invalid"],
      ["missing public origin", "test-only-secret-not-real-".repeat(2), undefined],
      ["non-HTTPS public origin", "test-only-secret-not-real-".repeat(2), "http://example.invalid"],
    ];
    for (const [name, secret, origin] of checkinCases) {
      await t.test(`check-in unconfigured: ${name}`, serial, async () => {
        try {
          if (secret === undefined) delete process.env.EVENT_CHECKIN_SECRET;
          else process.env.EVENT_CHECKIN_SECRET = secret;
          if (origin === undefined) delete process.env.EVENT_PUBLIC_BASE_URL;
          else process.env.EVENT_PUBLIC_BASE_URL = origin;
          const fixture = harness(createEventsRouter);
          const res = await fixture.invoke(validBody({ confirmationRequired: true }));
          assertRejected(res, fixture, 503);
          assert.equal(res.payload.message, "Event check-in is not configured");
          assert.deepEqual(fixture.lookups, []);
        } finally {
          for (const name of envNames) delete process.env[name];
        }
      });
    }
  } finally {
    for (const [name, value] of savedEnv) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    if (savedAuth) require.cache[authPath] = savedAuth;
    else delete require.cache[authPath];
    if (savedRouter) require.cache[routerPath] = savedRouter;
    else delete require.cache[routerPath];
  }
});