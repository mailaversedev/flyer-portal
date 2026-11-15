import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { toast } from "react-toastify";
import ApiService from "../../../../src/services/ApiService";
import Profile from "../../../../src/pages/Profile/Profile";
import MerchantProducts, { MerchantProductForm } from "../../../../src/pages/Profile/MerchantProducts";

jest.mock("react-i18next", () => {
  const t = (key) => key;
  return { useTranslation: () => ({ t }), initReactI18next: { type: "3rdParty", init: () => {} } };
});
jest.mock("react-toastify", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));
jest.mock("../../../../src/services/ApiService", () => ({
  __esModule: true,
  default: {
    getMerchantProducts: jest.fn(),
    getMerchantProduct: jest.fn(),
    createMerchantProduct: jest.fn(),
    updateMerchantProduct: jest.fn(),
    uploadFile: jest.fn(),
    getCompanyIndustries: jest.fn(),
    getDistricts: jest.fn(),
  },
}));

const existingProduct = {
  id: "coffee",
  name: "Coffee",
  currency: "HKD",
  price: "28.50",
  active: true,
  url: "https://example.com/coffee",
  image: "https://example.com/coffee.jpg",
};

beforeEach(() => {
  jest.clearAllMocks();
  URL.createObjectURL = jest.fn(() => "blob:preview");
  URL.revokeObjectURL = jest.fn();
  ApiService.getMerchantProducts.mockResolvedValue({ success: true, data: [existingProduct] });
  ApiService.getMerchantProduct.mockResolvedValue({ success: true, data: existingProduct });
  ApiService.createMerchantProduct.mockResolvedValue({ success: true });
  ApiService.updateMerchantProduct.mockResolvedValue({ success: true });
  ApiService.uploadFile.mockResolvedValue({ success: true, url: "https://example.com/uploaded.png" });
  ApiService.getCompanyIndustries.mockResolvedValue({ success: true, data: [] });
  ApiService.getDistricts.mockResolvedValue({ success: true, data: [] });
});

function renderPage(path = "/profile/products") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/profile" element={<Profile />} />
        <Route path="/profile/products" element={<MerchantProducts />} />
        <Route path="/profile/products/new" element={<MerchantProductForm />} />
        <Route path="/profile/products/:productId/edit" element={<MerchantProductForm />} />
      </Routes>
    </MemoryRouter>,
  );
}

test("profile and products navigation shows the list by default", async () => {
  renderPage("/profile");
  expect(screen.getByLabelText("profilePage.companyName")).toBeInTheDocument();
  await screen.findByText("profilePage.selectIndustry");
  await screen.findByText("profilePage.selectDistrict");
  fireEvent.click(screen.getByRole("link", { name: "profilePage.productsTitle" }));
  expect(await screen.findByText("Coffee")).toBeInTheDocument();
  expect(screen.queryByLabelText("profilePage.companyName")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("profilePage.productName")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("link", { name: "profilePage.title" }));
  expect(screen.getByLabelText("profilePage.companyName")).toBeInTheDocument();
  await screen.findByText("profilePage.selectIndustry");
  await screen.findByText("profilePage.selectDistrict");
});

test("adding a product uploads its image and returns to the list", async () => {
  renderPage();
  await screen.findByText("Coffee");
  fireEvent.click(screen.getByRole("button", { name: "profilePage.productCreate" }));
  for (const [label, value] of [
    ["productName", "Tea"],
    ["productPrice", "10"],
    ["productUrl", "https://example.com/tea"],
  ]) {
    fireEvent.change(screen.getByLabelText(`profilePage.${label}`), { target: { value } });
  }
  userEvent.upload(screen.getByLabelText("profilePage.productImage"), new File(["photo"], "photo.png", { type: "image/png" }));
  fireEvent.submit(screen.getByRole("form", { name: "profilePage.productsTitle" }));
  await waitFor(() => expect(ApiService.createMerchantProduct).toHaveBeenCalledWith(
    expect.objectContaining({ name: "Tea", image: "https://example.com/uploaded.png" }),
  ));
  expect(await screen.findByText("Coffee")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "profilePage.productCreate" }));
  expect(screen.getByLabelText("profilePage.productName")).toHaveValue("");
  expect(screen.getByLabelText("profilePage.productImage").files).toHaveLength(0);
});

test("edit page loads directly, preserves the saved image, and returns to the list", async () => {
  renderPage("/profile/products/coffee/edit");
  expect(await screen.findByDisplayValue("Coffee")).toBeInTheDocument();
  expect(screen.getByAltText("profilePage.productImagePreview")).toHaveAttribute("src", existingProduct.image);
  fireEvent.submit(screen.getByRole("form", { name: "profilePage.productsTitle" }));
  await waitFor(() => expect(ApiService.updateMerchantProduct).toHaveBeenCalledWith(
    "coffee", expect.objectContaining({ image: existingProduct.image }),
  ));
  expect(ApiService.uploadFile).not.toHaveBeenCalled();
  expect(await screen.findByText("Coffee")).toBeInTheDocument();
});

test("edit navigation and cancel return to the product list", async () => {
  renderPage();
  await screen.findByText("Coffee");
  fireEvent.click(screen.getByRole("button", { name: "profilePage.productEdit" }));
  await screen.findByDisplayValue("Coffee");
  userEvent.upload(screen.getByLabelText("profilePage.productImage"), new File(["photo"], "photo.png", { type: "image/png" }));
  fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));
  expect(await screen.findByText("Coffee")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "profilePage.productEdit" }));
  await screen.findByDisplayValue("Coffee");
  expect(screen.getByLabelText("profilePage.productImage").files).toHaveLength(0);
  expect(screen.getByAltText("profilePage.productImagePreview")).toHaveAttribute("src", existingProduct.image);
});

test("a failed edit lookup displays an error and does not show a blank form", async () => {
  ApiService.getMerchantProduct.mockRejectedValue(new Error("Not found"));
  renderPage("/profile/products/missing/edit");
  expect(await screen.findByRole("alert")).toHaveTextContent("Not found");
  expect(screen.queryByLabelText("profilePage.productName")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));
  expect(await screen.findByText("Coffee")).toBeInTheDocument();
});

test("editing can replace the image and a failed save keeps the form", async () => {
  ApiService.updateMerchantProduct.mockRejectedValue(new Error("Save failed"));
  renderPage("/profile/products/coffee/edit");
  await screen.findByDisplayValue("Coffee");
  userEvent.upload(screen.getByLabelText("profilePage.productImage"), new File(["photo"], "new.png", { type: "image/png" }));
  fireEvent.submit(screen.getByRole("form", { name: "profilePage.productsTitle" }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Save failed"));
  expect(ApiService.updateMerchantProduct).toHaveBeenCalledWith(
    "coffee", expect.objectContaining({ image: "https://example.com/uploaded.png" }),
  );
  expect(screen.getByDisplayValue("Coffee")).toBeInTheDocument();
});

test("product list continues to load subsequent pages", async () => {
  ApiService.getMerchantProducts
    .mockResolvedValueOnce({ success: true, data: [existingProduct], pagination: { nextCursor: "coffee" } })
    .mockResolvedValueOnce({ success: true, data: [{ ...existingProduct, id: "tea", name: "Tea" }] });
  renderPage();
  await screen.findByText("Coffee");
  fireEvent.click(screen.getByRole("button", { name: "profilePage.productsLoadMore" }));
  expect(await screen.findByText("Tea")).toBeInTheDocument();
  expect(ApiService.getMerchantProducts).toHaveBeenLastCalledWith("coffee");
});
