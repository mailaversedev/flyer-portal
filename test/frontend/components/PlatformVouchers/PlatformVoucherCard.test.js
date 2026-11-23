import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { PlatformVoucherCard } from "../../../../src/components/PlatformVouchers/PlatformVoucherCard";

test("renders delete action on image-backed vouchers without opening the card", () => {
  const onDelete = jest.fn();
  const onOpen = jest.fn();
  const voucher = {
    id: "voucher-1",
    merchant: "Example merchant",
    voucherImage: "https://example.com/voucher.png",
  };
  const translate = (key) => (key === "adminPage.deleteFlyer" ? "Delete" : key);

  render(
    <PlatformVoucherCard
      t={translate}
      value={voucher}
      onDelete={onDelete}
      onOpen={onOpen}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Delete" }));

  expect(onDelete).toHaveBeenCalledWith(voucher);
  expect(onOpen).not.toHaveBeenCalled();
});
