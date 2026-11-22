import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import ApiService from "../../../../src/services/ApiService";
import PlatformVouchersCreatePage from "../../../../src/pages/PlatformVouchers/PlatformVouchersCreatePage";
import en from "../../../../src/i18n/locales/en/common.json";

let mockParams = {};
let mockLocation = { state: null };
const mockNavigate = jest.fn();
jest.mock("react-router", () => ({
  useParams: () => mockParams,
  useLocation: () => mockLocation,
  useNavigate: () => mockNavigate,
  Navigate: () => null,
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: mockTranslate }),
}));
const mockTranslate = (key, variables = {}) => {
  const value = key.split(".").reduce((current, part) => current?.[part], en) || key;
  return value.replace(/\{\{(\w+)\}\}/g, (_, name) => variables[name] ?? "");
};
jest.mock("../../../../src/services/ApiService");
jest.mock("../../../../src/utils/AuthUtil", () => ({ isSuperAdmin: () => true }));
jest.mock("../../../../src/components/PlatformVouchers/PlatformVoucherCard", () => ({ PlatformVoucherCard: () => null }));

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockLocation = { state: null };
  Object.defineProperty(global, "crypto", { configurable: true, value: { randomUUID: jest.fn(() => "stable-import-key") } });
  URL.createObjectURL = jest.fn(() => "blob:preview");
  URL.revokeObjectURL = jest.fn();
  jest.spyOn(console, "error").mockImplementation(() => {});
  ApiService.createAdminVoucher.mockResolvedValue({ success: true, data: { id: "saved-id" } });
  ApiService.updateAdminVoucher.mockResolvedValue({ success: true });
  ApiService.importAdminVoucher.mockResolvedValue({ success: true });
});
afterEach(() => jest.restoreAllMocks());

const selectImported = () => fireEvent.change(screen.getByLabelText("Voucher Type"), { target: { value: "imported" } });
const submit = () => fireEvent.submit(screen.getByRole("form"));
const uploadCsv = async (contents) => {
  const file = new File([], "pairs.csv", { type: "text/csv" });
  file.text = jest.fn().mockResolvedValue(contents);
  fireEvent.change(screen.getByLabelText("Upload pairs CSV"), { target: { files: [file] } });
  await waitFor(() => expect(screen.queryByText(en.voucherAdminPage.csvReading)).not.toBeInTheDocument());
};
const uploadImages = (...names) => {
  const images = names.map((name) => new File(["image"], name, { type: "image/png" }));
  fireEvent.change(screen.getByLabelText("Select inventory images"), { target: { files: images } });
  return images;
};

