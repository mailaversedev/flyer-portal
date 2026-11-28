const test = require("node:test");
const assert = require("node:assert/strict");

const authPath = require.resolve("../routes/auth");
require.cache[authPath] = { id: authPath, filename: authPath, loaded: true, exports: { authenticateToken() {} } };
const firebasePath = require.resolve("firebase-admin");
const state = {};
const firebase = { firestore: () => ({
  collection: (...args) => state.db.collection(...args),
  runTransaction: (...args) => state.db.runTransaction(...args),
}) };
firebase.firestore.FieldValue = { increment: (value) => value };
require.cache[firebasePath] = { id: firebasePath, filename: firebasePath, loaded: true, exports: firebase };
const router = require("../routes/lottery");

function harness({ website = "https://example.com/", failCommit = false } = {}) {
  const flyer = { type: "qr", status: "active", website, rewardPolicy: "qr_scan_v1", lottery: {}, targetBudget: { budget: 500 } };
  const writes = [];
  const claimRef = { kind: "claim" };
  const flyerRef = { kind: "flyer", get: async () => ({ exists: true, data: () => flyer }) };
  const poolRef = { kind: "pool", collection: () => ({ doc: () => claimRef }) };
  const walletRef = { kind: "wallet" };
  const db = {
    collection(name) {
      if (name === "flyers") return { doc: () => flyerRef };
      if (name === "lottery") return { doc: () => poolRef };
      if (name === "wallets") return { where: () => ({ limit: () => ({ get: async () => ({ empty: false, docs: [{ ref: walletRef }] }) }) }) };
      if (name === "transactions") return { doc: () => ({ kind: "transaction" }) };
      if (name === "users") return { doc: () => ({ collection: () => ({ doc: () => ({ kind: "stats" }) }) }) };
      throw new Error(`Unexpected collection: ${name}`);
    },
    async runTransaction(fn) {
      const result = await fn({
        async get(ref) {
          if (ref.kind === "flyer") return { exists: true, data: () => flyer };
          if (ref.kind === "claim" || ref.kind === "stats") return { exists: false };
          if (ref.kind === "pool") return { exists: true, data: () => ({ claims: 0, remaining: 1, lotteryMoney: 100, maxUsers: 2 }) };
          if (ref.kind === "wallet") return { exists: true, id: "wallet", data: () => ({ balance: 0 }) };
          throw new Error(`Unexpected read: ${ref.kind}`);
        },
        update(ref, data) { writes.push({ kind: ref.kind, data }); },
        set(ref, data) { writes.push({ kind: ref.kind, data }); },
      });
      if (failCommit) throw new Error("commit failed");
      return result;
    },
  };
  state.db = db;
  const invoke = async (method, scannedValue) => {
    const handler = router.stack.find((layer) => layer.route?.path === "/" && layer.route.methods[method.toLowerCase()]).route.stack.at(-1).handle;
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };
    await handler({ method, user: { userId: "user" }, query: { flyerId: "flyer" }, body: { scannedValue } }, res);
    return res;
  };
  return { invoke, writes };
}

test("new scan rewards reject GET and unrelated QR contents", async () => {
  const f = harness();
  assert.equal((await f.invoke("GET")).statusCode, 403);
  assert.equal((await f.invoke("POST", "https://wrong.example/")).statusCode, 403);
  assert.equal(f.writes.length, 0);
});

test("matching scan claims no more than the remaining pool", async () => {
  const f = harness();
  const res = await f.invoke("POST", "https://example.com/");
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.reward, 1);
  assert.equal(f.writes.find((entry) => entry.kind === "wallet").data.balance, 1);
});

test("a failed transaction commit does not return a successful reward", async () => {
  const f = harness({ failCommit: true });
  const res = await f.invoke("POST", "https://example.com/");
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.success, false);
});
