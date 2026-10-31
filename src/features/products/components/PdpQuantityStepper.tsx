"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import BulkOrderGuardDialog from "@/features/carts/components/BulkOrderGuardDialog";
import { isBulkOrderQuantity } from "@/features/carts/constants/bulkOrder";
import {
  usePdpQuantity,
  usePdpQuantityStore,
} from "@/features/products/pdp-quantity-store";
import { useBulkOrderGuardConfig } from "@/providers/BulkOrderGuardProvider";
import { useStockControlConfig } from "@/providers/StockControlProvider";

type Props = {
  productId: string;
  stock?: number | null;
};

const stepButtonClass =
  "flex h-9 w-9 items-center justify-center text-foreground touch-manipulation disabled:opacity-40";

export function PdpQuantityStepper({ productId, stock }: Props) {
  const quantity = usePdpQuantity(productId);
  const setQuantity = usePdpQuantityStore((s) => s.setQuantity);
  const stockControl = useStockControlConfig();
  const bulkOrder = useBulkOrderGuardConfig();
  const { toast } = useToast();
  const [bulkGuardOpen, setBulkGuardOpen] = useState(false);

  const increase = () => {
    const next = quantity + 1;
    if (stockControl.enabled && typeof stock === "number" && next > stock) {
      toast({
        title: "Stock limit reached",
        description: `Only ${stock} left in stock.`,
        variant: "destructive",
      });
      return;
    }
    if (bulkOrder.enabled && isBulkOrderQuantity(next, bulkOrder.threshold)) {
      setBulkGuardOpen(true);
      return;
    }
    setQuantity(productId, next);
  };

  return (
    <>
      <div
        className="inline-flex shrink-0 items-center rounded-full border border-border bg-background md:hidden"
        role="group"
        aria-label="Quantity"
      >
        <button
          type="button"
          className={stepButtonClass}
          onClick={() => setQuantity(productId, quantity - 1)}
          disabled={quantity <= 1}
          aria-label="Decrease quantity"
        >
          <Minus className="h-4 w-4" strokeWidth={2} />
        </button>
        <span
          className="min-w-6 text-center text-sm font-semibold tabular-nums"
          aria-live="polite"
        >
          {quantity}
        </span>
        <button
          type="button"
          className={stepButtonClass}
          onClick={increase}
          aria-label="Increase quantity"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
      <BulkOrderGuardDialog
        open={bulkGuardOpen}
        onOpenChange={setBulkGuardOpen}
      />
    </>
  );
}
