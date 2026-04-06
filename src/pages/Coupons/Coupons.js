import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import ApiService from "../../services/ApiService";
import "./Coupons.css";

const getCouponTypeLabel = (coupon, t) => {
  switch (coupon.couponType) {
    case "percentage":
      return t("couponBuilder.percentageDiscount");
    case "fixed":
      return t("couponBuilder.fixedDiscount");
    case "free":
      return t("couponBuilder.free");
    case "buy_one_get_one":
      return t("couponBuilder.buyOneGetOne");
    default:
      return coupon.couponType || t("couponLibraryPage.none");
  }
};

const getCouponOfferLabel = (coupon, t) => {
  if (coupon.couponType === "percentage" && coupon.discountValue) {
    return `${coupon.discountValue}% ${t("couponBuilder.off")}`;
  }

  if (coupon.couponType === "fixed" && coupon.discountValue) {
    return `HK$${coupon.discountValue}`;
  }

  if (coupon.couponType === "buy_one_get_one") {
    return t("couponBuilder.buyOneGetOne");
  }

  if (coupon.itemDescription) {
    return coupon.itemDescription;
  }

  return t("couponLibraryPage.none");
};

const getCouponAssets = (coupon, t) => {
  const assets = [];

  if (coupon.couponFile) {
    assets.push(t("couponLibraryPage.couponFile"));
  }

  if (coupon.qrCodeImage) {
    assets.push(t("couponLibraryPage.qrCode"));
  }

  if (coupon.barcodeImage) {
    assets.push(t("couponLibraryPage.barcode"));
  }

  return assets.length > 0 ? assets : [t("couponLibraryPage.none")];
};

const Coupons = () => {
  const { t } = useTranslation();
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadCoupons = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await ApiService.getCompanyCouponLibrary();
        if (!isMounted) {
          return;
        }

        setCoupons(Array.isArray(response?.data) ? response.data : []);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        setError(loadError.message || t("couponLibraryPage.loading"));
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadCoupons();

    return () => {
      isMounted = false;
    };
  }, [t]);

  return (
    <div className="coupon-library-page">
      <div className="coupon-library-header">
        <div>
          <h1 className="coupon-library-title">{t("couponLibraryPage.title")}</h1>
          <p className="coupon-library-subtitle">
            {t("couponLibraryPage.subtitle")}
          </p>
        </div>
      </div>

      <div className="coupon-library-table-card">
        <div className="coupon-library-table-container">
          {loading ? (
            <div className="coupon-library-state">{t("couponLibraryPage.loading")}</div>
          ) : error ? (
            <div className="coupon-library-state coupon-library-error">{error}</div>
          ) : coupons.length === 0 ? (
            <div className="coupon-library-state">{t("couponLibraryPage.empty")}</div>
          ) : (
            <table className="coupon-library-table">
              <thead>
                <tr>
                  <th>{t("couponLibraryPage.type")}</th>
                  <th>{t("couponLibraryPage.offer")}</th>
                  <th>{t("couponLibraryPage.description")}</th>
                  <th>{t("couponLibraryPage.promotionCode")}</th>
                  <th>{t("couponLibraryPage.expiryDate")}</th>
                  <th>{t("couponLibraryPage.assets")}</th>
                  <th>{t("couponLibraryPage.terms")}</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((coupon) => (
                  <tr key={coupon.id}>
                    <td>{getCouponTypeLabel(coupon, t)}</td>
                    <td>{getCouponOfferLabel(coupon, t)}</td>
                    <td
                      className="coupon-library-description"
                      title={coupon.itemDescription || t("couponLibraryPage.none")}
                    >
                      {coupon.itemDescription || t("couponLibraryPage.none")}
                    </td>
                    <td>{coupon.promotionCode || t("couponLibraryPage.none")}</td>
                    <td>{coupon.expiredDate || t("couponLibraryPage.noExpiry")}</td>
                    <td>
                      <div className="coupon-library-assets">
                        {getCouponAssets(coupon, t).map((asset) => (
                          <span key={`${coupon.id}-${asset}`} className="coupon-library-asset-badge">
                            {asset}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="coupon-library-terms" title={coupon.termsConditions || t("couponLibraryPage.none")}>
                      {coupon.termsConditions || t("couponLibraryPage.none")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default Coupons;