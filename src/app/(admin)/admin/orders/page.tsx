import AdminShell from "@/components/admin/AdminShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminOrdersClientPanel } from "@/features/orders/components/admin/AdminOrdersClientPanel";
import {
  adminOrdersDateFiltersFromSearchParams,
  createThisMonthDateFilters,
  resolveAdminOrdersDateFilters,
  type AdminOrdersDateFilterState,
} from "@/lib/admin/admin-orders-date-filter";
import { parseOrdersSegment } from "@/lib/admin/admin-orders-segment";
import {
  clampAdminOrdersPageSize,
  getAdminOrdersCounts,
  getAdminOrdersList,
  parseAdminOrdersPage,
  type AdminOrdersListResult,
} from "@/lib/admin/getAdminOrdersList";
import { publicErrorMessage } from "@/lib/api/public-error";
import { withDbAsync } from "@/lib/supabase/db";
import { Suspense } from "react";

function OrdersSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
      <Skeleton className="h-5 w-48" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const revalidate = 0;

const PAID_PAGE_PARAM = "paidPage";
const PENDING_PAGE_PARAM = "pendingPage";
const PAGE_SIZE_PARAM = "pageSize";
const STATUS_PARAM = "status";

type AdminOrdersPageProps = {
  searchParams: Promise<{
    [key: string]: string | string[] | undefined;
  }>;
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function emptyList(pageSize: number): AdminOrdersListResult {
  return {
    rows: [],
    totalCount: 0,
    page: 1,
    pageSize,
  };
}

export default async function OrdersPage({
  searchParams,
}: AdminOrdersPageProps) {
  const resolved = await searchParams;
  return (
    <AdminShell heading="Orders">
      {/* Suspense lets the shell stream immediately while DB queries run.
          Tab switches use startTransition(router.push) so React keeps the
          current content visible — the skeleton only shows on first load. */}
      <Suspense fallback={<OrdersSkeleton />}>
        <OrdersPageContent searchParams={resolved} />
      </Suspense>
    </AdminShell>
  );
}

async function OrdersPageContent({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const pageSize = clampAdminOrdersPageSize(
    Number.parseInt(String(firstParam(searchParams[PAGE_SIZE_PARAM])), 10) ||
      undefined,
  );
  const segment = parseOrdersSegment(firstParam(searchParams[STATUS_PARAM]));
  const paidPage = parseAdminOrdersPage(searchParams[PAID_PAGE_PARAM]);
  const pendingPage = parseAdminOrdersPage(searchParams[PENDING_PAGE_PARAM]);

  const fromParams = adminOrdersDateFiltersFromSearchParams({
    from: firstParam(searchParams.from),
    to: firstParam(searchParams.to),
    all: firstParam(searchParams.all),
    preset: firstParam(searchParams.preset),
  });
  const hasExplicitDate =
    Boolean(firstParam(searchParams.all)) ||
    Boolean(firstParam(searchParams.preset)) ||
    Boolean(firstParam(searchParams.from)) ||
    Boolean(firstParam(searchParams.to));
  const dateFilter: AdminOrdersDateFilterState = resolveAdminOrdersDateFilters(
    hasExplicitDate ? fromParams : createThisMonthDateFilters(),
  );

  let fetchError: string | null = null;
  let counts = { paid: 0, pending: 0 };
  let paid = emptyList(pageSize);
  let unpaid = emptyList(pageSize);

  try {
    // Sequential on purpose: Vercel uses a single postgres.js connection
    // (max: 1) against Supabase transaction pooler (port 6543). Concurrent
    // queries pipeline on that socket and hang until the request dies —
    // which previously looked like an endless skeleton, then this alert.
    const result = await withDbAsync(async () => {
      const nextCounts = await getAdminOrdersCounts(dateFilter);
      if (segment === "paid") {
        const nextPaid = await getAdminOrdersList({
          segment: "paid",
          page: paidPage,
          pageSize,
          dateFilter,
          totalCountHint: nextCounts.paid,
        });
        return {
          counts: nextCounts,
          paid: nextPaid,
          unpaid: emptyList(pageSize),
        };
      }

      const nextUnpaid = await getAdminOrdersList({
        segment: "pending",
        page: pendingPage,
        pageSize,
        dateFilter,
        totalCountHint: nextCounts.pending,
      });
      return {
        counts: nextCounts,
        paid: emptyList(pageSize),
        unpaid: nextUnpaid,
      };
    });
    counts = result.counts;
    paid = result.paid;
    unpaid = result.unpaid;
  } catch (error) {
    console.error(
      `[admin/orders] page load failed (segment=${segment}):`,
      error,
    );
    fetchError =
      error instanceof Error && error.message.trim()
        ? error.message
        : publicErrorMessage(
            error,
            segment === "unpaid"
              ? "Failed to load unpaid orders."
              : "Failed to load paid orders.",
          );
  }

  const resetPageParams = [PAID_PAGE_PARAM, PENDING_PAGE_PARAM];

  return (
    <div className="space-y-6">
      {fetchError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not fully load orders</AlertTitle>
          <AlertDescription>{fetchError}</AlertDescription>
        </Alert>
      ) : null}

      <AdminOrdersClientPanel
        segment={segment}
        counts={counts}
        paid={paid}
        unpaid={unpaid}
        paidPageParam={PAID_PAGE_PARAM}
        unpaidPageParam={PENDING_PAGE_PARAM}
        pageSizeParam={PAGE_SIZE_PARAM}
        resetPageParams={resetPageParams}
        dateFilter={dateFilter}
      />
    </div>
  );
}
