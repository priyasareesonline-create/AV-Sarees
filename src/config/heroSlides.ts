import { siteConfig } from "@/config/site";

export type HeroSlide = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  cta: string;
  image: string;
  imageAlt: string;
};

/** Homepage hero fallback until Admin → Home Banner is set. */
export const heroSlides: HeroSlide[] = [
  {
    id: "elampillai-silk",
    title: "Elampillai soft silk",
    subtitle: "Crimson and gold weaves from Tamil Nadu",
    href: "/shop",
    cta: "Shop now",
    image: "/images/priya-elampillai-banner.png",
    imageAlt: `${siteConfig.name} — Elampillai soft silk`,
  },
  {
    id: "elampillai-bridal",
    title: "Bridal Elampillai",
    subtitle: "Festive semi-silk for weddings and celebrations",
    href: "/collections/elampillai-bridal",
    cta: "Explore",
    image: "/images/priya-elampillai-semi-silk.png",
    imageAlt: `${siteConfig.name} — Elampillai bridal sarees`,
  },
];
