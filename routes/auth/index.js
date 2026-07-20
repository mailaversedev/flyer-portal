const express = require("express");

const context = require("./context");

const createRegisterRouter = require("./register");
const createPasswordResetRouter = require("./passwordReset");
const createLoginRouter = require("./login");
const createRefreshTokenRouter = require("./refreshToken");

const router = express.Router();

router.use(createRegisterRouter(context));
router.use(createPasswordResetRouter(context));
router.use(createLoginRouter(context));
router.use(createRefreshTokenRouter(context));

module.exports = {
  router,
  authenticateToken: context.authenticateToken,
};
