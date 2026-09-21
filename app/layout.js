import "./globals.css";

export const metadata = {
  title: "¿Qué comemos?",
  description: "Encuesta para decidir qué comer el fin de semana",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
