import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { useLocation, useNavigate, useParams } from "react-router";
import ApiService from "../../../services/ApiService";
import LeafletCreation from "./Leaflet";

jest.mock("react-router", () => ({
  useLocation: jest.fn(),
  useNavigate: jest.fn(),
  useParams: jest.fn(),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key) => key, i18n: { language: "en" } }),
}));
jest.mock("react-toastify", () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}));
jest.mock("../../../utils/AuthUtil", () => ({ isSuperAdmin: () => false }));
jest.mock("../../../hooks/useKpayPayment", () => ({
  __esModule: true,
  default: () => ({ status: "idle" }),
  rememberKpayPayment: jest.fn(),
}));
jest.mock("../../../components/Payment/KpayPaymentStatus", () => () => null);
jest.mock("../../../components/Flyer/Leaflet/Step1ContentPro", () => {
  const React = require("react");
  return React.forwardRef(() => <div data-testid="content-step" />);
});
jest.mock("../../../components/Flyer/TargetBudget", () => (props) => (
  <div data-testid="budget-step">{JSON.stringify(props)}</div>
));
jest.mock("../../../components/Flyer/CouponBuilder", () => ({ data }) => (
  <div data-testid="coupon-step">{JSON.stringify(data)}</div>
));
jest.mock("../../Wallet/CreditRequestModal", () => () => null);
jest.mock("../../../services/ApiService", () => ({
  __esModule: true,
  default: {
    getCompanyWallet: jest.fn(),
    getFlyerById: jest.fn(),
    getDistricts: jest.fn(),
  },
}));

const storageKey = "leafletCreationDraftV1";
const uploadedImage = "blob:new-leaflet";
const oldDraft = {
  currentStep: 1,
  leafletData: {
    header: "Old flyer",
    coverPhoto: "https://example.com/old.png",
    companyId: "old-merchant",
    targetBudget: { budget: 100, paymentMethod: "credit-card" },
    coupon: { couponFile: "https://example.com/old-coupon.png" },
  },
  generatedHistory: ["https://example.com/old.png"],
  isFreeAttempt: true,
  isDirectUpload: false,
  settledBudget: 100,
};

beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
  useLocation.mockReturnValue({ state: null });
  useNavigate.mockReturnValue(jest.fn());
  useParams.mockReturnValue({});
  ApiService.getCompanyWallet.mockResolvedValue({ success: true, data: {} });
  ApiService.getDistricts.mockResolvedValue({ success: true, data: [] });
});

afterEach(() => sessionStorage.clear());

const selectUpload = () => {
  useLocation.mockReturnValue({
    state: { isDirectUpload: true, uploadedImage },
  });
};

test.each([1, 2, 3])("new upload overrides a saved draft at step %i", async (currentStep) => {
  sessionStorage.setItem(storageKey, JSON.stringify({ ...oldDraft, currentStep }));
  selectUpload();
  render(<React.StrictMode><LeafletCreation /></React.StrictMode>);

  const budget = JSON.parse(screen.getByTestId("budget-step").textContent);
  expect(budget).toMatchObject({
    data: { coverPhoto: uploadedImage, header: "", companyId: "" },
    history: [],
    isDirectUpload: true,
    isFreeAttempt: false,
  });
  expect(budget.data.targetBudget).toBeUndefined();
  expect(budget.data.coupon).toBeUndefined();
  expect(screen.queryByTestId("content-step")).not.toBeInTheDocument();
  expect(screen.queryByTestId("coupon-step")).not.toBeInTheDocument();
  await waitFor(() => expect(JSON.parse(sessionStorage.getItem(storageKey))).toMatchObject({
    currentStep: 2,
    leafletData: { coverPhoto: uploadedImage },
    generatedHistory: [],
    isFreeAttempt: false,
    isDirectUpload: true,
    settledBudget: 0,
  }));
});

test("direct upload opens the budget step without a saved draft", async () => {
  selectUpload();
  await act(async () => { render(<LeafletCreation />); });
  expect(JSON.parse(screen.getByTestId("budget-step").textContent).data.coverPhoto)
    .toBe(uploadedImage);
});

test("payment return without a new upload restores the draft and settled budget", async () => {
  const paymentDraft = { ...oldDraft, currentStep: 3, isDirectUpload: true };
  sessionStorage.setItem(storageKey, JSON.stringify(paymentDraft));
  useLocation.mockReturnValue({ state: null, search: "?kpayPurpose=target_budget_direct" });
  await act(async () => { render(<LeafletCreation />); });
  expect(JSON.parse(screen.getByTestId("coupon-step").textContent)).toMatchObject(oldDraft.leafletData);
  expect(JSON.parse(sessionStorage.getItem(storageKey))).toMatchObject(paymentDraft);
});

test("new upload resets an already mounted restored draft", async () => {
  sessionStorage.setItem(storageKey, JSON.stringify(oldDraft));
  let view;
  await act(async () => { view = render(<LeafletCreation />); });
  expect(screen.getByTestId("content-step")).toBeInTheDocument();
  selectUpload();
  view.rerender(<LeafletCreation />);
  expect(JSON.parse(screen.getByTestId("budget-step").textContent)).toMatchObject({
    data: { coverPhoto: uploadedImage, header: "" },
    history: [],
    isFreeAttempt: false,
    isDirectUpload: true,
  });
  expect(JSON.parse(sessionStorage.getItem(storageKey)).settledBudget).toBe(0);
});

test("edit mode ignores direct upload state and loads the existing flyer", async () => {
  useParams.mockReturnValue({ flyerId: "existing-flyer" });
  selectUpload();
  ApiService.getFlyerById.mockResolvedValue({
    success: true,
    data: { type: "leaflet", ...oldDraft.leafletData },
  });
  render(<LeafletCreation />);
  expect(await screen.findByDisplayValue("Old flyer")).toBeInTheDocument();
  expect(ApiService.getFlyerById).toHaveBeenCalledWith("existing-flyer");
  expect(screen.queryByTestId("budget-step")).not.toBeInTheDocument();
  expect(sessionStorage.getItem(storageKey)).toBeNull();
});