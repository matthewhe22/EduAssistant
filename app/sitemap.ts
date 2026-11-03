import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/ui/landing-content";

/** Public pages only. Regional pages (for example /nsw) can be added here later. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/curriculum`, changeFrequency: "monthly", priority: 0.6 },
  ];
}
