import InfoPage from "@/components/layouts/InfoPage";
import Link from "next/link";
import { Metadata } from "next";
import { siteConfig } from "@/config/site";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: `Our Story | ${siteConfig.name}`,
  description: `About ${siteConfig.name} — silk, cotton and wedding sarees from Elampillai, Salem, Tamil Nadu.`,
};

export default function AboutPage() {
  return (
    <InfoPage
      heading="Our Story"
      description={`${siteConfig.name} — ${siteConfig.tagline}.`}
    >
      <p>{siteConfig.name} offers silk, cotton, wedding and festive sarees.</p>
      <p>
        Based in Elampillai, Salem, Tamil Nadu. Visit us at {siteConfig.address}
        {siteConfig.email ? (
          <>
            , or email{" "}
            <a
              href={`mailto:${siteConfig.email}`}
              className="text-primary hover:underline"
            >
              {siteConfig.email}
            </a>
          </>
        ) : null}
        .
      </p>
      <p>
        Browse our{" "}
        <Link href="/collections" className="text-primary hover:underline">
          collections
        </Link>
        , explore{" "}
        <Link href="/featured" className="text-primary hover:underline">
          featured products
        </Link>
        , or{" "}
        <Link href="/contact" className="text-primary hover:underline">
          get in touch
        </Link>{" "}
        for orders and enquiries.
      </p>
    </InfoPage>
  );
}
