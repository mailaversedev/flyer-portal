const express = require("express");

const { COMPANY_INDUSTRIES } = require("../config/companyIndustries");

const router = express.Router();

router.get("/industries", (_req, res) => {
  res.status(200).json({
    success: true,
    data: COMPANY_INDUSTRIES,
  });
});

module.exports = router;