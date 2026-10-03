"use client";

import { useEffect } from "react";

// Pone data-person en <html> para que globals.css aplique la paleta de
// colores de quien esta conectado en este dispositivo.
export function useThemePerson(person) {
  useEffect(() => {
    document.documentElement.setAttribute("data-person", person || "");
  }, [person]);
}
