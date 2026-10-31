import {
  SOCIAL_IMAGE_FALLBACK_PATH,
  absoluteSocialFallbackUrl,
  buildSocialImages,
  resolveSocialImageUrl,
  type SocialImageResolveDeps,
} from "./social-image";

const deps: SocialImageResolveDeps = {
  siteOrigin: "http://localhost:3000",
  resolveMediaUrl: (key: string) => {
    if (key.startsWith("http://") || key.startsWith("https://")) return key;
    if (key.startsWith("/")) return key;
    return `https://cdn.example.com/${key}`;
  },
};

describe("resolveSocialImageUrl", () => {
  it("falls back when key is missing", () => {
    expect(resolveSocialImageUrl(undefined, deps)).toBe(
      `http://localhost:3000${SOCIAL_IMAGE_FALLBACK_PATH}`,
    );
    expect(resolveSocialImageUrl(null, deps)).toBe(
      absoluteSocialFallbackUrl("http://localhost:3000"),
    );
    expect(resolveSocialImageUrl("   ", deps)).toBe(
      absoluteSocialFallbackUrl("http://localhost:3000"),
    );
  });

  it("returns absolute CDN URLs for media keys", () => {
    expect(resolveSocialImageUrl("uploads/banner.png", deps)).toBe(
      "https://cdn.example.com/uploads/banner.png",
    );
  });

  it("absolutizes relative non-SVG paths", () => {
    expect(resolveSocialImageUrl("/images/og-default.jpg", deps)).toBe(
      "http://localhost:3000/images/og-default.jpg",
    );
    expect(resolveSocialImageUrl("/images/av-sarees-logo.png", deps)).toBe(
      "http://localhost:3000/images/av-sarees-logo.png",
    );
  });

  it("rejects SVG paths", () => {
    expect(
      resolveSocialImageUrl("/images/priya-sarees-wordmark.svg", deps),
    ).toBe(absoluteSocialFallbackUrl("http://localhost:3000"));
  });

  it("rejects Next image optimizer URLs", () => {
    expect(
      resolveSocialImageUrl(
        "http://localhost:3000/_next/image?url=%2Fuploads%2Fa.png&w=1200",
        deps,
      ),
    ).toBe(absoluteSocialFallbackUrl("http://localhost:3000"));
  });

  it("keeps https media URLs", () => {
    expect(
      resolveSocialImageUrl(
        "https://pub-7298c413a12641b5ba5dd9bff2d9009f.r2.dev/uploads/a.png",
        deps,
      ),
    ).toBe("https://pub-7298c413a12641b5ba5dd9bff2d9009f.r2.dev/uploads/a.png");
  });
});

describe("buildSocialImages", () => {
  it("returns Metadata-ready openGraph and twitter images", () => {
    const meta = buildSocialImages("uploads/banner.png", "Devin", deps);
    expect(meta.openGraph?.images).toEqual([
      {
        url: "https://cdn.example.com/uploads/banner.png",
        width: 1200,
        height: 630,
        alt: "Devin",
      },
    ]);
    expect(meta.twitter).toEqual({
      card: "summary_large_image",
      images: ["https://cdn.example.com/uploads/banner.png"],
    });
  });
});
