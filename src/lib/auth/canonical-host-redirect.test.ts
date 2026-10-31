import { buildCanonicalRedirectUrl } from "./canonical-host-redirect";

const CANONICAL = "http://localhost:3000";

describe("buildCanonicalRedirectUrl", () => {
  it("redirects workers.dev to the canonical origin", () => {
    expect(
      buildCanonicalRedirectUrl(
        "https://priya-sarees.vercel.app/shop",
        "priya-sarees.vercel.app",
        CANONICAL,
      ),
    ).toBe("http://localhost:3000/shop");
  });

  it("preserves query strings through redirect", () => {
    expect(
      buildCanonicalRedirectUrl(
        "https://priya-sarees.vercel.app/?code=abc123",
        "priya-sarees.vercel.app",
        CANONICAL,
      ),
    ).toBe("http://localhost:3000/?code=abc123");
  });

  it("does not redirect the canonical host", () => {
    expect(
      buildCanonicalRedirectUrl(
        "http://localhost:3000/shop",
        "localhost",
        CANONICAL,
      ),
    ).toBeNull();
  });

  it("does not redirect 127.0.0.1", () => {
    expect(
      buildCanonicalRedirectUrl(
        "http://127.0.0.1:3000/shop",
        "127.0.0.1",
        CANONICAL,
      ),
    ).toBeNull();
  });
});
