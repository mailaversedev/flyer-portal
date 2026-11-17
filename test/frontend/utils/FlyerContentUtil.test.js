import {
  createCreativeDefaults,
  getCreativeValidationErrors,
  getFlyerGenerationTokenCost,
  mergeFlyerContent,
  withoutCreativeFiles,
} from "../../../src/utils/FlyerContentUtil";

test("creative defaults preserve type-specific settings and independent typography", () => {
  const scan = createCreativeDefaults();
  const read = createCreativeDefaults("4:5", "2K");
  expect(scan).toEqual(expect.objectContaining({ aspectRatio: "1:1", resolution: "1K", productPhoto: [] }));
  expect(read).toEqual(expect.objectContaining({ aspectRatio: "4:5", resolution: "2K" }));
  scan.typography[0].value = "Changed";
  expect(read.typography[0].value).toBe("FS Albert Pro");
});

test.each([["1K", 1], ["2K", 2], ["4K", 4], ["1k", 1], [undefined, 2]])(
  "generation token cost for %s is %s",
  (resolution, cost) => expect(getFlyerGenerationTokenCost(resolution)).toBe(cost),
);

test.each([
  "flyerPrompts", "aspectRatio", "resolution", "primaryColor", "secondaryColor",
  "typography", "brandVoice", "logoImage", "referenceFlyer", "productPhoto", "companyId",
])("%s changes invalidate generated covers but not uploaded covers", (field) => {
  const data = { ...createCreativeDefaults(), coverPhoto: "https://example.com/cover.png" };
  const updates = { [field]: "changed" };
  expect(mergeFlyerContent(data, updates).coverPhoto).toBeNull();
  expect(mergeFlyerContent(data, updates, true).coverPhoto).toBe(data.coverPhoto);
});

test("unchanged creative inputs and metadata-only updates reuse prepared covers", () => {
  const data = { ...createCreativeDefaults(), coverPhoto: "https://example.com/cover.png" };
  expect(mergeFlyerContent(data, { ...data }).coverPhoto).toBe(data.coverPhoto);
  expect(mergeFlyerContent(data, { website: "https://example.com/new", venue: "Hall", header: "Title" }).coverPhoto).toBe(data.coverPhoto);
});

test("publication excludes transient creative files but retains content and design settings", () => {
  expect(withoutCreativeFiles({
    header: "Title", resolution: "2K", referenceFlyer: {}, productPhoto: [],
    backgroundPhoto: {}, logoImage: {}, coverPhoto: "https://example.com/cover.png",
  })).toEqual({ header: "Title", resolution: "2K", coverPhoto: "https://example.com/cover.png" });
});

test("creative validation does not make QR copy mandatory and localizes errors", () => {
  const t = (key) => key;
  expect(getCreativeValidationErrors({}, t)).toEqual({
    aspectRatio: "flyerContent.ratioRequired", flyerPrompts: "flyerContent.promptRequired",
  });
  expect(getCreativeValidationErrors({ aspectRatio: "1:1", flyerPrompts: "Image" }, t)).toEqual({});
});
