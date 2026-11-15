const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const babel = require("@babel/core");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { JSDOM } = require("jsdom");

const originalJsLoader = require.extensions[".js"];
require.extensions[".js"] = (module, filename) => {
  if (!filename.startsWith(path.resolve(__dirname, "../src") + path.sep)) {
    return originalJsLoader(module, filename);
  }

  const source = fs.readFileSync(filename, "utf8");
  const { code } = babel.transformSync(source, {
    babelrc: false,
    configFile: false,
    filename,
    presets: [
      ["@babel/preset-env", { targets: { node: "current" } }],
      "@babel/preset-react",
    ],
  });
  module._compile(code, filename);
};

const apiServicePath = require.resolve("../src/services/ApiService");
const originalApiService = require.cache[apiServicePath];
require.cache[apiServicePath] = {
  id: apiServicePath,
  filename: apiServicePath,
  loaded: true,
  exports: { default: {} },
};

let PlatformAdminVoucherRedemptionsTable;
try {
  ({ PlatformAdminVoucherRedemptionsTable } = require(
    "../src/components/PlatformAdmin/PlatformAdminVoucherRedemptionsTable",
  ));
} finally {
  require.extensions[".js"] = originalJsLoader;
  if (originalApiService) {
    require.cache[apiServicePath] = originalApiService;
  } else {
    delete require.cache[apiServicePath];
  }
}

const translations = {
  "adminPage.active": "Active",
  "adminPage.inactive": "Inactive",
  "adminPage.voucherExpired": "Expired",
  "adminPage.voucherNoExpiry": "No expiry",
};
const t = (key) => translations[key] || key;

test("voucher redemptions display expiry date and status", () => {
  const markup = renderToStaticMarkup(
    React.createElement(PlatformAdminVoucherRedemptionsTable, {
      t,
      redemptions: [
        {
          id: "expired",
          user: { username: "Expired User" },
          voucher: { expiryDate: "2000-01-01", isActive: true },
        },
        {
          id: "active",
          user: { username: "Active User" },
          voucher: { expiryDate: "2999-12-31", isActive: true },
        },
        {
          id: "no-expiry",
          user: { username: "No Expiry User" },
          voucher: { expiryDate: "", isActive: true },
        },
        {
          id: "inactive",
          user: { username: "Inactive User" },
          voucher: { expiryDate: "2999-12-31", isActive: false },
        },
      ],
    }),
  );
  const document = new JSDOM(markup).window.document;
  const headers = Array.from(document.querySelectorAll("thead th")).map(
    (header) => header.textContent,
  );
  const rows = new Map(
    Array.from(document.querySelectorAll("tbody tr")).map((row) => [
      row.cells[0].textContent,
      row,
    ]),
  );

  assert.ok(headers.includes("adminPage.voucherExpiryDate"));
  assert.ok(headers.includes("adminPage.voucherExpiryStatus"));
  assert.equal(rows.get("Expired User").cells[7].textContent, "Expired");
  assert.equal(
    rows.get("Expired User").cells[6].textContent,
    new Date("2000-01-01T00:00:00").toLocaleDateString(),
  );
  assert.equal(rows.get("Active User").cells[7].textContent, "Active");
  assert.equal(rows.get("No Expiry User").cells[7].textContent, "No expiry");
  assert.equal(rows.get("Inactive User").cells[7].textContent, "Inactive");
});
