import "./globals.css";
import { Fraunces, Nunito } from "next/font/google";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-heading",
  display: "swap",
});

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-body",
  display: "swap",
});

export const metadata = {
  title: "¿Qué comemos?",
  description: "Encuesta para decidir qué comer el fin de semana",
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
    <html lang="es" className={`${fraunces.variable} ${nunito.variable}`}>
      <body>{children}</body>
    </html>
  );
}
