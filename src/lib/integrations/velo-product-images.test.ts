import { STOREFRONT_IMAGE_FALLBACK } from "@/lib/utils";
import { toAbsoluteVeloImageUrl } from "./velo-product-images";

describe("toAbsoluteVeloImageUrl", () => {
  const origin = "https://localhost:3000";

  it("returns absolute https URLs unchanged", () => {
    expect(
      toAbsoluteVeloImageUrl("https://cdn.example.com/a.webp", origin),
    ).toBe("https://cdn.example.com/a.webp");
  });

  it("prefixes relative /api/r2 paths with Priya canonical origin", () => {
    expect(
      toAbsoluteVeloImageUrl("/api/r2/uploads/upload-abc.webp", origin),
    ).toBe("https://localhost:3000/api/r2/uploads/upload-abc.webp");
  });

  it("rejects empty and storefront fallback SVG", () => {
    expect(toAbsoluteVeloImageUrl(null, origin)).toBeNull();
    expect(toAbsoluteVeloImageUrl("", origin)).toBeNull();
    expect(toAbsoluteVeloImageUrl(STOREFRONT_IMAGE_FALLBACK, origin)).toBeNull();
  });

  it("keeps data URLs", () => {
    expect(toAbsoluteVeloImageUrl("data:image/png;base64,xx", origin)).toBe(
      "data:image/png;base64,xx",
    );
  });
});
