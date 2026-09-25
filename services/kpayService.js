const crypto = require("crypto");

const DEFAULT_API_BASE_URL = "https://payment.uat.kpay-group.com";
const NONCE_CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

const createConfigurationError = (message) => {
  const error = new Error(message);
  error.code = "KPAY_CONFIGURATION_ERROR";
  return error;
};

const normalizePem = (value) => `${value || ""}`.trim().replace(/\\n/g, "\n");

const normalizeBaseUrl = (value) => {
  try {
    const url = new URL(value || DEFAULT_API_BASE_URL);
    if (url.protocol !== "https:") {
      throw new Error("KPay API base URL must use HTTPS");
    }
    return url.origin;
  } catch (error) {
    throw createConfigurationError("KPAY_API_BASE_URL must be a valid HTTPS URL");
  }
};

const requireHttpsUrl = (value, variableName) => {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.search || url.hash) {
      throw new Error("Invalid URL");
    }
    return url.toString();
  } catch (error) {
    throw createConfigurationError(`${variableName} must be a valid HTTPS URL without query parameters or fragments`);
  }
};

const getKPayConfig = () => {
  const merchantCode = `${process.env.KPAY_MERCHANT_CODE || ""}`.trim();
  const privateKey = normalizePem(process.env.KPAY_PRIVATE_KEY);
  const platformPublicKey = normalizePem(process.env.KPAY_PLATFORM_PUBLIC_KEY);
  const appId = `${process.env.KPAY_APP_ID || ""}`.trim();

  if (!merchantCode || !privateKey || !platformPublicKey) {
    throw createConfigurationError(
      "KPay is not configured. KPAY_MERCHANT_CODE, KPAY_PRIVATE_KEY, and KPAY_PLATFORM_PUBLIC_KEY are required",
    );
  }

  try {
    crypto.createPrivateKey(privateKey);
    crypto.createPublicKey(platformPublicKey);
  } catch (error) {
    throw createConfigurationError("KPay key material is not a valid PEM-encoded RSA key");
  }

  return {
    appId,
    apiBaseUrl: normalizeBaseUrl(process.env.KPAY_API_BASE_URL),
    merchantCode,
    notifyUrl: requireHttpsUrl(process.env.KPAY_NOTIFY_URL, "KPAY_NOTIFY_URL"),
    platformPublicKey,
    privateKey,
    returnUrl: requireHttpsUrl(process.env.KPAY_RETURN_URL, "KPAY_RETURN_URL"),
  };
};

const generateNonce = () => {
  const bytes = crypto.randomBytes(32);
  let nonce = "";

  for (const byte of bytes) {
    nonce += NONCE_CHARACTERS[byte % NONCE_CHARACTERS.length];
  }

  return nonce;
};

const buildSignatureText = ({ method, pathWithQuery, timestamp, nonce, merchantCode, appId, body = "" }) => {
  const parts = [method.toUpperCase(), pathWithQuery, timestamp, nonce, merchantCode];

  if (appId) {
    parts.push(appId);
  }

  parts.push(body);
  return `${parts.join("\n")}\n`;
};

const sign = (text, privateKey) =>
  crypto.sign("RSA-SHA256", Buffer.from(text, "utf8"), privateKey).toString("base64");

const buildSignedHeaders = ({ method, pathWithQuery, body, config }) => {
  const timestamp = `${Date.now()}`;
  const nonce = generateNonce();
  const signature = sign(
    buildSignatureText({
      method,
      pathWithQuery,
      timestamp,
      nonce,
      merchantCode: config.merchantCode,
      appId: config.appId,
      body,
    }),
    config.privateKey,
  );

  return {
    "Content-Type": "application/json;charset=UTF-8",
    "K-Merchant-Code": config.merchantCode,
    "K-Nonce-Str": nonce,
    "K-Signature": signature,
    "K-Timestamp": timestamp,
    ...(config.appId ? { "K-App-Id": config.appId } : {}),
  };
};

