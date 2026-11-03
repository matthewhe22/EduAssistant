import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/ui/landing-content";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/plan", "/plans", "/templates", "/usage", "/settings", "/admin", "/api/", "/auth/", "/login"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
