const crypto = require("crypto");

const MAX_ITEMS = 100;
const MAX_IMAGES = 100;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_IMAGE_BYTES = 20 * 1024 * 1024;

const digest = (value) => crypto.createHash("sha256").update(value).digest("hex");
const itemId = (sequence) => String(sequence).padStart(16, "0");

function imageEncryptionKey() {
  const encoded = process.env.VOUCHER_IMAGE_ENCRYPTION_KEY || "";
  const key = Buffer.from(encoded, "base64");
  if (!/^[A-Za-z0-9+/]{43}=$/.test(encoded) || key.length !== 32) {
    throw new Error("__VOUCHER_IMAGE_KEY_MISSING__");
  }
  return key;
}

function encryptImage(buffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", imageEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
}

function decryptImage(buffer) {
  if (buffer.length < 28) throw new Error("Invalid encrypted voucher image");
  const decipher = crypto.createDecipheriv("aes-256-gcm", imageEncryptionKey(), buffer.subarray(0, 12));
  decipher.setAuthTag(buffer.subarray(12, 28));
  return Buffer.concat([decipher.update(buffer.subarray(28)), decipher.final()]);
}

function imageType(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return "image/jpeg";
  if (buffer.length >= 6 && ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("ascii"))) return "image/gif";
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

function prepareImport(rawItems, images, importKey) {
  if (typeof importKey !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(importKey)) {
    throw new Error("Invalid import key");
  }
  let items;
  try {
    items = JSON.parse(rawItems || "[]");
  } catch {
    throw new Error("Items must be a JSON array");
  }
  if (!Array.isArray(items) || items.some((item) => !item || typeof item !== "object" ||
      typeof item.code !== "string" || !Number.isInteger(item.imageIndex))) {
    throw new Error("Items must contain a code and image index");
  }
  const codes = items.map((item) => item.code);
  if (codes.some((code) => !code.trim() || Buffer.byteLength(code, "utf8") > 512)) {
    throw new Error("Each code must contain between 1 and 512 bytes");
  }
  if (new Set(codes).size !== codes.length) throw new Error("Duplicate codes in import");
  if (!items.length) throw new Error("Import must contain at least one item");
  if (items.length > MAX_ITEMS || images.length > MAX_IMAGES) {
    throw new Error("Import exceeds item or image limit");
  }
  const imageIndexes = items.map((item) => item.imageIndex);
  if (items.length !== images.length || new Set(imageIndexes).size !== images.length ||
      imageIndexes.some((index) => index < 0 || index >= images.length)) {
    throw new Error("Each code must have exactly one unique image");
  }
  let totalBytes = 0;
  const preparedImages = images.map((image) => {
    totalBytes += image.buffer.length;
    const type = imageType(image.buffer);
    if (!type || image.buffer.length > MAX_IMAGE_BYTES) {
      throw new Error("Images must be PNG, JPEG, GIF or WebP and at most 5 MB each");
    }
    return { buffer: image.buffer, type, hash: digest(image.buffer) };
  });
  if (totalBytes > MAX_TOTAL_IMAGE_BYTES) throw new Error("Combined images exceed 20 MB");
  const pairedItems = items.map(({ code, imageIndex }) => ({ code, imageIndex }));
  const fingerprint = digest(JSON.stringify(pairedItems.map(({ code, imageIndex }) => ({
    code, imageHash: preparedImages[imageIndex].hash,
  }))));
  return { items: pairedItems, images: preparedImages, importKey, fingerprint };
}

async function commitImport(db, voucherRef, prepared, imagePaths, timestamp) {
  const importRef = voucherRef.collection("imports").doc(prepared.importKey);
  const inventory = voucherRef.collection("inventory");
  const codeRefs = prepared.items.map(({ code }) => voucherRef.collection("importedCodeIndex").doc(digest(code)));
  return db.runTransaction(async (transaction) => {
    const prior = await transaction.get(importRef);
    if (prior.exists) {
      if (prior.data().fingerprint !== prepared.fingerprint) throw new Error("__IMPORT_KEY_CONFLICT__");
      return { ...prior.data().result, alreadyImported: true };
    }
    const voucher = await transaction.get(voucherRef);
    if (!voucher.exists || voucher.data().deleted === true) throw new Error("__VOUCHER_NOT_FOUND__");
    const data = voucher.data();
    if (data.voucherType !== "imported") throw new Error("__VOUCHER_TYPE_INVALID__");
    const total = data.totalNumber;
    if (!Number.isSafeInteger(total) || total < 0 || !Number.isSafeInteger(total + prepared.items.length)) {
      throw new Error("__VOUCHER_STOCK_INVALID__");
    }
    if (imagePaths.length !== prepared.images.length ||
        imagePaths.some((image) => !image?.storagePath || !image?.contentType)) {
      throw new Error("__VOUCHER_STOCK_INVALID__");
    }
    for (const ref of codeRefs) {
      if ((await transaction.get(ref)).exists) throw new Error("__DUPLICATE_CODE__");
    }
    const items = prepared.items.map(({ code, imageIndex }) => ({
      code, ...imagePaths[imageIndex],
    }));
    items.forEach((item, index) => {
      transaction.create(inventory.doc(itemId(total + index)), {
        ...item, sequence: total + index, status: "available", createdAt: timestamp,
      });
    });
    codeRefs.forEach((ref) => transaction.create(ref, { createdAt: timestamp }));
    const nextTotal = total + items.length;
    transaction.update(voucherRef, { totalNumber: nextTotal, isActive: true, updatedAt: timestamp });
    const result = { importedCount: items.length, totalNumber: nextTotal };
    transaction.create(importRef, { fingerprint: prepared.fingerprint, result, createdAt: timestamp });
    return result;
  });
}

module.exports = {
  MAX_IMAGES, MAX_IMAGE_BYTES, MAX_TOTAL_IMAGE_BYTES, MAX_ITEMS,
  commitImport, decryptImage, encryptImage, itemId, prepareImport,
};
