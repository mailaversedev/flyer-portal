import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { toast } from "react-toastify";
import EventCreation from "../../src/pages/Flyer/FlyerCreation/EventCreation";
import ApiService from "../../src/services/ApiService";
import { isSuperAdmin } from "../../src/utils/AuthUtil";

const mockT = (key) => key;
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: mockT }) }));
jest.mock("react-toastify", () => ({ toast: { error: jest.fn() } }));
jest.mock("../../src/utils/AuthUtil", () => ({ isSuperAdmin: jest.fn() }));
jest.mock("../../src/services/ApiService", () => ({
  __esModule: true,
  default: {
    getAdminCompanies: jest.fn(),
    generateLeaflet: jest.fn(),
    uploadFilesFromData: jest.fn(),
    uploadFile: jest.fn(),
    createEvent: jest.fn(),
    createFlyer: jest.fn(),
    consumeLeafletTokens: jest.fn(),
    getCompanyWallet: jest.fn(),
  },
}));
jest.mock("../../src/components/Flyer/TargetBudget", () => (props) => (
  <div>
    <span>event targeting: {String(props.isEvent)}</span>
    <span>cover: {props.data.coverPhoto}</span>
    <button type="button" onClick={() => props.onUpdate({
      ...props.data, targetBudget: { ...props.data.targetBudget, district: "Central" },
    })}>select district</button>
  </div>
));

beforeEach(() => {
  jest.clearAllMocks();
  isSuperAdmin.mockReturnValue(true);
  URL.createObjectURL = jest.fn(() => "blob:preview");
  URL.revokeObjectURL = jest.fn();
  ApiService.getAdminCompanies.mockResolvedValue({
    success: true,
    data: [
      { id: "merchant", name: "Merchant", icon: "https://example.com/icon.png" },
      { id: "inactive", name: "Inactive", isActive: false },
    ],
  });
  ApiService.generateLeaflet.mockResolvedValue({ images: [{ url: "https://example.com/event.png" }] });
  ApiService.uploadFilesFromData.mockResolvedValue({ coverPhoto: "https://example.com/upload.png" });
  ApiService.uploadFile.mockResolvedValue({ success: true, url: "https://example.com/custom-icon.png" });
  ApiService.createEvent.mockResolvedValue({ success: true });
});

