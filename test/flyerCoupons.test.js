const test = require("node:test");
const assert = require("node:assert/strict");
const {
  prepareFlyerCoupons, getFlyerCoupons, claimDocumentId,
  couponAvailability, getClaimFlyerCoupon,
} = require("../services/flyerCoupons");

test("coupon creation assigns stable distinct IDs and preserves legacy primary", () => {
  const flyer = prepareFlyerCoupons({ coupons: [
    { couponType: "fixed", quantity: "3", downloadCount: 99 },
    { couponType: "free" },
  ] }, "qr");
  assert.equal(flyer.coupon.id, "primary");
  assert.equal(flyer.coupon.quantity, 3);
  assert.equal(flyer.coupon.downloadCount, 0);
  assert.notEqual(flyer.coupons[1].id, "primary");
  assert.equal(claimDocumentId("flyer", flyer.coupons[0], 0), "flyer");
  assert.equal(claimDocumentId("flyer", flyer.coupons[1], 1),
    claimDocumentId("flyer", flyer.coupons[1], 1));
  assert.notEqual(claimDocumentId("flyer", flyer.coupons[1], 1),
    claimDocumentId("another", flyer.coupons[1], 1));
  assert.equal(getClaimFlyerCoupon(flyer, { flyerCouponId: flyer.coupons[1].id }).couponType, "free");
});

test("legacy coupons remain readable and limits are enforced", () => {
  assert.equal(getFlyerCoupons({ coupon: { couponType: "free" } })[0].id, "primary");
  assert.throws(() => prepareFlyerCoupons({ coupons: Array(6).fill({ couponType: "free" }) }, "qr"));
  assert.throws(() => prepareFlyerCoupons({ coupons: [{ couponType: "free", quantity: -1 }] }, "qr"));
  assert.throws(() => prepareFlyerCoupons({ coupons: [{ couponType: "free", couponFile: "data:image/png;base64,abc" }] }, "leaflet"));
  assert.throws(() => prepareFlyerCoupons({ coupons: [{ couponType: "free" }] }, "query"));
  assert.equal(couponAvailability({ expiredDate: "2026-01-01" }, "2026-01-02"), "expired");
  assert.equal(couponAvailability({ expiredDate: "2026-01-02" }, "2026-01-02"), null);
  assert.equal(couponAvailability({ quantity: 2, downloadCount: 2 }, "2026-01-02"), "exhausted");
});
