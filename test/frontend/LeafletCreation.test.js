import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import LeafletCreation from "../../src/pages/Flyer/FlyerCreation/Leaflet";
import ApiService from "../../src/services/ApiService";
import { isSuperAdmin } from "../../src/utils/AuthUtil";

const mockT = (key) => key;
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: mockT }) }));
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock("../../src/utils/AuthUtil", () => ({ isSuperAdmin: jest.fn() }));
jest.mock("../../src/services/ApiService", () => ({
  __esModule: true,
  default: {
    getCompanyWallet: jest.fn(), generateLeaflet: jest.fn(), consumeLeafletTokens: jest.fn(),
    uploadFilesFromData: jest.fn(), createFlyer: jest.fn(), getAdminCompanies: jest.fn(),
    getFlyerById: jest.fn(), getDistricts: jest.fn(),
  },
}));
jest.mock("../../src/components/Flyer/TargetBudget", () => (props) => (
  <div>
    <span>budget: {props.data.coverPhoto}</span>
    <span>direct upload: {String(Boolean(props.isDirectUpload))}</span>
    <button type="button" onClick={() => props.onUpdate({
      targetBudget: { ...props.data.targetBudget, noReward: true },
    })}>no reward</button>
  </div>
));
jest.mock("../../src/components/Flyer/CouponBuilder", () => () => <div>coupon builder</div>);
jest.mock("../../src/pages/Wallet/CreditRequestModal", () => () => <div>credit request</div>);

beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
  isSuperAdmin.mockReturnValue(true);
  ApiService.getAdminCompanies.mockResolvedValue({ success: true, data: [] });
  ApiService.getCompanyWallet.mockResolvedValue({
    success: true, data: { balance: 10, dailyFreeAttemptsRemaining: 1 },
  });
  ApiService.generateLeaflet.mockResolvedValue({ images: [{ url: "https://example.com/read.png" }] });
  ApiService.uploadFilesFromData.mockResolvedValue({});
  ApiService.createFlyer.mockResolvedValue({ success: true });
  ApiService.getDistricts.mockResolvedValue({ success: true, data: [] });
});

function renderFlow(entry = "/flyer/create/leaflet") {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/flyer/create/leaflet" element={<LeafletCreation />} />
        <Route path="/flyer/edit/leaflet/:flyerId" element={<LeafletCreation />} />
        <Route path="/flyer" element={<div>flyer list</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

test("Read still uses shared Pro defaults and proceeds through targeting and coupons", async () => {
  renderFlow();
  await waitFor(() => expect(ApiService.getAdminCompanies).toHaveBeenCalled());
  expect(screen.getByLabelText("leafletPro.aspectRatio")).toHaveValue("4:5");
  expect(screen.getByLabelText("leafletPro.resolution")).toHaveValue("2K");
  fireEvent.change(screen.getByLabelText("leafletPro.copyLine"), { target: { value: "Read title" } });
  fireEvent.change(screen.getByLabelText("leafletPro.adContent"), { target: { value: "Read content" } });
  fireEvent.change(screen.getByLabelText("leafletPro.prompts"), { target: { value: "Read flyer design" } });
  fireEvent.click(screen.getByRole("button", { name: "creation.next" }));
  await screen.findByText("budget: https://example.com/read.png");
  expect(ApiService.generateLeaflet).toHaveBeenCalledWith(expect.objectContaining({
    aspectRatio: "4:5", resolution: "2K", header: "Read title", adContent: "Read content",
  }), expect.any(Object));
  fireEvent.click(screen.getByRole("button", { name: "no reward" }));
  fireEvent.click(screen.getByRole("button", { name: "creation.proceedToCoupon" }));
  expect(screen.getByText("coupon builder")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "creation.create" }));
  await screen.findByText("flyer list");
  expect(ApiService.createFlyer).toHaveBeenCalledWith(expect.objectContaining({ type: "leaflet" }));
});

test("Read direct uploads retain the existing target/budget shortcut", async () => {
  renderFlow({
    pathname: "/flyer/create/leaflet",
    state: { isDirectUpload: true, uploadedImage: "blob:uploaded-read" },
  });
  await screen.findByText("budget: blob:uploaded-read");
  expect(screen.getByText("direct upload: true")).toBeInTheDocument();
  expect(screen.queryByLabelText("leafletPro.prompts")).not.toBeInTheDocument();
  expect(ApiService.generateLeaflet).not.toHaveBeenCalled();
});

test("Read editing remains asset-locked instead of mounting Pro generation controls", async () => {
  ApiService.getFlyerById.mockResolvedValue({
    success: true, data: { type: "leaflet", header: "Existing read", adContent: "Existing copy" },
  });
  renderFlow("/flyer/edit/leaflet/read-id");
  await screen.findByText("creation.assetLocked");
  expect(screen.queryByLabelText("leafletPro.prompts")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("leafletPro.resolution")).not.toBeInTheDocument();
});

test.each([
  ["default creation time", "2020-01-01T00:00:00.000Z", false],
  ["actual schedule", "2020-02-01T00:00:00.000Z", true],
])("Read edit displays %s appropriately", async (_name, scheduledAt, hasSchedule) => {
  ApiService.getFlyerById.mockResolvedValue({
    success: true,
    data: {
      type: "leaflet",
      header: "Existing read",
      createdAt: "2020-01-01T00:00:00.000Z",
      scheduledAt,
    },
  });
  renderFlow("/flyer/edit/leaflet/read-id");
  await screen.findByText("creation.assetLocked");
  const input = document.querySelector('input[type="datetime-local"]');
  expect(input).not.toBeNull();
  expect(Boolean(input.value)).toBe(hasSchedule);
});
