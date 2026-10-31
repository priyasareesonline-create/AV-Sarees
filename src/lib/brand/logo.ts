/**
 * AV Sarees brand mark — circular emblem with saffron / green / navy splash.
 */
export const BRAND_WORDMARK = "AV Sarees" as const;

/**
 * Tight-cropped emblem for header / footer / favicon / JSON-LD / email.
 */
export const BRAND_LOGO = {
  src: "/brand/logo.png",
  width: 640,
  height: 640,
} as const;

/** Display height (px) by chrome slot — width follows aspect ratio. */
export const brandLogoMaxHeight = {
  nav: 56,
  md: 72,
  footer: 96,
} as const;

export type BrandLogoSize = keyof typeof brandLogoMaxHeight;
