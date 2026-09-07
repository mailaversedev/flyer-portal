import React from "react";

import { formatDateTime, getStatusLabel, getStatusTone } from "./index";

export function CrmCampaignSelectedCard({ description = "Poll delivery progress without leaving the composer.", selectedCampaign, title = "Selected campaign" }) {
  return <section className="crm-campaigns-card crm-campaigns-selected-card"><div className="crm-campaigns-section-header"><div><h2>{title}</h2><p>{description}</p></div></div>{selectedCampaign ? <div className="crm-campaigns-selected-content">
    <div className="crm-campaigns-selected-row"><span>Subject</span><strong>{selectedCampaign.subject || "Untitled campaign"}</strong></div>
    <div className="crm-campaigns-selected-row"><span>Status</span><span className={`crm-campaigns-status crm-campaigns-status--${getStatusTone(selectedCampaign.status)}`}>{getStatusLabel(selectedCampaign.status)}</span></div>
    <div className="crm-campaigns-selected-row"><span>Type</span><strong>{selectedCampaign.mode === "test" ? "Test email" : "Bulk campaign"}</strong></div>
    {selectedCampaign.testRecipientEmail ? <div className="crm-campaigns-selected-row"><span>Test recipient</span><strong>{selectedCampaign.testRecipientEmail}</strong></div> : null}
    <div className="crm-campaigns-selected-grid"><div><span>Total</span><strong>{selectedCampaign.totalRecipients || 0}</strong></div><div><span>Sent</span><strong>{selectedCampaign.sentCount || 0}</strong></div><div><span>Failed</span><strong>{selectedCampaign.failedCount || 0}</strong></div><div><span>Pending</span><strong>{selectedCampaign.pendingCount || 0}</strong></div></div>
    <div className="crm-campaigns-selected-row"><span>Created</span><strong>{formatDateTime(selectedCampaign.createdAt)}</strong></div><div className="crm-campaigns-selected-row"><span>Completed</span><strong>{formatDateTime(selectedCampaign.completedAt)}</strong></div><div className="crm-campaigns-selected-row"><span>Created by</span><strong>{selectedCampaign.createdBy?.username || "-"}</strong></div>
    {selectedCampaign.lastError ? <div className="crm-campaigns-inline-alert">Last error: {selectedCampaign.lastError}</div> : null}
  </div> : <div className="crm-campaigns-empty-state">Select a campaign to inspect its status.</div>}</section>;
}
