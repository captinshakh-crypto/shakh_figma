import type { MetadataRoute } from "next";

const siteUrl = "https://www.daim-post.online";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/icon", "/icon-192", "/apple-icon", "/opengraph-image"],
      disallow: [
        "/dashboard/",
        "/cart",
        "/login",
        "/forgot-password",
        "/reset-password",
        "/auth/",
      ],
    },
    sitemap: siteUrl + "/sitemap.xml",
    host: siteUrl,
  };
}
