/**
 * Next/Image bypass rules for storefront media.
 *
 * Cloudflare in front of Vercel returns 404 for `/_next/image?url=/api/r2/...`
 * (matched path collapses to `/api/r2`). Serve those URLs with `unoptimized`
 * so the browser hits `/api/r2/...` directly.
 */

/** True when src is our authenticated R2 media proxy. */
export function isAppR2ProxySrc(src: string): boolean {
  if (!src) return false;
  try {
    if (src.startsWith("/api/r2/")) return true;
    if (src.startsWith("http://") || src.startsWith("https://")) {
      return new URL(src).pathname.startsWith("/api/r2/");
    }
  } catch {
    return false;
  }
  return false;
}

/** Skip the Next image optimizer for sources that break behind Cloudflare. */
export function shouldBypassImageOptimization(src: string): boolean {
  if (!src) return false;
  // Local SVGs (e.g. AV Sarees hero placeholders) skip the image optimizer.
  if (src.startsWith("/") && /\.svg(?:$|\?)/i.test(src)) return true;
  if (isAppR2ProxySrc(src)) return true;
  if (src.startsWith("/")) return false;
  if (src.startsWith("http://") || src.startsWith("https://")) return true;
  return false;
}

export function getStorefrontImageProps(src: string): { unoptimized?: true } {
  return shouldBypassImageOptimization(src) ? { unoptimized: true } : {};
}
