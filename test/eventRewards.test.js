const test = require("node:test");
const assert = require("node:assert/strict");
const { prepareEventReward, awardEventCheckin } = require("../services/eventRewards");

function fixture({ pool = { lotteryMoney: 10, remaining: 10, claims: 0, maxUsers: 2 }, claimed = false, wallet = { balance: 4, version: 1 } } = {}) {
  const writes = [];
  const poolRef = { id: "event", collection: () => ({ doc: (id) => ({ id, kind: "claim" }) }) };
  const walletRef = { id: "wallet", kind: "wallet" };
  const db = {
    collection(name) {
      if (name === "lottery") return { doc: () => poolRef };
      if (name === "wallets") return {
        where: () => ({ limit: () => ({ kind: "walletQuery" }) }),
        doc: () => walletRef,
      };
      if (name === "transactions") return { doc: (id) => ({ id, kind: "transaction" }) };
      throw new Error(`Unexpected collection: ${name}`);
    },
  };
  const tx = {
    async get(ref) {
      if (ref === poolRef) return { exists: pool !== null, data: () => pool };
      if (ref.kind === "claim") return { exists: claimed };
      if (ref.kind === "walletQuery") return { empty: wallet === null, docs: wallet === null ? [] : [{ ref: walletRef, data: () => wallet }] };
      throw new Error("Unexpected read");
    },
    update: (ref, data) => writes.push({ op: "update", ref, data }),
    create: (ref, data) => writes.push({ op: "create", ref, data }),
  };
  const run = () => awardEventCheckin({
    db, tx, eventRef: { id: "event" }, event: { header: "Event" },
    application: { userId: "user", username: "User" }, timestamp: "2026-01-01T00:00:00Z",
  });
  return { writes, run };
}

test("event budget validation rejects absent, invalid and out-of-range values", () => {
  for (const budget of [undefined, null, "500", 0, 99, 50001, 100.5, Infinity]) {
    assert.throws(() => prepareEventReward(budget));
  }
  const result = prepareEventReward(500, "F&B");
  assert.equal(result.budget, 500);
  assert.ok(result.pool.lotteryMoney > 0);
  assert.equal(result.pool.remaining, result.pool.lotteryMoney);
});

test("check-in pays from the pool and records wallet, claim and ledger writes", async () => {
  const f = fixture();
  assert.deepEqual(await f.run(), { rewardStatus: "paid", reward: 5 });
  assert.equal(f.writes.find((w) => w.ref.kind === "wallet").data.balance, 9);
  assert.deepEqual(f.writes.find((w) => w.ref.id === "event" && !w.ref.kind).data, { remaining: 5, claims: 1 });
  assert.equal(f.writes.find((w) => w.ref.kind === "claim").data.reward, 5);
  assert.equal(f.writes.find((w) => w.ref.kind === "transaction").data.amount, 5);
});

test("last claim is bounded by the remaining pool and missing wallets are created", async () => {
  const f = fixture({ pool: { lotteryMoney: 10, remaining: 3, claims: 1, maxUsers: 2 }, wallet: null });
  assert.deepEqual(await f.run(), { rewardStatus: "paid", reward: 3 });
  assert.equal(f.writes.find((w) => w.ref.kind === "wallet").op, "create");
  assert.equal(f.writes.find((w) => w.ref.kind === "wallet").data.balance, 3);
});

test("exhausted pool confirms attendance without wallet writes", async () => {
  const f = fixture({ pool: { lotteryMoney: 10, remaining: 0, claims: 1, maxUsers: 2 } });
  assert.deepEqual(await f.run(), { rewardStatus: "exhausted", reward: 0 });
  assert.equal(f.writes.length, 0);
});

test("duplicate claims and corrupt state fail before writing", async () => {
  for (const options of [{ claimed: true }, { pool: null }, { pool: { lotteryMoney: 10, remaining: -1, claims: 0, maxUsers: 2 } }, { pool: { lotteryMoney: 10, remaining: 11, claims: 0, maxUsers: 2 } }, { wallet: { balance: "4" } }]) {
    const f = fixture(options);
    await assert.rejects(f.run());
    assert.equal(f.writes.length, 0);
  }
});
