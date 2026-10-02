import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useLocation, useNavigate } from "react-router";
import { toast } from "react-toastify";
import ApiService from "../../../services/ApiService";
import Flyer from "../Flyer";
import FlyerDistributionCard from "../../../components/Flyer/FlyerDistributionCard";
import EventCreation from "./EventCreation";

jest.mock("react-router", () => ({
  useLocation: jest.fn(),
  useNavigate: jest.fn(),
}));
jest.mock("react-i18next", () => {
  const t = (key) => key;
  return { useTranslation: () => ({ t }) };
});
jest.mock("react-toastify", () => ({ toast: { error: jest.fn() } }));
jest.mock("../../../utils/AuthUtil", () => ({ isSuperAdmin: () => true }));
jest.mock("../../../components/Flyer/FlyerPreview", () => ({ __esModule: true, default: ({ coverPhoto }) => <img src={coverPhoto} alt="eventCreation.preview" /> }));
jest.mock("../../../services/ApiService", () => ({
  __esModule: true,
  default: {
    getAdminCompanies: jest.fn(),
    uploadFilesFromData: jest.fn(),
    generateLeaflet: jest.fn(),
    createEvent: jest.fn(),
    getDistricts: jest.fn(),
    getCurrentCompany: jest.fn(),
    uploadFile: jest.fn(),
  },
}));

const navigate = jest.fn();
const imageUrl = "https://storage.example.com/event.png";
const merchant = { id: "merchant-1", name: "Test merchant" };
const file = new File(["image"], "event.png", { type: "image/png" });

beforeEach(() => {
  jest.clearAllMocks();
  useNavigate.mockReturnValue(navigate);
  useLocation.mockReturnValue({ state: null });
  URL.createObjectURL = jest.fn(() => "blob:event-preview");
  URL.revokeObjectURL = jest.fn();
  ApiService.getAdminCompanies.mockResolvedValue({ data: [merchant] });
  ApiService.uploadFilesFromData.mockResolvedValue({ coverPhoto: imageUrl });
  ApiService.generateLeaflet.mockResolvedValue({ images: [{ url: imageUrl }] });
  ApiService.createEvent.mockResolvedValue({ success: true });
  ApiService.getDistricts.mockResolvedValue({ success: true, data: [] });
  ApiService.getCurrentCompany.mockReturnValue(null);
  ApiService.uploadFile.mockResolvedValue({ success: true, url: "https://storage.example.com/icon.png" });
});

const fillEventForm = async () => {
  await screen.findByRole("option", { name: merchant.name });
  fireEvent.change(screen.getByRole("combobox"), {
    target: { value: merchant.id },
  });
  [
    ["eventCreation.eventTitle", "Test event"],
    ["eventCreation.venue", "Test venue"],
    ["eventCreation.start", "2099-10-10T12:00"],
    ["eventCreation.end", "2099-10-10T14:00"],
    ["eventCreation.deadline", "2099-10-09T12:00"],
  ].forEach(([label, value]) => {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  });
  fireEvent.change(screen.getByLabelText("eventCreation.description"), {
    target: { value: "Event description" },
  });
};

test("event card offers direct upload and routes the file to event creation", () => {
  render(<Flyer />);
  const input = screen.getByLabelText("eventCreation.title: flyerPage.leafletSecondary");
  const picker = jest.spyOn(input, "click");
  fireEvent.click(screen.getAllByRole("button", { name: "flyerPage.leafletSecondary" })[1]);
  expect(picker).toHaveBeenCalled();
  fireEvent.change(input, { target: { files: [file] } });
  expect(navigate).toHaveBeenCalledWith("/flyer/create/event", {
    state: { uploadedFile: file, isDirectUpload: true },
  });
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});

test("leaflet direct upload keeps its existing navigation state", () => {
  render(
    <FlyerDistributionCard title="Leaflet" icon="leaflet" primaryRoute="/flyer/create/leaflet" />,
  );
  fireEvent.change(screen.getByLabelText("Leaflet: flyerPage.leafletSecondary"), {
    target: { files: [file] },
  });
  expect(navigate).toHaveBeenCalledWith("/flyer/create/leaflet", {
    state: {
      uploadedImage: "blob:event-preview",
      fileName: file.name,
      fileSize: file.size,
      isDirectUpload: true,
    },
  });
});

