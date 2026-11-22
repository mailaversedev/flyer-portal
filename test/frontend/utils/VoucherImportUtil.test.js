import { IMPORT_LIMITS, parsePairCsv, validateVoucherImport } from "../../../src/utils/VoucherImportUtil";

const image = (name, size = 1, type = "image/png") => ({ name, size, type });
const pair = (code, imageFilename) => ({ code, imageFilename });

test("parses CSV with BOM, quoted fields and leading zeros", () => {
  expect(parsePairCsv('\uFEFFcode,image_filename\r\n00123,a.png\r\n"a,b","b,c.png"\r\n"a""b",d.png'))
    .toEqual([pair("00123", "a.png"), pair("a,b", "b,c.png"), pair('a"b', "d.png")]);
});

test.each([
  ['code\n001', "csvHeaderInvalid"],
  ['code,image_filename\n001', "csvColumn"],
  ['code,image_filename\n"unclosed,a.png', "csvInvalid"],
  ['code,image_filename\n"a"x,a.png', "csvInvalid"],
])("rejects malformed or incomplete CSV", (csv, error) => {
  expect(() => parsePairCsv(csv)).toThrow(error);
});

test("matches filenames exactly independent of file order", () => {
  const pairs = [pair("001", "a.png"), pair("002", "b.png")];
  expect(validateVoucherImport(pairs, [image("b.png"), image("a.png")])).toEqual([]);
  expect(validateVoucherImport(pairs, [image("A.png"), image("b.png")])).toContain("importPairMismatch");
  expect(validateVoucherImport(pairs, [image("a.png")])).toContain("importPairMismatch");
  expect(validateVoucherImport(pairs, [image("a.png"), image("b.png"), image("c.png")])).toContain("importPairMismatch");
  expect(validateVoucherImport([pair("a", "a.png"), pair("b", "a.png")], [image("a.png"), image("a.png")]))
    .toEqual(expect.arrayContaining(["importFilenameInvalid", "importDuplicateImages"]));
});

test("enforces pair count, code uniqueness and UTF-8 byte limit", () => {
  const pairs = Array.from({ length: 100 }, (_, index) => pair(`00${index}`, `${index}.png`));
  const images = pairs.map(({ imageFilename }) => image(imageFilename));
  expect(validateVoucherImport(pairs, images)).toEqual([]);
  expect(validateVoucherImport([...pairs, pair("x", "x.png")], [...images, image("x.png")])).toContain("importItemLimit");
  expect(validateVoucherImport([pair("001", "a"), pair("001", "b")], [image("a"), image("b")])).toContain("importDuplicateCodes");
  expect(validateVoucherImport([pair(" ", "a")], [image("a")])).toContain("importCodeBlank");
  expect(validateVoucherImport([pair("中".repeat(171), "a")], [image("a")])).toContain("importCodeSize");
});

test("enforces image types and exact size boundaries", () => {
  const pairs = Array.from({ length: 4 }, (_, index) => pair(`${index}`, `${index}.png`));
  const images = pairs.map(({ imageFilename }) => image(imageFilename, IMPORT_LIMITS.imageBytes));
  expect(validateVoucherImport(pairs, images)).toEqual([]);
  expect(validateVoucherImport([pair("a", "a")], [image("a", IMPORT_LIMITS.imageBytes + 1)])).toContain("importImageSize");
  expect(validateVoucherImport([...pairs, pair("x", "x")], [...images, image("x")])).toContain("importCombinedSize");
  expect(validateVoucherImport([pair("a", "a")], [image("a", 1, "image/svg+xml")])).toContain("importImageType");
});