test("uses the accessible picker for voucher artwork", () => {
  render(<PlatformVouchersCreatePage />);
  for (const label of ["Merchant Icon", "Voucher Image", "QR Code"]) {
    const input = screen.getByLabelText(label);
    const click = jest.spyOn(input, "click").mockImplementation(() => {});
    fireEvent.click(screen.getByRole("button", { name: `Choose file for ${label}` }));
    expect(click).toHaveBeenCalledTimes(1);
    const file = new File(["image"], `${label}.png`, { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByText(`Selected: ${file.name}`)).toBeInTheDocument();
  }
});

test("creates zero-stock voucher then imports explicit pairs in CSV order", async () => {
  render(<PlatformVouchersCreatePage />);
  selectImported();
  await uploadCsv("code,image_filename\n00123,first.png\n00002,second.png");
  const images = uploadImages("second.png", "first.png");
  expect(screen.getByText('"00123"')).toBeInTheDocument();
  expect(screen.getByText("Import preview: 2 / 100 items")).toBeInTheDocument();
  submit();
  await waitFor(() => expect(ApiService.importAdminVoucher).toHaveBeenCalledTimes(1));
  expect(ApiService.createAdminVoucher).toHaveBeenCalledWith(expect.objectContaining({ voucherType: "imported", totalNumber: 0 }));
  expect(ApiService.importAdminVoucher).toHaveBeenCalledWith("saved-id", expect.objectContaining({
    pairs: [{ code: "00123", imageFilename: "first.png" }, { code: "00002", imageFilename: "second.png" }],
    images, importKey: "stable-import-key",
  }));
  expect(ApiService.createAdminVoucher.mock.invocationCallOrder[0]).toBeLessThan(ApiService.importAdminVoucher.mock.invocationCallOrder[0]);
});

test("rejects incomplete or duplicate pairs before creating a voucher", async () => {
  render(<PlatformVouchersCreatePage />);
  selectImported();
  submit();
  await screen.findByText(en.voucherAdminPage.importEmpty);
  await uploadCsv("code,image_filename\n001,a.png\n001,b.png");
  uploadImages("a.png");
  submit();
  expect(screen.getAllByText(en.voucherAdminPage.importDuplicateCodes).length).toBeGreaterThan(0);
  expect(screen.getAllByText(en.voucherAdminPage.importPairMismatch).length).toBeGreaterThan(0);
  expect(ApiService.createAdminVoucher).not.toHaveBeenCalled();
});

test.each([false, true])("failed import retries the identical pair batch after remount (throw=%s)", async (throws) => {
  if (throws) ApiService.importAdminVoucher.mockRejectedValueOnce(new Error("Import unavailable"));
  else ApiService.importAdminVoucher.mockResolvedValueOnce({ success: false, message: "Import unavailable" });
  const { unmount } = render(<PlatformVouchersCreatePage />);
  selectImported();
  await uploadCsv("code,image_filename\n0001,qr.png");
  uploadImages("qr.png");
  submit();
  await screen.findByText("Import unavailable");
  const retryNavigation = mockNavigate.mock.calls.filter(([path]) => path.endsWith("/edit")).pop();
  unmount();
  mockParams = { voucherId: "saved-id" };
  mockLocation = { state: retryNavigation[1].state };
  render(<PlatformVouchersCreatePage />);
  expect(screen.getByLabelText("Merchant")).toBeDisabled();
  submit();
  await waitFor(() => expect(ApiService.importAdminVoucher).toHaveBeenCalledTimes(2));
  expect(ApiService.importAdminVoucher.mock.calls[0]).toEqual(ApiService.importAdminVoucher.mock.calls[1]);
  expect(ApiService.createAdminVoucher).toHaveBeenCalledTimes(1);
  expect(ApiService.updateAdminVoucher).not.toHaveBeenCalled();
});

test("does not create while CSV is being read", async () => {
  render(<PlatformVouchersCreatePage />);
  selectImported();
  const file = new File([], "pairs.csv", { type: "text/csv" });
  file.text = jest.fn(() => new Promise(() => {}));
  fireEvent.change(screen.getByLabelText("Upload pairs CSV"), { target: { files: [file] } });
  submit();
  await waitFor(() => expect(screen.getAllByText(en.voucherAdminPage.csvReading).length).toBeGreaterThan(0));
  expect(ApiService.createAdminVoucher).not.toHaveBeenCalled();
});

test("cancelling discard preserves the retry payload", async () => {
  ApiService.importAdminVoucher.mockRejectedValueOnce(new Error("Network unavailable"));
  jest.spyOn(window, "confirm").mockReturnValue(false);
  render(<PlatformVouchersCreatePage />);
  selectImported();
  await uploadCsv("code,image_filename\n0001,qr.png");
  uploadImages("qr.png");
  submit();
  await screen.findByText("Network unavailable");
  fireEvent.click(screen.getByRole("button", { name: "Discard retry batch" }));
  expect(screen.getByLabelText("Upload pairs CSV")).toBeDisabled();
  submit();
  await waitFor(() => expect(ApiService.importAdminVoucher).toHaveBeenCalledTimes(2));
  expect(ApiService.importAdminVoucher.mock.calls[0]).toEqual(ApiService.importAdminVoucher.mock.calls[1]);
});

test("discarding a definitively rejected batch permits a corrected batch with a fresh key", async () => {
  ApiService.importAdminVoucher.mockResolvedValueOnce({ success: false, message: "Duplicate code" });
  ApiService.getAdminVoucher.mockResolvedValue({ success: true, data: { voucherType: "imported", totalNumber: 0 } });
  global.crypto.randomUUID.mockReturnValueOnce("rejected-key").mockReturnValueOnce("corrected-key");
  jest.spyOn(window, "confirm").mockReturnValue(true);
  const { rerender } = render(<PlatformVouchersCreatePage />);
  selectImported();
  await uploadCsv("code,image_filename\nduplicate,old.png");
  uploadImages("old.png");
  submit();
  await screen.findByText("Duplicate code");
  mockParams = { voucherId: "saved-id" };
  mockLocation = { state: mockNavigate.mock.calls.filter(([path]) => path.endsWith("/edit")).pop()[1].state };
  rerender(<PlatformVouchersCreatePage />);
  fireEvent.click(screen.getByRole("button", { name: "Discard retry batch" }));
  mockLocation = { state: null };
  rerender(<PlatformVouchersCreatePage />);
  await screen.findByText("Append inventory");
  await uploadCsv("code,image_filename\ncorrected,new.png");
  uploadImages("new.png");
  submit();
  await waitFor(() => expect(ApiService.importAdminVoucher).toHaveBeenCalledTimes(2));
  expect(ApiService.importAdminVoucher.mock.calls[1]).toEqual(["saved-id", expect.objectContaining({
    pairs: [{ code: "corrected", imageFilename: "new.png" }], importKey: "corrected-key",
  })]);
  expect(ApiService.createAdminVoucher).toHaveBeenCalledTimes(1);
});

test.each(["static", "numbered"])("editing %s cannot convert it to imported", async (type) => {
  mockParams = { voucherId: "existing-id" };
  ApiService.getAdminVoucher.mockResolvedValue({ success: true, data: { voucherType: type, totalNumber: 3 } });
  render(<PlatformVouchersCreatePage />);
  await screen.findByLabelText("Voucher Type");
  expect(screen.queryByRole("option", { name: "Imported Voucher" })).not.toBeInTheDocument();
});

test("existing imported voucher type is locked", async () => {
  mockParams = { voucherId: "existing-id" };
  ApiService.getAdminVoucher.mockResolvedValue({ success: true, data: { voucherType: "imported", totalNumber: 3 } });
  render(<PlatformVouchersCreatePage />);
  expect(await screen.findByLabelText("Voucher Type")).toBeDisabled();
});

test("edit appends pairs without setting quantity", async () => {
  mockParams = { voucherId: "existing-id" };
  ApiService.getAdminVoucher.mockResolvedValue({ success: true, data: { voucherType: "imported", totalNumber: 42 } });
  render(<PlatformVouchersCreatePage />);
  await screen.findByText("Append inventory");
  await uploadCsv("code,image_filename\n0007,qr.png");
  uploadImages("qr.png");
  submit();
  await waitFor(() => expect(ApiService.importAdminVoucher).toHaveBeenCalledTimes(1));
  expect(ApiService.updateAdminVoucher.mock.calls[0][1]).not.toHaveProperty("totalNumber");
  expect(ApiService.importAdminVoucher.mock.calls[0][0]).toBe("existing-id");
});

test("edit may save metadata without importing inventory", async () => {
  mockParams = { voucherId: "existing-id" };
  ApiService.getAdminVoucher.mockResolvedValue({ success: true, data: { voucherType: "imported", totalNumber: 42 } });
  render(<PlatformVouchersCreatePage />);
  await screen.findByText("Append inventory");
  submit();
  await waitFor(() => expect(ApiService.updateAdminVoucher).toHaveBeenCalledTimes(1));
  expect(ApiService.importAdminVoucher).not.toHaveBeenCalled();
});

test.each(["static", "numbered"])("existing %s creation preserves stock fields", async (type) => {
  render(<PlatformVouchersCreatePage />);
  fireEvent.change(screen.getByLabelText("Voucher Type"), { target: { value: type } });
  if (type === "static") fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "3" } });
  else {
    fireEvent.change(screen.getByLabelText("Voucher Prefix"), { target: { value: "ABC" } });
    fireEvent.change(screen.getByLabelText("Voucher Number Start"), { target: { value: "001" } });
    fireEvent.change(screen.getByLabelText("Voucher Number End"), { target: { value: "003" } });
  }
  submit();
  await waitFor(() => expect(ApiService.createAdminVoucher).toHaveBeenCalledTimes(1));
  expect(ApiService.createAdminVoucher.mock.calls[0][0]).toEqual(expect.objectContaining({ voucherType: type, totalNumber: 3 }));
});
