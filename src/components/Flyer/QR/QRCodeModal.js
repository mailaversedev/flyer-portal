import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import QRCode from "qrcode";

const QRCodeComponent = ({ website }) => {
  const { t } = useTranslation();
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");

  useEffect(() => {
    const generateQRCode = async () => {
      try {
        const qrCodeUrl = await QRCode.toDataURL(website, {
          width: 200,
          margin: 2,
          color: {
            dark: "#000000",
            light: "#FFFFFF",
          },
        });
        setQrCodeDataUrl(qrCodeUrl);
      } catch (error) {
        console.error("Error generating QR code:", error);
      }
    };

    if (website) {
      generateQRCode();
    }
  }, [website]);

  return qrCodeDataUrl ? (
    <img
      src={qrCodeDataUrl}
      alt="Generated QR Code"
      className="generated-qr-code"
      style={{ width: "200px", height: "200px" }}
    />
  ) : (
    <div>{t("qrGeneration.generatingQr")}</div>
  );
};

const QRCodeModal = ({ website, handleCloseModal, handleSaveAndProceed }) => {
  const { t } = useTranslation();

  return (
    <div className="modal-overlay" onClick={handleCloseModal}>
      <div className="qr-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{t("qrGeneration.qrCode")}</h3>
          <button className="close-button" onClick={handleCloseModal}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-content">
          <div className="qr-code-container">
            <div className="qr-code-placeholder">
              <div className="qr-code-image">
                {website ? (
                  <QRCodeComponent website={website} />
                ) : (
                  <div className="qr-pattern">
                    {Array.from({ length: 13 }, (_, rowIndex) => (
                      <div key={rowIndex} className="qr-row">
                        {Array.from({ length: 13 }, (_, cellIndex) => (
                          <div
                            key={cellIndex}
                            className={`qr-cell ${(rowIndex + cellIndex) % 3 === 0 ? "filled" : ""}`}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="modal-description">
            <p>{t("qrGeneration.qrPrintMessage")}</p>
          </div>
        </div>

        <div className="modal-actions">
          <button className="nav-button back-button" onClick={handleCloseModal}>
            {t("qrGeneration.cancel")}
          </button>
          <button className="nav-button next-button" onClick={handleSaveAndProceed}>
            {t("qrGeneration.saveProceed")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QRCodeModal;
