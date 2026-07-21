const express = require("express");

const bundleRoutes = require("./bundleRoutes");
const creditRequestRoutes = require("./creditRequestRoutes");
const tokenRoutes = require("./tokenRoutes");
const voucherRoutes = require("./voucherRoutes");
const walletRoutes = require("./walletRoutes");

const router = express.Router();

router.use(tokenRoutes);
router.use(voucherRoutes);
router.use(bundleRoutes);
router.use(walletRoutes);
router.use(creditRequestRoutes);

module.exports = router;