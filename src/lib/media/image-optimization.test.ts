/**
 * @jest-environment node
 */
import {
  getStorefrontImageProps,
  isAppR2ProxySrc,
  shouldBypassImageOptimization,
} from "./image-optimization";

describe("image-optimization bypass", () => {
  it("detects app R2 proxy sources", () => {
    expect(isAppR2ProxySrc("/api/r2/uploads/foo.webp")).toBe(true);
    expect(
      isAppR2ProxySrc("https://priyasaree.com/api/r2/uploads/foo.webp"),
    ).toBe(true);
    expect(isAppR2ProxySrc("/images/av-sarees-logo.png")).toBe(false);
  });

  it("bypasses next/image for R2 proxy and local SVGs", () => {
    expect(
      shouldBypassImageOptimization("/api/r2/uploads/upload-abc.webp"),
    ).toBe(true);
    expect(
      shouldBypassImageOptimization("/images/priya-sarees-hero-festive.svg"),
    ).toBe(true);
    expect(shouldBypassImageOptimization("/images/av-sarees-logo.png")).toBe(
      false,
    );
    expect(getStorefrontImageProps("/api/r2/uploads/x.webp")).toEqual({
      unoptimized: true,
    });
  });
});
