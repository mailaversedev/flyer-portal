const express = require("express");
const router = express.Router();
const { COMPANY_INDUSTRIES } = require("../config/companyIndustries");

router.get("/industries", (_req, res) => {
  res.status(200).json({
    success: true,
    data: COMPANY_INDUSTRIES,
  });
});

module.exports = router;