"use client";

import { useEffect } from "react";
import { defaultThemeFor, themeInfo } from "@/config";

// El tema de cada persona se guarda en la base (para que la siga en otros
// celulares) y en este dispositivo (para pintarlo de una vez al abrir).
const storageKey = (person) => `miamor_theme_${person}`;

export function savedTheme(person) {
  try {
    return localStorage.getItem(storageKey(person));
  } catch {
    return null;
  }
}

export function rememberTheme(person, themeId) {
  try {
    localStorage.setItem(storageKey(person), themeId);
  } catch {
    // sin almacenamiento: se vuelve a leer de la base al abrir
  }
}

// Pone data-theme en <html> (redesign.css repinta las variables) y el color
// de la barra del celular.
export function applyTheme(themeId) {
  const theme = themeInfo(themeId);
  document.documentElement.setAttribute("data-theme", theme.id);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme.meta);
}

export function useThemePerson(person) {
  useEffect(() => {
    if (!person) {
      document.documentElement.removeAttribute("data-theme");
      return;
    }
    applyTheme(savedTheme(person) || defaultThemeFor(person));
  }, [person]);
}
