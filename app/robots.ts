import type { MetadataRoute } from "next";

import { CANONICAL_SITE_URL, isProductionDeployment } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  if (!isProductionDeployment()) {
    return {
      rules: [
        {
          userAgent: "*",
          disallow: "/"
        }
      ]
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api"]
      }
    ],
    sitemap: `${CANONICAL_SITE_URL}/sitemap.xml`
  };
}
