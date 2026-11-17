import ApiService from "../../../src/services/ApiService";

afterEach(() => {
  jest.restoreAllMocks();
  ApiService.setAccessToken(null);
  delete global.fetch;
});

test.each(["code", "image"])("imports %s multipart inventory through authenticated request conventions", async (kind) => {
  const images = [
    new File(["a"], "first.png", { type: "image/png" }),
    new File(["b"], "second.gif", { type: "image/gif" }),
  ];
  const codes = ["00123", " 00456 "];
  const result = { success: true, data: { totalNumber: 2 } };
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => result });
  ApiService.setAccessToken("test-access-token");
  expect(await ApiService.importAdminVoucher("saved-id", {
    codes: kind === "code" ? codes : [], images: kind === "image" ? images : [], importKey: "stable-key",
  })).toEqual(result);
  const [url, options] = global.fetch.mock.calls[0];
  expect(url).toContain("/api/admin/vouchers/saved-id/import");
  expect(options.method).toBe("POST");
  expect(options.headers.Authorization).toBe("Bearer test-access-token");
  expect(options.headers["Content-Type"]).toBeUndefined();
  expect(options.credentials).toBe("include");
  expect(options.body.get("codes")).toBe(JSON.stringify(kind === "code" ? codes : []));
  expect(options.body.get("importKey")).toBe("stable-key");
  expect(options.body.getAll("images").map((file) => file.name))
    .toEqual(kind === "image" ? ["first.png", "second.gif"] : []);
});
