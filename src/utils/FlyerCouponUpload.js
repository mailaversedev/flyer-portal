import ApiService from "../services/ApiService";

export async function uploadFlyerCoupons(data, t) {
  const coupons = data.coupons || (data.coupon?.couponType ? [data.coupon] : []);
  if (coupons.length === 1 && !coupons[0].couponType) return [];
  if (coupons.some((coupon) => !coupon.couponType)) {
    throw new Error(t("couponBuilder.selectEveryCouponType"));
  }
  return Promise.all(coupons.map(async (coupon) => {
    const uploaded = await ApiService.uploadFilesFromData({
      couponFile: coupon.couponFile,
      qrCodeImage: coupon.qrCodeImage,
      barcodeImage: coupon.barcodeImage,
    });
    return { ...coupon, ...uploaded };
  }));
}
