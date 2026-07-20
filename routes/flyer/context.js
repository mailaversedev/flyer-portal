const admin = require("firebase-admin");

const db = admin.firestore();
const MAILAVERSE_COMPANY_NAME = "Mailaverse";
const MAILAVERSE_COMPANY_ICON =
  "https://static.wixstatic.com/media/255d46_b08eb7f7e1134cd8b8d5758d0ab3d99e~mv2.png/v1/fill/w_61,h_55,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/Mailaverse%20Logo.png";

const roundMoneyAmount = (value) => Math.round(Number(value) * 100) / 100;

module.exports = {
  admin,
  db,
  MAILAVERSE_COMPANY_NAME,
  MAILAVERSE_COMPANY_ICON,
  roundMoneyAmount,
};
