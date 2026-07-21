import React, { useEffect, useRef } from "react";
import { Download } from "lucide-react";

const FlyerPreview = ({
  coverPhoto,
  history = [],
  onHistorySelect,
  isFreeAttempt = false,
  t,
}) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!coverPhoto) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = coverPhoto;

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      if (isFreeAttempt) {
        ctx.save();
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)"; // Increased opacity
        ctx.font = `bold ${Math.max(img.width, img.height) * 0.05}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Tiled watermark logic
        const angle = -30 * (Math.PI / 180);
        const spacingX = img.width * 0.4;
        const spacingY = img.height * 0.3;

        for (let x = -img.width; x < img.width * 2; x += spacingX) {
          for (let y = -img.height; y < img.height * 2; y += spacingY) {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle);
            ctx.fillText("Mailaverse", 0, 0);
            ctx.restore();
          }
        }
        ctx.restore();
      }
    };
  }, [coverPhoto, isFreeAttempt]);

  const handleDownload = () => {
    if (!canvasRef.current || !coverPhoto) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const link = document.createElement("a");
    link.download = `flyer-${timestamp}.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  };

  return (
    <div className="flyer-preview">
      <div className="preview-container">
        {history && history.length > 0 && (
          <div
            className="history-thumbnails"
            style={{
              display: "flex",
              gap: "8px",
              marginBottom: "12px",
              justifyContent: "center",
            }}
          >
            {history.map((url, idx) => (
              <div
                key={idx}
                onClick={() => onHistorySelect && onHistorySelect(url)}
                style={{
                  width: "60px",
                  height: "84px",
                  cursor: "pointer",
                  border:
                    coverPhoto === url
                      ? "2px solid #3b82f6"
                      : "1px solid #e2e8f0",
                  borderRadius: "4px",
                  overflow: "hidden",
                  opacity: coverPhoto === url ? 1 : 0.6,
                  transition: "all 0.2s ease",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  position: "relative"
                }}
                title={t("flyerPage.version", { number: history.length - idx })}
              >
                <img
                  src={url}
                  alt={t("flyerPage.version", { number: idx + 1 })}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                  onContextMenu={(e) => e.preventDefault()}
                />
                {isFreeAttempt && (
                  <div style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(255,255,255,0.1)",
                    fontSize: "8px",
                    color: "rgba(255,255,255,0.5)",
                    pointerEvents: "none",
                    transform: "rotate(-30deg)",
                    whiteSpace: "nowrap"
                  }}>
                    Mailaverse
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="preview-image">
          {coverPhoto ? (
            <div className="generated-flyer">
              <canvas
                ref={canvasRef}
                onContextMenu={(e) => e.preventDefault()}
                style={{
                  maxWidth: "100%",
                  height: "auto",
                  display: "block",
                  borderRadius: "8px",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                }}
              />
            </div>
          ) : (
            <div className="flyer-placeholder">
              <div className="placeholder-content">
                <div className="placeholder-header">{t("targetBudget.placeholderHeader")}</div>
                <div className="placeholder-main">
                  <div className="placeholder-figure"></div>
                  <div className="placeholder-text">{t("targetBudget.placeholderTrial")}</div>
                  <div className="placeholder-subtitle">
                    {t("targetBudget.placeholderSubtitle")}
                  </div>
                </div>
                <div className="placeholder-footer">
                  <div className="placeholder-qr"></div>
                  <div className="placeholder-contact">{t("targetBudget.apply")}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="preview-controls">
          <button
            className="download-button"
            onClick={handleDownload}
            disabled={!coverPhoto}
          >
            <Download size={16} />
            {t("targetBudget.download")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FlyerPreview;
