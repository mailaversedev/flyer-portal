import React from "react";
import { Copy } from "lucide-react";

import { formatDateTime, getStatusLabel, getStatusTone } from "./index";

export function CrmCampaignListItem({ campaign, isSelected, onReuseCampaign, onSelectCampaign }) {
  return <article key={campaign.id} className={`crm-campaigns-list-item ${isSelected ? "is-selected" : ""}`}><button type="button" className="crm-campaigns-list-card" onClick={() => onSelectCampaign(campaign.id)}><div className="crm-campaigns-list-card-top"><div><h3>{campaign.subject || "Untitled campaign"}</h3><p>{formatDateTime(campaign.createdAt)}</p></div><span className={`crm-campaigns-status crm-campaigns-status--${getStatusTone(campaign.status)}`}>{getStatusLabel(campaign.status)}</span></div><div className="crm-campaigns-list-meta"><span className="crm-campaigns-list-mode">{campaign.mode === "test" ? "Test email" : "Bulk campaign"}</span>{campaign.testRecipientEmail ? <span className="crm-campaigns-list-recipient">{campaign.testRecipientEmail}</span> : null}</div><div className="crm-campaigns-list-stats"><span>{campaign.totalRecipients || 0} recipients</span><span>{campaign.sentCount || 0} sent</span><span>{campaign.failedCount || 0} failed</span><span>{campaign.pendingCount || 0} pending</span></div></button><button type="button" className="crm-campaigns-ghost-button" onClick={() => onReuseCampaign(campaign)}><Copy size={16} />Use template</button></article>;
}
