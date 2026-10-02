const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const createRouter = require("../routes/staffAuth/passwordReset");

const secret = "staff-password-reset-test-only";
const jwtOptions = { issuer: "flyer-portal", audience: "flyer-portal-staff" };

async function harness(t, options = {}) {
  const writes = [];
  const lookups = [];
  const revocations = [];
  const otpCalls = [];
  const db = {
    collection(name) {
      assert.equal(name, "staffs");
      return {
        doc(id) {
          lookups.push(id);
          return {
            async get() {
              return {
                id,
                exists: options.exists !== false,
                data: () => ({ isActive: options.isActive !== false }),
                ref: { async update(value) { writes.push({ id, ...value }); } },
              };
            },
          };
        },
      };
    },
  };
  const context = {
    db,
    JWT_OPTIONS: jwtOptions,
    authenticateToken(req, res, next) {
      try {
        req.user = jwt.verify(req.headers.authorization?.split(" ")[1], secret, {
          algorithms: ["HS256"],
          issuer: jwtOptions.issuer,
          audience: [jwtOptions.audience, "flyer-portal-users"],
        });
        next();
      } catch (_error) {
        res.status(401).json({ success: false });
      }
    },
    normalizeEmail: (value = "") => value.trim().toLowerCase(),
    isValidEmail: (value) => /\S+@\S+\.\S+/.test(value),
    generateOtp() { assert.fail("Authenticated reset must not generate an OTP"); },
    async storePasswordResetOtp() { assert.fail("Authenticated reset must not store an OTP"); },
    async sendPasswordResetEmail() { assert.fail("Authenticated reset must not send email"); },
    async consumePasswordResetOtp(...args) {
      otpCalls.push(args);
      throw new Error("Invalid OTP");
    },
    async revokeAllRefreshSessions(value) { revocations.push(value); },
  };
  const app = express();
  app.use(express.json());
  app.use(createRouter(context));
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const token = jwt.sign({ userId: "current-staff" }, secret, jwtOptions);
  return {
    writes, lookups, revocations, otpCalls, token,
    async request(body, accessToken = token, endpoint = "/change-password") {
      const response = await fetch(`http://127.0.0.1:${server.address().port}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(body),
      });
      return { status: response.status, body: await response.json() };
    },
  };
}

test("session reset changes only the authenticated staff and revokes refresh sessions", async (t) => {
  const fixture = await harness(t);
  const response = await fixture.request({
    newPassword: "new-password", email: "other@example.com", userId: "other-staff",
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.deepEqual(fixture.lookups, ["current-staff"]);
  assert.equal(fixture.writes.length, 1);
  assert.equal(fixture.writes[0].id, "current-staff");
  assert.equal(await bcrypt.compare("new-password", fixture.writes[0].password), true);
  assert.equal(fixture.revocations.length, 1);
  assert.equal(fixture.revocations[0].userId, "current-staff");
  assert.equal(fixture.revocations[0].subjectType, "staff");
  assert.equal(fixture.revocations[0].reason, "password_reset");
  assert.deepEqual(fixture.otpCalls, []);
});

test("missing, invalid and expired tokens cannot bypass OTP", async (t) => {
  const fixture = await harness(t);
  const expired = jwt.sign({ userId: "current-staff" }, secret, { ...jwtOptions, expiresIn: -1 });
  for (const token of [null, "invalid", expired]) {
    const response = await fixture.request({ newPassword: "new-password" }, token);
    assert.equal(response.status, 401);
  }
  assert.deepEqual(fixture.lookups, []);
  assert.deepEqual(fixture.writes, []);
});

test("customer tokens cannot change a staff password even for the same user ID", async (t) => {
  const fixture = await harness(t);
  const customer = jwt.sign({ userId: "current-staff" }, secret, {
    ...jwtOptions, audience: "flyer-portal-users",
  });
  assert.equal((await fixture.request({ newPassword: "new-password" }, customer)).status, 403);
  const noUser = jwt.sign({}, secret, jwtOptions);
  assert.equal((await fixture.request({ newPassword: "new-password" }, noUser)).status, 403);
  assert.deepEqual(fixture.lookups, []);
  assert.deepEqual(fixture.writes, []);
});

test("missing, short and non-string passwords are rejected", async (t) => {
  const fixture = await harness(t);
  for (const newPassword of [undefined, null, "", "short", 123456, [], {}]) {
    assert.equal((await fixture.request({ newPassword })).status, 400);
  }
  assert.deepEqual(fixture.writes, []);
  assert.deepEqual(fixture.revocations, []);
});

test("inactive or missing staff accounts cannot change passwords", async (t) => {
  for (const options of [{ isActive: false }, { exists: false }]) {
    const fixture = await harness(t, options);
    assert.equal((await fixture.request({ newPassword: "new-password" })).status, 403);
    assert.deepEqual(fixture.writes, []);
    assert.deepEqual(fixture.revocations, []);
  }
});

test("public reset still requires and validates OTP even with a staff token", async (t) => {
  const fixture = await harness(t);
  const body = { email: "staff@example.com", newPassword: "new-password" };
  assert.equal((await fixture.request(body, fixture.token, "/reset-password")).status, 400);
  const invalid = await fixture.request({ ...body, otp: "wrong" }, fixture.token, "/reset-password");
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.message, "Invalid OTP");
  assert.deepEqual(fixture.otpCalls, [["staff@example.com", "wrong"]]);
  assert.deepEqual(fixture.writes, []);
});