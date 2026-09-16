import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import ApiService from "../../services/ApiService";
import i18n from "../../i18n";

const FALLBACK_HK_DISTRICTS = [
  "Central & Western",
  "Wan Chai",
  "Eastern",
  "Southern",
  "Yau Tsim Mong",
  "Sham Shui Po",
  "Kowloon City",
  "Wong Tai Sin",
  "Kwun Tong",
  "Tsuen Wan",
  "Tuen Mun",
  "Yuen Long",
  "North",
  "Tai Po",
  "Sai Kung",
  "Sha Tin",
  "Kwai Tsing",
  "Islands",
];

const RegistrationForm = ({ t, onSuccess }) => {
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    displayName: "",
    companyDisplayName: "",
    companyName: "",
    companyNature: "",
    district: "",
    companyIconFile: null,
    address: "",
    contact: "",
  });
  const [companyIndustries, setCompanyIndustries] = useState([]);
  const [districtOptions, setDistrictOptions] = useState([]);
  const [isLoadingIndustries, setIsLoadingIndustries] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [industries, districts] = await Promise.all([
          ApiService.getCompanyIndustries(),
          ApiService.getDistricts(),
        ]);
        setCompanyIndustries(
          industries.success && Array.isArray(industries.data)
            ? industries.data
            : [],
        );
        setDistrictOptions(
          districts.success &&
            Array.isArray(districts.data) &&
            districts.data.length
            ? districts.data
            : FALLBACK_HK_DISTRICTS,
        );
      } catch (error) {
        console.error("Failed to load registration options", error);
        setDistrictOptions(FALLBACK_HK_DISTRICTS);
      } finally {
        setIsLoadingIndustries(false);
      }
    };
    loadOptions();
  }, []);

  const update = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    setLoading(true);

    try {
      let companyIconUrl = "";
      if (form.companyIconFile) {
        const uploadResponse = await ApiService.uploadFile(
          form.companyIconFile,
          "companyIcon",
        );
        if (!uploadResponse.success) {
          throw new Error("Failed to upload company icon");
        }
        companyIconUrl = uploadResponse.url;
      }

      const response = await ApiService.registerStaff({
        ...form,
        companyIcon: companyIconUrl,
        role: "admin",
        locale: i18n.resolvedLanguage || "en",
      });
      if (!response.success) {
        throw new Error(response.message || t("login.registrationFailed"));
      }

      toast.success(response.message || t("login.registrationSuccess"));
      onSuccess();
    } catch (error) {
      toast.error(error.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="username">{t("login.username")}</label>
        <input
          id="username"
          value={form.username}
          onChange={update("username")}
          placeholder={t("login.enterUsername")}
          required
        />
      </div>
      <div className="form-group">
        <label htmlFor="password">{t("login.password")}</label>
        <input
          type="password"
          id="password"
          value={form.password}
          onChange={update("password")}
          placeholder={t("login.enterPassword")}
          required
        />
      </div>
      <div className="form-group">
        <label htmlFor="email">{t("login.email")}</label>
        <input
          type="email"
          id="email"
          value={form.email}
          onChange={update("email")}
          placeholder={t("login.enterEmail")}
          required
        />
      </div>
      <div className="form-group">
        <label htmlFor="displayName">{t("login.displayName")}</label>
        <input
          id="displayName"
          value={form.displayName}
          onChange={update("displayName")}
          placeholder={t("login.yourFullName")}
          required
        />
      </div>
      <div className="form-group">
        <label htmlFor="companyName">{t("login.companyName")}</label>
        <input
          id="companyName"
          value={form.companyName}
          onChange={update("companyName")}
          placeholder={t("login.companyNamePlaceholder")}
          required
        />
      </div>
      <div className="form-group">
        <label htmlFor="companyDisplayName">
          {t("login.companyDisplayName")}
        </label>
        <input
          id="companyDisplayName"
          value={form.companyDisplayName}
          onChange={update("companyDisplayName")}
          placeholder={t("login.companyDisplayNamePlaceholder")}
        />
      </div>
      <div className="form-group">
        <label htmlFor="companyNature">{t("login.companyNature")}</label>
        <select
          id="companyNature"
          value={form.companyNature}
          onChange={update("companyNature")}
          required
        >
          <option value="">
            {isLoadingIndustries
              ? t("login.loadingIndustries")
              : t("login.selectIndustry")}
          </option>
          {companyIndustries.map((industry) => (
            <option key={industry} value={industry}>
              {industry}
            </option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label htmlFor="companyIcon">{t("login.companyIcon")}</label>
        <input
          type="file"
          id="companyIcon"
          accept="image/png, image/jpeg"
          onChange={(event) => {
            const file = event.target.files[0];
            if (!file) return;
            if (!["image/png", "image/jpeg"].includes(file.type)) {
              toast.error("Only PNG and JPEG images are allowed.");
              event.target.value = null;
              return;
            }
            setForm((current) => ({ ...current, companyIconFile: file }));
          }}
        />
      </div>
      <div className="form-group">
        <label htmlFor="address">{t("login.addressOptional")}</label>
        <input
          id="address"
          value={form.address}
          onChange={update("address")}
          placeholder={t("login.companyAddressPlaceholder")}
        />
      </div>
      <div className="form-group">
        <label htmlFor="district">{t("login.districtOptional")}</label>
        <select
          id="district"
          value={form.district}
          onChange={update("district")}
        >
          <option value="">
            {t("qrGeneration.pleaseSelect") || t("login.selectDistrict")}
          </option>
          {districtOptions.map((district) => (
            <option key={district} value={district}>
              {district}
            </option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label htmlFor="contact">{t("login.contactOptional")}</label>
        <input
          id="contact"
          value={form.contact}
          onChange={update("contact")}
          placeholder={t("login.contactPlaceholder")}
        />
      </div>
      <button type="submit" className="login-button" disabled={loading}>
        {loading ? t("login.registering") : t("login.registerCompany")}
      </button>
    </form>
  );
};

export default RegistrationForm;
