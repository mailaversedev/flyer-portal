const test = require("node:test");
const assert = require("node:assert/strict");

function stub(path, exports) {
  const id = require.resolve(path);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}

stub("../routes/auth", { authenticateToken() {} });
stub("../services/companyWalletService", {});
stub("../services/flyerJobService", {});
const createCompaniesRouter = require("../routes/admin/companies");
const createCreationRouter = require("../routes/flyer/creation");

async function request(router, method, path, req) {
  const handler = router.stack.find(({ route }) => route?.path === path && route.methods[method])
    .route.stack.at(-1).handle;
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  await handler(req, res);
  return res;
}

test("admin company list returns every company, even with missing createdAt", async () => {
  const docs = Array.from({ length: 205 }, (_, index) => ({
    id: `company-${index}`,
    data: () => ({ createdAt: new Date(Date.UTC(2020, 0, index + 1)).toISOString() }),
  }));
  docs.push({ id: "legacy", data: () => ({ name: "Legacy merchant", isActive: false }) });
  const companies = {
    async get() { return { docs }; },
    orderBy(field, direction) {
      assert.equal(field, "createdAt");
      assert.equal(direction, "desc");
      return { limit: (limit) => ({ get: async () => ({ docs: docs.slice(0, limit) }) }) };
    },
  };
  const wallets = {
    where() { return this; },
    async get() { return { docs: [{ id: "wallet", data: () => ({ companyId: "legacy", creditBalanceHkd: 12 }) }] }; },
  };
  const router = createCompaniesRouter({
    db: { collection: (name) => ({ companies, wallets })[name] },
    normalizeLimit: Number,
  });
  const all = await request(router, "get", "/companies", { query: { limit: "all", direction: "desc" } });
  assert.equal(all.statusCode, 200);
  assert.equal(all.body.data.length, 206);
  assert.deepEqual(new Set(all.body.data.map(({ id }) => id)), new Set(docs.map(({ id }) => id)));
  assert.equal(all.body.data[0].id, "company-204");
  assert.equal(all.body.data.at(-1).walletCreditBalanceHkd, 12);
  const limited = await request(router, "get", "/companies", { query: { limit: "100" } });
  assert.equal(limited.body.data.length, 100);
});

const event = {
  type: "event", header: "Title", adContent: "Description", venue: "Venue",
  startsAt: "2099-06-10T10:00:00.000Z", endsAt: "2099-06-10T12:00:00.000Z",
  applicationDeadline: "2099-06-09T10:00:00.000Z", timezone: "UTC",
  companyId: "mailaverse", confirmationRequired: false, capacity: 10, applicantCount: 0,
  coverPhoto: "https://example.com/original.png", targetBudget: { noReward: true },
};

const edit = async (original, data, user = { role: "super-admin" }) => {
  const flyerRef = { get: async () => ({ exists: true, id: "flyer", data: () => stored }) };
  const companyRef = {};
  let stored = { ...original };
  const db = {
    collection(name) {
      return { doc: () => name === "flyers" ? flyerRef : companyRef };
    },
    async runTransaction(fn) {
      await fn({
        get: (ref) => ref === flyerRef ? ref.get() : { exists: true, data: () => ({ name: "New organizer" }) },
        set(ref, patch) {
          assert.equal(ref, flyerRef);
          stored = { ...stored, ...patch };
        },
      });
    },
  };
  const res = await request(createCreationRouter({ db }), "put", "/flyer/:flyerId", {
    params: { flyerId: "flyer" }, body: { data }, user,
  });
  return { status: res.statusCode, body: res.body, stored };
};

test("event updates are super-admin only and preserve published assets", async () => {
  assert.equal((await edit(event, { header: "New title" }, { role: "staff", companyId: event.companyId })).status, 403);
  const saved = await edit(event, {
    header: " New title ", capacity: 20, companyId: "another-organizer",
    coverPhoto: "https://example.com/changed.png", applicantCount: 999, targetBudget: { noReward: false },
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.stored.header, "New title");
  assert.equal(saved.stored.capacity, 20);
  assert.equal(saved.stored.companyName, "New organizer");
  assert.equal(saved.stored.coverPhoto, event.coverPhoto);
  assert.equal(saved.stored.applicantCount, 0);
  assert.deepEqual(saved.stored.targetBudget, event.targetBudget);
  assert.equal((await edit(event, { endsAt: event.startsAt })).status, 400);
});

test("rewarded events cannot change organizer or disable confirmation", async () => {
  const rewarded = { ...event, rewardPolicy: "event_checkin_v1", confirmationRequired: true };
  assert.equal((await edit(rewarded, { confirmationRequired: false })).status, 409);
  assert.equal((await edit(rewarded, { companyId: "another-organizer" })).status, 409);
  assert.equal((await edit(rewarded, { header: "New title" })).status, 200);
});

test("events with applications reject changes to enrollment but accept copy edits after the event", async () => {
  const past = Object.fromEntries(["startsAt", "endsAt", "applicationDeadline"].map((field) => [
    field, event[field].replace("2099", "2020"),
  ]));
  const applied = { ...event, ...past, applicantCount: 1 };
  for (const changed of [
    { companyId: "another-organizer" }, { capacity: 11 }, { timezone: "Asia/Hong_Kong" },
    { startsAt: event.startsAt }, { endsAt: event.endsAt }, { applicationDeadline: event.applicationDeadline },
    { confirmationRequired: true },
  ]) {
    const result = await edit(applied, { header: "Must not partially save", ...changed });
    assert.equal(result.status, 409);
    assert.deepEqual(result.stored, applied);
  }
  const saved = await edit(applied, { venue: "Updated venue" });
  assert.equal(saved.status, 200);
  assert.equal(saved.stored.venue, "Updated venue");
});

test("merchant can save QR copy on a legacy flyer without a website without unlocking its assets", async () => {
  const qr = { type: "qr", companyId: "merchant", coverPhoto: event.coverPhoto };
  const saved = await edit(qr, { website: "", productDescriptions: "Updated copy", coverPhoto: "replacement" }, {
    role: "staff", companyId: "merchant",
  });

  assert.equal(saved.status, 200);
  assert.equal(saved.stored.productDescriptions, "Updated copy");
  assert.equal(saved.stored.adContent, "Updated copy");
  assert.equal(saved.stored.coverPhoto, qr.coverPhoto);
  assert.equal((await edit(qr, { header: "Update" }, { role: "staff", companyId: "other" })).status, 403);
});

test("clearing a schedule falls back to creation time, including nested edits", async () => {
  const flyer = {
    type: "leaflet", companyId: "merchant",
    createdAt: "2020-01-01T00:00:00.000Z",
    scheduledAt: "2021-01-01T00:00:00.000Z",
    targetBudget: { scheduledAt: "2021-01-01T00:00:00.000Z", district: "Central" },
  };
  for (const data of [{ scheduledAt: null, targetBudget: { district: "Central" } }, { targetBudget: { scheduledAt: null } }]) {
    const result = await edit(flyer, data);
    assert.equal(result.status, 200);
    assert.equal(result.stored.scheduledAt, flyer.createdAt);
    assert.equal(result.stored.targetBudget.scheduledAt, null);
  }
  const changed = await edit(flyer, { targetBudget: { scheduledAt: "2022-01-01T08:00:00+08:00" } });
  assert.equal(changed.stored.scheduledAt, "2022-01-01T00:00:00.000Z");
});
