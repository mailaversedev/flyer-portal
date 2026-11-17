import React from "react";
import { Plus, RefreshCcw } from "lucide-react";
import PageHeader from "../PageHeader/PageHeader";

export function CrmCampaignHero({ onCreateCampaign, onRefresh }) {
  return (
    <PageHeader
      title="CRM Email Campaigns"
      description="Review created campaigns first, then open the composer when you are ready to draft a new bulk email or queue a single-recipient test."
      actions={
        <>
          <button type="button" className="page-header-button page-header-button--secondary" onClick={onRefresh}>
            <RefreshCcw size={18} aria-hidden="true" />
            Refresh
          </button>
          {onCreateCampaign ? (
            <button type="button" className="page-header-button page-header-button--primary" onClick={onCreateCampaign}>
              <Plus size={18} aria-hidden="true" />
              Create new campaign
            </button>
          ) : null}
        </>
      }
    />
  );
}
