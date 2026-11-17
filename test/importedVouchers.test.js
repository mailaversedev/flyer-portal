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

test("validates codes and image content and encrypts image data", () => {
  const previous = process.env.VOUCHER_IMAGE_ENCRYPTION_KEY;
  process.env.VOUCHER_IMAGE_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64");
  try {
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1]);
    const prepared = prepareImport('["  0001 ", "A-9"]', [], "key-1");
    assert.deepEqual(prepared.codes, ["  0001 ", "A-9"]);
    assert.equal(prepareImport("[]", [{ buffer: png }], "image").images[0].type, "image/png");
    assert.throws(() => prepareImport('["x"]', [{ buffer: png }], "mixed"), /either codes or images/);
    assert.throws(() => prepareImport('["x","x"]', [], "key"), /Duplicate/);
    assert.throws(() => prepareImport("[]", [{ buffer: Buffer.from("svg") }], "key"), /Images must/);
    assert.throws(() => prepareImport('["x"]', [], "../bad"), /Invalid import key/);
    assert.equal(prepareImport(JSON.stringify(Array.from({ length: 100 }, (_, index) => `${index}`)), [], "codes").codes.length, 100);
    assert.throws(() => prepareImport(JSON.stringify(Array.from({ length: 101 }, (_, index) => `${index}`)), [], "key"), /limit/);
    assert.equal(MAX_IMAGES, 100);
    assert.equal(prepareImport("[]", Array.from({ length: 100 }, () => ({ buffer: png })), "images").images.length, 100);
    assert.throws(() => prepareImport("[]", Array.from({ length: 101 }, () => ({ buffer: png })), "too-many-images"), /limit/);
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
  const first = prepareImport('["ABC","0009"]', [], "import1");
  assert.equal((await commitImport(db, voucher, first, [], "now")).totalNumber, 2);
  assert.equal(docs.get(voucher.path).importKind, "code");
  assert.equal(docs.get(`${voucher.path}/inventory/${itemId(0)}`).code, "ABC");
  assert.equal(docs.get(`${voucher.path}/inventory/${itemId(1)}`).code, "0009");
  assert.equal((await commitImport(db, voucher, first, [], "later")).alreadyImported, true);
  await assert.rejects(commitImport(db, voucher, prepareImport('["changed"]', [], "import1"), [], "later"), /__IMPORT_KEY_CONFLICT__/);
  await assert.rejects(commitImport(db, voucher, prepareImport('["ABC"]', [], "import2"), [], "later"), /__DUPLICATE_CODE__/);
  assert.equal(docs.get(voucher.path).totalNumber, 2);
  await commitImport(db, voucher, prepareImport('["third"]', [], "import3"), [], "later");
  assert.equal(docs.get(`${voucher.path}/inventory/${itemId(2)}`).code, "third");
});