const buildCheckoutUrl = ({ managedOrderNo, language = "zh-HK", config = getKPayConfig() }) => {
  const path = "/v1/web/managed/order";
  const timestamp = `${Date.now()}`;
  const nonce = generateNonce();
  const queryEntries = [
    ["managedOrderNo", managedOrderNo],
    ["language", language],
    ["K-Merchant-Code", config.merchantCode],
    ["K-Nonce-Str", nonce],
    ["K-Timestamp", timestamp],
    ...(config.appId ? [["K-App-Id", config.appId]] : []),
  ];
  const query = queryEntries.map(([key, value]) => `${key}=${value}`).join("&");
  const signature = sign(
    buildSignatureText({
      method: "GET",
      pathWithQuery: `${path}?${query}`,
      timestamp,
      nonce,
      merchantCode: config.merchantCode,
      appId: config.appId,
    }),
    config.privateKey,
  );

  return `${config.apiBaseUrl}${path}?${query}&K-Signature=${encodeURIComponent(signature)}`;
};

const createManagedOrder = async ({ managedOutTradeNo, amount, orderRemark, itemName }) => {
  const config = getKPayConfig();
  const path = "/v1/managed/order/add";
  const body = JSON.stringify({
    managedOutTradeNo,
    payAmount: amount,
    payCurrency: "HKD",
    notifyUrl: config.notifyUrl,
    returnUrl: config.returnUrl,
    orderRemark,
    itemList: [
      {
        itemNo: managedOutTradeNo,
        itemName,
        price: amount,
        priceCurrency: "HKD",
        quantity: 1,
      },
    ],
  });
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    method: "POST",
    headers: buildSignedHeaders({ method: "POST", pathWithQuery: path, body, config }),
    body,
    signal: AbortSignal.timeout(10000),
  });
  const rawResponse = await response.text();
  let responseBody;

  try {
    responseBody = rawResponse ? JSON.parse(rawResponse) : {};
  } catch (error) {
    responseBody = {};
  }

  if (!response.ok || `${responseBody.code}` !== "10000" || !responseBody.data?.managedOrderNo) {
    const gatewayError = new Error(responseBody.message || "KPay rejected the payment order");
    gatewayError.code = "KPAY_GATEWAY_ERROR";
    gatewayError.gatewayStatus = response.status;
    gatewayError.gatewayCode = responseBody.code;
    throw gatewayError;
  }

  return {
    managedOrderNo: `${responseBody.data.managedOrderNo}`,
    checkoutUrl: buildCheckoutUrl({ managedOrderNo: `${responseBody.data.managedOrderNo}`, config }),
  };
};

const getHeader = (headers, name) => `${headers[name] || ""}`.trim();

const verifyWebhook = ({ headers, rawBody, callbackPath }) => {
  const config = getKPayConfig();
  const merchantCode = getHeader(headers, "k-merchant-code");
  const timestamp = getHeader(headers, "k-timestamp");
  const nonce = getHeader(headers, "k-nonce-str");
  const signature = getHeader(headers, "k-signature");
  const appId = getHeader(headers, "k-app-id");

  if (!merchantCode || !timestamp || !nonce || !signature || merchantCode !== config.merchantCode) {
    return false;
  }

  if ((config.appId && appId !== config.appId) || (!config.appId && appId)) {
    return false;
  }

  const timestampNumber = Number(timestamp);
  if (!Number.isSafeInteger(timestampNumber) || Math.abs(Date.now() - timestampNumber) > 5 * 60 * 1000) {
    return false;
  }

  const signatureText = buildSignatureText({
    method: "POST",
    pathWithQuery: callbackPath,
    timestamp,
    nonce,
    merchantCode,
    appId,
    body: rawBody,
  });

  try {
    return crypto.verify(
      "RSA-SHA256",
      Buffer.from(signatureText, "utf8"),
      config.platformPublicKey,
      Buffer.from(signature, "base64"),
    );
  } catch (error) {
    return false;
  }
};

module.exports = {
  buildCheckoutUrl,
  buildSignatureText,
  createManagedOrder,
  getKPayConfig,
  verifyWebhook,
};