test("uploaded photo is previewed, hides the prompt and releases its URL", () => {
  useLocation.mockReturnValue({ state: { uploadedFile: file, isDirectUpload: true } });
  const { unmount } = render(<EventCreation />);
  expect(screen.getByAltText("eventCreation.preview")).toHaveAttribute(
    "src", "blob:event-preview",
  );
  expect(screen.queryByText("eventCreation.imagePrompt")).not.toBeInTheDocument();
  unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:event-preview");
});

test("direct upload persists a permanent URL without generating an image", async () => {
  useLocation.mockReturnValue({ state: { uploadedFile: file, isDirectUpload: true } });
  render(<EventCreation />);
  await fillEventForm();
  fireEvent.submit(screen.getByRole("form"));
  await screen.findByRole("button", { name: "eventCreation.create" });
  expect(ApiService.createEvent).not.toHaveBeenCalled();
  expect(screen.getByAltText("eventCreation.preview")).toHaveAttribute("src", imageUrl);
  fireEvent.submit(screen.getByRole("form"));
  await waitFor(() => expect(ApiService.createEvent).toHaveBeenCalled());
  expect(ApiService.uploadFilesFromData).toHaveBeenCalledWith({ coverPhoto: file });
  expect(ApiService.generateLeaflet).not.toHaveBeenCalled();
  expect(ApiService.createEvent).toHaveBeenCalledWith(expect.objectContaining({
    companyId: merchant.id,
    coverPhoto: imageUrl,
    header: "Test event",
    adContent: "Event description",
  }));
  expect(navigate).toHaveBeenCalledWith("/flyer", {
    state: { success: true, message: "eventCreation.created" },
  });
});

test("upload failure prevents event creation and allows retry", async () => {
  useLocation.mockReturnValue({ state: { uploadedFile: file, isDirectUpload: true } });
  ApiService.uploadFilesFromData.mockRejectedValueOnce(new Error("Upload failed"));
  render(<EventCreation />);
  await fillEventForm();
  fireEvent.submit(screen.getByRole("form"));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Upload failed"));
  expect(ApiService.createEvent).not.toHaveBeenCalled();
  expect(ApiService.generateLeaflet).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "creation.next" })).toBeEnabled();
  fireEvent.submit(screen.getByRole("form"));
  await screen.findByRole("button", { name: "eventCreation.create" });
  fireEvent.submit(screen.getByRole("form"));
  await waitFor(() => expect(ApiService.createEvent).toHaveBeenCalledTimes(1));
});

test("missing uploaded URL does not submit the event", async () => {
  useLocation.mockReturnValue({ state: { uploadedFile: file, isDirectUpload: true } });
  ApiService.uploadFilesFromData.mockResolvedValueOnce({});
  render(<EventCreation />);
  await fillEventForm();
  fireEvent.submit(screen.getByRole("form"));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("eventCreation.failed"));
  expect(ApiService.createEvent).not.toHaveBeenCalled();
  expect(ApiService.generateLeaflet).not.toHaveBeenCalled();
});

test("regular event creation retains image prompt generation", async () => {
  render(<EventCreation />);
  expect(screen.getByText("eventCreation.imagePrompt")).toBeInTheDocument();
  await fillEventForm();
  fireEvent.change(screen.getByLabelText("eventCreation.imagePrompt"), {
    target: { value: "Generate an event flyer" },
  });
  fireEvent.submit(screen.getByRole("form"));
  await screen.findByRole("button", { name: "eventCreation.create" });
  expect(ApiService.createEvent).not.toHaveBeenCalled();
  expect(screen.getByAltText("eventCreation.preview")).toHaveAttribute("src", imageUrl);
  expect(navigate).not.toHaveBeenCalled();
  fireEvent.submit(screen.getByRole("form"));
  await waitFor(() => expect(ApiService.createEvent).toHaveBeenCalled());
  expect(ApiService.generateLeaflet).toHaveBeenCalledWith(
    expect.objectContaining({ flyerPrompts: "Generate an event flyer" }),
    { company: expect.objectContaining({ ...merchant, icon: expect.stringContaining("https://") }) },
  );
  expect(ApiService.uploadFilesFromData).not.toHaveBeenCalled();
});