test("fixes inventory type across batches, including legacy vouchers and concurrent imports", async () => {
  const { db, docs } = fakeFirestore();
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1]);
  const images = prepareImport("[]", [{ buffer: png }], "image");
  const codes = prepareImport('["code"]', [], "code");
  const imagePaths = [{ storagePath: "path", contentType: "image/png" }];
  const imageVoucher = db.collection("vouchers").doc("image");
  docs.set(imageVoucher.path, { voucherType: "imported", totalNumber: 0 });
  await commitImport(db, imageVoucher, images, imagePaths, "now");
  assert.equal(docs.get(imageVoucher.path).importKind, "image");
  await assert.rejects(commitImport(db, imageVoucher, codes, [], "now"), /__VOUCHER_IMPORT_KIND_MISMATCH__/);
  await commitImport(db, imageVoucher, prepareImport("[]", [{ buffer: png }], "next"), imagePaths, "now");
  assert.equal(docs.get(imageVoucher.path).totalNumber, 2);

  const legacy = db.collection("vouchers").doc("legacy");
  docs.set(legacy.path, { voucherType: "imported", totalNumber: 1 });
  docs.set(`${legacy.path}/inventory/${itemId(0)}`, { kind: "code" });
  await assert.rejects(commitImport(db, legacy, images, imagePaths, "now"), /__VOUCHER_IMPORT_KIND_MISMATCH__/);
  await commitImport(db, legacy, codes, [], "now");
  assert.equal(docs.get(legacy.path).importKind, "code");
  const invalid = db.collection("vouchers").doc("invalid");
  docs.set(invalid.path, { voucherType: "imported", totalNumber: 1 });
  await assert.rejects(commitImport(db, invalid, codes, [], "now"), /__VOUCHER_IMPORT_KIND_INVALID__/);

  const concurrent = db.collection("vouchers").doc("concurrent");
  docs.set(concurrent.path, { voucherType: "imported", totalNumber: 0 });
  const outcomes = await Promise.allSettled([
    commitImport(db, concurrent, codes, [], "now"),
    commitImport(db, concurrent, images, imagePaths, "now"),
  ]);
  assert.equal(outcomes.filter((result) => result.status === "fulfilled").length, 1);
  assert.match(outcomes.find((result) => result.status === "rejected").reason.message, /__VOUCHER_IMPORT_KIND_MISMATCH__/);
  assert.equal(docs.get(concurrent.path).totalNumber, 1);
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
      form.append("codes", JSON.stringify(codes));
      form.append("importKey", importKey);
      for (let index = 0; index < imageCount; index += 1) {
        form.append("images", new Blob([png], { type: "image/png" }), `${index}.png`);
      }
      return fetch(`${base}/vouchers/${targetId}/import`, { method: "POST", body: form });
    }
    assert.equal((await importItems(["0001"], "mixed", 1)).status, 400);
    assert.equal(objects.size, 0);
    assert.equal((await importItems([], "first", 100)).status, 200);
    assert.equal(docs.get(`vouchers/${voucherId}`).totalNumber, 100);
    assert.equal(docs.get(`vouchers/${voucherId}`).importKind, "image");
    assert.equal(docs.get(`vouchers/${voucherId}`).isActive, true);
    assert.equal(objects.size, 100);
    assert.notDeepEqual([...objects.values()][0], png);
    assert.equal((await importItems([], "first", 100)).status, 200);
    assert.equal(objects.size, 100);
    assert.equal((await importItems(["0001"], "second")).status, 409);
    assert.equal((await importItems([], "too-many", 101)).status, 400);
    assert.equal(objects.size, 100);
    assert.equal(docs.get(`vouchers/${voucherId}`).totalNumber, 100);
    docs.set("vouchers/code-only", { voucherType: "imported", totalNumber: 0 });
    const hundredCodes = Array.from({ length: 100 }, (_, index) => `code-${index}`);
    assert.equal((await importItems(hundredCodes, "codes", 0, "code-only")).status, 200);
    assert.equal((await importItems([], "wrong-type", 1, "code-only")).status, 409);
    assert.equal(objects.size, 100);
    assert.equal(docs.get("vouchers/code-only").totalNumber, 100);
    const details = await (await fetch(`${base}/vouchers/${voucherId}`)).json();
    assert.equal(details.data.importKind, "image");
    docs.set("vouchers/legacy", { voucherType: "imported", totalNumber: 1 });
    docs.set(`vouchers/legacy/inventory/${itemId(0)}`, { kind: "code" });
    const legacy = await (await fetch(`${base}/vouchers/legacy`)).json();
    assert.equal(legacy.data.importKind, "code");
    docs.set("vouchers/invalid", { voucherType: "imported", totalNumber: 1 });
    const invalid = await fetch(`${base}/vouchers/invalid`);
    assert.equal(invalid.status, 409);
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
    docs.set(`${voucher.path}/inventory/${itemId(0)}`, { kind: "code", code: "X09", status: "available" });
    docs.set(`${voucher.path}/inventory/${itemId(1)}`, { kind: "image", storagePath: "private/item", contentType: "image/png", status: "available" });
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
    assert.equal(b.body.data.voucher.voucherImage, "/api/payment/redeemed-vouchers/b_2/image");
    assert.equal("importedImageUrl" in b.body.data.voucher, false);
    assert.equal(docs.get("wallets/c").balance, 10);
    assert.equal(docs.get("vouchers/v").redeemedCount, 2);
    assert.deepEqual((await claim("a", "1")).body.data, a.body.data);
    assert.deepEqual((await claim("b", "2")).body.data, b.body.data);
    assert.equal(docs.get("wallets/a").balance, 7);
    docs.set("vouchers/poor", { voucherType: "imported", totalNumber: 1, redeemedCount: 0, cost: 50, isActive: true });
    docs.set(`vouchers/poor/inventory/${itemId(0)}`, { kind: "code", code: "unclaimed", status: "available" });
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
    assert.equal(wallet.body.data[0].voucherImage, "/api/payment/redeemed-vouchers/b_2/image");
    const completed = response();
    await updateStatus({ user: { userId: "b" }, params: { redemptionId: "b_2" }, body: { status: "COMPLETED" } }, completed);
    assert.equal(completed.body.data.voucherImage, "/api/payment/redeemed-vouchers/b_2/image");
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
