"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { Theme } from "../types/calendar";
import { themes } from "../config/themes";

interface ThemeContextType {
  currentTheme: Theme;
  setTheme: (themeId: string) => void;
  themeId: string;
  availableThemes: typeof themes;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [themeId, setThemeId] = useState<string>("light");

  // Load theme preference from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("calendarTheme");
    if (savedTheme && themes[savedTheme]) {
      setThemeId(savedTheme);
    }
  }, []);

  // Save theme preference to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("calendarTheme", themeId);
  }, [themeId]);

  const setTheme = (newThemeId: string) => {
    if (themes[newThemeId]) {
      setThemeId(newThemeId);
    }
  };

  const value = {
    currentTheme: themes[themeId],
    setTheme,
    themeId,
    availableThemes: themes,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
