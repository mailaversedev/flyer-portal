const test = require("node:test");
const assert = require("node:assert/strict");

test("coupon wallet keeps claim order and restores missing visible flyer logos", async () => {
  const docs = new Map([
    ["flyers/visible", { companyIcon: "https://example.com/flyer.png" }],
    ["flyers/hidden", { companyIcon: "https://example.com/hidden.png", hideCompanyDetail: true }],
    ["users/user/coupons/old", { flyerId: "visible", claimedAt: "2025-01-01T00:00:00.000Z", isUsed: true }],
    ["users/user/coupons/new", { flyerId: "visible", companyIcon: "https://example.com/saved.png", claimedAt: "2025-03-01T00:00:00.000Z", isUsed: false }],
    ["users/user/coupons/hidden", { flyerId: "hidden", claimedAt: "2025-02-01T00:00:00.000Z", isUsed: true }],
    ["users/user/coupons/missing", { flyerId: "deleted", claimedAt: "2024-01-01T00:00:00.000Z", isUsed: true }],
  ]);
  const snapshot = (path) => ({
    id: path.split("/").at(-1),
    exists: docs.has(path),
    data: () => docs.get(path),
  });
  const collection = (path) => ({
    doc: (id) => ({
      collection: (name) => collection(`${path}/${id}/${name}`),
      get: async () => snapshot(`${path}/${id}`),
      update: async (data) => docs.set(`${path}/${id}`, { ...docs.get(`${path}/${id}`), ...data }),
    }),
    orderBy: (field, direction) => ({
      get: async () => {
        assert.equal(field, "claimedAt");
        assert.equal(direction, "desc");
        return {
          docs: [...docs.keys()]
            .filter((key) => key.startsWith(`${path}/`) && !key.slice(path.length + 1).includes("/"))
            .map(snapshot)
            .sort((a, b) => b.data().claimedAt.localeCompare(a.data().claimedAt)),
        };
      },
    }),
  });
  const adminPath = require.resolve("firebase-admin");
  const routerPath = require.resolve("../routes/coupon");
  const savedAdmin = require.cache[adminPath];
  const savedRouter = require.cache[routerPath];
  require.cache[adminPath] = {
    id: adminPath, filename: adminPath, loaded: true,
    exports: { firestore: () => ({ collection }) },
  };
  delete require.cache[routerPath];
  try {
    const router = require(routerPath);
    const handler = (path) => router.stack.find((layer) => layer.route?.path === path).route.stack[0].handle;
    const invoke = async (path, body = {}) => {
      const res = {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        json(data) { this.body = data; return this; },
      };
      await handler(path)({ user: { userId: "user" }, query: {}, body }, res);
      assert.equal(res.statusCode, 200);
      return res.body;
    };
    const before = await invoke("/my-coupons");
    assert.deepEqual(before.data.map((coupon) => coupon.id), ["new", "hidden", "old", "missing"]);
    assert.deepEqual(before.data.map((coupon) => coupon.companyIcon), [
      "https://example.com/saved.png", "", "https://example.com/flyer.png", "",
    ]);

    await invoke("/use", { couponId: "new", usedAmount: 5 });
    const after = await invoke("/my-coupons");
    assert.deepEqual(after.data.map((coupon) => coupon.id), ["new", "hidden", "old", "missing"]);
    assert.equal(after.data[0].isUsed, true);
    assert.equal(after.data[0].companyIcon, "https://example.com/saved.png");
  } finally {
    if (savedAdmin) require.cache[adminPath] = savedAdmin;
    else delete require.cache[adminPath];
    if (savedRouter) require.cache[routerPath] = savedRouter;
    else delete require.cache[routerPath];
  }
});
