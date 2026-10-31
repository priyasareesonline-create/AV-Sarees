/**
 * AV Sarees catalog: replace all products/collections with Elampillai set.
 * 2 collections + 2 products at ₹2 (test pricing) + home banner.
 * Usage: node --env-file=.env.local scripts/seed-priya-minimal.mjs
 */
import postgres from "postgres";
import dotenv from "dotenv";
import { loadProjectIdentity } from "./lib/load-project-identity.mjs";

dotenv.config({ path: ".env.local" });
const identity = loadProjectIdentity();
const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}
if (!url.includes(identity.supabase.projectRef)) {
  console.error("DATABASE_URL is not the Priya Supabase project");
  process.exit(1);
}

const sql = postgres(url, { max: 1, ssl: "require", prepare: false });

const medias = [
  {
    id: "ps-media-banner",
    key: "/images/priya-elampillai-banner.png",
    alt: "Elampillai soft silk saree — AV Sarees",
  },
  {
    id: "ps-media-soft-silk",
    key: "/images/priya-elampillai-soft-silk.png",
    alt: "Elampillai soft silk saree crimson and gold",
  },
  {
    id: "ps-media-semi-silk",
    key: "/images/priya-elampillai-semi-silk.png",
    alt: "Elampillai semi silk wedding saree",
  },
];

const collections = [
  {
    id: "ps-col-elampillai-soft",
    label: "Elampillai Soft Silk",
    slug: "elampillai-soft-silk",
    title: "Elampillai Soft Silk",
    description:
      "Soft silk sarees from the Elampillai tradition — light drape, rich zari borders.",
    featured_image_id: "ps-media-soft-silk",
    order: 1,
  },
  {
    id: "ps-col-elampillai-bridal",
    label: "Elampillai Bridal",
    slug: "elampillai-bridal",
    title: "Elampillai Bridal",
    description:
      "Festive and bridal Elampillai weaves with deep crimson and antique gold.",
    featured_image_id: "ps-media-semi-silk",
    order: 2,
  },
];

const products = [
  {
    id: "ps-prod-elampillai-soft",
    name: "Elampillai Soft Silk – Crimson Gold",
    slug: "elampillai-soft-silk-crimson-gold",
    product_code: "PS-EL-SOFT-01",
    description:
      "Elampillai soft silk saree in crimson with antique gold temple border. Test price ₹2.",
    featured: true,
    badge: "new_product",
    price: 2,
    stock: 50,
    collection_id: "ps-col-elampillai-soft",
    featured_image_id: "ps-media-soft-silk",
    images: ["/images/priya-elampillai-soft-silk.png"],
  },
  {
    id: "ps-prod-elampillai-bridal",
    name: "Elampillai Semi Silk – Bridal Wine",
    slug: "elampillai-semi-silk-bridal-wine",
    product_code: "PS-EL-BRIDE-01",
    description:
      "Elampillai semi-silk bridal saree with gold buttas and broad zari border. Test price ₹2.",
    featured: true,
    badge: "featured",
    price: 2,
    stock: 50,
    collection_id: "ps-col-elampillai-bridal",
    featured_image_id: "ps-media-semi-silk",
    images: ["/images/priya-elampillai-semi-silk.png"],
  },
];

const bannerSlides = {
  slides: [
    {
      id: "elampillai-hero",
      title: "Elampillai soft silk",
      subtitle: "Crimson and gold weaves from Tamil Nadu",
      href: "/shop",
      cta: "Shop now",
      image: "/images/priya-elampillai-banner.png",
      imageMediaId: "ps-media-banner",
      imageAlt: "Elampillai soft silk saree banner",
      productId: "ps-prod-elampillai-soft",
    },
    {
      id: "elampillai-bridal",
      title: "Bridal Elampillai",
      subtitle: "Festive semi-silk for weddings and celebrations",
      href: "/collections/elampillai-bridal",
      cta: "Explore",
      image: "/images/priya-elampillai-semi-silk.png",
      imageMediaId: "ps-media-semi-silk",
      imageAlt: "Elampillai bridal saree",
      productId: "ps-prod-elampillai-bridal",
    },
  ],
};

try {
  // Clear storefront catalog (keep users / settings / paid history tables intact)
  await sql`DELETE FROM carts`;
  await sql`DELETE FROM wishlist`;
  await sql`DELETE FROM product_medias`;
  await sql`DELETE FROM products`;
  await sql`DELETE FROM collections`;
  await sql`DELETE FROM medias`;

  for (const m of medias) {
    await sql`
      INSERT INTO medias (id, key, alt)
      VALUES (${m.id}, ${m.key}, ${m.alt})
    `;
  }
  for (const c of collections) {
    await sql`
      INSERT INTO collections (id, label, slug, title, description, featured_image_id, "order")
      VALUES (${c.id}, ${c.label}, ${c.slug}, ${c.title}, ${c.description}, ${c.featured_image_id}, ${c.order})
    `;
  }
  for (const p of products) {
    await sql`
      INSERT INTO products (
        id, name, slug, product_code, description, featured, badge, price, stock,
        collection_id, featured_image_id, images, is_draft
      )
      VALUES (
        ${p.id}, ${p.name}, ${p.slug}, ${p.product_code}, ${p.description},
        ${p.featured}, ${p.badge}, ${p.price}, ${p.stock},
        ${p.collection_id}, ${p.featured_image_id},
        ${sql.json(p.images)}, false
      )
    `;
  }

  await sql`
    INSERT INTO api_settings (key, value, is_enabled, updated_at)
    VALUES (
      'home_banner_slides',
      ${sql.json(bannerSlides)},
      true,
      NOW()
    )
    ON CONFLICT (key) DO UPDATE SET
      value = EXCLUDED.value,
      is_enabled = true,
      updated_at = NOW()
  `;

  const cols = await sql`SELECT label, slug FROM collections ORDER BY "order"`;
  const prods =
    await sql`SELECT name, slug, price::float AS price FROM products WHERE is_draft = false ORDER BY name`;
  console.log("OK collections:", cols);
  console.log("OK products:", prods);
  console.log("OK home_banner_slides enabled");
} catch (error) {
  console.error("FAIL:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
