export const TOKEN_PRICE_HKD = 0.02;

export const tokensToHkd = (tokens) => Number(tokens || 0) * TOKEN_PRICE_HKD;

export const hkdToTokens = (amountHkd) => Number(amountHkd || 0) / TOKEN_PRICE_HKD;
