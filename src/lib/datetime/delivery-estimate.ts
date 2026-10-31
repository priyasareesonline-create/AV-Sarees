import { ORDER_SHIPPING } from "@/lib/storefront/order-shipping";
import { INDIA_TIME_ZONE } from "@/lib/datetime/india";

/** Pull the [min, max] day numbers out of copy like "2–3 days" / "5–6 working days". */
function parseDayRange(label: string): [number, number] {
  const nums = label.match(/\d+/g)?.map(Number) ?? [];
  const min = nums[0] ?? 0;
  const max = nums[1] ?? min;
  return [min, max];
}

const [PROCESS_MIN, PROCESS_MAX] = parseDayRange(ORDER_SHIPPING.processing);
const transitRanges = ORDER_SHIPPING.regions.map((r) => parseDayRange(r.time));
const TRANSIT_MIN = Math.min(...transitRanges.map(([min]) => min));
const TRANSIT_MAX = Math.max(...transitRanges.map(([, max]) => max));

/** Working days from order to delivery, derived from the shared shipping copy. */
export const DELIVERY_WORKING_DAYS = {
  min: PROCESS_MIN + TRANSIT_MIN,
  max: PROCESS_MAX + TRANSIT_MAX,
} as const;

/** Today's calendar date in India as a UTC-midnight Date (safe for day math). */
export function indiaCalendarDate(now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return new Date(Date.UTC(get("year"), get("month") - 1, get("day")));
}

/** Add working days (Mon–Sat; Sundays skipped) to a UTC-midnight date. */
export function addWorkingDays(start: Date, days: number): Date {
  const result = new Date(start.getTime());
  let remaining = days;
  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + 1);
    if (result.getUTCDay() !== 0) remaining -= 1;
  }
  return result;
}

function formatDeliveryDay(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

export type DeliveryEstimate = {
  from: string;
  to: string;
  label: string;
};

export function getDeliveryEstimate(now: Date = new Date()): DeliveryEstimate {
  const today = indiaCalendarDate(now);
  const from = formatDeliveryDay(
    addWorkingDays(today, DELIVERY_WORKING_DAYS.min),
  );
  const to = formatDeliveryDay(
    addWorkingDays(today, DELIVERY_WORKING_DAYS.max),
  );
  return { from, to, label: `${from} – ${to}` };
}
