import React from "react";
import { Eye, Mail } from "lucide-react";

import { buildPreviewDocument } from "./index";

export function CrmCampaignPreviewCard({ description, previewHtml, previewSubject }) {
  return <section className="crm-campaigns-card crm-campaigns-preview-card"><div className="crm-campaigns-section-header"><div><h2>Preview</h2><p>{description}</p></div><Eye size={18} /></div><div className="crm-campaigns-preview-subject"><Mail size={16} /><span>{previewSubject}</span></div><iframe title="CRM campaign preview" className="crm-campaigns-preview-frame" srcDoc={buildPreviewDocument(previewHtml)} /></section>;
}
