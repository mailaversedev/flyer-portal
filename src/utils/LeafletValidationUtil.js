export const getProLeafletValidationErrors = (
  data,
  { requireCompanySelection = false } = {},
) => {
  const errors = {};

  if (!data.aspectRatio || data.aspectRatio.trim() === "") {
    errors.aspectRatio = "Aspect Ratio is required";
  }

  if (!data.header || data.header.trim() === "") {
    errors.header = "Header is required";
  }

  if (!data.adContent || data.adContent.trim() === "") {
    errors.adContent = "Ad Content is required";
  }

  if (!data.flyerPrompts || data.flyerPrompts.trim() === "") {
    errors.flyerPrompts = "Context/Prompts is required";
  }

  if (requireCompanySelection && !data.companyId) {
    errors.companyId = "Merchant is required";
  }

  return errors;
};
