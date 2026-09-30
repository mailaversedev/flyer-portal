const crypto = require("crypto");

const DEFAULT_API_BASE_URL = "https://payment.uat.kpay-group.com";
const NONCE_CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

const createConfigurationError = (message) => {
  const error = new Error(message);
  error.code = "KPAY_CONFIGURATION_ERROR";
  return error;
};

const normalizeKeyMaterial = (value) => `${value || ""}`.trim().replace(/\\n/g, "\n");

const decodeBase64Der = (value) => {
  const compact = value.replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(compact) || compact.length % 4 === 1) {
    throw new Error("Invalid base64-encoded DER");
  }

  const der = Buffer.from(compact, "base64");
  if (
    der.length === 0 ||
    der.toString("base64").replace(/=+$/, "") !== compact.replace(/=+$/, "")
  ) {
    throw new Error("Invalid base64-encoded DER");
  }

  return der;
};

const loadPrivateKey = (value) => {
  const key = crypto.createPrivateKey({
    key: decodeBase64Der(normalizeKeyMaterial(value)),
    format: "der",
    type: "pkcs8",
  });

  if (key.asymmetricKeyType !== "rsa") {
    throw new Error("Expected an RSA private key");
  }

  return key;
};

const loadPublicKey = (value) => {
  const key = crypto.createPublicKey({
    key: decodeBase64Der(normalizeKeyMaterial(value)),
    format: "der",
    type: "spki",
  });

  if (key.asymmetricKeyType !== "rsa") {
    throw new Error("Expected an RSA public key");
  }

  return key;
};

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

const getPublicAppBaseUrl = () => {
  const configuredBaseUrl = `${process.env.KPAY_PUBLIC_BASE_URL || ""}`.trim();
  const herokuDefaultDomain = `${process.env.HEROKU_APP_DEFAULT_DOMAIN_NAME || ""}`.trim();
  const baseUrl = configuredBaseUrl || (herokuDefaultDomain ? `https://${herokuDefaultDomain}` : "");

  if (!baseUrl) {
    throw createConfigurationError(
      "Set KPAY_PUBLIC_BASE_URL or enable Heroku runtime dyno metadata to provide HEROKU_APP_DEFAULT_DOMAIN_NAME",
    );
  }

  try {
    const url = new URL(baseUrl);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      throw new Error("Invalid public app URL");
    }
    return url.origin;
  } catch (error) {
    throw createConfigurationError(
      "KPAY_PUBLIC_BASE_URL must be a valid HTTPS origin, or Heroku app metadata must contain a valid app domain",
    );
  }
};

const buildPublicReturnUrl = (returnPath = "/wallet") => {
  const normalizedPath = `${returnPath || ""}`.trim();

  if (!normalizedPath.startsWith("/")) {
    throw createConfigurationError("KPay returnPath must start with '/'");
  }

  if (normalizedPath.startsWith("//") || /^https?:\/\//i.test(normalizedPath)) {
    throw createConfigurationError("KPay returnPath must be a relative path");
  }

  return `${getPublicAppBaseUrl()}${normalizedPath}`;
};

const getKPayConfig = () => {
  const merchantCode = `${process.env.KPAY_MERCHANT_CODE || ""}`.trim();
  const privateKeyValue = normalizeKeyMaterial(process.env.KPAY_PRIVATE_KEY);
  const platformPublicKeyValue = normalizeKeyMaterial(process.env.KPAY_PLATFORM_PUBLIC_KEY);
  const appId = `${process.env.KPAY_APP_ID || ""}`.trim();

  if (!merchantCode || !privateKeyValue || !platformPublicKeyValue) {
    throw createConfigurationError(
      "KPay is not configured. KPAY_MERCHANT_CODE, KPAY_PRIVATE_KEY, and KPAY_PLATFORM_PUBLIC_KEY are required",
    );
  }

  let privateKey;
  try {
    privateKey = loadPrivateKey(privateKeyValue);
  } catch (error) {
    throw createConfigurationError(
      "KPAY_PRIVATE_KEY must be base64-encoded PKCS#8 DER for an RSA private key; PEM is not accepted",
    );
  }

  let platformPublicKey;
  try {
    platformPublicKey = loadPublicKey(platformPublicKeyValue);
  } catch (error) {
    throw createConfigurationError(
      "KPAY_PLATFORM_PUBLIC_KEY must be base64-encoded SPKI DER for an RSA public key; PEM is not accepted",
    );
  }

  const publicAppBaseUrl = getPublicAppBaseUrl();

  return {
    appId,
    apiBaseUrl: normalizeBaseUrl(process.env.KPAY_API_BASE_URL),
    merchantCode,
    notifyUrl: `${publicAppBaseUrl}/api/payment/kpay/notify`,
    platformPublicKey,
    privateKey,
    defaultReturnUrl: `${publicAppBaseUrl}/wallet`,
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

const createManagedOrder = async ({ managedOutTradeNo, amount, orderRemark, itemName, returnUrl }) => {
  const config = getKPayConfig();
  const path = "/v1/managed/order/add";
  const resolvedReturnUrl = returnUrl || config.defaultReturnUrl;
  const body = JSON.stringify({
    managedOutTradeNo,
    payAmount: amount,
    payCurrency: "HKD",
    notifyUrl: config.notifyUrl,
    returnUrl: resolvedReturnUrl,
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
  buildPublicReturnUrl,
  buildCheckoutUrl,
  buildSignatureText,
  createManagedOrder,
  getKPayConfig,
  verifyWebhook,
};