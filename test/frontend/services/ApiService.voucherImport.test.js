import ApiService from "../../../src/services/ApiService";

afterEach(() => {
  jest.restoreAllMocks();
  ApiService.setAccessToken(null);
  delete global.fetch;
});

test("imports ordered multipart codes and images through authenticated request conventions", async () => {
  const images = [
    new File(["a"], "first.png", { type: "image/png" }),
    new File(["b"], "second.gif", { type: "image/gif" }),
  ];
  const result = { success: true, data: { totalNumber: 3 } };
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => result });
  ApiService.setAccessToken("test-access-token");
  expect(await ApiService.importAdminVoucher("saved-id", {
    codes: ["00123", " 00456 "], images, importKey: "stable-key",
  })).toEqual(result);
  const [url, options] = global.fetch.mock.calls[0];
  expect(url).toContain("/api/admin/vouchers/saved-id/import");
  expect(options.method).toBe("POST");
  expect(options.headers.Authorization).toBe("Bearer test-access-token");
  expect(options.headers["Content-Type"]).toBeUndefined();
  expect(options.credentials).toBe("include");
  expect(options.body.get("codes")).toBe('["00123"," 00456 "]');
  expect(options.body.get("importKey")).toBe("stable-key");
  expect(options.body.getAll("images").map((file) => file.name)).toEqual(["first.png", "second.gif"]);
});
