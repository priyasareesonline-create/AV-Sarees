import { env } from "@/env.mjs";

export type ImageDeliveryMode = "cloudflare" | "legacy";

export type CdnImageOptions = {
  /** Target display width in CSS pixels (served via CF Images). */
  width: number;
  quality?: number;
  format?: "webp" | "avif" | "jpeg";
};

export const CDN_PRESETS = {
  thumb: { width: 200, quality: 70, format: "webp" as const },
  card: { width: 400, quality: 75, format: "webp" as const },
  pdp: { width: 800, quality: 78, format: "webp" as const },
  /** Mobile LCP hero — smaller than desktop `hero` so high-DPR phones do not pull 1200w. */
  heroMobile: { width: 800, quality: 75, format: "webp" as const },
  hero: { width: 1200, quality: 78, format: "webp" as const },
} as const;

/**
 * Pick CDN quality/format for an optimizeWidth so preload URLs match
 * StorefrontImage (e.g. 1200 → hero q=78, not card q=75).
 */
export function cdnPresetForWidth(width: number): CdnImageOptions {
  const w = Math.round(width);
  if (w >= CDN_PRESETS.hero.width) {
    return { ...CDN_PRESETS.hero, width: w };
  }
  if (w >= CDN_PRESETS.pdp.width) {
    return { ...CDN_PRESETS.pdp, width: w };
  }
  if (w >= CDN_PRESETS.card.width) {
    return { ...CDN_PRESETS.card, width: w };
  }
  return { ...CDN_PRESETS.thumb, width: w };
}

const DEFAULT_MEDIA_ORIGIN = "";
const FALLBACK = "/images/priya-sarees-hero-festive.svg";

export function getImageDeliveryMode(): ImageDeliveryMode {
  // Use legacy (raw R2) until NEXT_PUBLIC_MEDIA_CDN_ORIGIN points at the
  // AV Sarees media worker. Set NEXT_PUBLIC_IMAGE_DELIVERY_MODE=cloudflare
  // after that worker is live.
  const raw = String(process.env.NEXT_PUBLIC_IMAGE_DELIVERY_MODE ?? "legacy")
    .trim()
    .toLowerCase();
  return raw === "legacy" ? "legacy" : "cloudflare";
}

function mediaOrigin(): string {
  const fromEnv = String(
    process.env.NEXT_PUBLIC_MEDIA_CDN_ORIGIN ?? DEFAULT_MEDIA_ORIGIN,
  )
    .trim()
    .replace(/\/$/, "");
  return fromEnv || DEFAULT_MEDIA_ORIGIN;
}

function cdnPublicBase(): string | null {
  const fromProcess = process.env.NEXT_PUBLIC_CDN_URL?.replace(/\/$/, "");
  if (fromProcess) return fromProcess;
  try {
    return env.NEXT_PUBLIC_CDN_URL.replace(/\/$/, "");
  } catch {
    return null;
  }
}

/**
 * Extract an R2 object key from a storefront media URL or raw key.
 * Returns null for local assets / unknown hosts (leave as-is).
 */
function keyFromApiR2Path(pathname: string): string | null {
  if (!pathname.startsWith("/api/r2/")) return null;
  const key = decodeURIComponent(pathname.slice("/api/r2/".length));
  if (!key.startsWith("uploads/") || key.includes("..")) return null;
  return key;
}

export function extractMediaObjectKey(keyOrUrl: string): string | null {
  const raw = keyOrUrl.trim();
  if (!raw || raw === FALLBACK) return null;

  // App R2 proxy paths (used when CDN URL is private S3 API).
  if (raw.startsWith("/api/r2/")) {
    return keyFromApiR2Path(raw.split("?")[0] ?? raw);
  }

  if (raw.startsWith("/")) return null;

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      const url = new URL(raw);
      const fromProxy = keyFromApiR2Path(url.pathname);
      if (fromProxy) return fromProxy;
      if (url.origin === mediaOrigin() && mediaOrigin()) {
        const m = url.pathname.match(/^\/cdn\/[^/]+\/(.+)$/);
        return m?.[1] ? decodeURIComponent(m[1]) : null;
      }
      const base = cdnPublicBase();
      if (base) {
        const baseUrl = new URL(base);
        if (url.hostname === baseUrl.hostname) {
          return decodeURIComponent(url.pathname.replace(/^\//, ""));
        }
      }
      if (url.hostname.endsWith(".r2.dev")) {
        return decodeURIComponent(url.pathname.replace(/^\//, ""));
      }
      return null;
    } catch {
      return null;
    }
  }

  if (raw.includes("..") || raw.startsWith("sakthi/")) return null;
  return raw.replace(/^\//, "");
}

/**
 * Build a Cloudflare Images resize URL on localhost:3000.
 * Falls back to the original key/URL when mode is legacy or key is not CDN media.
 */
export function cdnImageUrl(
  keyOrUrl: string | null | undefined,
  options: CdnImageOptions,
): string {
  if (!keyOrUrl?.trim()) return FALLBACK;
  const input = keyOrUrl.trim();
  if (getImageDeliveryMode() === "legacy") return input;

  const key = extractMediaObjectKey(input);
  if (!key || !key.startsWith("uploads/")) {
    return input.startsWith("http") || input.startsWith("/") ? input : FALLBACK;
  }

  const width = Math.min(
    1600,
    Math.max(16, Math.round(options.width || CDN_PRESETS.card.width)),
  );
  const quality = Math.min(
    100,
    Math.max(20, Math.round(options.quality ?? CDN_PRESETS.card.quality)),
  );
  const format = options.format ?? "webp";
  const opts = `w=${width},q=${quality},f=${format}`;
  return `${mediaOrigin()}/cdn/${opts}/${key}`;
}
