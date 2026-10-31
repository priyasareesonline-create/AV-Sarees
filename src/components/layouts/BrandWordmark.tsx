import Image from "next/image";
import { siteConfig } from "@/config/site";
import { BRAND_LOGO, brandLogoMaxHeight } from "@/lib/brand/logo";
import { cn } from "@/lib/utils";
import type { ShopBoardBrandSize } from "@/lib/brand/shop-board";

export type BrandWordmarkSize = ShopBoardBrandSize;

type Props = {
  className?: string;
  size?: BrandWordmarkSize;
  align?: "left" | "center";
};

/** AV Sarees cropped emblem lockup (height-led; width follows aspect). */
export function BrandWordmark({
  className,
  size = "md",
  align = "left",
}: Props) {
  const height = brandLogoMaxHeight[size];
  const width = Math.round((height * BRAND_LOGO.width) / BRAND_LOGO.height);

  return (
    <span
      className={cn(
        "brand-board-lockup brand-wordmark inline-flex shrink-0 items-center",
        size === "nav" && "brand-board-lockup--nav",
        align === "center" && "mx-auto justify-center",
        className,
      )}
      style={{ height, width }}
      aria-label={`${siteConfig.shopBoardName} — ${siteConfig.tagline}`}
    >
      <Image
        src={BRAND_LOGO.src}
        alt={siteConfig.shopBoardName}
        width={BRAND_LOGO.width}
        height={BRAND_LOGO.height}
        className="brand-board-emblem h-full w-full object-contain"
        priority={size === "nav" || size === "md"}
        sizes={`${width}px`}
      />
    </span>
  );
}

export default BrandWordmark;
