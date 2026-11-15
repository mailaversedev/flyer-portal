import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { toast } from "react-toastify";
import QRCode from "qrcode";
import QRGeneration from "../../src/pages/Flyer/FlyerCreation/QRGeneration";
import Flyer from "../../src/pages/Flyer/Flyer";
import ApiService from "../../src/services/ApiService";
import { isSuperAdmin } from "../../src/utils/AuthUtil";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key) => key }),
}));
jest.mock("react-toastify", () => ({ toast: { error: jest.fn() } }));
jest.mock("qrcode", () => ({ toDataURL: jest.fn().mockResolvedValue("data:image/png;base64,qr") }));
jest.mock("../../src/utils/AuthUtil", () => ({ isSuperAdmin: jest.fn() }));
jest.mock("../../src/utils/FlyerValidationUtil", () => ({
  validateTargetBudgetStep: () => ({ isValid: true, missingFields: [] }),
}));
jest.mock("../../src/services/ApiService", () => ({
  __esModule: true,
  default: {
    getCompanyWallet: jest.fn(),
    generateLeaflet: jest.fn(),
    consumeLeafletTokens: jest.fn(),
    uploadFilesFromData: jest.fn(),
    createFlyer: jest.fn(),
    getFlyerById: jest.fn(),
    updateFlyer: jest.fn(),
  },
}));
jest.mock("../../src/components/Flyer/TargetBudget", () => (props) => (
  <div>
    <span>budget: {props.data.coverPhoto}</span>
    <span>free: {String(props.isFreeAttempt)}</span>
  </div>
));
jest.mock("../../src/components/Flyer/CouponBuilder", () => () => <div>coupon</div>);

beforeEach(() => {
  jest.clearAllMocks();
  isSuperAdmin.mockReturnValue(false);
  QRCode.toDataURL.mockResolvedValue("data:image/png;base64,qr");
  URL.createObjectURL = jest.fn(() => "blob:preview");
  URL.revokeObjectURL = jest.fn();
  ApiService.getCompanyWallet.mockResolvedValue({
    success: true,
    data: { balance: 0, dailyFreeAttemptsRemaining: 1 },
  });
  ApiService.generateLeaflet.mockResolvedValue({ images: [{ url: "https://example.com/generated.png" }] });
  ApiService.consumeLeafletTokens.mockResolvedValue({ success: true, data: { usedFreeAttempt: true } });
  ApiService.uploadFilesFromData.mockImplementation(async ({ coverPhoto }) => ({
    coverPhoto: coverPhoto instanceof File ? "https://example.com/uploaded.png" : undefined,
  }));
  ApiService.createFlyer.mockResolvedValue({ success: true });
});

function renderFlow(entry = "/flyer/create/qr") {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/flyer" element={<Flyer />} />
        <Route path="/flyer/create/qr" element={<QRGeneration />} />
        <Route path="/flyer/edit/qr/:flyerId" element={<QRGeneration />} />
        <Route path="/dashboard" element={<div>dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function enterWebsite() {
  fireEvent.change(screen.getByPlaceholderText("qrGeneration.websitePlaceholder"), {
    target: { value: "https://example.com" },
  });
}

async function proceedToBudget() {
  fireEvent.click(screen.getByRole("button", { name: "qrGeneration.proceedToQr" }));
  fireEvent.click(await screen.findByRole("button", { name: "qrGeneration.saveProceed" }));
}

test("generates and bills a flyer, then creates the QR flyer with its image", async () => {
  renderFlow();
  enterWebsite();
  fireEvent.change(screen.getByLabelText("qrGeneration.imagePrompt"), { target: { value: "Summer sale" } });
  await proceedToBudget();
  expect(ApiService.generateLeaflet).toHaveBeenCalledWith(expect.objectContaining({
    flyerPrompts: "Summer sale", aspectRatio: "1:1", resolution: "1K",
  }));
  expect(ApiService.consumeLeafletTokens).toHaveBeenCalledWith({
    resolution: "1K", flyerOutputPath: "https://example.com/generated.png",
  });
  expect(screen.getByText("budget: https://example.com/generated.png")).toBeInTheDocument();
  expect(screen.getByText("free: true")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "creation.noCoupon" }));
  await waitFor(() => expect(ApiService.createFlyer).toHaveBeenCalledWith(expect.objectContaining({
    type: "qr",
    data: expect.objectContaining({ website: "https://example.com", coverPhoto: "https://example.com/generated.png" }),
  })));
});

test("direct upload from the QR card enters the QR flow without generation or billing", async () => {
  renderFlow("/flyer");
  const file = new File(["image"], "flyer.png", { type: "image/png" });
  userEvent.upload(screen.getByLabelText("flyerPage.qrTitle: flyerPage.leafletSecondary"), file);
  expect(screen.getByAltText("Cover preview")).toHaveAttribute("src", "blob:preview");
  enterWebsite();
  await proceedToBudget();
  expect(ApiService.uploadFilesFromData).toHaveBeenCalledWith({ coverPhoto: file });
  expect(screen.getByText("budget: https://example.com/uploaded.png")).toBeInTheDocument();
  expect(ApiService.generateLeaflet).not.toHaveBeenCalled();
  expect(ApiService.consumeLeafletTokens).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "creation.noCoupon" }));
  await waitFor(() => expect(ApiService.createFlyer).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.objectContaining({ coverPhoto: "https://example.com/uploaded.png" }),
  })));
});

