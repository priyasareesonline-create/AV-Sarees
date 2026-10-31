"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import BuyNowButton from "@/features/products/components/BuyNowButton";
import {
  getActiveOptionGroups,
  type ProductSizeConfig,
} from "@/lib/products/sizeConfig-shared";
import { useAuth } from "@/providers/AuthProvider";
import { useCheckoutChrome } from "@/providers/CheckoutChromeProvider";
import { useStockControlConfig } from "@/providers/StockControlProvider";
import useCartActions from "@/features/carts/hooks/useCartActions";
import { productSizeConfigToCartConfig } from "@/features/carts/cart-options-guard";
import { usePdpQuantity } from "@/features/products/pdp-quantity-store";

export const BUY_BOX_ID = "product-buy-box";

type Props = {
  productId: string;
  stock?: number | null;
  sizeConfig: ProductSizeConfig;
  hasConfiguredSizes: boolean;
};

/**
 * Mobile PDP action bar (Flipkart / Myntra style). Takes the place of
 * MobileBottomNav on /shop/[slug], so it must keep the same height
 * (--mobile-nav-height) for floating buttons, toasts and page padding.
 */
export function ProductMobileBuyBar({
  productId,
  stock,
  sizeConfig,
  hasConfiguredSizes,
}: Props) {
  const { hideStoreChrome } = useCheckoutChrome();
  const { user } = useAuth();
  const stockControl = useStockControlConfig();
  const { addProductToCart } = useCartActions(user, productId, stock ?? null);
  const [adding, setAdding] = useState(false);
  const quantity = usePdpQuantity(productId);

  const hasSizeOptions = getActiveOptionGroups(sizeConfig).length > 0;
  const needsOptions = hasConfiguredSizes || hasSizeOptions;
  const isOutOfStock =
    stockControl.enabled &&
    typeof stock === "number" &&
    stock <= 0 &&
    !hasSizeOptions;

  if (hideStoreChrome) return null;

  const scrollToBuyBox = () => {
    const el = document.getElementById(BUY_BOX_ID);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => {
      const focusable = el?.querySelector<HTMLElement>(
        "button, [role='radio'], input, select",
      );
      focusable?.focus({ preventScroll: true });
    }, 350);
  };

  const addSimple = async () => {
    if (isOutOfStock || adding) return;
    setAdding(true);
    try {
      await addProductToCart(quantity, {
        sizeConfigHint: sizeConfig
          ? productSizeConfigToCartConfig(sizeConfig)
          : undefined,
      });
    } finally {
      setAdding(false);
    }
  };

  const buttonClass = "h-11 flex-1 text-sm font-semibold";

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[220] border-t border-border bg-background pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-4px_20px_rgba(0,0,0,0.12)] md:hidden"
      role="region"
      aria-label="Buy product"
    >
      <div className="mx-auto flex h-14 max-w-lg items-center gap-2 px-3">
        {isOutOfStock ? (
          <Button type="button" className={buttonClass} disabled>
            Out of stock
          </Button>
        ) : needsOptions ? (
          <>
            <Button
              type="button"
              variant="outline"
              className={`${buttonClass} border-primary text-primary`}
              onClick={scrollToBuyBox}
            >
              Add to Cart
            </Button>
            <Button
              type="button"
              className={buttonClass}
              onClick={scrollToBuyBox}
            >
              Buy Now
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              className={`${buttonClass} border-primary text-primary`}
              disabled={adding}
              onClick={() => void addSimple()}
            >
              {adding ? "Adding…" : "Add to Cart"}
            </Button>
            <BuyNowButton
              productId={productId}
              quantity={quantity}
              stock={stock}
              className={buttonClass}
            />
          </>
        )}
      </div>
    </div>
  );
}
