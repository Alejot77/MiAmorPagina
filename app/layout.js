import "./globals.css";
import { DM_Sans, Fraunces } from "next/font/google";
import UpdatePrompt from "@/components/UpdatePrompt";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["600", "700"],
  style: ["normal", "italic"],
  variable: "--font-heading",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata = {
  title: "Plan de dos",
  description: "Planes en pareja, con amigos o en familia: voten qué comer, qué hacer y a dónde ir.",
  // Para que en iPhone "Agregar a inicio" la abra como app (sin barra de
  // Safari) con su ícono: es lo que permite las notificaciones allá.
  appleWebApp: {
    capable: true,
    title: "Nuestros planes",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#9d6fe0",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${fraunces.variable} ${dmSans.variable}`}>
      <body>
        {children}
        <UpdatePrompt />
      </body>
    </html>
  );
}
