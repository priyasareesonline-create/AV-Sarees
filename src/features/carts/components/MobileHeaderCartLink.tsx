"use client";

import Link from "next/link";
import { Icons } from "@/components/layouts/icons";
import { cn } from "@/lib/utils";
import { useCartCount } from "@/features/carts/hooks/useCartCount";
import { useCartAddedPulse } from "@/features/carts/hooks/useCartAddedPulse";

export function MobileHeaderCartLink() {
  const count = useCartCount();
  const pulse = useCartAddedPulse();

  return (
    <Link
      href="/cart"
      className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted touch-manipulation"
      aria-label={count > 0 ? `Cart, ${count} items` : "Cart"}
    >
      <span
        className={cn(
          "relative inline-flex transition-transform duration-300",
          pulse && "scale-125",
        )}
      >
        <Icons.cart className="h-5 w-5" />
        <span
          className={cn(
            "absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-white",
            count <= 0 && "scale-0 opacity-0",
          )}
          aria-hidden
        >
          {count > 9 ? "9+" : count}
        </span>
      </span>
    </Link>
  );
}
