import Link from "next/link";
import { ORDER_RETURNS, ORDER_SHIPPING } from "@/lib/storefront/order-shipping";

function ShipReturns() {
  return (
    <div className="space-y-2 text-sm text-muted-foreground">
      <p>
        {ORDER_SHIPPING.processingLabel}: {ORDER_SHIPPING.processing}.{" "}
        {ORDER_SHIPPING.tracking}
      </p>
      <p>{ORDER_RETURNS.summary}</p>
      <Link
        href={ORDER_RETURNS.fullDetailsHref}
        className="text-primary hover:underline"
      >
        {ORDER_SHIPPING.fullDetailsLabel}
      </Link>
    </div>
  );
}

export default ShipReturns;
