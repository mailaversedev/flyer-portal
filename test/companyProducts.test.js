const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

function loadCompanyRouter() {
  const authPath = require.resolve("../routes/auth");
  const routerPath = require.resolve("../routes/flyer/company");
  const savedAuth = require.cache[authPath];
  const savedRouter = require.cache[routerPath];
  require.cache[authPath] = {
    id: authPath,
    filename: authPath,
    loaded: true,
    exports: { authenticateToken: (_req, _res, next) => next() },
  };
  delete require.cache[routerPath];
  try {
    return require(routerPath);
  } finally {
    if (savedAuth) require.cache[authPath] = savedAuth;
    else delete require.cache[authPath];
    if (savedRouter) require.cache[routerPath] = savedRouter;
    else delete require.cache[routerPath];
  }
}

test("public product paging accepts inactive cursors without returning inactive products", async (t) => {
  const products = Array.from({ length: 12 }, (_, index) => ({
    id: `product-${String(index).padStart(2, "0")}`,
    active: true,
    name: `Product ${index}`,
    createdAt: new Date(Date.UTC(2026, 0, 20 - index)).toISOString(),
  }));
  const document = (product) => ({
    exists: Boolean(product),
    id: product?.id,
    data: () => product,
  });
  const productsRef = {
    doc(id) {
      return { get: async () => document(products.find((product) => product.id === id)) };
    },
    where(field, operator, value) {
      assert.equal(field, "active");
      assert.equal(operator, "==");
      assert.equal(value, true);
      let cursor;
      let limit;
      const query = {
        orderBy(field, direction) {
          assert.equal(field, "createdAt");
          assert.equal(direction, "desc");
          return query;
        },
        startAfter(doc) {
          cursor = doc;
          return query;
        },
        limit(size) {
          limit = size;
          return query;
        },
        async get() {
          const offset = cursor
            ? products.findIndex((product) => product.id === cursor.id) + 1
            : 0;
          return {
            docs: products.slice(offset)
              .filter((product) => product.active)
              .slice(0, limit)
              .map(document),
          };
        },
      };
      return query;
    },
  };
  const db = {
    collection(name) {
      assert.equal(name, "companies");
      return {
        doc(companyId) {
          return {
            get: async () => ({ exists: companyId === "merchant" }),
            collection(name) {
              assert.equal(name, "products");
              return productsRef;
            },
          };
        },
      };
    },
  };
  const app = express();
  app.use(loadCompanyRouter()({ db }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections();
  }));
  const request = (query = "", companyId = "merchant") =>
    fetch(`http://127.0.0.1:${server.address().port}/company/${companyId}/products${query}`);

  const first = await request();
  assert.equal(first.status, 200);
  const page = await first.json();
  assert.equal(page.data.length, 10);
  assert.equal(page.pagination.nextCursor, products[9].id);
  products[9].active = false;
  products[10].active = false;
  const next = await request(`?after=${page.pagination.nextCursor}`);
  assert.equal(next.status, 200);
  const nextPage = await next.json();
  assert.deepEqual(nextPage.data.map((product) => product.id), [products[11].id]);
  assert.equal(nextPage.pagination.nextCursor, null);
  assert.equal((await request("?after=missing")).status, 400);
  assert.equal((await request("?limit=11")).status, 400);
  assert.equal((await request("", "missing-company")).status, 404);
});
