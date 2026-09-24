import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import ApiService from "../../services/ApiService";
import ResetPasswordForm from "../../components/Login/ResetPasswordForm";
import i18n, {
  applyLocale,
  clearPendingLocale,
  markPendingLocale,
  normalizeLocale,
} from "../../i18n";
import "./Profile.css";

const Profile = () => {
  const MAX_COMPANY_COVER_PHOTOS = 5;
  const { t } = useTranslation();
  const [companyName, setCompanyName] = useState("");
  const [companyNature, setCompanyNature] = useState("");
  const [district, setDistrict] = useState("");
  const [address, setAddress] = useState("");
  const [contact, setContact] = useState("");
  const [website, setWebsite] = useState("");
  const [introduction, setIntroduction] = useState("");
  const [companyIconFile, setCompanyIconFile] = useState(null);
  const [currentIcon, setCurrentIcon] = useState("");
  const [companyCoverFiles, setCompanyCoverFiles] = useState([]);
  const [companyCoverPreviewUrls, setCompanyCoverPreviewUrls] = useState([]);
  const [currentCoverPhotos, setCurrentCoverPhotos] = useState([]);
  const [companyIndustries, setCompanyIndustries] = useState([]);
  const [districtOptions, setDistrictOptions] = useState([]);
  const [isLoadingIndustries, setIsLoadingIndustries] = useState(true);
  const [isLoadingDistricts, setIsLoadingDistricts] = useState(true);
  const [locale, setLocale] = useState(
    normalizeLocale(localStorage.getItem("locale") || i18n.resolvedLanguage),
  );

  const [loading, setLoading] = useState(false);
  const [companyDisplayName, setCompanyDisplayName] = useState("");
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [showPasswordResetFields, setShowPasswordResetFields] = useState(false);
  const passwordResetTriggerRef = useRef(null);

  useEffect(() => {
    if (!showPasswordReset) return undefined;

    const previousOverflow = document.body.style.overflow;
    const triggerElement = passwordResetTriggerRef.current;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setShowPasswordReset(false);
        setShowPasswordResetFields(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      triggerElement?.focus();
    };
  }, [showPasswordReset]);

  useEffect(() => {
    if (companyCoverFiles.length === 0) {
      setCompanyCoverPreviewUrls([]);
      return undefined;
    }

    const previewUrls = companyCoverFiles.map((file) => URL.createObjectURL(file));
    setCompanyCoverPreviewUrls(previewUrls);

    return () => {
      previewUrls.forEach((previewUrl) => URL.revokeObjectURL(previewUrl));
    };
  }, [companyCoverFiles]);

  useEffect(() => {
    // Load existing local storage company data
    const storedCompany = localStorage.getItem("company");
    if (storedCompany) {
      try {
        const parsedCompany = JSON.parse(storedCompany);
        setCompanyName(parsedCompany.name || "");
        setCompanyNature(parsedCompany.nature || "");
        setDistrict(parsedCompany.district || "");
        setAddress(parsedCompany.address || "");
        setContact(parsedCompany.contact || "");
        setWebsite(parsedCompany.website || "");
        setIntroduction(parsedCompany.introduction || "");
        setCurrentIcon(parsedCompany.icon || "");
        setCurrentCoverPhotos(
          Array.isArray(parsedCompany.coverPhotos)
            ? parsedCompany.coverPhotos.slice(0, MAX_COMPANY_COVER_PHOTOS)
            : [],
        );
        setCompanyDisplayName(
          parsedCompany.companyDisplayName || parsedCompany.displayName || "",
        );
      } catch (e) {
        console.error("Failed to parse company info", e);
      }
    }

    try {
      const storedUser = JSON.parse(localStorage.getItem("user") || "null");
      if (storedUser?.locale) {
        setLocale(storedUser.locale);
      }
    } catch (e) {
      console.error("Failed to parse user info", e);
    }

    const fetchCompanyIndustries = async () => {
      setIsLoadingIndustries(true);
      try {
        const response = await ApiService.getCompanyIndustries();
        if (response.success && Array.isArray(response.data)) {
          setCompanyIndustries(response.data);
        } else {
          setCompanyIndustries([]);
        }
      } catch (fetchError) {
        console.error("Failed to fetch company industries", fetchError);
        setCompanyIndustries([]);
      } finally {
        setIsLoadingIndustries(false);
      }
    };

    const fetchDistricts = async () => {
      setIsLoadingDistricts(true);
      try {
        const response = await ApiService.getDistricts();
        if (response.success && Array.isArray(response.data)) {
          setDistrictOptions(response.data);
        } else {
          setDistrictOptions([]);
        }
      } catch (fetchError) {
        console.error("Failed to fetch districts", fetchError);
        setDistrictOptions([]);
      } finally {
        setIsLoadingDistricts(false);
      }
    };

    fetchCompanyIndustries();
    fetchDistricts();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      let companyIconUrl = currentIcon;
      let companyCoverPhotoUrls = currentCoverPhotos;
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

      if (companyCoverFiles.length > 0) {
        const uploadedCoverPhotos = await Promise.all(
          companyCoverFiles.map(async (file) => {
            const uploadResponse = await ApiService.uploadFile(
              file,
              "companyCoverPhoto",
            );
            if (!uploadResponse.success || !uploadResponse.url) {
              throw new Error("Failed to upload company cover photo");
            }
            return uploadResponse.url;
          }),
        );
        companyCoverPhotoUrls = uploadedCoverPhotos;
      }

      // Update API request
      const response = await ApiService.updateCompanyProfile({
        companyDisplayName: companyDisplayName.trim(),
        name: companyName,
        nature: companyNature,
        district,
        address: address,
        contact: contact,
        icon: companyIconUrl,
        website: website.trim(),
        introduction: introduction.trim(),
        coverPhotos: companyCoverPhotoUrls,
      });

      markPendingLocale(locale);
      await ApiService.updateStaffProfile({ locale });

      if (response.success) {
        toast.success(t("profilePage.profileUpdated"));

        // Update local storage and ApiService
        const storedCompany = JSON.parse(localStorage.getItem("company") || "{}");
        const updatedCompany = {
          ...storedCompany,
          companyDisplayName: companyDisplayName.trim(),
          name: companyName,
          nature: companyNature,
          district,
          address: address,
          contact: contact,
          icon: companyIconUrl,
          website: website.trim(),
          introduction: introduction.trim(),
          coverPhotos: companyCoverPhotoUrls,
        };
        localStorage.setItem("company", JSON.stringify(updatedCompany));
        ApiService.setCurrentCompany(updatedCompany);
        setCurrentIcon(companyIconUrl);
        setCurrentCoverPhotos(companyCoverPhotoUrls);
        setCompanyCoverFiles([]);
        await applyLocale(locale);
        clearPendingLocale(locale);

        // Optional UI reload to update header instantly
        window.dispatchEvent(new Event("storage"));
      } else {
        throw new Error(response.message || "Failed to update profile");
      }
    } catch (err) {
      clearPendingLocale(locale);
      toast.error(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleCompanyCoverPhotosChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > MAX_COMPANY_COVER_PHOTOS) {
      toast.error(
        t("profilePage.companyCoverPhotosLimit", {
          count: MAX_COMPANY_COVER_PHOTOS,
        }),
      );
      e.target.value = null;
      return;
    }

    const hasInvalidFile = files.some(
      (file) => !file.type.startsWith("image/"),
    );
    if (hasInvalidFile) {
      toast.error(t("profilePage.companyCoverPhotosInvalid"));
      e.target.value = null;
      return;
    }

    setCompanyCoverFiles(files);
  };

  return (
    <div className="profile-container">
      <div className="profile-card">
        <div className="profile-header">
          <h2>{t("profilePage.title")}</h2>
          <button
            type="button"
            className="password-reset-trigger"
            ref={passwordResetTriggerRef}
            onClick={() => setShowPasswordReset(true)}
          >
            {t("profilePage.resetPassword")}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="profile-form">
          <div className="form-group">
            <label htmlFor="companyDisplayName">
              {t("profilePage.companyDisplayName")}
            </label>
            <input
              type="text"
              id="companyDisplayName"
              value={companyDisplayName}
              onChange={(e) => setCompanyDisplayName(e.target.value)}
              placeholder={t("login.companyDisplayNamePlaceholder")}
            />
          </div>

          <div className="form-group">
            <label htmlFor="companyName">{t("profilePage.companyName")}</label>
            <input
              type="text"
              id="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder={t("login.companyNamePlaceholder")}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="companyNature">{t("profilePage.companyNature")}</label>
            <select
              id="companyNature"
              value={companyNature}
              onChange={(e) => setCompanyNature(e.target.value)}
              required
            >
              <option value="">
                {isLoadingIndustries
                  ? t("profilePage.loadingIndustries")
                  : t("profilePage.selectIndustry")}
              </option>
              {companyIndustries.map((industry) => (
                <option key={industry} value={industry}>
                  {industry}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="district">{t("profilePage.district")}</label>
            <select
              id="district"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
            >
              <option value="">
                {isLoadingDistricts
                  ? t("profilePage.loadingDistricts")
                  : t("profilePage.selectDistrict")}
              </option>
              {districtOptions.map((districtOption) => (
                <option key={districtOption} value={districtOption}>
                  {districtOption}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="portalLanguage">{t("profilePage.portalLanguage")}</label>
            <select
              id="portalLanguage"
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
            >
              <option value="en">{t("common.english")}</option>
              <option value="zh-HK">{t("common.traditionalChinese")}</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="companyIcon">{t("profilePage.companyIcon")}</label>
            {currentIcon && !companyIconFile && (
              <div className="current-icon">
                <img
                  src={currentIcon}
                  alt={t("profilePage.currentCompanyIcon")}
                  style={{ width: "60px", height: "60px", borderRadius: "8px", objectFit: "cover", display: "block" }}
                />
              </div>
            )}
            <input
              type="file"
              id="companyIcon"
              accept="image/png, image/jpeg"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  if (file.type !== "image/png" && file.type !== "image/jpeg") {
                    toast.error("Only PNG and JPEG images are allowed.");
                    e.target.value = null;
                    return;
                  }
                  setCompanyIconFile(file);
                }
              }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="companyCoverPhotos">
              {t("profilePage.companyCoverPhotos")}
            </label>
            <p className="form-hint">
              {t("profilePage.companyCoverPhotosHint", {
                count: MAX_COMPANY_COVER_PHOTOS,
              })}
            </p>
            <input
              type="file"
              id="companyCoverPhotos"
              accept="image/*"
              multiple
              onChange={handleCompanyCoverPhotosChange}
            />

            {(companyCoverFiles.length > 0 || currentCoverPhotos.length > 0) && (
              <div className="cover-photo-preview-grid">
                {(companyCoverFiles.length > 0
                  ? companyCoverPreviewUrls.map((previewUrl, index) => ({
                      key: `${companyCoverFiles[index]?.name || index}-${index}`,
                      url: previewUrl,
                      label:
                        companyCoverFiles[index]?.name ||
                        `${t("profilePage.companyCoverPhoto")} ${index + 1}`,
                    }))
                  : currentCoverPhotos.map((photo, index) => ({
                      key: `${photo}-${index}`,
                      url: photo,
                      label: `${t("profilePage.companyCoverPhoto")} ${index + 1}`,
                    }))).map((photo) => (
                  <div key={photo.key} className="cover-photo-preview-card">
                    <img src={photo.url} alt={photo.label} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="website">{t("profilePage.website")}</label>
            <input
              type="url"
              id="website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder={t("profilePage.websitePlaceholder")}
            />
          </div>

          <div className="form-group">
            <label htmlFor="introduction">{t("profilePage.introduction")}</label>
            <textarea
              id="introduction"
              value={introduction}
              onChange={(e) => setIntroduction(e.target.value)}
              placeholder={t("profilePage.introductionPlaceholder")}
              rows={5}
            />
          </div>

          <div className="form-group">
            <label htmlFor="address">{t("profilePage.address")}</label>
            <input
              type="text"
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t("login.companyAddressPlaceholder")}
            />
          </div>

          <div className="form-group">
            <label htmlFor="contact">{t("profilePage.contact")}</label>
            <input
              type="text"
              id="contact"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder={t("login.contactPlaceholder")}
            />
          </div>

          <button type="submit" className="save-button" disabled={loading}>
            {loading ? t("common.saving") : t("common.save")}
          </button>
        </form>

      </div>
      {showPasswordReset && (
        <div
          className="password-reset-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowPasswordReset(false);
              setShowPasswordResetFields(false);
            }
          }}
        >
          <section
            className="password-reset-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="password-reset-title"
            aria-describedby="password-reset-description"
            onKeyDown={(event) => {
              if (event.key !== "Tab") return;
              const focusableElements = event.currentTarget.querySelectorAll(
                'button:not([disabled]), input:not([disabled])',
              );
              const firstElement = focusableElements[0];
              const lastElement = focusableElements[focusableElements.length - 1];

              if (event.shiftKey && document.activeElement === firstElement) {
                event.preventDefault();
                lastElement.focus();
              } else if (!event.shiftKey && document.activeElement === lastElement) {
                event.preventDefault();
                firstElement.focus();
              }
            }}
          >
            <div className="password-reset-dialog-header">
              <div>
                <h2 id="password-reset-title">{t("profilePage.resetPassword")}</h2>
                <p id="password-reset-description">
                  {t("profilePage.passwordResetDescription")}
                </p>
              </div>
              <button
                type="button"
                className="password-reset-close"
                aria-label={t("profilePage.closePasswordReset")}
                onClick={() => {
                  setShowPasswordReset(false);
                  setShowPasswordResetFields(false);
                }}
              >
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
            <ResetPasswordForm
              t={t}
              className="profile-password-form"
              showResetFields={showPasswordResetFields}
              onCodeSent={() => setShowPasswordResetFields(true)}
              onSuccess={() => {
                setShowPasswordReset(false);
                setShowPasswordResetFields(false);
                ApiService.logoutSession();
              }}
            />
          </section>
        </div>
      )}
    </div>
  );
};

export default Profile;