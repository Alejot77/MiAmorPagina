/** @type {import('next').NextConfig} */
const nextConfig = {
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
