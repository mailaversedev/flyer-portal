import React from "react";
import { render, screen, within } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router";
import i18n from "../../src/i18n";
import ApiService from "../../src/services/ApiService";
import PlatformAdminVoucherRedemptionsPage from "../../src/pages/PlatformAdmin/PlatformAdminVoucherRedemptionsPage";

describe("platform admin voucher redemptions", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
  });

  test("uses the shared scrollable table layout and displays voucher data", async () => {
    localStorage.setItem("user", JSON.stringify({ role: "super-admin" }));
    jest.spyOn(ApiService, "getAdminVoucherRedemptions").mockResolvedValue({
      success: true,
      data: [{
        id: "redemption-1",
        user: { username: "Iris", email: "iris@example.com" },
        assignedVoucherNumber: "G3001174591",
        voucher: { merchant: "Venchi", value: 65, cost: 3250 },
        redemptionStatus: "PENDING",
      }],
      nextCursor: null,
    });

    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <PlatformAdminVoucherRedemptionsPage />
        </MemoryRouter>
      </I18nextProvider>,
    );

    expect(await screen.findByText("Iris")).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(table).toHaveClass("campaigns-table", "platform-admin-voucher-redemptions-table");
    expect(table.parentElement).toHaveClass("table-container");
    expect(table.closest("section")).toHaveClass("campaign-table");
    expect(within(table).getByRole("columnheader", { name: /assigned voucher number/i })).toBeInTheDocument();
    expect(within(table).getByText("G3001174591")).toBeInTheDocument();
    expect(within(table).getByText("Venchi")).toBeInTheDocument();
  });
});
