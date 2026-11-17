import { IMPORT_LIMITS, parseCodeCsv, parsePastedCodes, validateVoucherImport } from "../../../src/utils/VoucherImportUtil";

test("paste keeps leading zeros and spaces, ignoring only blank lines", () => {
  expect(parsePastedCodes("00123\r\n\n 0007 \rABC\n  ")).toEqual(["00123", " 0007 ", "ABC"]);
});

test("CSV handles BOM, optional header, quoted commas, escaped quotes and newlines", () => {
  expect(parseCodeCsv('\uFEFFcode\r\n00123\r\n"a,b"\r\n"a""b"\r\n"line\nbreak"\r\n', true))
    .toEqual(["00123", "a,b", 'a"b', "line\nbreak"]);
  expect(parseCodeCsv("code\n0001")).toEqual(["code", "0001"]);
  expect(parseCodeCsv(' 0001 \n\n"0002"')).toEqual([" 0001 ", "0002"]);
});

test.each(['"unclosed', 'a"b', '"a"x'])("rejects malformed CSV: %s", (csv) => {
  expect(() => parseCodeCsv(csv)).toThrow("csvInvalid");
});

test("rejects multiple columns and an incorrect explicit header", () => {
  expect(() => parseCodeCsv("a,b")).toThrow("csvColumn");
  expect(() => parseCodeCsv("code\n001,")).toThrow("csvColumn");
  expect(() => parseCodeCsv("001\n002", true)).toThrow("csvHeaderInvalid");
});

const image = (name, size = 1, type = "image/png") => ({ name, size, type, lastModified: 1 });

test("enforces total items and exact code duplicates without numeric conversion", () => {
  const codes = Array.from({ length: 100 }, (_, index) => `00${index}`);
  expect(validateVoucherImport(codes, [])).toEqual([]);
  expect(validateVoucherImport(codes, [image("a")])).toContain("importItemLimit");
  expect(validateVoucherImport(["001"], [image("a")])).toContain("importMixedTypes");
  expect(validateVoucherImport(["001", "1"], [])).toEqual([]);
  expect(validateVoucherImport(["001", "001"], [])).toContain("importDuplicateCodes");
});

test.each(["", " ", "\t\r\n", "\u3000"])("rejects whitespace-only code %j", (code) => {
  expect(validateVoucherImport([code], [])).toContain("importCodeBlank");
});

test.each([
  ["a".repeat(512), "a".repeat(513)],
  ["中".repeat(170) + "ab", "中".repeat(171)],
  ["😀".repeat(128), "😀".repeat(128) + "a"],
  [" " + "0".repeat(510) + " ", " " + "0".repeat(511) + " "],
])("counts UTF-8 bytes including preserved whitespace", (valid, invalid) => {
  expect(validateVoucherImport([valid], [])).toEqual([]);
  expect(validateVoucherImport([invalid], [])).toContain("importCodeSize");
});

test("enforces image counts, MIME types and duplicate selections", () => {
  const images = Array.from({ length: 100 }, (_, index) => image(`${index}`));
  expect(validateVoucherImport([], images)).toEqual([]);
  expect(validateVoucherImport([], [...images, image("extra")])).toContain("importImageLimit");
  expect(validateVoucherImport([], [image("svg", 1, "image/svg+xml")])).toContain("importImageType");
  expect(validateVoucherImport([], [image("a"), image("a")])).toContain("importDuplicateImages");
  for (const type of ["image/png", "image/jpeg", "image/gif", "image/webp"]) {
    expect(validateVoucherImport([], [image(type, 1, type)])).toEqual([]);
  }
});

test("accepts size boundaries and rejects one byte over", () => {
  const images = Array.from({ length: 4 }, (_, index) => image(`${index}`, IMPORT_LIMITS.imageBytes));
  expect(validateVoucherImport([], images)).toEqual([]);
  expect(validateVoucherImport([], [image("a", IMPORT_LIMITS.imageBytes + 1)])).toContain("importImageSize");
  expect(validateVoucherImport([], [...images, image("extra")])).toContain("importCombinedSize");
});
