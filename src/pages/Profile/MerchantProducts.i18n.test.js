import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { I18nextProvider } from "react-i18next";
import i18n from "../../i18n";
import ApiService from "../../services/ApiService";
import MerchantProducts, { MerchantProductForm } from "./MerchantProducts";

jest.mock("../../services/ApiService", () => ({
  __esModule: true,
  default: {
    getMerchantProducts: jest.fn(),
    getMerchantProduct: jest.fn(),
  },
}));

afterEach(async () => {
  await i18n.changeLanguage("en");
  jest.clearAllMocks();
});

test.each([
  ["en", "Cancel", "Loading..."],
  ["zh-HK", "取消", "載入中..."],
])("product pages translate cancel and loading in %s", async (locale, cancel, loading) => {
  await i18n.changeLanguage(locale);
  ApiService.getMerchantProducts.mockReturnValue(new Promise(() => {}));
  ApiService.getMerchantProduct.mockReturnValue(new Promise(() => {}));

  const renderPage = (path) => render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/profile/products" element={<MerchantProducts />} />
          <Route path="/profile/products/new" element={<MerchantProductForm />} />
          <Route path="/profile/products/:productId/edit" element={<MerchantProductForm />} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );

  const list = renderPage("/profile/products");
  expect(screen.getByText(loading)).toBeInTheDocument();
  list.unmount();

  const edit = renderPage("/profile/products/coffee/edit");
  expect(screen.getByText(loading)).toBeInTheDocument();
  edit.unmount();

  renderPage("/profile/products/new");
  expect(screen.getByRole("button", { name: cancel })).toBeInTheDocument();
});
