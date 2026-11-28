const test = require("node:test");
const assert = require("node:assert/strict");
const createRouter = require("../routes/admin/events");

test("event summary exposes allocated and paid rewards", async () => {
  const event = {
    type: "event", header: "Event", rewardPolicy: "event_checkin_v1", fundingSource: "platform",
    targetBudget: { budget: 500 }, lottery: { lotteryMoney: 100, remaining: 70, claims: 3 },
    confirmationRequired: true, applicantCount: 5, confirmedCount: 3,
  };
  const db = { collection: () => ({ doc: () => ({ get: async () => ({ exists: true, id: "event", data: () => event }) }) }) };
  const router = createRouter({ db });
  const handler = router.stack.find((layer) => layer.route?.path === "/events/:eventId/summary").route.stack.at(-1).handle;
  const res = {
    json(body) { this.body = body; return this; },
    status(code) { this.statusCode = code; return this; },
  };
  await handler({ params: { eventId: "event" } }, res);
  assert.deepEqual(res.body.data.rewards, {
    fundingSource: "platform", budgetHkd: 500, allocatedMailcoin: 100,
    remainingMailcoin: 70, paidMailcoin: 30, paidClaims: 3,
  });
});
