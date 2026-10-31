import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { siteConfig } from "@/config/site";
import { brandSans, heroSerif } from "@/lib/fonts";
import { absoluteSocialFallbackUrl } from "@/lib/seo/social-image";
import { getURL } from "@/lib/utils";
import CustomProvider from "../providers/CustomProvider";
import { MicrosoftClarity } from "@/components/analytics/MicrosoftClarity";
import { ClaritySpaTracker } from "@/components/analytics/ClaritySpaTracker";
import { WebViewErrorNoiseFilter } from "@/components/analytics/WebViewErrorNoiseFilter";

const siteUrl = getURL();
const defaultSocialImageUrl = absoluteSocialFallbackUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${siteConfig.name} | ${siteConfig.tagline}`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: [
    "AV Sarees",
    "silk sarees",
    "cotton sarees",
    "wedding sarees",
    "festive sarees",
    "Elampillai sarees",
    "Salem sarees",
    "Tamil Nadu sarees",
  ],
  applicationName: siteConfig.name,
  authors: [{ name: siteConfig.name }],
  creator: siteConfig.name,
  publisher: siteConfig.name,
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: siteUrl,
    siteName: siteConfig.name,
    title: `${siteConfig.name} | ${siteConfig.tagline}`,
    description: siteConfig.description,
    images: [
      {
        url: defaultSocialImageUrl,
        width: 1200,
        height: 630,
        alt: siteConfig.name,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} | ${siteConfig.tagline}`,
    description: siteConfig.description,
    images: [defaultSocialImageUrl],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  alternates: {
    canonical: siteUrl,
  },
  icons: {
    icon: [{ url: "/images/av-sarees-logo.png", type: "image/png" }],
    shortcut: ["/images/av-sarees-logo.png"],
    apple: [{ url: "/images/av-sarees-logo.png", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#9B1B2E",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <CustomProvider>
        <body
          className={`${brandSans.className} ${brandSans.variable} ${heroSerif.variable}`}
        >
          {children}
          <Toaster />
          <WebViewErrorNoiseFilter />
          <MicrosoftClarity />
          <ClaritySpaTracker />
        </body>
      </CustomProvider>
    </html>
  );
}
