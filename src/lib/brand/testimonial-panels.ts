/**
 * Soft logo-derived panels for customer testimonials.
 * Crimson · deep crimson · antique gold · warm neutrals — white text readable.
 */
export const testimonialPanels = [
  {
    id: "crimson",
    bg: "#9B1B2E",
    shadow: "rgba(155, 27, 46, 0.45)",
  },
  {
    id: "deep",
    bg: "#6E0F1C",
    shadow: "rgba(110, 15, 28, 0.45)",
  },
  {
    id: "gold",
    bg: "#A8892A",
    shadow: "rgba(168, 137, 42, 0.45)",
  },
  {
    id: "ink",
    bg: "#2A181C",
    shadow: "rgba(42, 24, 28, 0.45)",
  },
  {
    id: "rosewood",
    bg: "#8B3A3A",
    shadow: "rgba(139, 58, 58, 0.45)",
  },
  {
    id: "bronze",
    bg: "#8A6D1F",
    shadow: "rgba(138, 109, 31, 0.45)",
  },
] as const;

export type TestimonialPanel = (typeof testimonialPanels)[number];

export function testimonialPanelAt(index: number): TestimonialPanel {
  return testimonialPanels[index % testimonialPanels.length]!;
}
