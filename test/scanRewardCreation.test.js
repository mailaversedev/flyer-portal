const test = require("node:test");
const assert = require("node:assert/strict");

function stub(path, exports) {
  const id = require.resolve(path);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}
stub("../routes/auth", { authenticateToken() {} });
stub("../services/flyerJobService", { scheduleFlyerJob: async () => {} });
stub("../services/companyWalletService", {});
const createCreationRouter = require("../routes/flyer/creation");

async function create({ type = "qr", noReward = false, website = "https://example.com/", suppliedPolicy } = {}) {
  const writes = [];
  const db = {
    collection(name) {
      if (name === "flyers" || name === "lottery") return { doc: (id) => ({ id: id || "flyer", name }) };
      if (name === "users") return { where: () => ({ count: () => ({ get: async () => ({ data: () => ({ count: 100 }) }) }) }) };
      throw new Error(`Unexpected collection: ${name}`);
    },
    async runTransaction(fn) {
      await fn({ set: (ref, data) => writes.push({ ref, data }) });
    },
  };
  const router = createCreationRouter({
    db, roundMoneyAmount: (value) => value, MAILAVERSE_COMPANY_NAME: "Mailaverse",
  });
  const handler = router.stack.find((layer) => layer.route?.path === "/flyer" && layer.route.methods.post).route.stack.at(-1).handle;
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  await handler({
    user: { role: "super-admin" },
    body: { type, data: { website, rewardPolicy: suppliedPolicy, targetBudget: { noReward, budget: 500 } } },
  }, res);
  return { res, writes };
}

test("rewarded scan flyers always get the scan policy without a feature flag", async () => {
  const { res, writes } = await create();
  assert.equal(res.statusCode, 201);
  assert.equal(writes.find(({ ref }) => ref.name === "flyers").data.rewardPolicy, "qr_scan_v1");
  assert.ok(writes.find(({ ref }) => ref.name === "lottery"));
});

test("no-reward and other flyers do not accept a client-supplied policy", async () => {
  for (const options of [{ noReward: true }, { type: "leaflet" }]) {
    const { res, writes } = await create({ ...options, suppliedPolicy: "qr_scan_v1" });
    assert.equal(res.statusCode, 201);
    assert.equal(writes.find(({ ref }) => ref.name === "flyers").data.rewardPolicy, undefined);
  }
});

test("rewarded scan flyers require a QR destination", async () => {
  const { res, writes } = await create({ website: "" });
  assert.equal(res.statusCode, 400);
  assert.equal(writes.length, 0);
});
