import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "react-toastify";
import ApiService from "../../services/ApiService";
import ResetPasswordForm from "./ResetPasswordForm";

jest.mock("react-toastify", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));
jest.mock("../../services/ApiService", () => ({
  __esModule: true,
  default: {
    changeStaffPassword: jest.fn(),
    requestStaffPasswordReset: jest.fn(),
    resetStaffPassword: jest.fn(),
  },
}));

const t = (key) => key;
const fillPasswords = (confirmation = "new-password") => {
  fireEvent.change(screen.getByLabelText("login.newPassword"), {
    target: { value: "new-password" },
  });
  fireEvent.change(screen.getByLabelText("login.confirmPassword"), {
    target: { value: confirmation },
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  Object.values(ApiService).forEach((method) =>
    method.mockResolvedValue({ success: true }),
  );
});

test("profile resets directly without email or OTP", async () => {
  const onSuccess = jest.fn();
  render(<ResetPasswordForm t={t} authenticated onSuccess={onSuccess} />);
  expect(screen.queryByLabelText("login.email")).toBeNull();
  expect(screen.queryByLabelText("login.resetCode")).toBeNull();
  expect(screen.getByLabelText("login.newPassword")).toHaveFocus();
  fillPasswords();
  fireEvent.click(screen.getByRole("button", { name: "login.resetPassword" }));
  await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  expect(ApiService.changeStaffPassword).toHaveBeenCalledWith("new-password");
  expect(ApiService.requestStaffPasswordReset).not.toHaveBeenCalled();
  expect(ApiService.resetStaffPassword).not.toHaveBeenCalled();
});

test("profile reset rejects mismatched passwords", async () => {
  const onSuccess = jest.fn();
  render(<ResetPasswordForm t={t} authenticated onSuccess={onSuccess} />);
  fillPasswords("different-password");
  fireEvent.click(screen.getByRole("button", { name: "login.resetPassword" }));
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith("login.passwordsDoNotMatch"),
  );
  expect(ApiService.changeStaffPassword).not.toHaveBeenCalled();
  expect(onSuccess).not.toHaveBeenCalled();
});

test("failed authenticated reset does not complete the flow", async () => {
  ApiService.changeStaffPassword.mockRejectedValue(new Error("Session expired"));
  const onSuccess = jest.fn();
  render(<ResetPasswordForm t={t} authenticated onSuccess={onSuccess} />);
  fillPasswords();
  fireEvent.click(screen.getByRole("button", { name: "login.resetPassword" }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Session expired"));
  expect(onSuccess).not.toHaveBeenCalled();
  expect(screen.getByRole("button")).not.toBeDisabled();
});

test("logged-out reset still requests an email code", async () => {
  const onCodeSent = jest.fn();
  render(<ResetPasswordForm t={t} onCodeSent={onCodeSent} />);
  expect(screen.queryByLabelText("login.newPassword")).toBeNull();
  fireEvent.change(screen.getByLabelText("login.email"), {
    target: { value: "staff@example.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: "login.sendResetCode" }));
  await waitFor(() => expect(onCodeSent).toHaveBeenCalledTimes(1));
  expect(ApiService.requestStaffPasswordReset).toHaveBeenCalledWith("staff@example.com");
  expect(ApiService.changeStaffPassword).not.toHaveBeenCalled();
});

test("logged-out password submission still includes email and OTP", async () => {
  const onSuccess = jest.fn();
  render(<ResetPasswordForm t={t} showResetFields onSuccess={onSuccess} />);
  fireEvent.change(screen.getByLabelText("login.email"), {
    target: { value: "staff@example.com" },
  });
  fireEvent.change(screen.getByLabelText("login.resetCode"), {
    target: { value: "123456" },
  });
  fillPasswords();
  fireEvent.click(screen.getByRole("button", { name: "login.resetPassword" }));
  await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  expect(ApiService.resetStaffPassword).toHaveBeenCalledWith(
    "staff@example.com", "123456", "new-password",
  );
  expect(ApiService.changeStaffPassword).not.toHaveBeenCalled();
});