import React, { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";

import { isSuperAdmin } from "../../utils/AuthUtil";
import {
  CrmCampaignHero,
  CrmCampaignListSection,
  CrmCampaignPreviewCard,
  CrmCampaignSelectedCard,
  CrmCampaignSummaryGrid,
  EMPTY_PREVIEW_TEMPLATE,
  useCrmCampaignDashboard,
  DEFAULT_TEMPLATE,
} from "./CrmCampaigns.shared";
import "./CrmCampaigns.css";

const CrmCampaignListPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [success, setSuccess] = useState("");
  const {
    campaigns,
    loadDashboard,
    loadError,
    loading,
    selectedCampaign,
    selectedCampaignId,
    setSelectedCampaignId,
    summary,
  } = useCrmCampaignDashboard();

  useEffect(() => {
    if (location.state?.selectedCampaignId) {
      setSelectedCampaignId(location.state.selectedCampaignId);
    }

    if (location.state?.successMessage) {
      setSuccess(location.state.successMessage);
    }

    if (location.state?.selectedCampaignId || location.state?.successMessage) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate, setSelectedCampaignId]);

  if (!isSuperAdmin()) {
    return <Navigate to="/platform-admin" replace />;
  }

  const handleReuseCampaign = (campaign) => {
    navigate("/crm-campaigns/create", {
      state: {
        draft: {
          subject: campaign.subject || "",
          html: campaign.html || DEFAULT_TEMPLATE.trim(),
          testRecipientEmail: campaign.testRecipientEmail || "",
        },
        successMessage: `Loaded "${campaign.subject || "Untitled campaign"}" into the editor.`,
      },
    });
  };

  return (
    <div className="crm-campaigns-page">
      <CrmCampaignHero
        onCreateCampaign={() => navigate("/crm-campaigns/create")}
        onRefresh={() => loadDashboard()}
      />

      <CrmCampaignSummaryGrid campaigns={campaigns} summary={summary} />

      {loadError ? <div className="crm-campaigns-message error">{loadError}</div> : null}
      {success ? <div className="crm-campaigns-message success">{success}</div> : null}

      <div className="crm-campaigns-grid">
        <CrmCampaignSelectedCard
          description="Open the composer only when you want to draft a new message. The selected created campaign stays front and center by default."
          selectedCampaign={selectedCampaign}
          title="Created campaign"
        />

        <div className="crm-campaigns-side-column">
          <CrmCampaignPreviewCard
            description="The preview uses the currently selected created campaign."
            previewHtml={selectedCampaign?.html || EMPTY_PREVIEW_TEMPLATE.trim()}
            previewSubject={selectedCampaign?.subject?.trim() || "Select a campaign to preview"}
          />
        </div>
      </div>

      <CrmCampaignListSection
        campaigns={campaigns}
        loading={loading}
        onReuseCampaign={handleReuseCampaign}
        onSelectCampaign={setSelectedCampaignId}
        selectedCampaignId={selectedCampaignId}
      />
    </div>
  );
};

export default CrmCampaignListPage;