test("requires a prompt or upload and reports upload and billing failures", async () => {
  renderFlow();
  enterWebsite();
  fireEvent.click(screen.getByRole("button", { name: "qrGeneration.proceedToQr" }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("qrGeneration.promptRequired"));
  const file = new File(["image"], "flyer.png", { type: "image/png" });
  userEvent.upload(screen.getByLabelText("qrGeneration.upload"), file);
  ApiService.uploadFilesFromData.mockRejectedValueOnce(new Error("Upload failed"));
  fireEvent.click(screen.getByRole("button", { name: "qrGeneration.proceedToQr" }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Upload failed"));
  expect(screen.queryByRole("button", { name: "qrGeneration.saveProceed" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "qrGeneration.usePrompt" }));
  fireEvent.change(screen.getByLabelText("qrGeneration.imagePrompt"), { target: { value: "Sale" } });
  ApiService.consumeLeafletTokens.mockRejectedValueOnce(new Error("Billing failed"));
  fireEvent.click(screen.getByRole("button", { name: "qrGeneration.proceedToQr" }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Billing failed"));
  expect(screen.queryByRole("button", { name: "qrGeneration.saveProceed" })).not.toBeInTheDocument();
});

test("does not generate when the wallet has no free attempts or tokens", async () => {
  ApiService.getCompanyWallet.mockResolvedValue({ success: true, data: { balance: 0, dailyFreeAttemptsRemaining: 0 } });
  renderFlow();
  enterWebsite();
  fireEvent.change(screen.getByLabelText("qrGeneration.imagePrompt"), { target: { value: "Sale" } });
  fireEvent.click(screen.getByRole("button", { name: "qrGeneration.proceedToQr" }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("leafletCreation.tokenIndicatorLowBalance"));
  expect(ApiService.generateLeaflet).not.toHaveBeenCalled();
});

test("reuses the prepared image when going back and allows switching to an in-page upload", async () => {
  renderFlow();
  enterWebsite();
  fireEvent.change(screen.getByLabelText("qrGeneration.imagePrompt"), { target: { value: "Sale" } });
  await proceedToBudget();
  fireEvent.click(screen.getByRole("button", { name: "creation.back" }));
  await proceedToBudget();
  expect(ApiService.generateLeaflet).toHaveBeenCalledTimes(1);
  expect(ApiService.consumeLeafletTokens).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "creation.back" }));
  const file = new File(["image"], "replacement.png", { type: "image/png" });
  userEvent.upload(screen.getByLabelText("qrGeneration.upload"), file);
  await proceedToBudget();
  expect(screen.getByText("budget: https://example.com/uploaded.png")).toBeInTheDocument();
  expect(screen.getByText("free: false")).toBeInTheDocument();
  expect(ApiService.generateLeaflet).toHaveBeenCalledTimes(1);
});

test("super admins generate without a wallet or token charge", async () => {
  isSuperAdmin.mockReturnValue(true);
  renderFlow();
  enterWebsite();
  fireEvent.change(screen.getByLabelText("qrGeneration.imagePrompt"), { target: { value: "Sale" } });
  await proceedToBudget();
  expect(ApiService.getCompanyWallet).not.toHaveBeenCalled();
  expect(ApiService.consumeLeafletTokens).not.toHaveBeenCalled();
  expect(screen.getByText("free: false")).toBeInTheDocument();
});

test("QR modal cancel preserves the image, and the coupon step can create the flyer", async () => {
  renderFlow();
  enterWebsite();
  userEvent.upload(
    screen.getByLabelText("qrGeneration.upload"),
    new File(["image"], "flyer.png", { type: "image/png" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "qrGeneration.proceedToQr" }));
  expect(await screen.findByAltText("Generated QR Code")).toHaveAttribute("src", "data:image/png;base64,qr");
  expect(QRCode.toDataURL).toHaveBeenCalledWith("https://example.com", expect.any(Object));
  fireEvent.click(screen.getByRole("button", { name: "qrGeneration.cancel" }));
  expect(screen.queryByRole("button", { name: "qrGeneration.saveProceed" })).not.toBeInTheDocument();
  await proceedToBudget();
  expect(ApiService.uploadFilesFromData).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "creation.proceedToCoupon" }));
  expect(screen.getByText("coupon")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "creation.create" }));
  await waitFor(() => expect(ApiService.createFlyer).toHaveBeenCalledWith(expect.objectContaining({
    type: "qr",
    data: expect.objectContaining({ coverPhoto: "https://example.com/uploaded.png" }),
  })));
});

test("editing an existing QR flyer keeps the image locked and saves only editable fields", async () => {
  ApiService.getFlyerById.mockResolvedValue({
    success: true,
    data: { type: "qr", website: "https://example.com", coverPhoto: "https://example.com/existing.png" },
  });
  ApiService.updateFlyer.mockResolvedValue({ success: true });
  renderFlow("/flyer/edit/qr/123");
  expect(await screen.findByAltText("Cover preview")).toHaveAttribute("src", "https://example.com/existing.png");
  expect(screen.queryByLabelText("qrGeneration.imagePrompt")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("qrGeneration.upload")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "creation.saveChanges" }));
  await waitFor(() => expect(ApiService.updateFlyer).toHaveBeenCalledWith("123", expect.not.objectContaining({ coverPhoto: expect.anything() })));
});
