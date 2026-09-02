const express = require("express");

const { authenticateToken } = require("../auth");
const context = require("./context");

const createCrmRouter = require("./crm");
const createUsersRouter = require("./users");
const createCompaniesRouter = require("./companies");
const createVouchersRouter = require("./vouchers");
const createFlyersRouter = require("./flyers");
const createCreditRequestsRouter = require("./creditRequests");
const createAdminSummaryRouter = require("./summary");
const createCouponClaimsRouter = require("./couponClaims");
const createVoucherRedemptionsRouter = require("./voucherRedemptions");

const router = express.Router();

router.use(authenticateToken, context.requireSuperAdmin);

router.use(createCrmRouter(context));
router.use(createUsersRouter(context));
router.use(createCompaniesRouter(context));
router.use(createVouchersRouter(context));
router.use(createFlyersRouter(context));
router.use(createCreditRequestsRouter(context));
router.use(createCouponClaimsRouter(context));
router.use(createVoucherRedemptionsRouter(context));
router.use(createAdminSummaryRouter(context));

module.exports = router;
