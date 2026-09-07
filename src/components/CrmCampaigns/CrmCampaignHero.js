import React from "react";
import { Plus, RefreshCcw } from "lucide-react";

export function CrmCampaignHero({ onCreateCampaign, onRefresh }) {
  return <div className="crm-campaigns-hero"><div><h1>CRM Email Campaigns</h1><p className="crm-campaigns-subtitle">Review created campaigns first, then open the composer when you are ready to draft a new bulk email or queue a single-recipient test.</p></div><div className="crm-campaigns-hero-actions"><button type="button" className="crm-campaigns-secondary-button" onClick={onRefresh}><RefreshCcw size={16} />Refresh</button>{onCreateCampaign ? <button type="button" className="crm-campaigns-primary-button" onClick={onCreateCampaign}><Plus size={16} />Create new campaign</button> : null}</div></div>;
}