function renderFlow(uploadedFile) {
  render(
    <MemoryRouter initialEntries={[{ pathname: "/flyer/create/event", state: { uploadedFile } }]}>
      <Routes>
        <Route path="/flyer/create/event" element={<EventCreation />} />
        <Route path="/flyer" element={<div>flyer list</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function change(label, value) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function enterDetails() {
  change("eventCreation.eventTitle", "Community day");
  change("eventCreation.description", "Meet your neighbours");
  change("eventCreation.venue", "Town hall");
  change("eventCreation.timezone", "Asia/Hong_Kong");
  change("eventCreation.start", "2099-06-10T10:00");
  change("eventCreation.end", "2099-06-10T12:00");
  change("eventCreation.deadline", "2099-06-09T10:00");
}

async function proceedToTargeting() {
  fireEvent.click(screen.getByRole("button", { name: "creation.next" }));
  expect(await screen.findByText("event targeting: true")).toBeInTheDocument();
}

test("uses the Pro editor and publishes through event targeting without billing or coupons", async () => {
  renderFlow();
  enterDetails();
  change("leafletPro.prompts", "A neighbourhood gathering");
  expect(screen.getByLabelText("leafletPro.aspectRatio")).toHaveValue("1:1");
  expect(screen.getByLabelText("leafletPro.resolution")).toHaveValue("1K");
  expect(screen.getByLabelText("eventCreation.eventTitle")).toHaveAttribute("maxlength", "160");
  expect(screen.getByLabelText("eventCreation.description")).toHaveAttribute("maxlength", "5000");
  await screen.findByRole("option", { name: "Merchant" });
  expect(screen.queryByRole("option", { name: "Inactive" })).not.toBeInTheDocument();
  change("eventCreation.merchant", "merchant");
  change("leafletPro.aspectRatio", "4:5");
  change("leafletPro.resolution", "2K");
  change("leafletPro.primaryColor", "#123456");
  await proceedToTargeting();
  expect(ApiService.generateLeaflet).toHaveBeenCalledWith(expect.objectContaining({
    aspectRatio: "4:5", resolution: "2K", primaryColor: "#123456",
  }), { company: expect.objectContaining({ id: "merchant", icon: "https://example.com/icon.png" }) });
  fireEvent.click(screen.getByRole("button", { name: "select district" }));
  fireEvent.click(screen.getByRole("button", { name: "eventCreation.create" }));
  await screen.findByText("flyer list");
  expect(ApiService.createEvent).toHaveBeenCalledWith(expect.objectContaining({
    companyId: "merchant", header: "Community day", adContent: "Meet your neighbours",
    startsAt: "2099-06-10T02:00:00.000Z",
    companyIcon: "https://example.com/icon.png",
    targetBudget: expect.objectContaining({ noReward: true, district: "Central" }),
  }));
  expect(ApiService.createEvent.mock.calls[0][0]).not.toHaveProperty("logoImage");
  expect(ApiService.createFlyer).not.toHaveBeenCalled();
  expect(ApiService.getCompanyWallet).not.toHaveBeenCalled();
  expect(ApiService.consumeLeafletTokens).not.toHaveBeenCalled();
});

test("uploaded events skip creative requirements and persist an overridden organizer icon", async () => {
  const file = new File(["image"], "event.png", { type: "image/png" });
  renderFlow(file);
  enterDetails();
  expect(screen.queryByLabelText("leafletPro.prompts")).not.toBeInTheDocument();
  expect(screen.getByAltText("eventCreation.preview")).toHaveAttribute("src", "blob:preview");
  const icon = new File(["icon"], "icon.png", { type: "image/png" });
  userEvent.upload(screen.getByLabelText("eventCreation.icon"), icon);
  await proceedToTargeting();
  expect(ApiService.uploadFilesFromData).toHaveBeenCalledWith({ coverPhoto: file });
  fireEvent.click(screen.getByRole("button", { name: "eventCreation.create" }));
  await screen.findByText("flyer list");
  expect(ApiService.uploadFile).toHaveBeenCalledWith(icon, "event-icon");
  expect(ApiService.createEvent).toHaveBeenCalledWith(expect.objectContaining({
    companyId: "mailaverse", companyIcon: "https://example.com/custom-icon.png",
  }));
  expect(ApiService.generateLeaflet).not.toHaveBeenCalled();
});

test("unchanged Back/Next reuses the image; design changes generate a new image", async () => {
  renderFlow();
  enterDetails();
  change("leafletPro.prompts", "Community gathering");
  await proceedToTargeting();
  fireEvent.click(screen.getByRole("button", { name: "creation.back" }));
  change("eventCreation.venue", "New town hall");
  await proceedToTargeting();
  expect(ApiService.generateLeaflet).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "creation.back" }));
  change("leafletPro.secondaryColor", "#ABCDEF");
  await proceedToTargeting();
  expect(ApiService.generateLeaflet).toHaveBeenCalledTimes(2);
});

test("validates the shared prompt and event dates before generating", async () => {
  renderFlow();
  enterDetails();
  fireEvent.click(screen.getByRole("button", { name: "creation.next" }));
  expect(await screen.findByText("flyerContent.promptRequired")).toBeInTheDocument();
  expect(ApiService.generateLeaflet).not.toHaveBeenCalled();
  change("leafletPro.prompts", "Gathering");
  change("eventCreation.end", "2099-06-10T09:00");
  fireEvent.click(screen.getByRole("button", { name: "creation.next" }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("eventCreation.endAfterStart"));
  expect(ApiService.generateLeaflet).not.toHaveBeenCalled();
});

test("non-admins cannot enter event creation", async () => {
  isSuperAdmin.mockReturnValue(false);
  renderFlow();
  await screen.findByText("flyer list");
  expect(ApiService.getAdminCompanies).not.toHaveBeenCalled();
  expect(ApiService.generateLeaflet).not.toHaveBeenCalled();
});
