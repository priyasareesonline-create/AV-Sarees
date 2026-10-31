"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Link2, Mail, Share2, Truck } from "lucide-react";
import { Icons } from "@/components/layouts/icons";
import { getDeliveryEstimate } from "@/lib/datetime/delivery-estimate";
import { cn } from "@/lib/utils";

type Props = {
  productName: string;
  /** Absolute canonical product URL (never the vercel.app host). */
  productUrl: string;
  /** Absolute image URL for Pinterest; optional. */
  imageUrl?: string | null;
  /** Server-rendered estimate; refreshed on the client after mount. */
  initialDeliveryLabel: string;
  showDelivery: boolean;
};

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const field = document.createElement("textarea");
      field.value = text;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.left = "-9999px";
      document.body.appendChild(field);
      field.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(field);
      return ok;
    } catch {
      return false;
    }
  }
}

const shareIconClass =
  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 touch-manipulation";

export function ProductInfoRows({
  productName,
  productUrl,
  imageUrl,
  initialDeliveryLabel,
  showDelivery,
}: Props) {
  const [deliveryLabel, setDeliveryLabel] = useState(initialDeliveryLabel);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Cached HTML / back navigation can carry yesterday's dates.
    setDeliveryLabel(getDeliveryEstimate().label);
    setCanNativeShare(
      typeof navigator !== "undefined" && typeof navigator.share === "function",
    );
  }, []);

  const handleNativeShare = useCallback(async () => {
    try {
      await navigator.share({ title: productName, url: productUrl });
    } catch {
      // User cancelled or share unavailable — icon links remain.
    }
  }, [productName, productUrl]);

  const handleCopy = useCallback(async () => {
    const ok = await copyText(productUrl);
    if (!ok) {
      window.prompt("Copy this link", productUrl);
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, [productUrl]);

  const url = encodeURIComponent(productUrl);
  const text = encodeURIComponent(productName);
  const shareLinks = [
    {
      label: "WhatsApp",
      href: `https://wa.me/?text=${encodeURIComponent(`${productName} ${productUrl}`)}`,
      icon: <Icons.whatsapp className="h-5 w-5 text-[#25D366]" />,
    },
    {
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      icon: <Icons.facebook className="h-5 w-5 text-[#1877F2]" />,
    },
    {
      label: "X",
      href: `https://x.com/intent/post?url=${url}&text=${text}`,
      icon: <Icons.x className="h-[18px] w-[18px] text-black dark:text-white" />,
    },
    {
      label: "Pinterest",
      href: `https://pinterest.com/pin/create/button/?url=${url}&description=${text}${
        imageUrl ? `&media=${encodeURIComponent(imageUrl)}` : ""
      }`,
      icon: <Icons.pinterest className="h-5 w-5 text-[#E60023]" />,
    },
    {
      label: "Email",
      href: `mailto:?subject=${text}&body=${url}`,
      icon: (
        <Mail className="h-5 w-5 text-[#EA4335]" strokeWidth={1.75} />
      ),
    },
  ];

  return (
    <section
      aria-label="Delivery and sharing"
      className="mb-5 max-w-lg divide-y divide-border border-y border-border text-sm"
    >
      {showDelivery ? (
        <div className="flex items-start gap-3 py-3">
          <Truck
            className="mt-0.5 h-5 w-5 shrink-0 text-foreground/70"
            strokeWidth={1.75}
            aria-hidden
          />
          <div className="min-w-0">
            <p className="text-foreground">
              Estimated delivery:{" "}
              <span className="font-semibold" suppressHydrationWarning>
                {deliveryLabel}
              </span>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Tamil Nadu orders usually arrive sooner.
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-1 gap-y-1 py-2">
        {canNativeShare ? (
          <button
            type="button"
            onClick={handleNativeShare}
            aria-label="Share using your phone"
            className="mr-1 inline-flex min-h-10 items-center gap-3 rounded-full text-foreground touch-manipulation hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <Share2
              className="h-5 w-5 shrink-0 text-foreground/70"
              strokeWidth={1.75}
              aria-hidden
            />
            Share
          </button>
        ) : (
          <span className="mr-1 inline-flex min-h-10 items-center gap-3 text-foreground">
            <Share2
              className="h-5 w-5 shrink-0 text-foreground/70"
              strokeWidth={1.75}
              aria-hidden
            />
            Share
          </span>
        )}
        {shareLinks.map((link) => (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Share on ${link.label}`}
            title={link.label}
            className={shareIconClass}
          >
            {link.icon}
          </a>
        ))}
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? "Link copied" : "Copy link"}
          title={copied ? "Copied" : "Copy link"}
          className={cn(shareIconClass, "text-primary")}
        >
          {copied ? (
            <Check className="h-5 w-5 text-[#25D366]" strokeWidth={2} />
          ) : (
            <Link2 className="h-5 w-5" strokeWidth={1.75} />
          )}
        </button>
      </div>
      {copied ? (
        <p className="sr-only" role="status">
          Link copied
        </p>
      ) : null}
    </section>
  );
}
