import React from "react";

export function CrmCampaignSummaryGrid({ campaigns, summary }) {
  return <div className="crm-campaigns-summary-grid"><div className="crm-campaigns-summary-card"><span>Total imported contacts</span><strong>{summary.totalContacts || 0}</strong></div><div className="crm-campaigns-summary-card"><span>Email-eligible contacts</span><strong>{summary.eligibleEmailContacts || 0}</strong></div><div className="crm-campaigns-summary-card"><span>Campaigns created</span><strong>{campaigns.length}</strong></div></div>;
}
