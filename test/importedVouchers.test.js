const test = require("node:test");
const assert = require("node:assert/strict");
const {
  commitImport, decryptImage, encryptImage, itemId, MAX_IMAGES, prepareImport,
} = require("../services/importedVouchers");

function fakeFirestore() {
  const docs = new Map();
  function ref(path) {
    return {
      id: path.split("/").at(-1),
      path,
      collection: (name) => collection(`${path}/${name}`),
      get: async () => snapshot(path),
      set: async (data) => docs.set(path, data),
      update: async (data) => docs.set(path, { ...docs.get(path), ...data }),
    };
  }
  function collection(path) {
    return {
      doc: (id = `auto-${docs.size}`) => ref(`${path}/${id}`),
      where: (field, operator, value) => ({
        get: async () => ({
          docs: [...docs.keys()]
            .filter((key) => key.startsWith(`${path}/`) &&
              !key.slice(path.length + 1).includes("/") &&
              operator === "==" && docs.get(key)[field] === value)
            .map(snapshot),
        }),
      }),
    };
  }
  function snapshot(path) {
    return { id: path.split("/").at(-1), exists: docs.has(path), data: () => docs.get(path) };
  }
  let queue = Promise.resolve();
  const db = {
    collection,
    runTransaction(callback) {
      const run = queue.then(async () => {
        const writes = [];
        const tx = {
          get: async (target) => snapshot(target.path),
          create(target, data) {
            writes.push(() => {
              assert.equal(docs.has(target.path), false);
              docs.set(target.path, data);
            });
          },
          set(target, data, options) {
            writes.push(() => docs.set(target.path, options?.merge ? { ...docs.get(target.path), ...data } : data));
          },
          update(target, data) {
            writes.push(() => docs.set(target.path, { ...docs.get(target.path), ...data }));
          },
        };
        const result = await callback(tx);
        writes.forEach((write) => write());
        return result;
      });
      queue = run.catch(() => {});
      return run;
    },
  };
  return { db, docs };
}

function response() {
  return {
    statusCode: 200,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    set(name, value) { this.headers[name] = value; return this; },
    send(body) { this.body = body; return this; },
  };
}

const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1]);
const prepare = (codes, key, images = codes.map(() => ({ buffer: png }))) =>
  prepareImport(JSON.stringify(codes.map((code, imageIndex) => ({ code, imageIndex }))), images, key);
const paths = (count) => Array.from({ length: count }, (_, index) => ({
  storagePath: `private/${index}`, contentType: "image/png",
}));

test("validates paired codes and image content and encrypts image data", () => {
  const previous = process.env.VOUCHER_IMAGE_ENCRYPTION_KEY;
  process.env.VOUCHER_IMAGE_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64");
  try {
    const prepared = prepare(["  0001 ", "A-9"], "key-1");
    assert.deepEqual(prepared.items.map((item) => item.code), ["  0001 ", "A-9"]);
    assert.equal(prepared.images[0].type, "image/png");
    assert.throws(() => prepare(["x"], "missing", []), /exactly one unique image/);
    assert.throws(() => prepare(["x", "x"], "key"), /Duplicate/);
    assert.throws(() => prepare(["x"], "key", [{ buffer: Buffer.from("svg") }]), /Images must/);
    assert.throws(() => prepare(["x"], "../bad"), /Invalid import key/);
    assert.equal(prepare(Array.from({ length: 100 }, (_, index) => `${index}`), "pairs").items.length, 100);
    assert.throws(() => prepare(Array.from({ length: 101 }, (_, index) => `${index}`), "key"), /limit/);
    assert.equal(MAX_IMAGES, 100);
    assert.throws(() => prepareImport('[{"code":"x","imageIndex":0},{"code":"y","imageIndex":0}]', [{ buffer: png }, { buffer: png }], "key"), /unique image/);
    assert.throws(() => prepareImport('[{"code":"x","imageIndex":1}]', [{ buffer: png }], "key"), /unique image/);
    const encrypted = encryptImage(png);
    assert.notDeepEqual(encrypted, png);
    assert.deepEqual(decryptImage(encrypted), png);
    encrypted[encrypted.length - 1] ^= 1;
    assert.throws(() => decryptImage(encrypted));
  } finally {
    if (previous === undefined) delete process.env.VOUCHER_IMAGE_ENCRYPTION_KEY;
    else process.env.VOUCHER_IMAGE_ENCRYPTION_KEY = previous;
  }
});

