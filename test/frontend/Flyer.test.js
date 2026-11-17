import React from "react";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import Flyer from "../../src/pages/Flyer/Flyer";

jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key) => key }) }));
jest.mock("../../src/utils/AuthUtil", () => ({ isSuperAdmin: () => true }));

test("Read, Scan and Event share primary creation styling and secondary upload styling", () => {
  render(<MemoryRouter><Flyer /></MemoryRouter>);
  for (const title of ["flyerPage.leafletTitle", "flyerPage.qrTitle", "eventCreation.title"]) {
    const card = screen.getByRole("heading", { name: title }).closest(".flyer-distribution-card");
    expect(within(card).getByRole("button", { name: "flyerPage.leafletPrimary" }))
      .toHaveClass("primary");
    expect(within(card).getByRole("button", { name: "flyerPage.leafletSecondary" }))
      .toHaveClass("secondary");
  }
});
