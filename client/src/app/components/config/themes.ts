"use client";

import { Theme } from "../types/calendar";

export const themes: Record<string, Theme> = {
  light: {
    name: "Light",
    background: "#ffffff",
    primary: "#22223b",
    accent: "#9a8c98",
    text: "#2b2b2b",
    surface: "#ffffff",
    border: "#e0e0e0",
  },
  dark: {
    name: "Dark",
    background: "#1a1a1a",
    primary: "#bb86fc",
    accent: "#03dac6",
    text: "#ffffff",
    surface: "#2d2d2d",
    border: "#404040",
  },
  highContrast: {
    name: "High Contrast",
    background: "#000000",
    primary: "#ffffff",
    accent: "#ffff00",
    text: "#ffffff",
    surface: "#000000",
    border: "#ffffff",
  },
  sepia: {
    name: "Sepia",
    background: "#f4ecd8",
    primary: "#5c4b37",
    accent: "#8b4513",
    text: "#35281e",
    surface: "#fff1db",
    border: "#d3c4a6",
  },
  ocean: {
    name: "Ocean",
    background: "#f0f8ff",
    primary: "#1e3d59",
    accent: "#17c3b2",
    text: "#2b2b2b",
    surface: "#ffffff",
    border: "#bee3db",
  },
};
