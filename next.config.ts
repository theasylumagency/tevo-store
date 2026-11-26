import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  // frame-ancestors/base-uri/form-action only: a full script CSP would need per-request nonces,
  // which turns every page dynamic. Bank payment pages are reached by redirect, not by form post.
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
  // HSTS is sent by the reverse proxy (Caddy/nginx) so plain-http local runs keep working.
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  cacheComponents: true,
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  partialPrefetching: true,
  images: {
    // product photos are served from /public/media (a link to MEDIA_DIR, see scripts/link-media.mjs)
    localPatterns: [{ pathname: "/media/**", search: "" }],
    formats: ["image/avif", "image/webp"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
