import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { toast } from "react-toastify";
import EventCreation from "../../src/pages/Flyer/FlyerCreation/EventCreation";
import EventEdit from "../../src/pages/Flyer/FlyerCreation/EventEdit";
import ApiService from "../../src/services/ApiService";
import { isSuperAdmin } from "../../src/utils/AuthUtil";

const mockT = (key) => key;
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: mockT }) }));
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock("../../src/utils/AuthUtil", () => ({ isSuperAdmin: jest.fn() }));
jest.mock("../../src/services/ApiService", () => ({
  __esModule: true,
  default: {
    getAdminCompanies: jest.fn(),
    getFlyerById: jest.fn(),
    updateFlyer: jest.fn(),
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

function renderEdit(applicantCount) {
  ApiService.getFlyerById.mockResolvedValue({ success: true, data: {
    type: "event", applicantCount, companyId: "mailaverse", header: "Community day",
    adContent: "Meet your neighbours", venue: "Town hall", timezone: "Asia/Hong_Kong",
    startsAt: "2099-06-10T02:00:00.000Z", endsAt: "2099-06-10T04:00:00.000Z",
    applicationDeadline: "2099-06-09T02:00:00.000Z", confirmationRequired: false,
    capacity: 10, coverPhoto: "https://example.com/original.png",
  } });
  ApiService.updateFlyer.mockResolvedValue({ success: true });
  render(
    <MemoryRouter initialEntries={["/flyer/edit/event/event-id"]}>
      <Routes>
        <Route path="/flyer/edit/event/:flyerId" element={<EventEdit />} />
        <Route path="/platform-admin" element={<div>flyer admin list</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

test("edit an event in its local timezone and submit only changed fields", async () => {
  renderEdit(0);
  expect(await screen.findByLabelText("eventCreation.start")).toHaveValue("2099-06-10T10:00");
  expect(screen.getByAltText("eventCreation.preview")).toHaveAttribute("src", "https://example.com/original.png");
  expect(await screen.findByRole("option", { name: "Merchant" })).toBeInTheDocument();
  change("eventCreation.end", "2099-06-10T13:00");
  fireEvent.click(screen.getByRole("button", { name: "creation.saveChanges" }));
  expect(await screen.findByText("flyer admin list")).toBeInTheDocument();
  expect(ApiService.updateFlyer).toHaveBeenCalledWith("event-id", { endsAt: "2099-06-10T05:00:00.000Z" });
});

test("edit existing event copy after an application while enrollment fields are locked", async () => {
  renderEdit(1);
  expect(await screen.findByLabelText("eventCreation.capacity")).toBeDisabled();
  expect(screen.getByLabelText("eventCreation.start")).toBeDisabled();
  expect(screen.getByLabelText("eventCreation.confirmationRequired")).toBeDisabled();
  expect(screen.getByLabelText("eventCreation.merchant")).toBeDisabled();
  change("eventCreation.venue", "New town hall");
  fireEvent.click(screen.getByRole("button", { name: "creation.saveChanges" }));
  expect(await screen.findByText("flyer admin list")).toBeInTheDocument();
  expect(ApiService.updateFlyer).toHaveBeenCalledWith("event-id", { venue: "New town hall" });
  expect(ApiService.getAdminCompanies).not.toHaveBeenCalled();
});

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

test("uses the original event fields and publishes through event targeting without billing or coupons", async () => {
  renderFlow();
  enterDetails();
  change("eventCreation.imagePrompt", "A neighbourhood gathering");
  expect(screen.queryByRole("button", { name: "qrGeneration.upload" })).not.toBeInTheDocument();
  expect(screen.queryByText("qrGeneration.backgroundInformation")).not.toBeInTheDocument();
  for (const field of [
    "qrGeneration.website", "leafletPro.aspectRatio", "leafletPro.resolution", "leafletPro.primaryColor",
    "leafletPro.moodboard", "leafletPro.uploadLogo", "leafletPro.uploadProduct",
  ]) {
    expect(screen.queryByLabelText(field)).not.toBeInTheDocument();
  }
  expect(screen.getByLabelText("eventCreation.eventTitle")).toHaveAttribute("maxlength", "160");
  expect(screen.getByLabelText("eventCreation.description")).toHaveAttribute("maxlength", "5000");
  await screen.findByRole("option", { name: "Merchant" });
  expect(screen.queryByRole("option", { name: "Inactive" })).not.toBeInTheDocument();
  change("eventCreation.merchant", "merchant");
  await proceedToTargeting();
  expect(ApiService.generateLeaflet).toHaveBeenCalledWith(expect.objectContaining({
    aspectRatio: "1:1", resolution: "1K", flyerPrompts: "A neighbourhood gathering",
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
  expect(screen.queryByLabelText("eventCreation.imagePrompt")).not.toBeInTheDocument();
  expect(screen.getByText("event.png")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "qrGeneration.usePrompt" })).not.toBeInTheDocument();
  expect(screen.queryByAltText("eventCreation.preview")).not.toBeInTheDocument();
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

test("unchanged Back/Next reuses the image; prompt changes generate a new image", async () => {
  renderFlow();
  enterDetails();
  change("eventCreation.imagePrompt", "Community gathering");
  await proceedToTargeting();
  fireEvent.click(screen.getByRole("button", { name: "creation.back" }));
  change("eventCreation.venue", "New town hall");
  await proceedToTargeting();
  expect(ApiService.generateLeaflet).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "creation.back" }));
  change("eventCreation.imagePrompt", "A community gathering outdoors");
  await proceedToTargeting();
  expect(ApiService.generateLeaflet).toHaveBeenCalledTimes(2);
});

test("validates the shared prompt and event dates before generating", async () => {
  renderFlow();
  enterDetails();
  fireEvent.click(screen.getByRole("button", { name: "creation.next" }));
  expect(await screen.findByText("flyerContent.promptRequired")).toBeInTheDocument();
  expect(ApiService.generateLeaflet).not.toHaveBeenCalled();
  change("eventCreation.imagePrompt", "Gathering");
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
