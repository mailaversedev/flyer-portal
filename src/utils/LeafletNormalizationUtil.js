export const DEFAULT_TYPOGRAPHY = [
  { key: "Primary", value: "FS Albert Pro" },
  { key: "Body", value: "Helvetica Neue" },
];

export const normalizeTypographyEntries = (typography) => {
  if (Array.isArray(typography) && typography.length > 0) {
    const normalizedArray = typography.map((entry) => ({
      key: `${entry?.key || ""}`,
      value: `${entry?.value || ""}`,
    }));

    if (normalizedArray.some((entry) => entry.key.trim() || entry.value.trim())) {
      return normalizedArray;
    }
  }

  if (typography && typeof typography === "object" && !Array.isArray(typography)) {
    const normalizedObject = Object.entries(typography).map(([key, value]) => ({
      key: `${key || ""}`,
      value: `${value || ""}`,
    }));

    if (normalizedObject.length > 0) {
      return normalizedObject;
    }
  }

  if (typeof typography === "string") {
    const rawTypography = typography.trim();

    if (rawTypography) {
      try {
        const parsedTypography = JSON.parse(rawTypography);

        if (
          parsedTypography &&
          typeof parsedTypography === "object" &&
          !Array.isArray(parsedTypography)
        ) {
          const normalizedObject = Object.entries(parsedTypography).map(
            ([key, value]) => ({
              key: `${key || ""}`,
              value: `${value || ""}`,
            }),
          );

          if (normalizedObject.length > 0) {
            return normalizedObject;
          }
        }
      } catch (_error) {
        // Ignore malformed JSON and fall back to defaults.
      }
    }
  }

  return DEFAULT_TYPOGRAPHY.map((entry) => ({ ...entry }));
};

export const normalizeTypographyMap = (typography) => {
  const typographyMap = {};

  if (Array.isArray(typography)) {
    typography.forEach((entry) => {
      const key = `${entry?.key || ""}`.trim();
      const value = `${entry?.value || ""}`.trim();

      if (key && value) {
        typographyMap[key] = value;
      }
    });

    return typographyMap;
  }

  if (typography && typeof typography === "object") {
    Object.entries(typography).forEach(([key, value]) => {
      const normalizedKey = `${key || ""}`.trim();
      const normalizedValue = `${value || ""}`.trim();

      if (normalizedKey && normalizedValue) {
        typographyMap[normalizedKey] = normalizedValue;
      }
    });

    return typographyMap;
  }

  if (typeof typography === "string") {
    const rawTypography = typography.trim();

    if (!rawTypography) {
      return typographyMap;
    }

    try {
      const parsedTypography = JSON.parse(rawTypography);

      if (
        parsedTypography &&
        typeof parsedTypography === "object" &&
        !Array.isArray(parsedTypography)
      ) {
        Object.entries(parsedTypography).forEach(([key, value]) => {
          const normalizedKey = `${key || ""}`.trim();
          const normalizedValue = `${value || ""}`.trim();

          if (normalizedKey && normalizedValue) {
            typographyMap[normalizedKey] = normalizedValue;
          }
        });

        return typographyMap;
      }
    } catch (_error) {
      typographyMap.Primary = rawTypography;
      return typographyMap;
    }
  }

  return typographyMap;
};

export const normalizeLeafletResolution = (resolution) => {
  const normalized = `${resolution || "2K"}`.toUpperCase();
  if (["1K", "2K", "4K"].includes(normalized)) {
    return normalized;
  }
  return "2K";
};

export const DEFAULT_SPREADING_COEFFICIENT = 0.845;

export const SPREADING_COEFFICIENT_BY_INDUSTRY = {
  "F&B": 0.35,
  Lifestyle: 0.8,
  Entertainment: 0.65,
  "Banking & Finance": 1.3,
  Household: 0.65,
  "Real Estate": 1.3,
  Education: 0.65,
  "Government Bodies": 1,
  Utilities: 1,
  Donation: 1,
  Travelling: 1,
  Healthcare: 0.8,
  "Fitness & Sports": 0.8,
};

export const normalizeIndustry = (industry) => `${industry || ""}`.trim();

export const getStoredCompanyNature = () => {
  try {
    const storedCompany = JSON.parse(localStorage.getItem("company") || "null");
    return storedCompany?.nature || "";
  } catch {
    return "";
  }
};

export const getSpreadingCoefficientByIndustry = (industry) => {
  const normalizedIndustry = normalizeIndustry(industry);

  if (
    normalizedIndustry &&
    Object.prototype.hasOwnProperty.call(
      SPREADING_COEFFICIENT_BY_INDUSTRY,
      normalizedIndustry,
    )
  ) {
    return SPREADING_COEFFICIENT_BY_INDUSTRY[normalizedIndustry];
  }

  return DEFAULT_SPREADING_COEFFICIENT;
};
