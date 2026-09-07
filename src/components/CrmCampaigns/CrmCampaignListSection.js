import React from "react";

import { CrmCampaignListItem } from "./CrmCampaignListItem";

export function CrmCampaignListSection({ campaigns, loading, onReuseCampaign, onSelectCampaign, selectedCampaignId }) {
  return <section className="crm-campaigns-card crm-campaigns-list-section"><div className="crm-campaigns-section-header"><div><h2>Created campaigns</h2><p>Recent campaigns stay live here while the worker processes each batch.</p></div></div>{loading ? <div className="crm-campaigns-empty-state">Loading campaigns...</div> : campaigns.length === 0 ? <div className="crm-campaigns-empty-state">No CRM email campaigns have been created yet.</div> : <div className="crm-campaigns-list-grid">{campaigns.map((campaign) => <CrmCampaignListItem key={campaign.id} campaign={campaign} isSelected={campaign.id === selectedCampaignId} onReuseCampaign={onReuseCampaign} onSelectCampaign={onSelectCampaign} />)}</div>}</section>;
}
