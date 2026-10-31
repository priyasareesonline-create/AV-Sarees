import { Suspense } from "react";
import Header from "@/components/layouts/Header";
import { Shell } from "@/components/layouts/Shell";
import { AddProductToCartForm } from "@/features/carts";
import {
  BuyNowButton,
  LowStockNotice,
  ProductCard,
  ProductImageShowcase,
} from "@/features/products";
import { AddToWishListButton } from "@/features/wishlists";
import {
  getProductOptionDisplayName,
  getProductSizeConfig,
  getProductSizePreviewsByIds,
} from "@/lib/products/sizeConfig";
import { buildBreadcrumbJsonLd, buildProductJsonLd } from "@/lib/seo/json-ld";
import { buildSocialImages } from "@/lib/seo/social-image";
import { getPublishedProductDetailCached } from "@/lib/storefront/product-detail";
import {
  formatPackLabelFromSnapshot,
  getProductStorefrontSnapshotsByIds,
} from "@/lib/storefront/product-storefront-snapshot";
import {
  ProductDiscountBadge,
  ProductPriceDisplay,
} from "@/features/products/components/ProductPriceDisplay";
import { ProductBuyBox } from "@/features/products/components/ProductBuyBox";
import { getEffectiveProductPrice } from "@/lib/products/discount";
import { formatProductPackLabel } from "@/lib/products/pack";
import { withFallback } from "@/lib/resilience";
import {
  resolveCourierChargesConfig,
  toGstInclusiveAmount,
} from "@/lib/integrations/settings";
import {
  resolveProductPricingForSelection,
  toProductDiscountFields,
} from "@/lib/products/pricing";
import { keytoUrl } from "@/lib/utils";
import { JsonLd } from "@/components/seo/JsonLd";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductInfoRows } from "@/features/products/components/ProductInfoRows";
import { SafeCheckoutBadges } from "@/features/products/components/SafeCheckoutBadges";
import { ProductMobileBuyBar } from "@/features/products/components/ProductMobileBuyBar";
import { PdpQuantityStepper } from "@/features/products/components/PdpQuantityStepper";
import {
  getShortDescription,
  hasMoreThanShortDescription,
} from "@/lib/products/short-description";
import { getDeliveryEstimate } from "@/lib/datetime/delivery-estimate";
import { getCanonicalSiteOrigin } from "@/lib/auth/site-urls";

export const revalidate = 120;

type Props = {
  params: Promise<{
    slug: string;
  }>;
};
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  const data = await getPublishedProductDetailCached(resolvedParams.slug);
  const product = data?.productsCollection?.edges?.[0]?.node;
  const productName = product?.name;
  const path = `/shop/${resolvedParams.slug}`;

  if (productName) {
    const productDescription =
      product?.description?.trim() ||
      `Buy ${productName} online from AV Sarees. Silk, cotton and wedding sarees with secure checkout.`;
    const social = buildSocialImages(product?.featuredImage?.key, productName);
    return {
      title: productName,
      description: productDescription,
      alternates: {
        canonical: path,
      },
      openGraph: {
        title: `${productName} | AV Sarees`,
        description: productDescription,
        url: path,
        ...social.openGraph,
      },
      twitter: {
        ...social.twitter,
        title: `${productName} | AV Sarees`,
        description: productDescription,
      },
    };
  }

  return {
    title: "AV Sarees | Silk, cotton & wedding sarees",
    description:
      "AV Sarees — silk, cotton, wedding and festive sarees with secure checkout.",
  };
}

