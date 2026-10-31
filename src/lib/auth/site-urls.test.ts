import {
  getAllowedAuthOrigins,
  getAuthCallbackUrls,
  resolveOAuthBrowserOrigin,
} from "./site-urls";

describe("resolveOAuthBrowserOrigin", () => {
  const prev = process.env.NEXT_PUBLIC_SITE_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = prev;
  });

  it("keeps www when the shopper opened www (PKCE-safe)", () => {
    expect(resolveOAuthBrowserOrigin("http://localhost:3000")).toBe(
      "http://localhost:3000",
    );
  });

  it("keeps apex when the shopper opened apex", () => {
    expect(resolveOAuthBrowserOrigin("http://localhost:3000")).toBe(
      "http://localhost:3000",
    );
  });

  it("falls back to canonical for unknown hosts", () => {
    expect(resolveOAuthBrowserOrigin("https://evil.example")).toBe(
      "http://localhost:3000",
    );
  });
});

describe("getAuthCallbackUrls", () => {
  it("includes apex and www callbacks", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    const urls = getAuthCallbackUrls();
    expect(urls).toEqual(
      expect.arrayContaining([
        "http://localhost:3000/auth/callback",
        "http://localhost:3000/auth/callback",
      ]),
    );
    expect(getAllowedAuthOrigins()).toEqual(
      expect.arrayContaining([
        "http://localhost:3000",
        "http://localhost:3000",
      ]),
    );
  });
});
