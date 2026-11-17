import { DEFAULT_TYPOGRAPHY, normalizeLeafletResolution } from "./LeafletNormalizationUtil";

export const getFlyerGenerationTokenCost = (resolution) =>
  ({ "1K": 1, "2K": 2, "4K": 4 })[normalizeLeafletResolution(resolution)];

export const createCreativeDefaults = (aspectRatio = "1:1", resolution = "1K") => ({
  aspectRatio,
  resolution,
  flyerPrompts: "",
  referenceFlyer: null,
  productPhoto: [],
  logoImage: null,
  primaryColor: "",
  secondaryColor: "",
  typography: DEFAULT_TYPOGRAPHY.map((entry) => ({ ...entry })),
  brandVoice: "",
  tags: [],
});

const CREATIVE_FIELDS = [
  "flyerPrompts", "aspectRatio", "resolution", "primaryColor", "secondaryColor",
  "typography", "brandVoice", "logoImage", "referenceFlyer", "productPhoto", "companyId",
];

export const mergeFlyerContent = (previous, updates, hasUploadedFile = false) => {
  const creativeChanged = CREATIVE_FIELDS.some(
    (field) => Object.prototype.hasOwnProperty.call(updates, field) && updates[field] !== previous[field],
  );
  return {
    ...previous,
    ...updates,
    ...(creativeChanged && !hasUploadedFile ? { coverPhoto: null } : {}),
  };
};

export const getCreativeValidationErrors = (data, t) => {
  const errors = {};
  if (!data.aspectRatio?.trim()) errors.aspectRatio = t("flyerContent.ratioRequired");
  if (!data.flyerPrompts?.trim()) errors.flyerPrompts = t("flyerContent.promptRequired");
  return errors;
};

export const withoutCreativeFiles = ({ referenceFlyer, productPhoto, logoImage, backgroundPhoto, ...data }) => data;
