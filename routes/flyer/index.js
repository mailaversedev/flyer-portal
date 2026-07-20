const express = require("express");

const context = require("./context");

const createJobsRouter = require("./jobs");
const createCreationRouter = require("./creation");
const createCompanyRouter = require("./company");
const createListingRouter = require("./listing");
const createAnswersRouter = require("./answers");

const router = express.Router();

router.use(createJobsRouter(context));
router.use(createCreationRouter(context));
router.use(createCompanyRouter(context));
router.use(createListingRouter(context));
router.use(createAnswersRouter(context));

module.exports = router;
