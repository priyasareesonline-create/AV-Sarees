"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileDown, Filter, Loader2 } from "lucide-react";

import AdminOrdersList from "@/features/orders/components/admin/AdminOrdersList";
import { AdminOrdersDateFilterModal } from "@/features/orders/components/admin/AdminOrdersDateFilterModal";
import { AdminOrdersUiErrorBoundary } from "@/features/orders/components/admin/AdminOrdersUiErrorBoundary";
import type { AdminOrderListView } from "@/lib/admin/getAdminOrdersList";
import { clampAdminOrdersPageSize } from "@/lib/admin/admin-orders-pagination";
import {
  describeAdminOrdersDateFilters,
  isAdminOrdersDateFilterHighlighted,
  type AdminOrdersDateFilterState,
} from "@/lib/admin/admin-orders-date-filter";
import {
  parseOrdersSegment,
  segmentHref,
  type OrdersSegment,
} from "@/lib/admin/admin-orders-segment";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { downloadAdminOrdersPackingSlipsPdf } from "@/lib/pdf/download-packing-slip.client";
import { cn } from "@/lib/utils";

export type { OrdersSegment };
export { parseOrdersSegment, segmentHref };

type OrdersListResult = {
  rows: AdminOrderListView[];
  totalCount: number;
  page: number;
  pageSize: number;
};

type Props = {
  segment: OrdersSegment;
  counts: { paid: number; pending: number };
  paid: OrdersListResult;
  unpaid: OrdersListResult;
  paidPageParam: string;
  unpaidPageParam: string;
  pageSizeParam: string;
  resetPageParams: string[];
  dateFilter: AdminOrdersDateFilterState;
};

/** If RSC navigation stalls, unlock the UI so the admin can retry. */
const NAV_STALL_TIMEOUT_MS = 12_000;

