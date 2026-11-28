const test = require("node:test");
const assert = require("node:assert/strict");
const { backfillFlyerScheduledAt, scheduledAtForFlyer } = require("../scripts/backfillFlyerScheduledAt");

test("backfill resolves schedules before creation times and normalizes UTC", () => {
  assert.equal(scheduledAtForFlyer({ createdAt: "2020-01-01T08:00:00+08:00" }), "2020-01-01T00:00:00.000Z");
  assert.equal(scheduledAtForFlyer({
    createdAt: "2020-01-01T00:00:00Z",
    targetBudget: { scheduledAt: "2021-01-01T00:00:00Z" },
  }), "2021-01-01T00:00:00.000Z");
  assert.throws(() => scheduledAtForFlyer({ createdAt: "not-a-date" }));
  assert.throws(() => scheduledAtForFlyer({ scheduledAt: "invalid", createdAt: "2020-01-01" }));
});

test("backfill is dry-run by default, idempotent, paginated and transactional", async () => {
  const records = new Map(Array.from({ length: 201 }, (_, i) => [
    String(i).padStart(3, "0"), { createdAt: "2020-01-01T00:00:00Z" },
  ]));
  records.set("bad", { createdAt: "bad" });
  let writes = 0;
  const makeDoc = (id) => ({ id, ref: { id }, data: () => records.get(id) });
  const db = {
    collection() {
      let after;
      return {
        orderBy() { return this; },
        limit() { return this; },
        startAfter(doc) { after = doc.id; return this; },
        async get() {
          const ids = [...records.keys()].sort().filter((id) => !after || id > after).slice(0, 200);
          return { docs: ids.map(makeDoc) };
        },
      };
    },
    async runTransaction(fn) {
      return fn({
        async get(ref) {
          return { exists: records.has(ref.id), data: () => records.get(ref.id) };
        },
        update(ref, patch) {
          writes++;
          records.set(ref.id, { ...records.get(ref.id), ...patch });
        },
      });
    },
  };
  const log = () => {};
  assert.deepEqual(await backfillFlyerScheduledAt(db, { log }), {
    scanned: 202, changed: 201, unchanged: 0, invalid: 1,
  });
  assert.equal(writes, 0);
  assert.deepEqual(await backfillFlyerScheduledAt(db, { apply: true, log }), {
    scanned: 202, changed: 201, unchanged: 0, invalid: 1,
  });
  assert.deepEqual(await backfillFlyerScheduledAt(db, { apply: true, log }), {
    scanned: 202, changed: 0, unchanged: 201, invalid: 1,
  });
  assert.equal(writes, 201);
});

test("scheduled listing uses an upper bound and cursor before returning a page", async () => {
  const authPath = require.resolve("../routes/auth");
  require.cache[authPath] = { id: authPath, filename: authPath, loaded: true, exports: { authenticateToken() {} } };
  const createListingRouter = require("../routes/flyer/listing");
  const data = [
    { id: "future", scheduledAt: "2999-01-01T00:00:00.000Z", companyId: "shop" },
    { id: "scheduled", scheduledAt: "2020-03-01T00:00:00.000Z", companyId: "shop" },
    { id: "regular", scheduledAt: "2020-02-01T00:00:00.000Z", companyId: "shop" },
    { id: "other", scheduledAt: "2020-01-01T00:00:00.000Z", companyId: "other" },
  ];
  const refs = (id) => ({ id, exists: true, data: () => data.find((item) => item.id === id) });
  const db = {
    collection(name) {
      if (name === "lottery") return { doc: (id) => ({ id }) };
      let rows = [...data];
      let limit = 100;
      return {
        doc: (id) => ({ get: async () => refs(id) }),
        where(field, op, value) {
          rows = rows.filter((item) => op === "==" ? item[field] === value : item[field] <= value);
          return this;
        },
        orderBy(field, direction) {
          assert.equal(field, "scheduledAt");
          assert.equal(direction, "desc");
          rows.sort((a, b) => b[field].localeCompare(a[field]));
          return this;
        },
        startAfter(doc) { rows = rows.slice(rows.findIndex((row) => row.id === doc.id) + 1); return this; },
        limit(value) { limit = value; return this; },
        async get() {
          return { forEach: (visit) => rows.slice(0, limit).forEach((row) => visit(refs(row.id))) };
        },
      };
    },
    async getAll(...refs) { return refs.map(() => ({ exists: false })); },
  };
  const router = createListingRouter({ db });
  const handler = router.stack.find((layer) => layer.route?.path === "/flyers").route.stack.at(-1).handle;
  async function get(after) {
    const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await handler({ query: { sortBy: "scheduledAt", limit: "1", companyId: "shop", after } }, res);
    assert.equal(res.code, 200);
    return res.body;
  }
  const first = await get();
  assert.deepEqual(first.data.map((item) => item.id), ["scheduled"]);
  const second = await get(first.pagination.nextCursor);
  assert.deepEqual(second.data.map((item) => item.id), ["regular"]);
});
