import ApiService from "../../../src/services/ApiService";

afterEach(() => {
  jest.restoreAllMocks();
  ApiService.setAccessToken(null);
  delete global.fetch;
});

test("sends explicit pair mapping with authenticated multipart request", async () => {
  const images = [
    new File(["a"], "first.png", { type: "image/png" }),
    new File(["b"], "second.gif", { type: "image/gif" }),
  ];
  const pairs = [{ code: "00123", imageFilename: "second.gif" }, { code: " 00456 ", imageFilename: "first.png" }];
  const result = { success: true, data: { totalNumber: 2 } };
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => result });
  ApiService.setAccessToken("test-access-token");
  expect(await ApiService.importAdminVoucher("saved-id", { pairs, images, importKey: "stable-key" })).toEqual(result);
  const [url, options] = global.fetch.mock.calls[0];
  expect(url).toContain("/api/admin/vouchers/saved-id/import");
  expect(options.method).toBe("POST");
  expect(options.headers.Authorization).toContain("test-access-token");
  expect(options.headers["Content-Type"]).toBeUndefined();
  expect(options.credentials).toBe("include");
  expect(JSON.parse(options.body.get("items"))).toEqual([{ code: "00123", imageIndex: 1 }, { code: " 00456 ", imageIndex: 0 }]);
  expect(options.body.get("importKey")).toBe("stable-key");
  expect(options.body.getAll("images").map((file) => file.name)).toEqual(["first.png", "second.gif"]);
});
