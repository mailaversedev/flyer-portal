import React from "react";

import { tokensToHkd } from "../../config/billingConfig";
import { formatDate, getFlyerStatusLabel } from "./index";

export const PlatformAdminFlyersTable = ({
  flyers,
  t,
  onOpenFlyer,
  onUpdateFlyerStatus,
  onDeleteFlyer,
  deletingFlyerId = "",
  updatingFlyerId = "",
}) => {
  const formattedFlyers = flyers.map((flyer) => {
    const lottery = flyer.lottery || {};
    const coupon = flyer.coupon || {};
    const maxUsers = Number(lottery.maxUsers) || 0;
    const claims = Number(lottery.claims) || 0;
    const totalReached = Number(lottery.userReached) || 0;
    const browseRate = maxUsers > 1 ? (claims / (maxUsers - 1)) * 100 : 0;
    const downloadCount = Number(coupon.downloadCount) || 0;
    const downloadRate = totalReached > 0 ? (downloadCount / totalReached) * 100 : 0;
    return {
      id: flyer.id,
      flyerType: flyer.type || "",
      thumbnail: flyer.thumbnail || "",
      companyName: flyer.companyDisplayName || flyer.companyName || flyer.companyId || "-",
      adTitle: flyer.header || `${t("adminPage.untitledFlyer")} ${flyer.id.slice(0, 6)}`,
      status: getFlyerStatusLabel(flyer.status),
      adType: flyer.type ? flyer.type.charAt(0).toUpperCase() + flyer.type.slice(1) : "-",
      totalReached,
      browseRate: browseRate > 0 ? `${browseRate.toFixed(2)}%` : "-",
      totalBudget: lottery.pool ? `HK$${tokensToHkd(lottery.pool).toFixed(2)}` : "-",
      remainingPool: lottery.remaining ? `HK$${tokensToHkd(lottery.remaining).toFixed(2)}` : "-",
      downloadRate: downloadRate > 0 ? `${downloadRate.toFixed(2)}%` : "-",
      createdAt: formatDate(flyer.createdAt),
      rawStatus: flyer.status || "",
    };
  });

  const getEditRoute = (flyer) => {
    const flyerType = `${flyer.flyerType || flyer.adType || ""}`.trim().toLowerCase();
    if (flyerType === "leaflet") return `/flyer/edit/leaflet/${flyer.id}`;
    if (flyerType === "qr") return `/flyer/edit/qr/${flyer.id}`;
    return null;
  };

  const handleDownloadFlyer = async (event, flyer) => {
    event.stopPropagation();
    if (!flyer.thumbnail) return;
    const safeFileName = ((flyer.id || "flyer").toString().trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")) || "flyer";
    try {
      const response = await fetch(flyer.thumbnail);
      if (!response.ok) throw new Error("Failed to fetch image");
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${safeFileName}.${blob.type.split("/")[1] || "jpg"}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (_error) {
      window.open(flyer.thumbnail, "_blank", "noopener,noreferrer");
    }
  };

  return <table className="campaigns-table"><thead><tr>
    <th>{t("adminPage.company")}</th><th>{t("dashboard.adTitle")}</th><th>{t("dashboard.status")}</th><th>{t("dashboard.adType")}</th><th>{t("dashboard.totalReached")}</th><th>{t("dashboard.browseRate")}</th><th>{t("dashboard.totalBudget")}</th><th>{t("dashboard.remainingPool")}</th><th>{t("dashboard.downloadRate")}</th><th>{t("adminPage.createdAt")}</th><th>{t("adminPage.actions")}</th>
  </tr></thead><tbody>
    {formattedFlyers.map((flyer) => { const editRoute = getEditRoute(flyer); const isEditable = Boolean(editRoute); return <tr key={flyer.id} className={`campaign-row ${isEditable ? "campaign-row-editable" : "campaign-row-disabled"}`} onClick={isEditable ? () => onOpenFlyer(editRoute) : undefined} onKeyDown={isEditable ? (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpenFlyer(editRoute); } } : undefined} tabIndex={isEditable ? 0 : undefined} role={isEditable ? "button" : undefined}>
      <td className="platform-admin-text-cell">{flyer.companyName}</td><td className="ad-title" title={flyer.adTitle}>{flyer.adTitle}</td><td><span className={`status ${flyer.status.toLowerCase()}`}>{flyer.status}</span></td><td>{flyer.adType}</td><td>{flyer.totalReached}</td><td>{flyer.browseRate}</td><td>{flyer.totalBudget}</td><td>{flyer.remainingPool}</td><td>{flyer.downloadRate}</td><td>{flyer.createdAt}</td><td><div className="platform-admin-flyer-action-group">
        <button type="button" className="platform-admin-flyer-action-button" onClick={(event) => { event.stopPropagation(); onUpdateFlyerStatus(flyer.id, flyer.rawStatus === "active" ? "inactive" : "active"); }} disabled={updatingFlyerId === flyer.id || deletingFlyerId === flyer.id}>{updatingFlyerId === flyer.id ? t("adminPage.updatingStatus") : flyer.rawStatus === "active" ? t("adminPage.markInactive") : t("adminPage.markActive")}</button>
        <button type="button" className="platform-admin-flyer-action-button danger" onClick={(event) => { event.stopPropagation(); onDeleteFlyer(flyer); }} disabled={deletingFlyerId === flyer.id || updatingFlyerId === flyer.id}>{deletingFlyerId === flyer.id ? t("adminPage.deletingFlyer") : t("adminPage.deleteFlyer")}</button>
        <button type="button" className="platform-admin-flyer-action-button" onClick={(event) => handleDownloadFlyer(event, flyer)} disabled={!flyer.thumbnail} title={flyer.thumbnail ? "Download flyer image" : "No flyer image available"}>Download</button>
      </div></td>
    </tr>; })}
    {formattedFlyers.length === 0 && <tr><td colSpan="11" className="platform-admin-empty-cell">{t("adminPage.noFlyers")}</td></tr>}
  </tbody></table>;
};
