export const getProLeafletValidationErrors = (data) => {
  const errors = {};

  if (!data.aspectRatio || data.aspectRatio.trim() === "") {
    errors.aspectRatio = "Aspect Ratio is required";
  }

  if (!data.flyerPrompts || data.flyerPrompts.trim() === "") {
    errors.flyerPrompts = "Context/Prompts is required";
  }

  return errors;
};
