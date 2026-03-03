import React, { useState, useEffect } from "react";
import ApiService from "../../services/ApiService";
import "./Profile.css";

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

const Profile = () => {
  const [companyName, setCompanyName] = useState("");
  const [companyNature, setCompanyNature] = useState("");
  const [address, setAddress] = useState("");
  const [contact, setContact] = useState("");
  const [companyIconFile, setCompanyIconFile] = useState(null);
  const [currentIcon, setCurrentIcon] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    // Load existing local storage company data
    const storedCompany = localStorage.getItem("company");
    if (storedCompany) {
      try {
        const parsedCompany = JSON.parse(storedCompany);
        setCompanyName(parsedCompany.name || "");
        setCompanyNature(parsedCompany.nature || "");
        setAddress(parsedCompany.address || "");
        setContact(parsedCompany.contact || "");
        setCurrentIcon(parsedCompany.icon || "");
      } catch (e) {
        console.error("Failed to parse company info", e);
      }
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      let companyIconUrl = currentIcon;
      if (companyIconFile) {
        // Upload new icon file using ApiService
        const uploadResponse = await ApiService.uploadFile(
          companyIconFile,
          "companyIcon",
        );
        if (uploadResponse.success) {
          companyIconUrl = uploadResponse.url;
        } else {
          throw new Error("Failed to upload company icon");
        }
      }

      // Update API request
      const response = await ApiService.updateCompanyProfile({
        name: companyName,
        nature: companyNature,
        address: address,
        contact: contact,
        icon: companyIconUrl,
      });

      if (response.success) {
        setSuccess("Profile updated successfully!");

        // Update local storage and ApiService
        const updatedCompany = {
          ...JSON.parse(localStorage.getItem("company")),
          name: companyName,
          nature: companyNature,
          address: address,
          contact: contact,
          icon: companyIconUrl,
        };
        localStorage.setItem("company", JSON.stringify(updatedCompany));
        ApiService.setCurrentCompany(updatedCompany);
        setCurrentIcon(companyIconUrl);

        // Optional UI reload to update header instantly
        window.dispatchEvent(new Event("storage"));
      } else {
        throw new Error(response.message || "Failed to update profile");
      }
    } catch (err) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-container">
      <div className="profile-card">
        <h2>Company Profile</h2>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="error-message success-message">{success}</div>}

        <form onSubmit={handleSubmit} className="profile-form">
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
            {currentIcon && !companyIconFile && (
              <div className="current-icon">
                <img 
                  src={currentIcon} 
                  alt="Current Company Icon" 
                  style={{ width: "60px", height: "60px", borderRadius: "8px", objectFit: "cover", display: "block" }} 
                />
              </div>
            )}
            <input
              type="file"
              id="companyIcon"
              accept="image/*"
              onChange={(e) => setCompanyIconFile(e.target.files[0])}
            />
          </div>

          <div className="form-group">
            <label htmlFor="address">Address</label>
            <input
              type="text"
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Company Address"
            />
          </div>

          <div className="form-group">
            <label htmlFor="contact">Contact</label>
            <input
              type="text"
              id="contact"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Contact Number"
            />
          </div>

          <button type="submit" className="save-button" disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Profile;