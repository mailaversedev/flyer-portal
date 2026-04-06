function normalizeCompanyCouponEntry({ flyerId, companyId, flyerData, now }) {
  if (!companyId || !flyerId || !flyerData) {
    return null;
  }

  const coupon = flyerData.coupon || {};
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
    createdAt:
      typeof flyerData.createdAt === "string" ? flyerData.createdAt : timestamp,
    updatedAt: timestamp,
  };
}

function isCompanyCouponAvailable(coupon, now = new Date().toISOString()) {
  const expiredDate =
    typeof coupon?.expiredDate === "string" ? coupon.expiredDate.trim() : "";

  if (!expiredDate) {
    return true;
  }

  return expiredDate >= now.slice(0, 10);
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

  const companyCouponRef = db
    .collection("companies")
    .doc(companyId)
    .collection("coupons")
    .doc(flyerId);

  const normalizedEntry = normalizeCompanyCouponEntry({
    flyerId,
    companyId,
    flyerData,
  });

  if (!normalizedEntry) {
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

  if (transaction) {
    transaction.set(companyCouponRef, normalizedEntry);
  } else {
    await companyCouponRef.set(normalizedEntry);
  }

  return normalizedEntry;
}

module.exports = {
  isCompanyCouponAvailable,
  mapCompanyCouponDoc,
  normalizeCompanyCouponEntry,
  syncCompanyCouponLibraryEntry,
};