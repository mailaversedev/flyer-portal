import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import CouponBuilder from "../../src/components/Flyer/CouponBuilder";
import ApiService from "../../src/services/ApiService";
import { uploadFlyerCoupons } from "../../src/utils/FlyerCouponUpload";

jest.mock("react-i18next", () => {
  const t = (key, options) => options?.number ? `${key} ${options.number}` : key;
  return { useTranslation: () => ({ t }) };
});
jest.mock("../../src/utils/AuthUtil", () => ({ isSuperAdmin: () => true }));
jest.mock("../../src/services/ApiService", () => ({
  __esModule: true,
  default: { uploadFilesFromData: jest.fn() },
}));

function Editor({ initialData = {} }) {
  const [data, setData] = useState(initialData);
  return <>
    <CouponBuilder multiple data={data} onUpdate={(update) => setData((old) => ({ ...old, ...update }))} />
    <output data-testid="data">{JSON.stringify(data)}</output>
  </>;
}

test("adds and selects coupons from the preview and enforces the limit", () => {
  render(<Editor />);
  const type = screen.getAllByRole("combobox")[1];
  fireEvent.change(type, { target: { value: "free" } });
  const add = screen.getByRole("button", { name: /couponBuilder.addCoupon/ });
  fireEvent.click(add);
  fireEvent.change(screen.getAllByRole("combobox")[1], { target: { value: "fixed" } });
  expect(screen.getByRole("button", { name: "couponBuilder.editCoupon 2" }).getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "couponBuilder.editCoupon 1" }));
  expect(screen.getAllByRole("combobox")[1].value).toBe("free");
  expect(screen.getByRole("button", { name: "couponBuilder.editCoupon 1" }).getAttribute("aria-pressed")).toBe("true");
  const data = JSON.parse(screen.getByTestId("data").textContent);
  expect(data.coupons.map((coupon) => coupon.couponType)).toEqual(["free", "fixed"]);
  expect(data.coupon.couponType).toBe("free");
  fireEvent.click(add);
  fireEvent.click(add);
  fireEvent.click(add);
  expect(add.disabled).toBe(true);
  expect(screen.queryByText("couponBuilder.moveUp")).toBeNull();
  expect(screen.queryByText("couponBuilder.moveDown")).toBeNull();
});

test("confirms removals, preserves selection and allows removing the last coupon", () => {
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(false);
  try {
    render(<Editor />);
    fireEvent.change(screen.getAllByRole("combobox")[1], { target: { value: "free" } });
    fireEvent.click(screen.getByRole("button", { name: /couponBuilder.addCoupon/ }));
    fireEvent.change(screen.getAllByRole("combobox")[1], { target: { value: "fixed" } });
    fireEvent.click(screen.getByRole("button", { name: "couponBuilder.removeCouponNumber 1" }));
    expect(confirm).toHaveBeenCalledWith("couponBuilder.removeConfirm 1");
    expect(JSON.parse(screen.getByTestId("data").textContent).coupons).toHaveLength(2);
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "couponBuilder.removeCouponNumber 1" }));
    let data = JSON.parse(screen.getByTestId("data").textContent);
    expect(data.coupons.map((coupon) => coupon.couponType)).toEqual(["fixed"]);
    expect(data.coupon.couponType).toBe("fixed");
    expect(screen.getAllByRole("combobox")[1].value).toBe("fixed");
    fireEvent.click(screen.getByRole("button", { name: "couponBuilder.removeCouponNumber 1" }));
    data = JSON.parse(screen.getByTestId("data").textContent);
    expect(data.coupons).toEqual([]);
    expect(data.coupon).toEqual({});
    expect(screen.getByText("couponBuilder.emptyMessage")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /couponBuilder.addCoupon/ }));
    expect(screen.getByRole("button", { name: "couponBuilder.editCoupon 1" })).toBeTruthy();
  } finally {
    confirm.mockRestore();
  }
});

test("custom coupon images appear in the preview without affecting selection", () => {
  render(<Editor initialData={{
    coupons: [
      { couponType: "free", couponFile: "https://example.com/coupon.png" },
      { couponType: "fixed", itemDescription: "Second offer" },
    ],
  }} />);
  expect(screen.getByAltText("couponBuilder.customPreview").getAttribute("src"))
    .toBe("https://example.com/coupon.png");
  fireEvent.click(screen.getByRole("button", { name: "couponBuilder.editCoupon 2" }));
  expect(screen.getByRole("button", { name: "couponBuilder.editCoupon 2" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByDisplayValue("Second offer")).toBeTruthy();
});

test("single-coupon builder keeps its existing preview without multi-coupon controls", () => {
  render(<CouponBuilder data={{ coupon: { couponType: "fixed", discountValue: "10" } }} onUpdate={() => {}} />);
  expect(screen.getByText("couponBuilder.mobileView")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /couponBuilder.addCoupon/ })).toBeNull();
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
