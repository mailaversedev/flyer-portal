const test = require("node:test");
const assert = require("node:assert/strict");
const createRouter = require("../routes/eventCheckin");

function harness({ remaining = 10 } = {}) {
  const token = "a".repeat(64);
  const now = Date.now();
  const data = {
    event: {
      type: "event", status: "active", header: "Event", rewardPolicy: "event_checkin_v1",
      startsAt: new Date(now - 60000).toISOString(), endsAt: new Date(now + 60000).toISOString(),
      confirmedCount: 0,
    },
    application: { eventId: "event", userId: "user", username: "User", confirmationRequired: true },
    pool: { lotteryMoney: 10, remaining, claims: 0, maxUsers: 2 },
    wallet: { balance: 0, version: 1 },
  };
  const claimRef = { kind: "claim" };
  const poolRef = { kind: "pool", id: "event", collection: () => ({ doc: () => claimRef }) };
  const walletRef = { kind: "wallet", id: "wallet" };
  const applicationRef = { kind: "application", get: async () => snapshot("application") };
  const eventRef = {
    kind: "event", id: "event", get: async () => snapshot("event"),
    collection: () => ({ doc: () => applicationRef }),
  };
  const snapshot = (kind) => ({ exists: !!data[kind], data: () => data[kind] });
  const db = {
    collection(name) {
      if (name === "eventCheckinTokens") return { doc: () => ({ get: async () => ({ exists: true, data: () => ({ eventId: "event", userId: "user" }) }) }) };
      if (name === "flyers") return { doc: () => eventRef };
      if (name === "lottery") return { doc: () => poolRef };
      if (name === "wallets") return { where: () => ({ limit: () => ({ kind: "walletQuery" }) }) };
      if (name === "transactions") return { doc: () => ({ kind: "transaction" }) };
      throw new Error(`Unexpected collection: ${name}`);
    },
    async runTransaction(fn) {
      const writes = [];
      const result = await fn({
        async get(ref) {
          if (ref.kind === "walletQuery") return { empty: false, docs: [{ ref: walletRef, data: () => data.wallet }] };
          return snapshot(ref.kind);
        },
        update(ref, patch) { writes.push({ kind: ref.kind, patch }); },
        create(ref, value) { writes.push({ kind: ref.kind, patch: value }); },
      });
      for (const { kind, patch } of writes) {
        data[kind] = { ...data[kind], ...patch };
      }
      return result;
    },
  };
  const router = createRouter({ db });
  const handler = router.stack.find((layer) => layer.route?.path === "/events/check-in/:token" && layer.route.methods.post).route.stack.at(-1).handle;
  const request = async () => {
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      type() { return this; },
      send(body) { this.body = body; return this; },
    };
    await handler({ params: { token } }, res);
    return res;
  };
  return { data, request };
}

test("event check-in pays only once even when confirmation is repeated", async () => {
  const f = harness();
  const first = await f.request();
  assert.equal(first.statusCode, 200);
  assert.match(first.body, /Reward credited: 5 Mailcoin/);
  assert.equal(f.data.wallet.balance, 5);
  assert.equal(f.data.pool.remaining, 5);
  assert.equal(f.data.event.confirmedCount, 1);
  const repeat = await f.request();
  assert.equal(repeat.statusCode, 200);
  assert.equal(f.data.wallet.balance, 5);
  assert.equal(f.data.pool.remaining, 5);
  assert.equal(f.data.event.confirmedCount, 1);
});

test("an exhausted reward pool does not prevent attendance confirmation", async () => {
  const f = harness({ remaining: 0 });
  const response = await f.request();
  assert.match(response.body, /reward pool exhausted/);
  assert.equal(f.data.application.rewardStatus, "exhausted");
  assert.equal(f.data.wallet.balance, 0);
  assert.equal(f.data.event.confirmedCount, 1);
});

test("invalid reward state does not confirm attendance", async () => {
  const f = harness();
  f.data.pool.remaining = -1;
  const response = await f.request();
  assert.equal(response.statusCode, 500);
  assert.equal(f.data.application.confirmedAt, undefined);
  assert.equal(f.data.event.confirmedCount, 0);
  assert.equal(f.data.wallet.balance, 0);
});