async function ProductDetailPage({ params }: Props) {
  const resolvedParams = await params;
  const data = await getPublishedProductDetailCached(resolvedParams.slug);

  const productEdge = data?.productsCollection?.edges?.[0];
  if (!productEdge?.node) return notFound();

  const { id, name, description, stock, featuredImage } = productEdge.node;
  const productSlug = resolvedParams.slug;
  const recommendationIds =
    data.recommendations?.edges?.map(({ node }) => node.id) ?? [];
  const snapshotIds = [id, ...recommendationIds];

  // Sequential Postgres reads — one query at a time on the pooler singleton.
  const sizeConfig = await getProductSizeConfig(id);
  const snapshots = await withFallback(
    "pdp:snapshots",
    () => getProductStorefrontSnapshotsByIds(snapshotIds),
    new Map(),
  );
  const recommendationSizePreviews =
    await getProductSizePreviewsByIds(recommendationIds);

  const mainSnapshot = snapshots.get(id);
  const isDigital = mainSnapshot?.isDigital ?? false;
  const digitalFileName = mainSnapshot?.digitalFileName ?? null;
  const packLabel = formatProductPackLabel(mainSnapshot?.packFields);
  const resolvedPricing = mainSnapshot?.pricing;
  const recommendationPackLabels = Object.fromEntries(
    recommendationIds.map((recId) => [
      recId,
      formatPackLabelFromSnapshot(snapshots.get(recId)),
    ]),
  );
  const pricingProduct = resolvedPricing
    ? toProductDiscountFields(resolvedPricing)
    : productEdge.node;
  const hasConfiguredSizes =
    !isDigital &&
    sizeConfig.enabled &&
    (sizeConfig.groups?.some((group) =>
      group.options.some((option) => Number(option.qty ?? 0) > 0),
    ) ??
      sizeConfig.options.some((option) => Number(option.qty ?? 0) > 0));
  const optionName = getProductOptionDisplayName(sizeConfig);
  const displayPricing = hasConfiguredSizes
    ? toProductDiscountFields(
        resolveProductPricingForSelection({
          product: pricingProduct,
          sizeConfig,
          preferMinWhenUnselected: true,
        }),
      )
    : pricingProduct;

  const storefrontSizeLabels = sizeConfig.groups?.length
    ? sizeConfig.groups.flatMap((group) =>
        group.options
          .filter((option) => Number(option.qty ?? 0) > 0)
          .map((option) => {
            const value = String(option.value ?? option.size ?? "")
              .trim()
              .toUpperCase();
            const label = !value
              ? `${option.qty}`
              : /^[A-Z]+$/.test(value)
                ? `${value} : ${option.qty}`
                : value;
            return sizeConfig.groups.length > 1
              ? `${group.name}: ${label}`
              : label;
          }),
      )
    : sizeConfig.options
        .filter((option) => Number(option.qty ?? 0) > 0)
        .map((option) => {
          const value = String(option.value ?? option.size ?? "")
            .trim()
            .toUpperCase();
          if (!value) return `${option.qty}`;
          if (/^[A-Z]+$/.test(value)) return `${value} : ${option.qty}`;
          return value;
        });

  const availableLabel =
    (sizeConfig.groups?.length ?? 0) > 1
      ? "Available options"
      : `Available ${optionName.toLowerCase()}`;

  const shortDescription = getShortDescription(description);
  const showFullDescription = hasMoreThanShortDescription(description);
  const siteOrigin = getCanonicalSiteOrigin().replace(/\/$/, "");
  const productUrl = `${siteOrigin}/shop/${productSlug}`;
  const featuredImageUrl = featuredImage?.key
    ? keytoUrl(featuredImage.key)
    : null;
  const shareImageUrl = featuredImageUrl
    ? featuredImageUrl.startsWith("/")
      ? `${siteOrigin}${featuredImageUrl}`
      : featuredImageUrl
    : null;
  const isOutOfStock =
    !hasConfiguredSizes && typeof stock === "number" && stock <= 0;

  const courierConfig = await resolveCourierChargesConfig();
  const jsonLdPrice = toGstInclusiveAmount(
    getEffectiveProductPrice(displayPricing),
    courierConfig,
  );

  return (
    <Shell>
      <JsonLd
        data={[
          buildBreadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Shop", path: "/shop" },
            { name, path: `/shop/${productSlug}` },
          ]),
          buildProductJsonLd({
            name,
            slug: productSlug,
            description,
            price: jsonLdPrice,
            imageUrl: featuredImage?.key ? keytoUrl(featuredImage.key) : null,
            inStock: Number(stock ?? 0) > 0,
          }),
        ]}
      />
      <div className="grid grid-cols-12 gap-x-8 gap-y-4 md:gap-y-8">
        <div className="space-y-4 relative col-span-12 md:col-span-7 md:space-y-8 min-w-0 overflow-hidden">
          <div className="relative min-w-0 w-full max-w-full">
            <ProductDiscountBadge
              product={displayPricing}
              className="absolute top-3 left-3 z-10"
            />
            <ProductImageShowcase data={productEdge.node} />
          </div>
        </div>

        <div className="col-span-12 md:col-span-5 min-w-0">
          <section className="flex justify-between items-start max-w-lg">
            <div>
              <h1 className="mb-2 text-2xl font-semibold tracking-wide sm:mb-3 sm:text-3xl md:text-4xl">
                {name}
              </h1>
              {shortDescription ? (
                <p className="mb-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {shortDescription}
                </p>
              ) : null}
              {!hasConfiguredSizes ? (
                <>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <ProductPriceDisplay
                      product={pricingProduct}
                      layout="inline"
                      saleClassName="text-lg sm:text-2xl"
                      originalClassName="text-xs sm:text-base"
                    />
                    {!isOutOfStock ? (
                      <PdpQuantityStepper productId={id} stock={stock} />
                    ) : null}
                  </div>
                  {packLabel ? (
                    <p className="mb-3 text-sm font-medium text-foreground/80">
                      {packLabel}
                      <span className="ml-1 font-normal text-muted-foreground">
                        · Qty 1 = 1 set
                      </span>
                    </p>
                  ) : null}
                </>
              ) : null}
              <LowStockNotice
                stock={stock}
                className="text-sm font-medium text-destructive"
              />
              {isDigital ? (
                <p className="text-sm font-medium text-foreground">
                  Digital file
                  {digitalFileName ? (
                    <>
                      : <span className="font-semibold">{digitalFileName}</span>
                    </>
                  ) : null}
                  . After payment you’ll get a Download button on the order
                  page.
                </p>
              ) : null}
              {hasConfiguredSizes ? (
                <p className="text-sm text-muted-foreground">
                  {availableLabel}: {storefrontSizeLabels.join(", ")}
                </p>
              ) : null}
            </div>
            <AddToWishListButton productId={id} />
          </section>

          <ProductInfoRows
            productName={name}
            productUrl={productUrl}
            imageUrl={shareImageUrl}
            initialDeliveryLabel={getDeliveryEstimate().label}
            showDelivery={!isDigital && !isOutOfStock}
          />

          {!isOutOfStock ? <SafeCheckoutBadges /> : null}

          <section id="product-buy-box" className="mb-8 scroll-mt-28 space-y-5">
            <Suspense>
              {hasConfiguredSizes ? (
                <ProductBuyBox
                  productId={id}
                  stock={stock}
                  sizeConfig={sizeConfig}
                  pricingProduct={pricingProduct}
                  packLabel={packLabel}
                />
              ) : (
                <div className="hidden items-end space-x-5 md:flex">
                  <AddProductToCartForm
                    productId={id}
                    stock={stock}
                    sizeConfig={sizeConfig}
                  />
                  <BuyNowButton productId={id} stock={stock} />
                </div>
              )}
            </Suspense>
          </section>

          <ProductMobileBuyBar
            productId={id}
            stock={stock}
            sizeConfig={sizeConfig}
            hasConfiguredSizes={hasConfiguredSizes}
          />

          <section className="space-y-6 pb-[calc(var(--mobile-nav-height)+5rem)] md:pb-0">
            {showFullDescription && description?.trim() ? (
              <div>
                <h2 className="text-lg font-semibold tracking-wide mb-3">
                  About this product
                </h2>
                <p className="max-w-4xl text-base leading-[1.8] tracking-wide text-zinc-700 whitespace-pre-line">
                  {description.trim()}
                </p>
              </div>
            ) : null}
          </section>
        </div>
      </div>

      <Header heading={`We Think You'll Love`} />

      <div className="container grid grid-cols-2 gap-x-8 pb-[calc(var(--mobile-nav-height)+5rem)] lg:grid-cols-4 md:pb-0">
        {data.recommendations &&
          data.recommendations.edges.map(({ node }) => (
            <ProductCard
              key={node.id}
              product={node}
              packLabel={recommendationPackLabels[node.id]}
              sizePreview={recommendationSizePreviews[node.id] ?? null}
            />
          ))}
      </div>
    </Shell>
  );
}

export default ProductDetailPage;
