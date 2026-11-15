const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const createProductsRouter = require("../routes/staffAuth/products");

function createDb() {
  const productsByCompany = new Map([["company-a", new Map()], ["company-b", new Map()]]);
  let nextId = 1;
  const document = (id, value) => ({
    id,
    exists: Boolean(value),
    data: () => value,
  });

  const db = {
    collection(name) {
      if (name === "staffs") {
        return {
          doc(userId) {
            return {
              async get() {
                return userId === "staff-a"
                  ? document(userId, { companyId: "company-a" })
                  : userId === "staff-b"
                    ? document(userId, { companyId: "company-b" })
                  : userId === "staff-without-company"
                    ? document(userId, {})
                    : document(userId, null);
              },
            };
          },
        };
      }

      assert.equal(name, "companies");
      return {
        doc(companyId) {
          const products = productsByCompany.get(companyId);
          return {
            collection(collectionName) {
              assert.equal(collectionName, "products");
              return {
                doc(productId) {
                  return {
                    async get() {
                      return document(productId, products?.get(productId));
                    },
                    async update(updates) {
                      Object.assign(products.get(productId), updates);
                    },
                  };
                },
                async add(value) {
                  const id = `product-${nextId++}`;
                  products.set(id, value);
                  return { id };
                },
                orderBy(field, direction) {
                  assert.equal(field, "createdAt");
                  assert.equal(direction, "desc");
                  let offset = 0;
                  let limit = 10;
                  const query = {
                    startAfter(cursor) {
                      const ordered = [...products.entries()].sort((a, b) =>
                        b[1].createdAt.localeCompare(a[1].createdAt),
                      );
                      offset = ordered.findIndex(([id]) => id === cursor.id) + 1;
                      return query;
                    },
                    limit(size) {
                      limit = size;
                      return query;
                    },
                    async get() {
                      const ordered = [...products.entries()].sort((a, b) =>
                        b[1].createdAt.localeCompare(a[1].createdAt),
                      );
                      const docs = ordered
                        .slice(offset, offset + limit)
                        .map(([id, value]) => document(id, value));
                      return { docs, size: docs.length };
                    },
                  };
                  return query;
                },
              };
            },
          };
        },
      };
    },
  };
  return db;
}

async function withRouter(t) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { userId: req.get("x-user-id") || "staff-a" };
    next();
  });
  app.use(
    "/api/auth/staff",
    createProductsRouter({
      db: createDb(),
      authenticateToken: (_req, _res, next) => next(),
    }),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(
    () =>
      new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      }),
  );
  return (path, options = {}) =>
    fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      ...options,
      headers: {
        "content-type": "application/json",
        ...(options.headers || {}),
      },
    });
}

const validProduct = {
  name: "Coffee",
  currency: "HKD",
  price: "28.50",
  active: true,
  url: "https://shop.example/coffee",
  image: "https://images.example/coffee.jpg",
  description: "Fresh coffee.",
};

test("merchant product CRUD is company-scoped and validates public fields", async (t) => {
  const request = await withRouter(t);
  const create = await request("/api/auth/staff/products", {
    method: "POST",
    body: JSON.stringify(validProduct),
  });
  assert.equal(create.status, 201);
  const created = (await create.json()).data;
  assert.equal(created.name, "Coffee");
  assert.equal(created.active, true);

  const get = await request(`/api/auth/staff/products/${created.id}`);
  assert.equal(get.status, 200);
  assert.equal((await get.json()).data.name, "Coffee");
  const otherCompany = await request(`/api/auth/staff/products/${created.id}`, {
    headers: { "x-user-id": "staff-b" },
  });
  assert.equal(otherCompany.status, 404);
  const missing = await request("/api/auth/staff/products/missing");
  assert.equal(missing.status, 404);
  const noCompany = await request(`/api/auth/staff/products/${created.id}`, {
    headers: { "x-user-id": "staff-without-company" },
  });
  assert.equal(noCompany.status, 404);

  const invalidCurrency = await request("/api/auth/staff/products", {
    method: "POST",
    body: JSON.stringify({ ...validProduct, currency: "ABC" }),
  });
  assert.equal(invalidCurrency.status, 400);

  const update = await request(`/api/auth/staff/products/${created.id}`, {
    method: "PUT",
    body: JSON.stringify({ ...validProduct, active: false }),
  });
  assert.equal(update.status, 200);
  assert.equal((await update.json()).data.active, false);

  const list = await request("/api/auth/staff/products");
  const listed = await list.json();
  assert.equal(list.status, 200);
  assert.equal(listed.data[0].active, false);

  const unassociated = await request("/api/auth/staff/products", {
    headers: { "x-user-id": "staff-without-company" },
  });
  assert.equal(unassociated.status, 404);
});
