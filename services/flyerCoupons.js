const { randomUUID, createHash } = require("node:crypto");

const MAX_FLYER_COUPONS = 5;

function getFlyerCoupons(flyer) {
  if (Array.isArray(flyer?.coupons)) return flyer.coupons;
  return flyer?.coupon?.couponType ? [{ ...flyer.coupon, id: "primary" }] : [];
}

function prepareFlyerCoupons(data, type) {
  if (!Object.hasOwn(data, "coupons")) return data;
  if (!["leaflet", "qr"].includes(type) || !Array.isArray(data.coupons) ||
      data.coupons.length > MAX_FLYER_COUPONS) {
    throw new Error("Invalid flyer coupons");
  }
  const coupons = data.coupons.map((coupon, index) => {
    if (!coupon || typeof coupon !== "object" || Array.isArray(coupon) ||
        typeof coupon.couponType !== "string" || !coupon.couponType.trim()) {
      throw new Error("Each coupon must have a type");
    }
    const quantity = coupon.quantity == null || coupon.quantity === ""
      ? null : Number(coupon.quantity);
    if (quantity !== null && (!Number.isSafeInteger(quantity) || quantity <= 0)) {
      throw new Error("Coupon quantity must be a positive integer");
    }
    for (const field of ["couponFile", "qrCodeImage", "barcodeImage"]) {
      if (typeof coupon[field] === "string" && /^(blob:|data:)/i.test(coupon[field])) {
        throw new Error("Coupon image upload was not completed");
      }
    }
    return { ...coupon, id: index === 0 ? "primary" : randomUUID(), quantity, downloadCount: 0 };
  });
  return { ...data, coupons, coupon: coupons[0] || {} };
}

function claimDocumentId(flyerId, coupon, index) {
  if (index === 0) return flyerId;
  return `coupon-${createHash("sha256").update(JSON.stringify([flyerId, coupon.id])).digest("hex")}`;
}

function couponAvailability(coupon, today) {
  if (coupon.expiredDate && coupon.expiredDate < today) return "expired";
  if (Number(coupon.quantity) > 0 && Number(coupon.downloadCount || 0) >= Number(coupon.quantity)) {
    return "exhausted";
  }
  return null;
}

function getClaimFlyerCoupon(flyer, claim) {
  const coupons = getFlyerCoupons(flyer);
  return coupons.find((coupon) => coupon.id === (claim.flyerCouponId || "primary")) || {};
}

module.exports = { MAX_FLYER_COUPONS, getFlyerCoupons, prepareFlyerCoupons, claimDocumentId, couponAvailability, getClaimFlyerCoupon };
