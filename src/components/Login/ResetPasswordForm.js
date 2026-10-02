import React, { useState } from "react";
import { toast } from "react-toastify";
import ApiService from "../../services/ApiService";

const ResetPasswordForm = ({
  t,
  showResetFields,
  authenticated = false,
  onCodeSent,
  onSuccess,
  className,
}) => {
  const [email, setEmail] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const showPasswordFields = authenticated || showResetFields;

  const handleSubmit = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    setLoading(true);
    try {
      if (showPasswordFields) {
        if (newPassword !== confirmPassword) {
          throw new Error(t("login.passwordsDoNotMatch"));
        }
        const response = authenticated
          ? await ApiService.changeStaffPassword(newPassword)
          : await ApiService.resetStaffPassword(email, resetOtp, newPassword);
        if (!response.success) throw new Error(response.message || t("login.passwordResetFailed"));
        toast.success(response.message || t("login.passwordResetSuccess"));
        onSuccess();
      } else {
        const response = await ApiService.requestStaffPasswordReset(email);
        if (!response.success) throw new Error(response.message || t("login.passwordResetRequestFailed"));
        toast.success(response.message || t("login.passwordResetCodeSent"));
        onCodeSent();
      }
    } catch (error) {
      toast.error(error.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={className}>
      {!authenticated && (
        <div className="form-group">
          <label htmlFor="reset-email">{t("login.email")}</label>
          <input
            type="email"
            id="reset-email"
            autoFocus
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t("login.enterEmail")}
            required
          />
        </div>
      )}
      {showPasswordFields && (
        <>
          {!authenticated && (
            <div className="form-group">
              <label htmlFor="reset-otp">{t("login.resetCode")}</label>
              <input
                id="reset-otp"
                value={resetOtp}
                onChange={(event) => setResetOtp(event.target.value)}
                inputMode="numeric"
                required
              />
            </div>
          )}
          <div className="form-group">
            <label htmlFor="new-password">{t("login.newPassword")}</label>
            <input
              type="password"
              id="new-password"
              autoFocus={authenticated}
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={6}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="confirm-password">
              {t("login.confirmPassword")}
            </label>
            <input
              type="password"
              id="confirm-password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={6}
              required
            />
          </div>
        </>
      )}
      <button type="submit" className="login-button" disabled={loading}>
        {loading
          ? showPasswordFields
            ? t("login.resettingPassword")
            : t("login.sendResetCode")
          : showPasswordFields
            ? t("login.resetPassword")
            : t("login.sendResetCode")}
      </button>
    </form>
  );
};

export default ResetPasswordForm;
