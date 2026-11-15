import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ApiService from "../../services/ApiService";
import MerchantProducts from "./MerchantProducts";

jest.mock("react-i18next", () => {
  const t = (key) => key;
  return { useTranslation: () => ({ t }) };
});
jest.mock("react-toastify", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));
jest.mock("../../services/ApiService", () => ({
  __esModule: true,
  default: {
    getMerchantProducts: jest.fn(),
    createMerchantProduct: jest.fn(),
    updateMerchantProduct: jest.fn(),
    uploadFile: jest.fn(),
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
const photo = () => new File(["photo"], "photo.png", { type: "image/png" });
const imageInput = () => screen.getByLabelText("profilePage.productImage");

beforeEach(() => {
  jest.clearAllMocks();
  URL.createObjectURL = jest.fn(() => "blob:preview");
  URL.revokeObjectURL = jest.fn();
  ApiService.getMerchantProducts.mockResolvedValue({
    success: true,
    data: [existingProduct],
  });
  ApiService.createMerchantProduct.mockResolvedValue({ success: true });
  ApiService.updateMerchantProduct.mockResolvedValue({ success: true });
  ApiService.uploadFile.mockResolvedValue({
    success: true,
    url: "https://example.com/uploaded.png",
  });
});

async function renderProducts() {
  render(<MerchantProducts />);
  await screen.findByText("Coffee");
}

function fillProduct(name) {
  for (const [label, value] of [
    ["productName", name],
    ["productPrice", "10"],
    ["productUrl", "https://example.com/product"],
  ]) {
    fireEvent.change(screen.getByLabelText(`profilePage.${label}`), {
      target: { value },
    });
  }
}

test("saving resets the file input and allows uploading the same file for the next product", async () => {
  await renderProducts();
  const file = photo();
  for (const [index, name] of ["First", "Second"].entries()) {
    fillProduct(name);
    userEvent.upload(imageInput(), file);
    fireEvent.submit(screen.getByRole("form", { name: "profilePage.productsTitle" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "profilePage.productCreate" })).toBeEnabled();
    });
    expect(screen.getByLabelText("profilePage.productName")).toHaveValue("");
    expect(imageInput().value).toBe("");
    expect(imageInput().files).toHaveLength(0);
    expect(ApiService.uploadFile).toHaveBeenCalledTimes(index + 1);
    expect(ApiService.createMerchantProduct).toHaveBeenNthCalledWith(
      index + 1,
      expect.objectContaining({ name, image: "https://example.com/uploaded.png" }),
    );
  }
});

test("editing and cancelling clear file selection without discarding the saved image", async () => {
  await renderProducts();
  userEvent.upload(imageInput(), photo());
  fireEvent.click(screen.getByRole("button", { name: "profilePage.productEdit" }));
  expect(imageInput().value).toBe("");
  expect(imageInput().files).toHaveLength(0);
  expect(screen.getByAltText("profilePage.productImagePreview")).toHaveAttribute(
    "src",
    existingProduct.image,
  );
  userEvent.upload(imageInput(), photo());
  fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));
  expect(imageInput().value).toBe("");
  expect(imageInput().files).toHaveLength(0);
  expect(screen.queryByAltText("profilePage.productImagePreview")).not.toBeInTheDocument();
});

test("saving an edit without a new upload retains the saved image", async () => {
  await renderProducts();
  userEvent.upload(imageInput(), photo());
  fireEvent.click(screen.getByRole("button", { name: "profilePage.productEdit" }));
  fireEvent.submit(screen.getByRole("form", { name: "profilePage.productsTitle" }));
  await waitFor(() => expect(ApiService.updateMerchantProduct).toHaveBeenCalledWith(
    existingProduct.id,
    expect.objectContaining({ image: existingProduct.image }),
  ));
  await waitFor(() => expect(screen.getByRole("button", { name: "profilePage.productCreate" })).toBeEnabled());
  expect(ApiService.uploadFile).not.toHaveBeenCalled();
});
