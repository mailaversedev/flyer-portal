import React, { useState } from "react";
import { useNavigate } from "react-router";
import ApiService from "../../services/ApiService";
import "./StaffLogin.css";

const COMPANY_INDUSTRIES = [
  "F&B",
  "Lifestyle",
  "Entertainment",
  "Banking & Finance",
  "Household",
  "Real Estate",
  "Education",
  "Government Bodies",
  "Utilities",
  "Donation",
  "Travelling",
  "Healthcare",
  "Fitness & Sports",
];

const StaffLogin = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyNature, setCompanyNature] = useState("");
  const [companyIconFile, setCompanyIconFile] = useState(null);
  const [address, setAddress] = useState("");
  const [contact, setContact] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      let response;
      if (isRegistering) {
        let companyIconUrl = "";
        if (companyIconFile) {
          try {
            const uploadResponse = await ApiService.uploadFile(
              companyIconFile,
              "companyIcon"
            );
            if (uploadResponse.success) {
              companyIconUrl = uploadResponse.url;
            } else {
              throw new Error("Failed to upload company icon");
            }
          } catch (uploadError) {
            setError("Failed to upload company icon: " + uploadError.message);
            setLoading(false);
            return;
          }
        }

        response = await ApiService.registerStaff({
          username,
          password,
          displayName,
          companyName,
          companyNature,
          companyIcon: companyIconUrl,
          address,
          contact,
          role: "admin", // Default role for self-onboarding
        });
      } else {
        response = await ApiService.loginStaff(username, password);
      }

      if (response.success) {
        if (isRegistering) {
          setIsRegistering(false);
          setError("Registration successful! Please login.");
          setPassword("");
        } else {
          // Login success
          localStorage.setItem("token", response.data.token);
          localStorage.setItem("user", JSON.stringify(response.data.user));

          if (response.data.company) {
            localStorage.setItem(
              "company",
              JSON.stringify(response.data.company)
            );
            ApiService.setCurrentCompany(response.data.company);
          }

          navigate("/dashboard");
        }
      } else {
        setError(
          response.message ||
            (isRegistering ? "Registration failed" : "Login failed")
        );
      }
    } catch (err) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsRegistering(!isRegistering);
    setError("");
  };

  return (
    <div className="staff-login-container">
      <div className="login-card">
        <h2>{isRegistering ? "Company Onboarding" : "Staff Portal Login"}</h2>

        {error && (
          <div
            className={`error-message ${
              error.includes("successful") ? "success-message" : ""
            }`}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>

          {isRegistering && (
            <>
              <div className="form-group">
                <label htmlFor="displayName">Display Name</label>
                <input
                  type="text"
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your full name"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="companyName">Company Name</label>
                <input
                  type="text"
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Company Name"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="companyNature">Company Nature / Industry</label>
                <select
                  id="companyNature"
                  value={companyNature}
                  onChange={(e) => setCompanyNature(e.target.value)}
                  required
                  className="form-control"
                  style={{ width: '100%', padding: '8px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ddd' }}
                >
                  <option value="">Select Industry...</option>
                  {COMPANY_INDUSTRIES.map((industry) => (
                    <option key={industry} value={industry}>
                      {industry}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="companyIcon">Company Icon</label>
                <input
                  type="file"
                  id="companyIcon"
                  accept="image/*"
                  onChange={(e) => setCompanyIconFile(e.target.files[0])}
                />
              </div>
              <div className="form-group">
                <label htmlFor="address">Address (Optional)</label>
                <input
                  type="text"
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Company Address"
                />
              </div>
              <div className="form-group">
                <label htmlFor="contact">Contact (Optional)</label>
                <input
                  type="text"
                  id="contact"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="Contact Number"
                />
              </div>
            </>
          )}

          <button type="submit" className="login-button" disabled={loading}>
            {loading
              ? isRegistering
                ? "Registering..."
                : "Logging in..."
              : isRegistering
              ? "Register Company"
              : "Login"}
          </button>

          <div className="toggle-container">
            <button
              type="button"
              className="toggle-button"
              onClick={toggleMode}
            >
              {isRegistering
                ? "Already have an account? Login"
                : "New Company? Onboard here"}
            </button>
          </div>
        </form>
      </div>

      {loading && (
        <div className="loading-indicator-overlay">
          <div className="loading-indicator-content">
            <div className="spinner" />
            <span className="loading-indicator-text">
              {isRegistering ? "Registering..." : "Logging in..."}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffLogin;
