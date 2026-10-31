import type { NavItemWithOptionalChildren } from "@/types";

export type SiteConfig = typeof siteConfig;

/** AV Sarees storefront */
const ADDRESS_LINES = [
  "A. Arumugam",
  "5/400, Asari street",
  "K.k. nagar, Elampillai",
  "Salem 637502",
  "Tamil Nadu, India",
] as const;

const CONTACTS: readonly {
  name: string;
  phone: string;
  phoneHref: string;
}[] = [
  { name: "AV Sarees", phone: "7200783646", phoneHref: "tel:+917200783646" },
  { name: "AV Sarees", phone: "8072034006", phoneHref: "tel:+918072034006" },
];
const EMAIL = "avsareesav@gmail.com";
const GSTIN = "";

const SOCIAL = {
  instagram: "",
  youtube: "",
  facebook: "",
  whatsapp: "",
} as const;

export const siteConfig = {
  shopBoardName: "AV Sarees",
  name: "AV Sarees",
  shortName: "AV",
  tagline: "Your Style, Our Fabrics",
  location: "Elampillai, Salem, Tamil Nadu",
  description: "AV Sarees — silk, cotton and festive sarees from Elampillai. Your Style, Our Fabrics.",
  searchPlaceholder: "Search sarees…",
  url:
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "http://localhost:3000",
  addressLines: ADDRESS_LINES,
  address: ADDRESS_LINES.join(", "),
  phone: "7200783646",
  phoneHref: "tel:+917200783646",
  contacts: CONTACTS,
  email: EMAIL,
  gstin: GSTIN,
  currency: "INR",
  currencySymbol: "₹",
  social: SOCIAL,
  announcements: [
    {
      text: "Welcome to AV Sarees — silk, cotton and wedding weaves",
      href: "/shop",
      cta: "Shop now",
    },
    {
      text: "Wedding & festive sarees for every occasion",
      href: "/shop",
      cta: "Explore",
    },
    {
      text: "New arrivals and featured collections",
      href: "/collections",
      cta: "Browse collections",
    },
    {
      text: "Silk, cotton and everyday wear — shop the range",
      href: "/shop",
      cta: "See more",
    },
    {
      text: "Handpicked favourites — shop featured sarees",
      href: "/featured",
      cta: "Featured",
    },
  ],
  mainNav: [
    {
      title: "Collections",
      href: "/collections",
      description: "Browse collections.",
      items: [],
    },
    {
      title: "Featured",
      href: "/featured",
      description: "Featured products.",
      items: [],
    },
    {
      title: "Orders",
      href: "/orders",
      description: "Your orders.",
      items: [],
    },
  ] satisfies NavItemWithOptionalChildren[],

  footerNav: [
    {
      title: "Shop",
      items: [
        { title: "All products", href: "/shop", items: [] },
        { title: "Featured", href: "/featured", items: [] },
        { title: "All categories", href: "/collections", items: [] },
        { title: "Wishlist", href: "/wish-list", items: [] },
        { title: "Cart", href: "/cart", items: [] },
      ],
    },
    {
      title: "Explore",
      items: [
        { title: "Collections", href: "/collections", items: [] },
        { title: "Featured picks", href: "/featured", items: [] },
        { title: "Our story", href: "/about", items: [] },
        { title: "Contact", href: "/contact", items: [] },
      ],
    },
    {
      title: "Customer Service",
      items: [
        {
          title: "Terms & Conditions",
          href: "/terms-and-conditions",
          items: [],
        },
        { title: "Terms of Use", href: "/terms-of-use", items: [] },
        { title: "Privacy Policy", href: "/privacy-policy", items: [] },
        { title: "Shipping & Returns", href: "/shipping-returns", items: [] },
        { title: "Payment Methods", href: "/payment-methods", items: [] },
        { title: "FAQ", href: "/faq", items: [] },
        { title: "My orders", href: "/orders", items: [] },
      ],
    },
    {
      title: "About AV Sarees",
      items: [
        { title: "Our Story", href: "/about", items: [] },
        { title: "Our Collections", href: "/collections", items: [] },
        { title: "Contact", href: "/contact", items: [] },
      ],
    },
  ] satisfies NavItemWithOptionalChildren[],
};
