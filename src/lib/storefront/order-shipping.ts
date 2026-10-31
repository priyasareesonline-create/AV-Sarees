/** Shared order / shipping copy — short, plain words every buyer can follow. */

export const ORDER_SHIPPING = {
  title: "Order & shipping",
  /** Sidebar + page: main timings */
  processingLabel: "Processing time",
  processing: "2–3 days",
  processingNote: "Large orders may take a little longer.",
  deliveryLabel: "Delivery",
  regions: [
    {
      place: "Tamil Nadu",
      placeShort: "Tamil Nadu",
      time: "2–3 working days",
    },
    {
      place: "Other states in India",
      placeShort: "Other India",
      time: "5–6 working days",
    },
  ] as const,
  readyStock: "In-stock items usually ship sooner after we confirm.",
  tracking: "When we ship, you get an email with tracking.",
  contactPrompt: "No email in 10–15 working days? Contact us:",
  wholesale: "Wholesale: timing depends on order size.",
  fullDetailsHref: "/shipping-returns",
  fullDetailsLabel: "Full details",
  contactWhatsApp: "WhatsApp",
  contactEmail: "Email",
} as const;

export const ORDER_RETURNS = {
  title: "Returns & exchanges",
  windowDays: 7,
  summary:
    "Returns or exchanges may be accepted within 7 days of delivery for unused items with original packaging intact.",
  badgeTitle: "7-Day Returns",
  badgeDescription: "Unboxing video needed for damage or wrong-item claims.",
  rules: [
    "Please email us before sending any item back.",
    "An unboxing video is required for any damage or wrong-item claim.",
    "Used, washed, or altered sarees cannot be returned.",
    "Shipping charges for returns may apply unless the item is faulty.",
  ],
  fullDetailsHref: "/shipping-returns",
} as const;

export const ORDER_SHIPPING_FALLBACK = {
  email: "",
} as const;
