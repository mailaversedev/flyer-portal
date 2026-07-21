export const MIN_BUDGET = 500;
export const MAX_BUDGET = 50000;
export const DEFAULT_BUDGET = 1000;

export const validateTargetBudgetStep = ({
  data,
  isDirectUpload = false,
  requireCompanySelection = false,
  t,
}) => {
  const formData = {
    district: data?.targetBudget?.district || data?.district || "",
    propertyEstate:
      data?.targetBudget?.propertyEstate || data?.propertyEstate || "",
    targetedGroup:
      data?.targetBudget?.targetedGroup || data?.targetedGroup || "",
    budget: data?.targetBudget?.budget || data?.budget || DEFAULT_BUDGET,
    paymentMethod:
      data?.targetBudget?.paymentMethod || data?.paymentMethod || "",
    noReward: Boolean(data?.targetBudget?.noReward || data?.noReward),
  };

  const missingFields = [];

  if (requireCompanySelection && !data?.companyId) {
    missingFields.push(t("common.merchant"));
  }

  if (isDirectUpload) {
    if (!data?.header?.trim()) {
      missingFields.push(t("targetBudget.header"));
    }
    if (!(data?.adContent || "").trim()) {
      missingFields.push(t("targetBudget.adContent"));
    }
  }

  if (!formData.noReward) {
    if (!formData.paymentMethod.trim()) {
      missingFields.push(t("targetBudget.payment"));
    }
    if (!formData.budget || formData.budget < MIN_BUDGET) {
      missingFields.push(t("targetBudget.budgetHkd"));
    }
  }

  return {
    isValid: missingFields.length === 0,
    missingFields,
  };
};
