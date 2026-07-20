const express = require("express");

const context = require("./context");

const createRegisterRouter = require("./register");
const createLoginRouter = require("./login");
const createRefreshTokenRouter = require("./refreshToken");
const createProfileRouter = require("./profile");
const createCompanyRouter = require("./company");

const router = express.Router();

router.use(createRegisterRouter(context));
router.use(createLoginRouter(context));
router.use(createRefreshTokenRouter(context));
router.use(createProfileRouter(context));
router.use(createCompanyRouter(context));

module.exports = router;
