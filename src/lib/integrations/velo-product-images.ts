import { getCanonicalSiteOrigin } from "@/lib/auth/site-urls";
import db from "@/lib/supabase/db";
import { medias, productMedias, products } from "@/lib/supabase/schema";
import { STOREFRONT_IMAGE_FALLBACK, keytoUrl } from "@/lib/utils";
import { asc, eq, inArray, sql } from "drizzle-orm";

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

/**
 * Velosoft runs off-origin; relative `/api/r2/...` paths must become
 * https://localhost:3000/api/r2/... (or the configured canonical origin).
 * Never send the storefront SVG fallback as a product photo.
 */
export function toAbsoluteVeloImageUrl(
  keyOrUrl: string | null | undefined,
  siteOrigin = getCanonicalSiteOrigin(),
): string | null {
  if (!keyOrUrl?.trim()) return null;
  const raw = keyOrUrl.trim();
  if (raw.startsWith("data:image/")) return raw;

  let resolved = raw;
  if (!isHttpUrl(raw) && !raw.startsWith("/")) {
    try {
      resolved = keytoUrl(raw);
    } catch {
      return null;
    }
  } else if (raw.startsWith("/") && raw !== STOREFRONT_IMAGE_FALLBACK) {
    resolved = raw;
  } else if (isHttpUrl(raw)) {
    resolved = raw;
  } else {
    return null;
  }

  if (
    !resolved ||
    resolved === STOREFRONT_IMAGE_FALLBACK ||
    resolved.endsWith(STOREFRONT_IMAGE_FALLBACK)
  ) {
    return null;
  }

  if (isHttpUrl(resolved)) return resolved;
  if (resolved.startsWith("/")) {
    return `${siteOrigin.replace(/\/$/, "")}${resolved}`;
  }
  return null;
}

function urlFromUnknownImage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return toAbsoluteVeloImageUrl(value);
}

/**
 * Resolve public absolute image URLs for products (draft + published).
 * Preference:
 * 1) featured_image_id → medias.key
 * 2) featured_image_id stored as product_medias.id
 * 3) first product_medias gallery row by priority
 * 4) products.images JSON (urls or storage keys)
 */
export async function resolveProductImageUrls(
  productIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = [...new Set(productIds.map((id) => id.trim()).filter(Boolean))];
  if (!ids.length) return out;

  const featuredRows = await db
    .select({
      productId: products.id,
      imageKey: medias.key,
    })
    .from(products)
    .leftJoin(medias, eq(products.featuredImageId, medias.id))
    .where(inArray(products.id, ids));

  for (const row of featuredRows) {
    const url = urlFromUnknownImage(row.imageKey);
    if (url) out.set(row.productId, url);
  }

  let missing = ids.filter((id) => !out.has(id));
  if (missing.length) {
    const viaProductMediaId = await db
      .select({
        productId: products.id,
        imageKey: medias.key,
      })
      .from(products)
      .innerJoin(productMedias, eq(products.featuredImageId, productMedias.id))
      .innerJoin(medias, eq(productMedias.mediaId, medias.id))
      .where(inArray(products.id, missing));

    for (const row of viaProductMediaId) {
      if (out.has(row.productId)) continue;
      const url = urlFromUnknownImage(row.imageKey);
      if (url) out.set(row.productId, url);
    }
  }

  missing = ids.filter((id) => !out.has(id));
  if (missing.length) {
    const galleryRows = await db
      .select({
        productId: productMedias.productId,
        imageKey: medias.key,
        priority: productMedias.priority,
      })
      .from(productMedias)
      .innerJoin(medias, eq(productMedias.mediaId, medias.id))
      .where(inArray(productMedias.productId, missing))
      .orderBy(
        asc(sql`coalesce(${productMedias.priority}, 999999)`),
        asc(productMedias.id),
      );

    for (const row of galleryRows) {
      if (!row.imageKey || out.has(row.productId)) continue;
      const url = urlFromUnknownImage(row.imageKey);
      if (url) out.set(row.productId, url);
    }
  }

  missing = ids.filter((id) => !out.has(id));
  if (missing.length) {
    const jsonRows = await db
      .select({
        productId: products.id,
        images: products.images,
      })
      .from(products)
      .where(inArray(products.id, missing));

    for (const row of jsonRows) {
      if (out.has(row.productId)) continue;
      const images = Array.isArray(row.images) ? row.images : [];
      for (const entry of images) {
        const url = urlFromUnknownImage(entry);
        if (url) {
          out.set(row.productId, url);
          break;
        }
      }
    }
  }

  return out;
}
