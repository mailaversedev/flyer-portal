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

const selectImported = () => {
  fireEvent.change(screen.getByLabelText("Voucher Type"), { target: { value: "imported" } });
};
const submit = () => fireEvent.submit(screen.getByRole("form"));

test("uses the same accessible file picker for merchant, voucher and QR images", () => {
  render(<PlatformVouchersCreatePage />);
  for (const label of ["Merchant Icon", "Voucher Image", "QR Code"]) {
    const input = screen.getByLabelText(label);
    const click = jest.spyOn(input, "click").mockImplementation(() => {});
    const button = screen.getByRole("button", { name: `Choose file for ${label}` });
    expect(button).toHaveTextContent("Choose file");
    fireEvent.click(button);
    expect(click).toHaveBeenCalledTimes(1);
    const file = new File(["image"], `${label}.png`, { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByText(`Selected: ${file.name}`)).toBeInTheDocument();
  }
});

test("uses the shared picker for CSV and inventory images", () => {
  render(<PlatformVouchersCreatePage />);
  selectImported();
  fireEvent.change(screen.getByLabelText("Code source"), { target: { value: "csv" } });
  expect(screen.getByRole("button", { name: "Choose file for Upload codes CSV" })).toHaveTextContent("Choose file");
  fireEvent.change(screen.getByLabelText("Inventory type"), { target: { value: "image" } });
  const button = screen.getByRole("button", { name: "Choose file for Select inventory images" });
  expect(button).toHaveTextContent("Choose files");
  const images = [new File(["a"], "first.png", { type: "image/png" }), new File(["b"], "second.png", { type: "image/png" })];
  fireEvent.change(screen.getByLabelText("Select inventory images"), { target: { files: images } });
  expect(screen.getByText("2 files selected")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Clear images" }));
  expect(screen.queryByText("2 files selected")).not.toBeInTheDocument();
});

test("creates imported voucher with zero stock before uploading codes", async () => {
  render(<PlatformVouchersCreatePage />);
  selectImported();
  fireEvent.change(screen.getByLabelText("Paste codes (one per line)"), { target: { value: "00123\n00002" } });
  expect(screen.queryByLabelText("Select inventory images")).not.toBeInTheDocument();
  expect(screen.getByText('"00123"')).toBeInTheDocument();
  expect(screen.getByLabelText("Quantity")).toHaveAttribute("readonly");
  submit();
  await waitFor(() => expect(ApiService.importAdminVoucher).toHaveBeenCalledTimes(1));
  expect(ApiService.createAdminVoucher).toHaveBeenCalledWith(expect.objectContaining({ voucherType: "imported", totalNumber: 0, promotionCode: "", qrCode: "" }));
  expect(ApiService.importAdminVoucher).toHaveBeenCalledWith("saved-id", expect.objectContaining({ codes: ["00123", "00002"], images: [], importKey: "stable-import-key" }));
  expect(ApiService.createAdminVoucher.mock.invocationCallOrder[0]).toBeLessThan(ApiService.importAdminVoucher.mock.invocationCallOrder[0]);
  expect(mockNavigate.mock.calls[0][0]).toBe("/platform-vouchers/saved-id/edit");
  expect(mockNavigate.mock.invocationCallOrder[0]).toBeLessThan(ApiService.importAdminVoucher.mock.invocationCallOrder[0]);
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/platform-vouchers", expect.any(Object)));
});

test("switches inventory type only after confirmation and imports images without codes", async () => {
  const confirm = jest.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
  render(<PlatformVouchersCreatePage />);
  selectImported();
  fireEvent.change(screen.getByLabelText("Paste codes (one per line)"), { target: { value: "001" } });
  const selector = screen.getByLabelText("Inventory type");
  fireEvent.change(selector, { target: { value: "image" } });
  expect(selector).toHaveValue("code");
  expect(screen.getByText('"001"')).toBeInTheDocument();
  fireEvent.change(selector, { target: { value: "image" } });
  expect(confirm).toHaveBeenCalledTimes(2);
  expect(screen.queryByLabelText("Paste codes (one per line)")).not.toBeInTheDocument();
  const images = [new File(["a"], "first.png", { type: "image/png" })];
  fireEvent.change(screen.getByLabelText("Select inventory images"), { target: { files: images } });
  submit();
  await waitFor(() => expect(ApiService.importAdminVoucher).toHaveBeenCalledWith("saved-id", expect.objectContaining({ codes: [], images })));
});

test.each(["code", "image"])("locks existing inventory type to %s", async (kind) => {
  mockParams = { voucherId: "existing-id" };
  ApiService.getAdminVoucher.mockResolvedValue({ success: true, data: { voucherType: "imported", totalNumber: 1, importKind: kind } });
  render(<PlatformVouchersCreatePage />);
  const selector = await screen.findByLabelText("Inventory type");
  expect(selector).toHaveValue(kind);
  expect(selector).toBeDisabled();
  expect(screen.queryByLabelText(kind === "code" ? "Select inventory images" : "Paste codes (one per line)")).not.toBeInTheDocument();
});

test.each([false, true])("failed import persists saved ID and same retry key even after remount (throw=%s)", async (throws) => {
  if (throws) ApiService.importAdminVoucher.mockRejectedValueOnce(new Error("Import unavailable"));
  else ApiService.importAdminVoucher.mockResolvedValueOnce({ success: false, message: "Import unavailable" });
  const { unmount } = render(<PlatformVouchersCreatePage />);
  selectImported();
  fireEvent.change(screen.getByLabelText("Paste codes (one per line)"), { target: { value: "0001" } });
  submit();
  await screen.findByText("Import unavailable");
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/platform-vouchers/saved-id/edit", expect.objectContaining({ replace: true })));
  const retryNavigation = mockNavigate.mock.calls.filter(([path]) => path.endsWith("/edit")).pop();
  unmount();
  mockParams = { voucherId: "saved-id" };
  mockLocation = { state: retryNavigation[1].state };
  render(<PlatformVouchersCreatePage />);
  expect(screen.getByText("Import unavailable")).toBeInTheDocument();
  expect(screen.getByLabelText("Merchant")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Choose file for Merchant Icon" })).toBeDisabled();
  submit();
  await waitFor(() => expect(ApiService.importAdminVoucher).toHaveBeenCalledTimes(2));
  expect(ApiService.importAdminVoucher.mock.calls[0]).toEqual(ApiService.importAdminVoucher.mock.calls[1]);
  expect(ApiService.createAdminVoucher).toHaveBeenCalledTimes(1);
  expect(ApiService.updateAdminVoucher).not.toHaveBeenCalled();
  expect(screen.queryByText("Import unavailable")).not.toBeInTheDocument();
});

test("invalid and empty imports do not create a voucher", async () => {
  render(<PlatformVouchersCreatePage />);
  selectImported();
  submit();
  await screen.findByText(en.voucherAdminPage.importEmpty);
  fireEvent.change(screen.getByLabelText("Paste codes (one per line)"), { target: { value: "001\n001" } });
  submit();
  await waitFor(() => expect(ApiService.createAdminVoucher).not.toHaveBeenCalled());
  expect(screen.getAllByText(en.voucherAdminPage.importDuplicateCodes).length).toBeGreaterThan(0);
});

test.each(["a".repeat(513), "中".repeat(171), "😀".repeat(129)])("oversized pasted codes prevent creation", async (code) => {
  render(<PlatformVouchersCreatePage />);
  selectImported();
  fireEvent.change(screen.getByLabelText("Paste codes (one per line)"), { target: { value: code } });
  submit();
  await waitFor(() => expect(screen.getAllByText(en.voucherAdminPage.importCodeSize).length).toBeGreaterThan(0));
  expect(ApiService.createAdminVoucher).not.toHaveBeenCalled();
  expect(ApiService.importAdminVoucher).not.toHaveBeenCalled();
});

test("oversized quoted CSV code prevents creation without trimming spaces", async () => {
  render(<PlatformVouchersCreatePage />);
  selectImported();
  fireEvent.change(screen.getByLabelText("Code source"), { target: { value: "csv" } });
  const file = new File([], "codes.csv", { type: "text/csv" });
  file.text = jest.fn().mockResolvedValue(`" ${"0".repeat(511)} "`);
  fireEvent.change(screen.getByLabelText("Upload codes CSV"), { target: { files: [file] } });
  await screen.findByText(en.voucherAdminPage.importCodeSize);
  submit();
  expect(ApiService.createAdminVoucher).not.toHaveBeenCalled();
});

test("uncertain import stays locked and keeps its key when discard is cancelled", async () => {
  ApiService.importAdminVoucher.mockRejectedValueOnce(new Error("Network unavailable"));
  jest.spyOn(window, "confirm").mockReturnValue(false);
  render(<PlatformVouchersCreatePage />);
  selectImported();
  fireEvent.change(screen.getByLabelText("Paste codes (one per line)"), { target: { value: "0001" } });
  submit();
  await screen.findByText("Network unavailable");
  fireEvent.click(screen.getByRole("button", { name: "Discard retry batch" }));
  expect(screen.getByLabelText("Paste codes (one per line)")).toBeDisabled();
  submit();
  await waitFor(() => expect(ApiService.importAdminVoucher).toHaveBeenCalledTimes(2));
  expect(ApiService.importAdminVoucher.mock.calls[0]).toEqual(ApiService.importAdminVoucher.mock.calls[1]);
  expect(ApiService.createAdminVoucher).toHaveBeenCalledTimes(1);
});

test("confirmed definitive rejection permits a corrected batch on the saved voucher with a fresh key", async () => {
  ApiService.importAdminVoucher.mockResolvedValueOnce({ success: false, message: "Duplicate code" });
  ApiService.getAdminVoucher.mockResolvedValue({ success: true, data: { voucherType: "imported", totalNumber: 0 } });
  global.crypto.randomUUID.mockReturnValueOnce("rejected-key").mockReturnValueOnce("corrected-key");
  jest.spyOn(window, "confirm").mockReturnValue(true);
  const { rerender } = render(<PlatformVouchersCreatePage />);
  selectImported();
  fireEvent.change(screen.getByLabelText("Paste codes (one per line)"), { target: { value: "duplicate" } });
  submit();
  await screen.findByText("Duplicate code");
  mockParams = { voucherId: "saved-id" };
  mockLocation = { state: mockNavigate.mock.calls.filter(([path]) => path.endsWith("/edit")).pop()[1].state };
  rerender(<PlatformVouchersCreatePage />);
  fireEvent.click(screen.getByRole("button", { name: "Discard retry batch" }));
  mockLocation = { state: null };
  rerender(<PlatformVouchersCreatePage />);
  await screen.findByText("Append inventory");
  fireEvent.change(screen.getByLabelText("Paste codes (one per line)"), { target: { value: "corrected" } });
  submit();
  await waitFor(() => expect(ApiService.importAdminVoucher).toHaveBeenCalledTimes(2));
  expect(ApiService.importAdminVoucher.mock.calls[1]).toEqual(["saved-id", expect.objectContaining({ codes: ["corrected"], importKey: "corrected-key" })]);
  expect(ApiService.createAdminVoucher).toHaveBeenCalledTimes(1);
});

test.each(["static", "numbered"])("edit excludes imported conversion but preserves original choices (%s)", async (type) => {
  mockParams = { voucherId: "existing-id" };
  ApiService.getAdminVoucher.mockResolvedValue({ success: true, data: { voucherType: type, totalNumber: 3 } });
  render(<PlatformVouchersCreatePage />);
  const selector = await screen.findByLabelText("Voucher Type");
  expect(selector).not.toBeDisabled();
  expect(screen.queryByRole("option", { name: "Imported Voucher" })).not.toBeInTheDocument();
  fireEvent.change(selector, { target: { value: type === "static" ? "numbered" : "static" } });
  expect(selector).toHaveValue(type === "static" ? "numbered" : "static");
});

test("existing imported voucher type is locked", async () => {
  mockParams = { voucherId: "existing-id" };
  ApiService.getAdminVoucher.mockResolvedValue({ success: true, data: { voucherType: "imported", totalNumber: 3 } });
  render(<PlatformVouchersCreatePage />);
  const selector = await screen.findByLabelText("Voucher Type");
  expect(selector).toBeDisabled();
  fireEvent.change(selector, { target: { value: "static" } });
  expect(selector).toHaveValue("imported");
});

test("edit appends inventory without setting server-controlled quantity", async () => {
  mockParams = { voucherId: "existing-id" };
  ApiService.getAdminVoucher.mockResolvedValue({ success: true, data: { voucherType: "imported", totalNumber: 42 } });
  render(<PlatformVouchersCreatePage />);
  await screen.findByText("Append inventory");
  fireEvent.change(screen.getByLabelText("Paste codes (one per line)"), { target: { value: "0007" } });
  submit();
  await waitFor(() => expect(ApiService.importAdminVoucher).toHaveBeenCalledTimes(1));
  const payload = ApiService.updateAdminVoucher.mock.calls[0][1];
  expect(payload.voucherType).toBe("imported");
  expect(payload).not.toHaveProperty("totalNumber");
  expect(ApiService.createAdminVoucher).not.toHaveBeenCalled();
  expect(ApiService.importAdminVoucher.mock.calls[0][0]).toBe("existing-id");
});

test("CSV upload honors explicit header and quoted cells without losing zeros", async () => {
  render(<PlatformVouchersCreatePage />);
  selectImported();
  fireEvent.change(screen.getByLabelText("Code source"), { target: { value: "csv" } });
  fireEvent.click(screen.getByLabelText("First nonblank row is a code header"));
  const file = new File([], "codes.csv", { type: "text/csv" });
  file.text = jest.fn().mockResolvedValue('code\r\n00123\r\n"a,b"\r\n"a""b"');
  fireEvent.change(screen.getByLabelText("Upload codes CSV"), { target: { files: [file] } });
  await screen.findByText('"00123"');
  submit();
  await waitFor(() => expect(ApiService.importAdminVoucher).toHaveBeenCalledTimes(1));
  expect(ApiService.importAdminVoucher.mock.calls[0][1].codes).toEqual(["00123", "a,b", 'a"b']);
});

test("does not create a voucher while the CSV is still being read", async () => {
  render(<PlatformVouchersCreatePage />);
  selectImported();
  fireEvent.change(screen.getByLabelText("Code source"), { target: { value: "csv" } });
  const file = new File([], "codes.csv", { type: "text/csv" });
  file.text = jest.fn(() => new Promise(() => {}));
  fireEvent.change(screen.getByLabelText("Upload codes CSV"), { target: { files: [file] } });
  submit();
  await waitFor(() => expect(screen.getAllByText(en.voucherAdminPage.csvReading).length).toBeGreaterThan(0));
  expect(ApiService.createAdminVoucher).not.toHaveBeenCalled();
});

test("edit may save metadata without importing any inventory", async () => {
  mockParams = { voucherId: "existing-id" };
  ApiService.getAdminVoucher.mockResolvedValue({ success: true, data: { voucherType: "imported", totalNumber: 42 } });
  render(<PlatformVouchersCreatePage />);
  await screen.findByText("Append inventory");
  submit();
  await waitFor(() => expect(ApiService.updateAdminVoucher).toHaveBeenCalledTimes(1));
  expect(ApiService.importAdminVoucher).not.toHaveBeenCalled();
});

test.each(["static", "numbered"])("existing %s creation still submits its original stock fields", async (type) => {
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
  expect(ApiService.importAdminVoucher).not.toHaveBeenCalled();
});
