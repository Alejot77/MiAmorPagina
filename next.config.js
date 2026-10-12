/** @type {import('next').NextConfig} */

// Encabezados de seguridad para todas las paginas y la API.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Las pantallas viejas ahora viven dentro de la app principal.
  async redirects() {
    return ["/history", "/lugares", "/ruleta", "/perfil"].map((source) => ({
      source,
      destination: "/",
      permanent: false,
    }));
  },
};

module.exports = nextConfig;
