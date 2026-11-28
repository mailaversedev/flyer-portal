import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import TargetBudget from "../../src/components/Flyer/TargetBudget";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key) => key, i18n: { language: "en" } }),
}));
jest.mock("../../src/utils/AuthUtil", () => ({ isSuperAdmin: () => true }));
jest.mock("../../src/services/ApiService", () => ({
  __esModule: true,
  default: {
    getDistricts: async () => ({ success: false }),
    getCurrentCompany: () => null,
  },
}));
jest.mock("../../src/components/Flyer/FlyerPreview", () => () => null);

test("event rewards toggle enables a platform-funded budget and QR confirmation", async () => {
  function Form() {
    const [data, setData] = useState({
      timezone: "UTC", confirmationRequired: false,
      targetBudget: { noReward: true },
    });
    return <>
      <TargetBudget data={data} onUpdate={setData} isEvent />
      <output data-testid="data">{JSON.stringify(data)}</output>
    </>;
  }
  render(<Form />);
  expect(screen.queryByText("targetBudget.budgetHkd")).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText("eventCreation.enableRewards"));
  expect(screen.getByText("targetBudget.budgetHkd")).toBeInTheDocument();
  expect(screen.queryByText("targetBudget.payment")).not.toBeInTheDocument();
  const data = JSON.parse(screen.getByTestId("data").textContent);
  expect(data.eventRewardsEnabled).toBe(true);
  expect(data.confirmationRequired).toBe(true);
  expect(data.targetBudget.budget).toBe(500);
});
