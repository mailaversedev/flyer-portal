import React from "react";
import { CheckCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import "./CarbonDonationCard.css";

const CarbonDonationCard = ({
  carbonAmount,
  unit,
  donationAmount,
  isVerified,
}) => {
  const { t } = useTranslation();
  return (
    <div className="carbon-donation-card">
      <div className="card-background">
        {isVerified && (
          <div className="verification-badge">
            <CheckCircle size={16} />
          </div>
        )}

        <div className="carbon-info">
          <div className="carbon-amount">{carbonAmount}</div>
          <div className="carbon-unit">{unit}</div>
        </div>

        <button className="donate-button">
          {t("marketplacePage.donate", { amount: donationAmount })}
        </button>
      </div>
    </div>
  );
};

export default CarbonDonationCard;
