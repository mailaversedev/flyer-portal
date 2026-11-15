import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import CouponBuilder from "../src/components/Flyer/CouponBuilder";
import ApiService from "../src/services/ApiService";
import { uploadFlyerCoupons } from "../src/utils/FlyerCouponUpload";

jest.mock("react-i18next", () => {
  const t = (key, options) => options?.number ? `${key} ${options.number}` : key;
  return { useTranslation: () => ({ t }) };
});
jest.mock("../src/utils/AuthUtil", () => ({ isSuperAdmin: () => true }));
jest.mock("../src/services/ApiService", () => ({
  __esModule: true,
  default: { uploadFilesFromData: jest.fn() },
}));

function Editor() {
  const [data, setData] = useState({});
  return <>
    <CouponBuilder multiple data={data} onUpdate={(update) => setData((old) => ({ ...old, ...update }))} />
    <output data-testid="data">{JSON.stringify(data)}</output>
  </>;
}

test("adds, edits, reorders and limits coupons", () => {
  render(<Editor />);
  fireEvent.change(screen.getByLabelText("couponBuilder.selectCoupon"), { target: { value: "0" } });
  const type = screen.getAllByRole("combobox")[2];
  fireEvent.change(type, { target: { value: "free" } });
  fireEvent.click(screen.getByText("couponBuilder.addCoupon"));
  fireEvent.change(screen.getAllByRole("combobox")[2], { target: { value: "fixed" } });
  fireEvent.click(screen.getByText("couponBuilder.moveUp"));
  let data = JSON.parse(screen.getByTestId("data").textContent);
  expect(data.coupons.map((coupon) => coupon.couponType)).toEqual(["fixed", "free"]);
  expect(data.coupon.couponType).toBe("fixed");
  fireEvent.click(screen.getByText("couponBuilder.addCoupon"));
  fireEvent.click(screen.getByText("couponBuilder.addCoupon"));
  fireEvent.click(screen.getByText("couponBuilder.addCoupon"));
  expect(screen.getByText("couponBuilder.addCoupon").disabled).toBe(true);
  fireEvent.click(screen.getByText("couponBuilder.removeCoupon"));
  data = JSON.parse(screen.getByTestId("data").textContent);
  expect(data.coupons).toHaveLength(4);
});

test("uploads each coupon independently and rejects incomplete multi-coupon drafts", async () => {
  ApiService.uploadFilesFromData.mockImplementation(async ({ couponFile }) => ({
    couponFile: `uploaded-${couponFile}`,
  }));
  const coupons = await uploadFlyerCoupons({
    coupons: [{ couponType: "fixed", couponFile: "one" }, { couponType: "free", couponFile: "two" }],
  }, (key) => key);
  expect(coupons.map((coupon) => coupon.couponFile)).toEqual(["uploaded-one", "uploaded-two"]);
  await expect(uploadFlyerCoupons({ coupons: [{ couponType: "free" }, {}] }, (key) => key))
    .rejects.toThrow("couponBuilder.selectEveryCouponType");
});