test("Mailaverse is an organizer without a merchant record and supports a custom icon", async () => {
  useLocation.mockReturnValue({ state: { uploadedFile: file } });
  render(<EventCreation />);
  await fillEventForm();
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "mailaverse" } });
  fireEvent.change(screen.getByLabelText("eventCreation.icon"), { target: { files: [file] } });
  fireEvent.change(screen.getByLabelText("eventCreation.timezone"), { target: { value: "UTC" } });
  fireEvent.submit(screen.getByRole("form"));
  await screen.findByRole("button", { name: "eventCreation.create" });
  fireEvent.submit(screen.getByRole("form"));
  await waitFor(() => expect(ApiService.createEvent).toHaveBeenCalled());
  expect(ApiService.uploadFile).toHaveBeenCalledWith(file, "event-icon");
  expect(ApiService.createEvent).toHaveBeenCalledWith(expect.objectContaining({
    companyId: "mailaverse", companyIcon: "https://storage.example.com/icon.png",
    startsAt: "2099-10-10T12:00:00.000Z", timezone: "UTC",
  }));
});

test("date errors are shown before image generation", async () => {
  render(<EventCreation />);
  await fillEventForm();
  fireEvent.change(screen.getByLabelText("eventCreation.end"), { target: { value: "2099-10-10T11:00" } });
  fireEvent.submit(screen.getByRole("form"));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("eventCreation.endAfterStart"));
  expect(ApiService.generateLeaflet).not.toHaveBeenCalled();
  expect(ApiService.createEvent).not.toHaveBeenCalled();
});

test("event release schedule uses the event timezone and cannot follow the deadline", async () => {
  useLocation.mockReturnValue({ state: { uploadedFile: file } });
  render(<EventCreation />);
  await fillEventForm();
  fireEvent.change(screen.getByLabelText("eventCreation.timezone"), { target: { value: "Asia/Hong_Kong" } });
  fireEvent.submit(screen.getByRole("form"));
  await screen.findByRole("button", { name: "eventCreation.create" });
  fireEvent.change(screen.getByLabelText("targetBudget.scheduledDateTime"), { target: { value: "2099-10-09T13:00" } });
  fireEvent.submit(screen.getByRole("form"));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("eventCreation.scheduleBeforeDeadline"));
  expect(ApiService.createEvent).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("targetBudget.scheduledDateTime"), { target: { value: "2099-10-08T12:00" } });
  fireEvent.submit(screen.getByRole("form"));
  await waitFor(() => expect(ApiService.createEvent).toHaveBeenCalled());
  expect(ApiService.createEvent).toHaveBeenCalledWith(expect.objectContaining({
    targetBudget: expect.objectContaining({ scheduledAt: "2099-10-08T04:00:00.000Z" }),
  }));
});

test("back allows edits and regenerates the image before another review", async () => {
  render(<EventCreation />);
  await fillEventForm();
  fireEvent.change(screen.getByLabelText("eventCreation.imagePrompt"), { target: { value: "First design" } });
  fireEvent.submit(screen.getByRole("form"));
  await screen.findByRole("button", { name: "eventCreation.create" });
  fireEvent.click(screen.getByRole("button", { name: "creation.back" }));
  fireEvent.change(screen.getByLabelText("eventCreation.imagePrompt"), { target: { value: "Second design" } });
  fireEvent.submit(screen.getByRole("form"));
  await screen.findByRole("button", { name: "eventCreation.create" });
  expect(ApiService.generateLeaflet).toHaveBeenCalledTimes(2);
  expect(ApiService.createEvent).not.toHaveBeenCalled();
});