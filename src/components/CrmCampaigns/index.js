import { useCallback, useEffect, useState } from "react";

import ApiService from "../../services/ApiService";

export const POLL_INTERVAL_MS = 10000;
export const DEFAULT_TEMPLATE = `<section style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 32px 24px; color: #111827;"><p style="margin: 0 0 12px; font-size: 14px; letter-spacing: 0.12em; text-transform: uppercase; color: #2563eb;">Mailaverse CRM</p><h1 style="margin: 0 0 16px; font-size: 32px; line-height: 1.2;">Your next campaign starts here</h1><p style="margin: 0 0 20px; font-size: 16px; line-height: 1.7; color: #374151;">Draft your promotional message here. Use the toolbar to style the content and the preview panel to verify the final email layout before you queue the campaign.</p><p style="margin: 0 0 16px; font-size: 16px; line-height: 1.7; color: #374151;">You can include headings, lists, links, and highlighted offers.</p><ul style="margin: 0; padding-left: 20px; color: #374151; line-height: 1.8;"><li>Announce new offers</li><li>Share seasonal promotions</li><li>Drive traffic back to your channels</li></ul></section>`;
export const EMPTY_PREVIEW_TEMPLATE = `<section style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 48px 24px; color: #111827; text-align: center;"><h1 style="margin: 0 0 12px; font-size: 28px; line-height: 1.2;">Select a campaign</h1><p style="margin: 0; font-size: 16px; line-height: 1.7; color: #4b5563;">Choose an existing campaign below or open the composer to build a new one.</p></section>`;
export const EMPTY_SUMMARY = { totalContacts: 0, eligibleEmailContacts: 0 };
export const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const formatDateTime = (value) => {
	if (!value) return "-";
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
};

export const stripHtml = (html = "") => `${html}`.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();

export const buildPreviewDocument = (html) => `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><style>html, body { margin: 0; padding: 0; background: #ffffff; } body { min-height: 100vh; }</style></head><body>${html}</body></html>`;

export const getStatusLabel = (status) => ({ processing: "Processing", completed: "Completed", completed_with_failures: "Completed with failures", failed: "Failed", queued: "Queued" }[status] || "Queued");
export const getStatusTone = (status) => ({ processing: "processing", completed: "completed", completed_with_failures: "warning", failed: "failed", queued: "queued" }[status] || "queued");

export function useCrmCampaignDashboard() {
	const [summary, setSummary] = useState(EMPTY_SUMMARY);
	const [campaigns, setCampaigns] = useState([]);
	const [selectedCampaignId, setSelectedCampaignId] = useState("");
	const [selectedCampaign, setSelectedCampaign] = useState(null);
	const [loading, setLoading] = useState(true);
	const [loadError, setLoadError] = useState("");

	const loadDashboard = useCallback(async ({ background = false } = {}) => {
		if (!background) setLoading(true);

		try {
			const [summaryResponse, campaignsResponse] = await Promise.all([
				ApiService.getCrmContactSummary(),
				ApiService.getCrmEmailCampaigns(30),
			]);
			const nextSummary = summaryResponse?.success
				? summaryResponse.data || EMPTY_SUMMARY
				: EMPTY_SUMMARY;
			const nextCampaigns =
				campaignsResponse?.success && Array.isArray(campaignsResponse.data)
					? campaignsResponse.data
					: [];

			setSummary(nextSummary);
			setCampaigns(nextCampaigns);
			setSelectedCampaignId((current) =>
				nextCampaigns.some((campaign) => campaign.id === current)
					? current
					: nextCampaigns[0]?.id || "",
			);
			setLoadError("");
		} catch (error) {
			console.error("Failed to load CRM campaign data", error);
			if (!background) {
				setLoadError(error.message || "Failed to load CRM campaign data.");
			}
		} finally {
			if (!background) setLoading(false);
		}
	}, []);

	const loadSelectedCampaign = useCallback(async (campaignId) => {
		if (!campaignId) {
			setSelectedCampaign(null);
			return;
		}

		try {
			const response = await ApiService.getCrmEmailCampaign(campaignId);
			if (response?.success) {
				setSelectedCampaign(response.data || null);
			}
		} catch (error) {
			console.error("Failed to load CRM campaign detail", error);
		}
	}, []);

	useEffect(() => {
		loadDashboard();
		const intervalId = window.setInterval(
			() => loadDashboard({ background: true }),
			POLL_INTERVAL_MS,
		);
		return () => window.clearInterval(intervalId);
	}, [loadDashboard]);

	useEffect(() => {
		loadSelectedCampaign(selectedCampaignId);

		if (!selectedCampaignId) return undefined;

		const intervalId = window.setInterval(
			() => loadSelectedCampaign(selectedCampaignId),
			POLL_INTERVAL_MS,
		);
		return () => window.clearInterval(intervalId);
	}, [loadSelectedCampaign, selectedCampaignId]);

	return {
		campaigns,
		loadDashboard,
		loadError,
		loading,
		selectedCampaign,
		selectedCampaignId,
		setSelectedCampaignId,
		summary,
	};
}