test("imports atomically, in order, and rejects duplicate codes and conflicting retries", async () => {
  const { db, docs } = fakeFirestore();
  const voucher = db.collection("vouchers").doc("one");
  docs.set(voucher.path, { voucherType: "imported", totalNumber: 0, isActive: false });
  const first = prepare(["ABC", "0009"], "import1");
  assert.equal((await commitImport(db, voucher, first, paths(2), "now")).totalNumber, 2);
  assert.equal(docs.get(`${voucher.path}/inventory/${itemId(0)}`).code, "ABC");
  assert.equal(docs.get(`${voucher.path}/inventory/${itemId(0)}`).storagePath, "private/0");
  assert.equal(docs.get(`${voucher.path}/inventory/${itemId(1)}`).code, "0009");
  assert.equal((await commitImport(db, voucher, first, paths(2), "later")).alreadyImported, true);
  await assert.rejects(commitImport(db, voucher, prepare(["changed"], "import1"), paths(1), "later"), /__IMPORT_KEY_CONFLICT__/);
  await assert.rejects(commitImport(db, voucher, prepare(["ABC"], "import2"), paths(1), "later"), /__DUPLICATE_CODE__/);
  assert.equal(docs.get(voucher.path).totalNumber, 2);
  await commitImport(db, voucher, prepare(["third"], "import3"), paths(1), "later");
  assert.equal(docs.get(`${voucher.path}/inventory/${itemId(2)}`).code, "third");
});

test("fingerprints pairings and serializes concurrent imports", async () => {
  const { db, docs } = fakeFirestore();
  const secondPng = Buffer.concat([png, Buffer.from([2])]);
  const files = [{ buffer: png }, { buffer: secondPng }];
  const first = prepareImport('[{"code":"a","imageIndex":0},{"code":"b","imageIndex":1}]', files, "same");
  const swapped = prepareImport('[{"code":"a","imageIndex":1},{"code":"b","imageIndex":0}]', files, "same");
  assert.notEqual(first.fingerprint, swapped.fingerprint);
  const mapped = db.collection("vouchers").doc("mapped");
  docs.set(mapped.path, { voucherType: "imported", totalNumber: 0 });
  await commitImport(db, mapped, swapped, paths(2), "now");
  assert.equal(docs.get(`${mapped.path}/inventory/${itemId(0)}`).code, "a");
  assert.equal(docs.get(`${mapped.path}/inventory/${itemId(0)}`).storagePath, "private/1");
  assert.equal(docs.get(`${mapped.path}/inventory/${itemId(1)}`).storagePath, "private/0");
  const concurrent = db.collection("vouchers").doc("concurrent");
  docs.set(concurrent.path, { voucherType: "imported", totalNumber: 0 });
  const outcomes = await Promise.allSettled([
    commitImport(db, concurrent, first, paths(2), "now"),
    commitImport(db, concurrent, swapped, paths(2), "now"),
  ]);
  assert.equal(outcomes.filter((result) => result.status === "fulfilled").length, 1);
  assert.match(outcomes.find((result) => result.status === "rejected").reason.message, /__IMPORT_KEY_CONFLICT__/);
  assert.equal(docs.get(concurrent.path).totalNumber, 2);
  const duplicate = db.collection("vouchers").doc("duplicate");
  docs.set(duplicate.path, { voucherType: "imported", totalNumber: 0 });
  const duplicateOutcomes = await Promise.allSettled([
    commitImport(db, duplicate, prepare(["same-code"], "one"), paths(1), "now"),
    commitImport(db, duplicate, prepare(["same-code"], "two"), paths(1), "now"),
  ]);
  assert.equal(duplicateOutcomes.filter((result) => result.status === "fulfilled").length, 1);
  assert.match(duplicateOutcomes.find((result) => result.status === "rejected").reason.message, /__DUPLICATE_CODE__/);
  assert.equal(docs.get(duplicate.path).totalNumber, 1);
});

