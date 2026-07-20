const express = require("express");

const { authenticateToken } = require("../auth");
const context = require("./context");

const createCrmRouter = require("./crm");
const createUsersRouter = require("./users");
const createCompaniesRouter = require("./companies");
const createVouchersRouter = require("./vouchers");
const createFlyersRouter = require("./flyers");
const createCreditRequestsRouter = require("./creditRequests");

const router = express.Router();

router.use(authenticateToken, context.requireSuperAdmin);

router.use(createCrmRouter(context));
router.use(createUsersRouter(context));
router.use(createCompaniesRouter(context));
router.use(createVouchersRouter(context));
router.use(createFlyersRouter(context));
router.use(createCreditRequestsRouter(context));

module.exports = router;
