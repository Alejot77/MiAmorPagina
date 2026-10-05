// Manifest de la app instalable (PWA). En iPhone es obligatorio para las
// notificaciones: Safari solo las permite a páginas agregadas a la pantalla
// de inicio que se abren como app ("standalone"). En Android además hace que
// Chrome ofrezca "Instalar app".
export default function manifest() {
  return {
    name: "Nuestros planes",
    short_name: "Planes",
    description: "Planear los findes juntos: qué comemos, qué hacemos y a dónde vamos",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f2ff",
    theme_color: "#9d6fe0",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
