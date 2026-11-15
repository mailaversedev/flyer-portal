export const IMPORT_LIMITS = {
  items: 100,
  codeBytes: 512,
  images: 20,
  imageBytes: 5 * 1024 * 1024,
  combinedBytes: 20 * 1024 * 1024,
};

export const IMPORT_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

export const parsePastedCodes = (text) =>
  text.split(/\r\n|\n|\r/).filter((code) => code.trim() !== "");

// A single-column CSV, including escaped quotes and newlines inside quoted cells.
export const parseCodeCsv = (text, hasHeader = false) => {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  let closedQuote = false;
  const source = text.replace(/^\uFEFF/, "");
  const finishRow = () => {
    row.push(cell);
    if (row.some((value) => value.trim() !== "") || row.length > 1) rows.push(row);
    row = [];
    cell = "";
    closedQuote = false;
  };

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
          closedQuote = true;
        }
      } else {
        cell += char;
      }
    } else if (char === "," || char === "\n" || char === "\r") {
      if (char === ",") {
        row.push(cell);
        cell = "";
        closedQuote = false;
      } else {
        finishRow();
        if (char === "\r" && source[index + 1] === "\n") index += 1;
      }
    } else if (char === '"' && cell === "" && !closedQuote) {
      quoted = true;
    } else {
      if (closedQuote || char === '"') throw new Error("csvInvalid");
      cell += char;
    }
  }
  if (quoted) throw new Error("csvInvalid");
  finishRow();
  if (rows.some((values) => values.length !== 1)) throw new Error("csvColumn");
  if (hasHeader) {
    if (rows[0]?.[0].trim().toLowerCase() !== "code") throw new Error("csvHeaderInvalid");
    rows.shift();
  }
  return rows.map(([code]) => code);
};

export const validateVoucherImport = (codes, images) => {
  const errors = [];
  if (codes.length + images.length > IMPORT_LIMITS.items) errors.push("importItemLimit");
  if (codes.some((code) => typeof code !== "string" || code.trim() === "")) {
    errors.push("importCodeBlank");
  }
  if (codes.some((code) => typeof code === "string" && new Blob([code]).size > IMPORT_LIMITS.codeBytes)) {
    errors.push("importCodeSize");
  }
  if (new Set(codes).size !== codes.length) errors.push("importDuplicateCodes");
  if (images.length > IMPORT_LIMITS.images) errors.push("importImageLimit");
  if (images.some((file) => !IMPORT_IMAGE_TYPES.includes(file.type))) errors.push("importImageType");
  if (images.some((file) => file.size > IMPORT_LIMITS.imageBytes)) errors.push("importImageSize");
  if (images.reduce((total, file) => total + file.size, 0) > IMPORT_LIMITS.combinedBytes) {
    errors.push("importCombinedSize");
  }
  const fileKeys = images.map((file) => JSON.stringify([file.name, file.size, file.type, file.lastModified]));
  if (new Set(fileKeys).size !== images.length) errors.push("importDuplicateImages");
  return errors;
};
