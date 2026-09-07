import React from "react";

import { formatDate, formatLocation, getUserStatusMeta } from "./index";

export const PlatformAdminUsersTable = ({ users = [], t, emptyMessage = null }) => {
  const sortedUsers = [...users].sort((a, b) => {
    if (a.createdAt && b.createdAt) return b.createdAt.localeCompare(a.createdAt);
    return a.createdAt ? -1 : b.createdAt ? 1 : 0;
  });
  return (
    <table className="campaigns-table platform-admin-users-table"><thead><tr>
      <th className="platform-admin-user-column">{t("adminPage.username")}</th><th className="platform-admin-name-column">{t("adminPage.displayName")}</th><th className="platform-admin-email-column">{t("adminPage.email", t("email"))}</th><th className="platform-admin-status-column">{t("adminPage.status")}</th><th className="platform-admin-location-column">{t("adminPage.location")}</th><th className="platform-admin-timestamp-column">{t("adminPage.registeredAt")}</th><th className="platform-admin-timestamp-column">{t("adminPage.lastLogin")}</th>
    </tr></thead><tbody>
      {sortedUsers.map((user) => { const status = getUserStatusMeta(user, t); return <tr key={`${user.source || "user"}-${user.id}`} className="campaign-row-disabled">
        <td className="platform-admin-user-column">{user.username || "-"}</td><td className="platform-admin-name-column">{user.displayName || "-"}</td><td className="platform-admin-email-column">{user.email || "-"}</td><td className="platform-admin-status-column"><span className={`status ${status.className}`}>{status.label}</span></td><td className="platform-admin-text-cell platform-admin-location-column">{formatLocation(user.location)}</td><td className="platform-admin-timestamp-column">{formatDate(user.createdAt)}</td><td className="platform-admin-timestamp-column">{formatDate(user.lastLoginAt)}</td>
      </tr>; })}
      {sortedUsers.length === 0 && <tr><td colSpan="7" className="platform-admin-empty-cell">{emptyMessage || t("adminPage.noUsers")}</td></tr>}
    </tbody></table>
  );
};
