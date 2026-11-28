import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "../../src/i18n";
import ApiService from "../../src/services/ApiService";
import KpayUatTest from "../../src/pages/PlatformAdmin/KpayUatTest";

afterEach(() => {
  jest.restoreAllMocks();
  sessionStorage.clear();
  window.history.replaceState({}, "", "/");
});

test("restores and refreshes the verified test order status", async () => {
  sessionStorage.setItem("kpayAdminUatPaymentId", "payment-1");
  const getOrder = jest.spyOn(ApiService, "getKpayOrder").mockResolvedValue({
    success: true,
    data: {
      purpose: "admin_uat", managedOutTradeNo: "KP123",
      status: "PAID", updatedAt: "2026-01-01T00:00:00Z",
    },
  });
  render(<I18nextProvider i18n={i18n}><KpayUatTest /></I18nextProvider>);
  expect(await screen.findByText(/KP123/)).toBeInTheDocument();
  expect(screen.getByText(/PAID/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /refresh status/i }));
  expect(getOrder).toHaveBeenCalledTimes(2);
});

test("shows order creation errors without claiming a successful transaction", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(ApiService, "createKpayOrder").mockRejectedValue(new Error("UAT unavailable"));
  Object.defineProperty(window, "crypto", { configurable: true, value: { randomUUID: () => "unique-id" } });
  render(<I18nextProvider i18n={i18n}><KpayUatTest /></I18nextProvider>);
  fireEvent.click(screen.getByRole("button", { name: /create kpay test transaction/i }));
  expect(await screen.findByRole("alert")).toHaveTextContent("UAT unavailable");
  expect(ApiService.createKpayOrder).toHaveBeenCalledWith(expect.objectContaining({
    purpose: "admin_uat", amount: 5, idempotencyKey: "unique-id",
  }));
  expect(sessionStorage.getItem("kpayAdminUatPaymentId")).toBeNull();
});
