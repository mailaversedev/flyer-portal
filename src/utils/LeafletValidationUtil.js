export const getStandardLeafletValidationErrors = (data) => {
  const errors = {};

  if (!data.aspectRatio || data.aspectRatio.trim() === "") {
    errors.aspectRatio = "Aspect Ratio is required";
  }

  if (!data.adType || data.adType.trim() === "") {
    errors.adType = "Ad Type is required";
  }

  if (!data.header || data.header.trim() === "") {
    errors.header = "Header is required";
  }

  if (!data.adContent || data.adContent.trim() === "") {
    errors.adContent = "Ad Content is required";
  }

  if (!data.flyerPrompts || data.flyerPrompts.trim() === "") {
    errors.flyerPrompts = "Flyer Prompts is required";
  }

  if (!data.promotionMessage || data.promotionMessage.trim() === "") {
    errors.promotionMessage = "Promotion Message/Slogan is required";
  }

  if (!data.productDescriptions || data.productDescriptions.trim() === "") {
    errors.productDescriptions = "Product Descriptions is required";
  }

  return errors;
};

export const getProLeafletValidationErrors = (data) => {
  const errors = {};

  if (!data.aspectRatio || data.aspectRatio.trim() === "") {
    errors.aspectRatio = "Aspect Ratio is required";
  }

  if (!data.productName || data.productName.trim() === "") {
    errors.productName = "Product Name is required";
  }

  if (!data.header || data.header.trim() === "") {
    errors.header = "Copy Line (Header) is required";
  }

  if (!data.adContent || data.adContent.trim() === "") {
    errors.adContent = "Ad Content is required";
  }

  if (!data.flyerPrompts || data.flyerPrompts.trim() === "") {
    errors.flyerPrompts = "Context/Prompts is required";
  }

  return errors;
};
