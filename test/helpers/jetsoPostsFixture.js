const assert = require("node:assert/strict");

function createPostDb() {
  const collections = {
    jetsoPosts: new Map(),
    jetsoPostImages: new Map(),
    companies: new Map([["merchant-a", { name: "Example merchant", isActive: true, icon: "" }]]),
  };
  let nextId = 1;
  let pending = Promise.resolve();
  const document = (name, id) => ({
    id, exists: collections[name].has(id),
    data: () => structuredClone(collections[name].get(id)),
  });
  const db = {
    collections,
    collection(name) {
      assert.ok(collections[name], `Unexpected collection access: ${name}`);
      const store = collections[name];
      const collection = {
        doc(id = `post-${nextId++}`) {
          return {
            id, path: `${name}/${id}`,
            async get() { return document(name, id); },
            async set(data) { store.set(id, structuredClone(data)); },
          };
        },
        orderBy(field, direction) {
          if (typeof field === "string") assert.equal(direction, "desc");
          let limit = Infinity;
          let cursor = null;
          const query = {
            limit(value) { limit = value; return query; },
            startAfter(value) { cursor = value.id; return query; },
            async get() {
              const value = (record) => typeof field === "string"
                ? field.split(".").reduce((current, key) => current?.[key], record)
                : null;
              const ordered = [...store.entries()]
                .filter(([, record]) => typeof field !== "string" || value(record) !== undefined)
                .sort((a, b) => typeof field === "string"
                  ? String(value(b[1])).localeCompare(String(value(a[1]))) || b[0].localeCompare(a[0])
                  : a[0].localeCompare(b[0]));
              const start = cursor ? ordered.findIndex(([id]) => id === cursor) + 1 : 0;
              const docs = ordered.slice(start, start + limit).map(([id]) => document(name, id));
              return { docs, size: docs.length, forEach: (visit) => docs.forEach(visit) };
            },
          };
          return query;
        },
      };
      return collection;
    },
    async runTransaction(callback) {
      const previous = pending;
      let release;
      pending = new Promise((resolve) => { release = resolve; });
      await previous;
      const writes = [];
      try {
        const result = await callback({
          get: (ref) => ref.get(),
          set: (ref, data) => writes.push([ref, structuredClone(data)]),
        });
        for (const [ref, data] of writes) await ref.set(data);
        return result;
      } finally { release(); }
    },
  };
  return db;
}

module.exports = { createPostDb };
