const { getFlyerCoupons, claimDocumentId } = require("./flyerCoupons");

function normalizeCompanyCouponEntry({ flyerId, companyId, flyerData, coupon: couponOverride, now }) {
  if (!companyId || !flyerId || !flyerData) {
    return null;
  }

  const coupon = couponOverride || flyerData.coupon || {};
  if (typeof coupon.couponType !== "string" || !coupon.couponType.trim()) {
    return null;
  }

  const timestamp = now || new Date().toISOString();
  const expiredDate =
    typeof coupon.expiredDate === "string" ? coupon.expiredDate.trim() : "";

  return {
    couponType: coupon.couponType,
    couponFile:
      typeof coupon.couponFile === "string" ? coupon.couponFile : null,
    qrCodeImage:
      typeof coupon.qrCodeImage === "string" ? coupon.qrCodeImage : null,
    barcodeImage:
      typeof coupon.barcodeImage === "string" ? coupon.barcodeImage : null,
    termsConditions:
      typeof coupon.termsConditions === "string" ? coupon.termsConditions : "",
    expiredDate,
    discountValue:
      typeof coupon.discountValue === "string" ? coupon.discountValue : "",
    itemDescription:
      typeof coupon.itemDescription === "string" ? coupon.itemDescription : "",
    promotionCode:
      typeof coupon.promotionCode === "string" ? coupon.promotionCode : "",
    quantity:
      coupon.quantity ? parseInt(coupon.quantity) : null,
    downloadCount: coupon.downloadCount || 0,
    createdAt:
      typeof flyerData.createdAt === "string" ? flyerData.createdAt : timestamp,
    updatedAt: timestamp,
  };
}

function isCompanyCouponAvailable(coupon, now = new Date().toISOString()) {
  const expiredDate =
    typeof coupon?.expiredDate === "string" ? coupon.expiredDate.trim() : "";

  // Check if coupon has expired
  if (expiredDate && expiredDate < now.slice(0, 10)) {
    return false;
  }

  // Check if coupon quantity is exhausted
  if (coupon?.quantity) {
    const quantity = parseInt(coupon.quantity);
    const downloadCount = coupon?.downloadCount || 0;
    if (downloadCount >= quantity) {
      return false;
    }
  }

  return true;
}

function mapCompanyCouponDoc(doc) {
  const data = doc.data() || {};

  return {
    id: doc.id,
    couponType: data.couponType || "",
    couponFile: data.couponFile || null,
    qrCodeImage: data.qrCodeImage || null,
    barcodeImage: data.barcodeImage || null,
    termsConditions: data.termsConditions || "",
    expiredDate: data.expiredDate || "",
    discountValue: data.discountValue || "",
    itemDescription: data.itemDescription || "",
    promotionCode: data.promotionCode || "",
    quantity: data.quantity ? parseInt(data.quantity) : null,
    downloadCount: data.downloadCount || 0,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
  };
}

async function syncCompanyCouponLibraryEntry({
  db,
  companyId,
  flyerId,
  flyerData,
  transaction,
}) {
  if (!db || !companyId || !flyerId) {
    return null;
  }

  const library = db.collection("companies").doc(companyId).collection("coupons");
  const coupons = getFlyerCoupons(flyerData);
  if (!coupons.length) {
    const companyCouponRef = library.doc(flyerId);
    if (transaction) {
      transaction.delete(companyCouponRef);
    } else {
      try {
        await companyCouponRef.delete();
      } catch (error) {
        if (error.code !== 5) {
          throw error;
        }
      }
    }
    return null;
  }

  const entries = coupons.map((coupon, index) => ({
    ref: library.doc(claimDocumentId(flyerId, coupon, index)),
    data: normalizeCompanyCouponEntry({ flyerId, companyId, flyerData, coupon }),
  }));
  for (const entry of entries) {
    if (transaction) transaction.set(entry.ref, entry.data);
    else await entry.ref.set(entry.data);
  }
  return entries.map((entry) => entry.data);
}

module.exports = {
  isCompanyCouponAvailable,
  mapCompanyCouponDoc,
  normalizeCompanyCouponEntry,
  syncCompanyCouponLibraryEntry,
};