test("admin multipart import keeps voucher private until stock commits and handles retry", async () => {
  const { db, docs } = fakeFirestore();
  const adminPath = require.resolve("firebase-admin");
  const publicPath = require.resolve("../routes/voucher");
  const routerPath = require.resolve("../routes/admin/vouchers");
  const saved = new Map([adminPath, publicPath, routerPath].map((path) => [path, require.cache[path]]));
  const oldKey = process.env.VOUCHER_IMAGE_ENCRYPTION_KEY;
  process.env.VOUCHER_IMAGE_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString("base64");
  const objects = new Map();
  require.cache[adminPath] = { id: adminPath, filename: adminPath, loaded: true, exports: {
    storage: () => ({ bucket: () => ({ file: (path) => ({
      save: async (buffer) => objects.set(path, buffer),
      delete: async () => objects.delete(path),
    }) }) }),
  } };
  require.cache[publicPath] = { id: publicPath, filename: publicPath, loaded: true, exports: {
    serializeVoucher: (doc) => ({ id: doc.id, ...doc.data() }),
  } };
  delete require.cache[routerPath];
  const express = require("express");
  const app = express();
  app.use(express.json());
  app.use(require(routerPath)({ db, normalizeLimit: () => 100 }));
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const createdResponse = await fetch(`${base}/vouchers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: "10", merchant: "merchant", terms: "terms", cost: 1, totalNumber: 0, voucherType: "imported" }),
    });
    assert.equal(createdResponse.status, 201);
    const voucherId = (await createdResponse.json()).data.id;
    assert.equal(docs.get(`vouchers/${voucherId}`).isActive, false);
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1]);
    async function importItems(codes, importKey, imageCount = 0, targetId = voucherId) {
      const form = new FormData();
      form.append("items", JSON.stringify(codes.map((code, imageIndex) => ({ code, imageIndex }))));
      form.append("importKey", importKey);
      for (let index = 0; index < imageCount; index += 1) {
        form.append("images", new Blob([png], { type: "image/png" }), `${index}.png`);
      }
      return fetch(`${base}/vouchers/${targetId}/import`, { method: "POST", body: form });
    }
    assert.equal((await importItems(["0001"], "missing", 0)).status, 400);
    assert.equal(objects.size, 0);
    delete process.env.VOUCHER_IMAGE_ENCRYPTION_KEY;
    assert.equal((await importItems(["0001"], "no-key", 1)).status, 503);
    assert.equal(objects.size, 0);
    process.env.VOUCHER_IMAGE_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString("base64");
    const hundredCodes = Array.from({ length: 100 }, (_, index) => `code-${index}`);
    assert.equal((await importItems(hundredCodes, "first", 100)).status, 200);
    assert.equal(docs.get(`vouchers/${voucherId}`).totalNumber, 100);
    assert.equal(docs.get(`vouchers/${voucherId}`).isActive, true);
    assert.equal(objects.size, 100);
    assert.notDeepEqual([...objects.values()][0], png);
    assert.equal((await importItems(hundredCodes, "first", 100)).status, 200);
    assert.equal(objects.size, 100);
    assert.equal((await importItems(["code-0"], "second", 1)).status, 409);
    assert.equal((await importItems(Array.from({ length: 101 }, (_, index) => `x-${index}`), "too-many", 101)).status, 400);
    assert.equal(objects.size, 100);
    assert.equal(docs.get(`vouchers/${voucherId}`).totalNumber, 100);
    const details = await (await fetch(`${base}/vouchers/${voucherId}`)).json();
    assert.equal(details.data.totalNumber, 100);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    for (const [path, cached] of saved) {
      if (cached) require.cache[path] = cached;
      else delete require.cache[path];
    }
    if (oldKey === undefined) delete process.env.VOUCHER_IMAGE_ENCRYPTION_KEY;
    else process.env.VOUCHER_IMAGE_ENCRYPTION_KEY = oldKey;
  }
});

test("redeems concurrent imported stock once, refunds on failure, and authorizes private images", async () => {
  const { db, docs } = fakeFirestore();
  const adminPath = require.resolve("firebase-admin");
  const helpersPath = require.resolve("../routes/payment/helpers");
  const authPath = require.resolve("../routes/auth");
  const routerPath = require.resolve("../routes/payment/voucherRoutes");
  const saved = new Map([adminPath, helpersPath, authPath, routerPath].map((path) => [path, require.cache[path]]));
  const key = process.env.VOUCHER_IMAGE_ENCRYPTION_KEY;
  process.env.VOUCHER_IMAGE_ENCRYPTION_KEY = Buffer.alloc(32, 2).toString("base64");
  const image = Buffer.from("private data");
  const encrypted = encryptImage(image);
  require.cache[adminPath] = { id: adminPath, filename: adminPath, loaded: true, exports: {
    storage: () => ({ bucket: () => ({ file: () => ({ download: async () => [encrypted] }) }) }),
  } };
  require.cache[helpersPath] = { id: helpersPath, filename: helpersPath, loaded: true, exports: {
    db, buildAssignedVoucherNumber: () => "N001", generateTransactionId: () => "tx",
    getWalletByUserId: async (userId) => ({ doc: { id: userId } }),
  } };
  require.cache[authPath] = { id: authPath, filename: authPath, loaded: true, exports: { authenticateToken() {} } };
  delete require.cache[routerPath];
  try {
    const router = require(routerPath);
    const findHandler = (method, path) => router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]).route.stack.at(-1).handle;
    const redeem = findHandler("post", "/redeem-voucher");
    const getImage = findHandler("get", "/redeemed-vouchers/:redemptionId/image");
    const getWallet = findHandler("get", "/redeemed-vouchers");
    const updateStatus = findHandler("patch", "/redeemed-vouchers/:redemptionId/status");
    const voucher = db.collection("vouchers").doc("v");
    docs.set(voucher.path, { voucherType: "imported", totalNumber: 2, redeemedCount: 0, cost: 3, isActive: true, voucherImage: "https://example.com/shared.png" });
    docs.set(`${voucher.path}/inventory/${itemId(0)}`, { code: "X09", storagePath: "private/first", contentType: "image/png", status: "available" });
    docs.set(`${voucher.path}/inventory/${itemId(1)}`, { code: "X10", storagePath: "private/item", contentType: "image/png", status: "available" });
    docs.set("wallets/a", { balance: 10 });
    docs.set("wallets/b", { balance: 10 });
    docs.set("wallets/c", { balance: 10 });
    async function claim(userId, keyValue) {
      const res = response();
      await redeem({ user: { userId }, body: { voucherId: "v", idempotencyKey: keyValue } }, res);
      return res;
    }
    const [a, b, c] = await Promise.all([claim("a", "1"), claim("b", "2"), claim("c", "3")]);
    assert.deepEqual([a.statusCode, b.statusCode, c.statusCode], [200, 200, 409]);
    assert.equal(a.body.data.voucher.claimedVoucherNumber, "X09");
    assert.equal(a.body.data.voucher.voucherImage, "https://example.com/shared.png");
    assert.equal(a.body.data.voucher.importedQrImageUrl, "/api/payment/redeemed-vouchers/a_1/image");
    assert.equal(docs.get("voucherRedemptions/a_1").importedImagePath, "private/first");
    assert.equal(b.body.data.voucher.claimedVoucherNumber, "X10");
    assert.equal(b.body.data.voucher.voucherImage, "https://example.com/shared.png");
    assert.equal(b.body.data.voucher.importedQrImageUrl, "/api/payment/redeemed-vouchers/b_2/image");
    assert.equal(docs.get("voucherRedemptions/b_2").importedImagePath, "private/item");
    assert.equal("importedImageUrl" in b.body.data.voucher, false);
    assert.equal(docs.get("wallets/c").balance, 10);
    assert.equal(docs.get("vouchers/v").redeemedCount, 2);
    assert.deepEqual((await claim("a", "1")).body.data, a.body.data);
    assert.deepEqual((await claim("b", "2")).body.data, b.body.data);
    assert.equal(docs.get("wallets/a").balance, 7);
    docs.set("vouchers/poor", { voucherType: "imported", totalNumber: 1, redeemedCount: 0, cost: 50, isActive: true });
    docs.set(`vouchers/poor/inventory/${itemId(0)}`, { code: "unclaimed", storagePath: "private/poor", contentType: "image/png", status: "available" });
    const insufficient = response();
    await redeem({ user: { userId: "c" }, body: { voucherId: "poor", idempotencyKey: "4" } }, insufficient);
    assert.equal(insufficient.statusCode, 400);
    assert.equal(docs.get(`vouchers/poor/inventory/${itemId(0)}`).status, "available");
    assert.equal(docs.get("vouchers/poor").redeemedCount, 0);
    assert.equal(docs.get("wallets/c").balance, 10);
    const conflict = response();
    await redeem({ user: { userId: "a" }, body: { voucherId: "poor", idempotencyKey: "1" } }, conflict);
    assert.equal(conflict.statusCode, 409);
    docs.set("voucherRedemptions/a_b_c", { userId: "a", voucherId: "v", result: { private: "data" } });
    const userConflict = response();
    await redeem({ user: { userId: "a_b" }, body: { voucherId: "v", idempotencyKey: "c" } }, userConflict);
    assert.equal(userConflict.statusCode, 409);
    for (const [type, expected] of [["static", "SHARED"], ["numbered", "N001"]]) {
      docs.set(`vouchers/${type}`, { voucherType: type, totalNumber: 1, redeemedCount: 0, cost: 1, isActive: true, promotionCode: "SHARED", qrCode: "SHARED" });
      const legacy = response();
      await redeem({ user: { userId: "c" }, body: { voucherId: type, idempotencyKey: type } }, legacy);
      assert.equal(legacy.statusCode, 200);
      assert.equal(legacy.body.data.voucher.promotionCode, expected);
    }
    const denied = response();
    await getImage({ user: { userId: "a" }, params: { redemptionId: "b_2" } }, denied);
    assert.equal(denied.statusCode, 404);
    const allowed = response();
    await getImage({ user: { userId: "b" }, params: { redemptionId: "b_2" } }, allowed);
    assert.deepEqual(allowed.body, image);
    assert.equal(allowed.headers["Content-Type"], "image/png");
    const wallet = response();
    await getWallet({ user: { userId: "b" } }, wallet);
    assert.equal(wallet.body.data[0].importedQrImageUrl, "/api/payment/redeemed-vouchers/b_2/image");
    const completed = response();
    await updateStatus({ user: { userId: "b" }, params: { redemptionId: "b_2" }, body: { status: "COMPLETED" } }, completed);
    assert.equal(completed.body.data.importedQrImageUrl, "/api/payment/redeemed-vouchers/b_2/image");
    docs.set("voucherRedemptions/b_old", {
      userId: "b", voucherId: "v",
      result: { voucher: { voucherImage: "https://example.com/shared.png", importedImageUrl: "/api/payment/redeemed-vouchers/b_old/image" } },
    });
    const oldRetry = await claim("b", "old");
    assert.equal(oldRetry.body.data.voucher.voucherImage, "/api/payment/redeemed-vouchers/b_old/image");
    assert.equal("importedImageUrl" in oldRetry.body.data.voucher, false);
    const oldWallet = response();
    await getWallet({ user: { userId: "b" } }, oldWallet);
    assert.ok(oldWallet.body.data.some((item) => item.voucherImage === "/api/payment/redeemed-vouchers/b_old/image" && !("importedImageUrl" in item)));

    docs.get("voucherRedemptions/b_2").createdAt = "2024-01-01T00:00:00Z";
    for (const [id, createdAt] of [
      ["b_recent", "2025-01-02T00:00:00+08:00"],
      ["b_tie_a", "2025-01-01T16:00:00Z"],
      ["b_invalid", "not-a-date"],
    ]) {
      docs.set(`voucherRedemptions/${id}`, { userId: "b", createdAt, result: { voucher: { id } } });
    }
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (message) => warnings.push(message);
    try {
      const sorted = response();
      await getWallet({ user: { userId: "b" } }, sorted);
      assert.deepEqual(sorted.body.data.map((item) => item.redemptionId), [
        "b_recent", "b_tie_a", "b_2", "b_invalid", "b_old",
      ]);
      assert.equal(warnings.length, 1);
      assert.match(warnings[0], /b_invalid/);
    } finally {
      console.warn = originalWarn;
    }
  } finally {
    for (const [path, cached] of saved) {
      if (cached) require.cache[path] = cached;
      else delete require.cache[path];
    }
    if (key === undefined) delete process.env.VOUCHER_IMAGE_ENCRYPTION_KEY;
    else process.env.VOUCHER_IMAGE_ENCRYPTION_KEY = key;
  }
});
