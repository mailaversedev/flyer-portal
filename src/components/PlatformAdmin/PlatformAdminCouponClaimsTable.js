import React from "react";

export const PlatformAdminCouponClaimsTable = ({
  claims = [],
  t,
  emptyMessage = null,
  userView = false,
}) => {
  const groupedClaims = claims.reduce((groups, claim) => {
    const flyerId = claim.flyerId || claim.id;
    const group = groups.get(flyerId);
    if (group) group.claims.push(claim);
    else
      groups.set(flyerId, {
        id: flyerId,
        flyerId,
        flyerTitle: claim.flyerTitle,
        companyName: claim.companyName,
        couponType: claim.couponType,
        flyerCoupon: claim.flyerCoupon || {},
        claims: [claim],
      });
    return groups;
  }, new Map());
  const flyerGroups = [...groupedClaims.values()];
  return (
    <table className="campaigns-table platform-admin-engagement-table">
      <thead>
        <tr>
          <th>{t("adminPage.flyerTitle")}</th>
          {!userView && <th>{t("adminPage.company")}</th>}
          <th>{t("adminPage.couponType")}</th>
          {userView ? (
            <>
              <th>{t("adminPage.claimedUsers")}</th>
              <th>{t("adminPage.claimStatus")}</th>
            </>
          ) : (
            <>
              <th>{t("adminPage.downloadCount")}</th>
              <th>{t("adminPage.quantity")}</th>
              <th>{t("adminPage.claimedUsers")}</th>
            </>
          )}
        </tr>
      </thead>
      <tbody>
        {flyerGroups.map((group) => (
          <tr key={group.id} className="campaign-row-disabled">
            <td className="platform-admin-text-cell">
              {group.flyerTitle || "-"}
            </td>
            {!userView && <td>{group.companyName || "-"}</td>}
            <td>{group.couponType || "-"}</td>
            {userView ? (
              <>
                <td>
                  <div className="platform-admin-user-list">
                    {group.claims.map((claim) => (
                      <div
                        className="platform-admin-user-list-item"
                        key={claim.id}
                      >
                        <strong>
                          {claim.user?.username || t("adminPage.deletedUser")}
                        </strong>
                        <span>{claim.user?.email || "-"}</span>
                      </div>
                    ))}
                  </div>
                </td>
                <td>
                  <div className="platform-admin-user-list platform-admin-claim-status-list">
                    {group.claims.map((claim) => (
                      <div
                        className="platform-admin-user-list-item"
                        key={claim.id}
                      >
                        <span
                          className={`platform-admin-claim-status ${claim.isUsed ? "platform-admin-claim-status-used" : "platform-admin-claim-status-unused"}`}
                        >
                          {claim.isUsed
                            ? t("adminPage.used")
                            : t("adminPage.notUsed")}
                        </span>
                      </div>
                    ))}
                  </div>
                </td>
              </>
            ) : (
              <>
                <td>{group.flyerCoupon.downloadCount ?? 0}</td>
                <td>
                  {group.flyerCoupon.quantity ?? t("adminPage.unlimited")}
                </td>
                <td>
                  <div className="platform-admin-user-list">
                    {group.claims.map((claim) => (
                      <div
                        className="platform-admin-user-list-item"
                        key={claim.id}
                      >
                        <strong>
                          {claim.user?.username || t("adminPage.deletedUser")}
                        </strong>
                        <span>{claim.user?.email || "-"}</span>
                        <span
                          className={
                            claim.isUsed
                              ? "platform-admin-claim-status platform-admin-claim-status-used"
                              : "platform-admin-claim-status platform-admin-claim-status-unused"
                          }
                        >
                          {claim.isUsed
                            ? t("adminPage.used")
                            : t("adminPage.notUsed")}
                          {claim.usedAmount != null
                            ? ` · ${claim.usedAmount}`
                            : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </td>
              </>
            )}
          </tr>
        ))}
        {flyerGroups.length === 0 && (
          <tr>
            <td
              colSpan={userView ? "4" : "6"}
              className="platform-admin-empty-cell"
            >
              {emptyMessage || t("adminPage.noCouponClaims")}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
};
