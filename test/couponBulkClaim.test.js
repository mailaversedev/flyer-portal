const test = require("node:test");
const assert = require("node:assert/strict");
const { prepareFlyerCoupons, claimDocumentId } = require("../services/flyerCoupons");

test("legacy and bulk claims coexist without duplicating or exceeding coupon limits", async () => {
  const docs = new Map();
  function ref(path) {
    return {
      id: path.split("/").at(-1),
      path,
      collection: (name) => collection(`${path}/${name}`),
      get: async () => snapshot(path),
    };
  }
  function collection(path) {
    return { doc: (id) => ref(`${path}/${id}`) };
  }
  function snapshot(path) {
    return { exists: docs.has(path), data: () => docs.get(path) };
  }
  function apply(refValue, data, merge) {
    const old = docs.get(refValue.path) || {};
    const next = merge ? { ...old } : {};
    for (const [key, value] of Object.entries(data)) {
      next[key] = value && value.__increment !== undefined
        ? (old[key] || 0) + value.__increment : value;
    }
    docs.set(refValue.path, next);
  }
  const db = {
    collection,
    runTransaction: async (callback) => {
      const writes = [];
      const transaction = {
        get: async (reference) => snapshot(reference.path),
        set: (reference, data, options) => writes.push(() => apply(reference, data, options?.merge)),
        update: (reference, data) => writes.push(() => apply(reference, data, true)),
      };
      const result = await callback(transaction);
      writes.forEach((write) => write());
      return result;
    },
  };
  const firestore = () => db;
  firestore.FieldValue = { increment: (value) => ({ __increment: value }) };
  const adminPath = require.resolve("firebase-admin");
  const routerPath = require.resolve("../routes/coupon");
  const savedAdmin = require.cache[adminPath];
  const savedRouter = require.cache[routerPath];
  require.cache[adminPath] = { id: adminPath, filename: adminPath, loaded: true, exports: { firestore } };
  delete require.cache[routerPath];
  try {
    const router = require(routerPath);
    async function invoke(path, userId) {
      const handler = router.stack.find((layer) => layer.route?.path === path).route.stack[0].handle;
      const res = {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
      };
      await handler({ user: { userId }, body: { flyerId: "flyer" } }, res);
      return res;
    }
    const flyer = prepareFlyerCoupons({ coupons: [
      { couponType: "fixed", quantity: 2 },
      { couponType: "free", quantity: 1 },
      { couponType: "percentage", expiredDate: "2000-01-01" },
    ] }, "qr");
    docs.set("flyers/flyer", { ...flyer, type: "qr", status: "active", companyId: "merchant" });
    assert.equal((await invoke("/claim", "user1")).statusCode, 201);
    const bulk = await invoke("/claim-all", "user1");
    assert.equal(bulk.statusCode, 200);
    assert.deepEqual(bulk.body.data.skipped.map((entry) => entry.reason), ["already_claimed", "expired"]);
    assert.equal(bulk.body.data.claimed.length, 1);
    assert.ok(docs.has("users/user1/coupons/flyer"));
    assert.ok(docs.has(`users/user1/coupons/${claimDocumentId("flyer", flyer.coupons[1], 1)}`));
    const next = await invoke("/claim-all", "user2");
    assert.equal(next.body.data.claimed.length, 1);
    assert.deepEqual(next.body.data.skipped.map((entry) => entry.reason), ["exhausted", "expired"]);
    const stored = docs.get("flyers/flyer");
    assert.deepEqual(stored.coupons.map((coupon) => coupon.downloadCount), [2, 1, 0]);
    assert.equal(stored.coupon.downloadCount, 2);
    const again = await invoke("/claim-all", "user1");
    assert.equal(again.body.data.claimed.length, 0);
    docs.set("flyers/flyer", { ...stored, status: "inactive" });
    const unavailable = await invoke("/claim-all", "user3");
    assert.equal(unavailable.statusCode, 400);
    assert.equal(docs.has("users/user3/coupons/flyer"), false);
    assert.equal(docs.get("companies/merchant/coupons/flyer").downloadCount, 2);
    assert.equal(docs.get(`companies/merchant/coupons/${claimDocumentId("flyer", flyer.coupons[1], 1)}`).downloadCount, 1);
  } finally {
    if (savedAdmin) require.cache[adminPath] = savedAdmin;
    else delete require.cache[adminPath];
    if (savedRouter) require.cache[routerPath] = savedRouter;
    else delete require.cache[routerPath];
  }
});
