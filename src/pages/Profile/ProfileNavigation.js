import React from "react";
import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";

const ProfileNavigation = () => {
  const { t } = useTranslation();

  return (
    <nav className="profile-navigation" aria-label={t("profilePage.navigation")}>
      <NavLink end to="/profile">{t("profilePage.title")}</NavLink>
      <NavLink to="/profile/products">{t("profilePage.productsTitle")}</NavLink>
    </nav>
  );
};

export default ProfileNavigation;