export function AdminOrdersSegmentTabs({
  segment,
  counts,
  paid,
  unpaid,
  paidPageParam,
  unpaidPageParam,
  pageSizeParam,
  resetPageParams,
  dateFilter,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [isNavPending, startNavTransition] = React.useTransition();
  const [pendingSegment, setPendingSegment] =
    React.useState<OrdersSegment | null>(null);
  const [downloadingBulkPdf, setDownloadingBulkPdf] = React.useState(false);
  const [downloadingBulkPacking, setDownloadingBulkPacking] =
    React.useState(false);
  const [navError, setNavError] = React.useState<string | null>(null);
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [filterApplying, setFilterApplying] = React.useState(false);

  // Server `segment` prop is source of truth — do not use useSearchParams()
  // (it suspends without Suspense and kept /admin/orders on loading.tsx forever).
  const pageSize = clampAdminOrdersPageSize(
    paid.pageSize || unpaid.pageSize || undefined,
  );

  React.useEffect(() => {
    if (pendingSegment == null) return;
    if (segment === pendingSegment) {
      setPendingSegment(null);
      setNavError(null);
    }
  }, [pendingSegment, segment]);

  // Date-filter navigation keeps the same segment; clear when RSC props update.
  React.useEffect(() => {
    setFilterApplying(false);
  }, [dateFilter]);

  React.useEffect(() => {
    if (pendingSegment == null && !filterApplying) return;
    const waitingFor = pendingSegment ?? segment;
    const timer = window.setTimeout(() => {
      setNavError(
        `Could not load ${waitingFor} orders. Check your connection and retry.`,
      );
      setPendingSegment(null);
      setFilterApplying(false);
    }, NAV_STALL_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [filterApplying, pendingSegment, segment]);

  const displaySegment = pendingSegment ?? segment;
  const isLoading = pendingSegment != null || isNavPending || filterApplying;
  const staleList = segment === "unpaid" ? unpaid : paid;
  const active = segment === "unpaid" ? unpaid : paid;
  const listSource = isLoading ? staleList : active;
  const showPdfToolbar = segment === "paid" && !isLoading;
  const filterHighlighted = isAdminOrdersDateFilterHighlighted(dateFilter);
  const dateLabel = describeAdminOrdersDateFilters(dateFilter);

  const navigateTo = React.useCallback(
    (next: OrdersSegment) => {
      if (next === segment && pendingSegment == null && !isNavPending) return;
      setNavError(null);
      setPendingSegment(next);
      const href = segmentHref(next, pageSize, dateFilter);
      startNavTransition(() => {
        router.push(href, { scroll: false });
      });
    },
    [
      dateFilter,
      isNavPending,
      pageSize,
      pendingSegment,
      router,
      segment,
      startNavTransition,
    ],
  );

  const applyDateFilter = React.useCallback(
    (next: AdminOrdersDateFilterState) => {
      setFilterApplying(true);
      setFilterOpen(false);
      setNavError(null);
      const href = segmentHref(segment, pageSize, next);
      startNavTransition(() => {
        router.push(href, { scroll: false });
      });
    },
    [pageSize, router, segment, startNavTransition],
  );

  const retryNavigation = React.useCallback(() => {
    setNavError(null);
    const target = pendingSegment ?? segment;
    setPendingSegment(target);
    startNavTransition(() => {
      router.push(segmentHref(target, pageSize, dateFilter), {
        scroll: false,
      });
    });
  }, [
    dateFilter,
    pageSize,
    pendingSegment,
    router,
    segment,
    startNavTransition,
  ]);

  const downloadBulkPdf = React.useCallback(async () => {
    if (downloadingBulkPdf || paid.rows.length === 0) return;
    setDownloadingBulkPdf(true);
    try {
      const [{ adminOrdersToPdfLabels }, { downloadOrdersPdf }] =
        await Promise.all([
          import("@/lib/pdf/admin-order-pdf-label"),
          import("@/lib/pdf/shipping-label-pdf"),
        ]);
      await downloadOrdersPdf(adminOrdersToPdfLabels(paid.rows));
      toast({
        title: "PDF downloaded",
        description: `Shipping labels for ${paid.rows.length} paid order${paid.rows.length === 1 ? "" : "s"} on this page.`,
      });
    } catch (error) {
      toast({
        title: "Failed to generate PDF",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setDownloadingBulkPdf(false);
    }
  }, [downloadingBulkPdf, paid.rows, toast]);

  const downloadBulkPackingSlips = React.useCallback(async () => {
    if (downloadingBulkPacking || paid.rows.length === 0) return;
    setDownloadingBulkPacking(true);
    try {
      await downloadAdminOrdersPackingSlipsPdf(paid.rows);
      toast({
        title: "Packing slips downloaded",
        description: `Packing slips for ${paid.rows.length} paid order${paid.rows.length === 1 ? "" : "s"} on this page.`,
      });
    } catch (error) {
      toast({
        title: "Failed to generate packing slips",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setDownloadingBulkPacking(false);
    }
  }, [downloadingBulkPacking, paid.rows, toast]);

  return (
    <AdminOrdersUiErrorBoundary>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div
            className="grid min-w-0 flex-1 gap-4 md:grid-cols-2"
            role="tablist"
            aria-label="Order payment status"
          >
            <Link
              href={segmentHref("paid", pageSize, dateFilter)}
              replace
              scroll={false}
              prefetch
              role="tab"
              aria-selected={displaySegment === "paid"}
              aria-busy={isLoading && displaySegment === "paid"}
              onClick={(event) => {
                event.preventDefault();
                navigateTo("paid");
              }}
              className={cn(
                "rounded-lg border p-4 text-left transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                displaySegment === "paid"
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-card hover:border-primary/40 hover:bg-muted/30",
              )}
            >
              <p
                className={cn(
                  "text-xs uppercase tracking-wide",
                  displaySegment === "paid"
                    ? "text-primary"
                    : "text-muted-foreground",
                )}
              >
                Paid orders
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                {counts.paid}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Counted in dashboard revenue and top products
              </p>
            </Link>

            <Link
              href={segmentHref("unpaid", pageSize, dateFilter)}
              replace
              scroll={false}
              prefetch
              role="tab"
              aria-selected={displaySegment === "unpaid"}
              aria-busy={isLoading && displaySegment === "unpaid"}
              onClick={(event) => {
                event.preventDefault();
                navigateTo("unpaid");
              }}
              className={cn(
                "rounded-lg border p-4 text-left transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                displaySegment === "unpaid"
                  ? "border-destructive bg-destructive/5 shadow-sm"
                  : "border-border bg-card hover:border-destructive/40 hover:bg-muted/30",
              )}
            >
              <p
                className={cn(
                  "text-xs uppercase tracking-wide",
                  displaySegment === "unpaid"
                    ? "text-destructive"
                    : "text-muted-foreground",
                )}
              >
                Unpaid / pending
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                {counts.pending}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Follow up — payment not completed
              </p>
            </Link>
          </div>

          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn(
              "relative shrink-0",
              filterHighlighted && "border-primary text-primary",
            )}
            aria-label={`Filter orders (${dateLabel})`}
            title={`Filter: ${dateLabel}`}
            onClick={() => setFilterOpen(true)}
          >
            <Filter className="h-4 w-4" />
            {filterHighlighted ? (
              <span
                className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive"
                aria-hidden
              />
            ) : null}
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            {isLoading ? (
              <>
                <Loader2
                  className="h-3.5 w-3.5 shrink-0 animate-spin"
                  aria-hidden
                />
                <span>
                  Loading{" "}
                  <span className="font-medium text-foreground">
                    {displaySegment === "unpaid" ? "unpaid" : "paid"}
                  </span>{" "}
                  orders…
                </span>
              </>
            ) : (
              <>
                Showing{" "}
                <span className="font-medium text-foreground">
                  {segment === "unpaid" ? "unpaid" : "paid"}
                </span>{" "}
                ·{" "}
                <span className="font-medium text-foreground">{dateLabel}</span>
                {active.totalCount > 0 ? <> ({active.totalCount})</> : null}
              </>
            )}
          </p>

          {showPdfToolbar ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void downloadBulkPdf()}
                disabled={downloadingBulkPdf || paid.rows.length === 0}
                title="Download shipping label PDF for paid orders on this page"
              >
                {downloadingBulkPdf ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="mr-2 h-4 w-4" />
                )}
                {downloadingBulkPdf ? "Generating…" : "Labels"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void downloadBulkPackingSlips()}
                disabled={downloadingBulkPacking || paid.rows.length === 0}
                title="Download packing slips for paid orders on this page"
              >
                {downloadingBulkPacking ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="mr-2 h-4 w-4" />
                )}
                {downloadingBulkPacking ? "Generating…" : "Packing slips"}
              </Button>
            </div>
          ) : null}
        </div>

        {navError ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
            <p className="text-destructive">{navError}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={retryNavigation}
            >
              Retry
            </Button>
          </div>
        ) : null}

        <div
          className={cn(isLoading && "pointer-events-none opacity-60")}
          aria-busy={isLoading}
          aria-live="polite"
        >
          <AdminOrdersList
            key={`${segment}-${dateLabel}`}
            orders={listSource.rows}
            totalCount={listSource.totalCount}
            page={listSource.page}
            pageSize={listSource.pageSize}
            pageParam={segment === "unpaid" ? unpaidPageParam : paidPageParam}
            pageSizeParam={pageSizeParam}
            resetPageParams={resetPageParams}
            enablePdf={segment === "paid" && !isLoading}
            emptyMessage={
              segment === "unpaid"
                ? `No unpaid orders for ${dateLabel.toLowerCase()}.`
                : `No paid orders for ${dateLabel.toLowerCase()}.`
            }
          />
        </div>

        <AdminOrdersDateFilterModal
          open={filterOpen}
          initialFilters={dateFilter}
          applying={filterApplying}
          onClose={() => {
            if (!filterApplying) setFilterOpen(false);
          }}
          onApply={applyDateFilter}
        />
      </div>
    </AdminOrdersUiErrorBoundary>
  );
}
