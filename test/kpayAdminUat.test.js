const test = require("node:test");
const assert = require("node:assert/strict");

function stub(path, exports) {
  const id = require.resolve(path);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}

const records = new Map();
let origin = "https://payment.uat.kpay-group.com";
let gatewayCalls = 0;
let signatureValid = true;
const ref = (id) => ({
  id,
  async get() {
    const data = records.get(id);
    return { exists: !!data, data: () => data };
  },
  async update(patch) { records.set(id, { ...records.get(id), ...patch }); },
});
const db = {
  collection(name) {
    assert.equal(name, "kpayPayments");
    return {
      doc: ref,
      where(_field, _op, value) {
        return {
          limit() {
            return { async get() {
              const found = [...records.entries()].find(([, payment]) => payment.managedOrderNo === value);
              return found ? { empty: false, docs: [{ ref: ref(found[0]) }] } : { empty: true };
            } };
          },
        };
      },
    };
  },
  async runTransaction(fn) {
    return fn({
      get: (r) => r.get(),
      set: (r, value) => records.set(r.id, value),
      update: (r, value) => records.set(r.id, { ...records.get(r.id), ...value }),
    });
  },
};
stub("../routes/payment/helpers", { db });
stub("../services/companyWalletService", {
  ensureCompanyWalletInTransaction: () => { throw new Error("UAT must not access a wallet"); },
});
stub("../services/kpayService", {
  getKPayConfig: () => ({ apiBaseUrl: origin, merchantCode: "merchant" }),
  buildPublicReturnUrl: (path) => `https://portal.example${path}`,
  buildCheckoutUrl: () => "https://payment.uat.kpay-group.com/checkout",
  createManagedOrder: async () => {
    gatewayCalls += 1;
    return { managedOrderNo: "managed-1", checkoutUrl: "https://payment.uat.kpay-group.com/checkout" };
  },
  verifyWebhook: () => signatureValid,
});
const orders = require("../routes/payment/kpayRoutes");
const webhook = require("../routes/payment/kpayWebhookRoutes");

async function request(router, method, path, req) {
  const handler = router.stack.find(({ route }) => route?.path === path && route.methods[method])
    .route.stack.at(-1).handle;
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    set() { return this; },
    end() { return this; },
  };
  await handler(req, res);
  return res;
}

test("admin UAT payments are restricted, isolated and record verified callbacks", async () => {
  const body = { purpose: "admin_uat", amount: 5, idempotencyKey: "test-1" };
  const admin = { userId: "admin-1", role: "super-admin" };
  const create = (user, payload = body) => request(orders, "post", "/kpay/orders", { user, body: payload });
  assert.equal((await create({ userId: "staff", role: "staff", companyId: "company" })).statusCode, 403);
  origin = "https://payment.kpay-group.com";
  assert.equal((await create(admin)).statusCode, 403);
  origin = "https://payment.uat.kpay-group.com";
  assert.equal((await create(admin, { ...body, amount: 5.01 })).statusCode, 400);
  assert.equal(gatewayCalls, 0);

  const created = await create(admin);
  assert.equal(created.statusCode, 201);
  assert.equal(gatewayCalls, 1);
  const id = created.body.data.paymentId;
  const payment = records.get(id);
  assert.equal(payment.companyId, "");
  assert.equal(payment.returnPath, "/platform-admin");
  assert.equal((await create(admin)).statusCode, 200);
  assert.equal(gatewayCalls, 1);

  const read = (user) => request(orders, "get", "/kpay/orders/:paymentId", { user, params: { paymentId: id } });
  assert.equal((await read({ userId: "admin-2", role: "super-admin" })).statusCode, 404);
  assert.equal((await read({ userId: "staff", role: "staff", companyId: "company" })).statusCode, 404);

  const notify = await request(webhook, "post", "/notify", {
    headers: {}, rawBody: "{}",
    body: {
      merchantCode: "merchant", managedOrderNo: "managed-1",
      managedOutTradeNo: payment.managedOutTradeNo, localPayAmount: 5,
      localPayCurrency: "HKD", transactionState: 2,
    },
  });
  assert.equal(notify.statusCode, 200);
  const result = await read(admin);
  assert.equal(result.body.data.status, "PAID");
  assert.equal(result.body.data.kpayCallback.transactionState, 2);
  assert.equal(records.size, 1);
});

test("admin UAT rejects invalid callbacks and records unsuccessful callbacks without a wallet", async () => {
  const created = await request(orders, "post", "/kpay/orders", {
    user: { userId: "admin-1", role: "super-admin" },
    body: { purpose: "admin_uat", amount: 5, idempotencyKey: "test-2" },
  });
  const id = created.body.data.paymentId;
  const payment = records.get(id);
  const payload = {
    merchantCode: "merchant", managedOrderNo: payment.managedOrderNo,
    managedOutTradeNo: payment.managedOutTradeNo, localPayAmount: 5,
    localPayCurrency: "HKD", transactionState: 3, transactionStateDesc: "Declined",
  };
  // Use a distinct managed order number for the second gateway order.
  records.set(id, { ...payment, managedOrderNo: "managed-2" });
  payload.managedOrderNo = "managed-2";
  const notify = (body) => request(webhook, "post", "/notify", { headers: {}, rawBody: "{}", body });
  signatureValid = false;
  assert.equal((await notify(payload)).statusCode, 401);
  signatureValid = true;
  assert.equal((await notify({ ...payload, localPayAmount: 6 })).statusCode, 400);
  assert.equal(records.get(id).status, "PENDING");
  assert.equal((await notify(payload)).statusCode, 200);
  assert.equal(records.get(id).status, "FAILED");
  assert.equal(records.get(id).failureReason, "Declined");
});
