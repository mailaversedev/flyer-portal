const INITIAL_COMPANY_TOKENS = 10;
const DAILY_FREE_GENERATIONS_PER_COMPANY = 3;

const TOKEN_BUNDLES = [
  {
    code: "bundle-20",
    title: "Starter Bundle",
    tokens: 20,
    priceHkd: 100,
    description: "HK$100 for 20 tokens. Best for smaller batches of flyer generation and editing.",
  },
  {
    code: "bundle-200",
    title: "Growth Bundle",
    tokens: 200,
    priceHkd: 1000,
    description: "HK$1000 for 200 tokens. Built for frequent FlyerGenie generation and editable workflows.",
  },
];

const TOKEN_PRICING = [
  {
    code: "flyergenie-pro-max-generation-1k",
    title: "FlyerGenie Pro / Max Generation (1K)",
    tokens: 1,
    billingUnit: "generation",
    availability: "active",
  },
  {
    code: "flyergenie-pro-max-generation-2k",
    title: "FlyerGenie Pro / Max Generation (2K)",
    tokens: 2,
    billingUnit: "generation",
    availability: "active",
  },
  {
    code: "flyergenie-pro-max-generation-4k",
    title: "FlyerGenie Pro / Max Generation (4K)",
    tokens: 4,
    billingUnit: "generation",
    availability: "active",
  },
  {
    code: "flyergenie-max-edit-1k",
    title: "FlyerGenie Max Edit (1K)",
    tokens: 1,
    billingUnit: "edit",
    availability: "coming_soon",
  },
  {
    code: "flyergenie-max-edit-2k",
    title: "FlyerGenie Max Edit (2K)",
    tokens: 2,
    billingUnit: "edit",
    availability: "coming_soon",
  },
  {
    code: "flyergenie-max-edit-4k",
    title: "FlyerGenie Max Edit (4K)",
    tokens: 4,
    billingUnit: "edit",
    availability: "coming_soon",
  },
  {
    code: "flyergenie-max-generation-1k",
    title: "FlyerGenie Max Generation (1K)",
    tokens: 1,
    billingUnit: "generation",
    availability: "coming_soon",
  },
  {
    code: "flyergenie-max-generation-2k",
    title: "FlyerGenie Max Generation (2K)",
    tokens: 2,
    billingUnit: "generation",
    availability: "coming_soon",
  },
  {
    code: "flyergenie-max-generation-4k",
    title: "FlyerGenie Max Generation (4K)",
    tokens: 4,
    billingUnit: "generation",
    availability: "coming_soon",
  },
];

const getLeafletTokenCost = (resolution = "2K") => {
  const normalizedResolution = `${resolution || "2K"}`.trim().toUpperCase();

  if (normalizedResolution === "1K") {
    return {
      code: "flyergenie-pro-max-generation-1k",
      title: "FlyerGenie Pro / Max Generation (1K)",
      tokens: 1,
      billingUnit: "generation",
      resolution: "1K",
    };
  }

  if (normalizedResolution === "2K") {
    return {
      code: "flyergenie-pro-max-generation-2k",
      title: "FlyerGenie Pro / Max Generation (2K)",
      tokens: 2,
      billingUnit: "generation",
      resolution: "2K",
    };
  }

  if (normalizedResolution === "4K") {
    return {
      code: "flyergenie-pro-max-generation-4k",
      title: "FlyerGenie Pro / Max Generation (4K)",
      tokens: 4,
      billingUnit: "generation",
      resolution: "4K",
    };
  }

  return {
    code: "flyergenie-pro-max-generation-2k",
    title: "FlyerGenie Pro / Max Generation (2K)",
    tokens: 2,
    billingUnit: "generation",
    resolution: "2K",
  };
};

module.exports = {
  DAILY_FREE_GENERATIONS_PER_COMPANY,
  INITIAL_COMPANY_TOKENS,
  TOKEN_BUNDLES,
  TOKEN_PRICING,
  getLeafletTokenCost,
};