/**
 * @jest-environment node
 */
import {
  DELIVERY_WORKING_DAYS,
  addWorkingDays,
  getDeliveryEstimate,
  indiaCalendarDate,
} from "./delivery-estimate";

const utc = (y: number, m: number, d: number) =>
  new Date(Date.UTC(y, m - 1, d));

describe("delivery-estimate", () => {
  it("derives working days from the shared shipping copy", () => {
    // processing 2–3 + transit 2–3 (TN) … 5–6 (other states)
    expect(DELIVERY_WORKING_DAYS).toEqual({ min: 4, max: 9 });
  });

  it("uses the India calendar date near midnight", () => {
    // 2026-10-01 19:00 UTC = 2026-10-02 00:30 IST
    expect(indiaCalendarDate(new Date("2026-10-01T19:00:00Z"))).toEqual(
      utc(2026, 10, 2),
    );
    // 2026-10-01 18:00 UTC = 2026-10-01 23:30 IST
    expect(indiaCalendarDate(new Date("2026-10-01T18:00:00Z"))).toEqual(
      utc(2026, 10, 1),
    );
  });

  it("skips Sundays", () => {
    // Sat 2026-10-03 + 1 working day = Mon 2026-10-05
    expect(addWorkingDays(utc(2026, 10, 3), 1)).toEqual(utc(2026, 10, 5));
    // Sun start counts from Monday
    expect(addWorkingDays(utc(2026, 10, 4), 1)).toEqual(utc(2026, 10, 5));
  });

  it("rolls over months and years", () => {
    expect(addWorkingDays(utc(2026, 12, 30), 2)).toEqual(utc(2027, 1, 1));
  });

  it("formats a readable range", () => {
    // Thu 2026-10-01 IST: +4 → Tue Oct 6, +9 → Mon Oct 12
    const est = getDeliveryEstimate(new Date("2026-10-01T06:00:00Z"));
    expect(est.from).toMatch(/Tue.*6.*Oct|Tue.*Oct.*6/);
    expect(est.to).toMatch(/Mon.*12.*Oct|Mon.*Oct.*12/);
    expect(est.label).toBe(`${est.from} – ${est.to}`);
  });
});
