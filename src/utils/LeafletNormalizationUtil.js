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

export const normalizeLeafletResolution = (resolution = "2K") => {
  const normalizedResolution = `${resolution || "2K"}`.trim().toUpperCase();
  return normalizedResolution === "1K" ? "1K" : "2K";
};
