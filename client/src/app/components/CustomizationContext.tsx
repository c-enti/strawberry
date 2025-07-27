"use client";
import React, { createContext, useContext, useState, ReactNode } from "react";
// ...existing code...

export type CustomizationState = {
  themeId: string;
  fontId: string;
  backgroundId: string;
  setThemeId: (id: string) => void;
  setFontId: (id: string) => void;
  setBackgroundId: (id: string) => void;
};

const CustomizationContext = createContext<CustomizationState | undefined>(
  undefined
);

export const useCustomization = () => {
  const ctx = useContext(CustomizationContext);
  if (!ctx)
    throw new Error(
      "useCustomization must be used within CustomizationProvider"
    );
  return ctx;
};

export const CustomizationProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [themeId, setThemeId] = useState("default-theme");
  const [fontId, setFontId] = useState("default-font");
  const [backgroundId, setBackgroundId] = useState("default-bg");

  return (
    <CustomizationContext.Provider
      value={{
        themeId,
        fontId,
        backgroundId,
        setThemeId,
        setFontId,
        setBackgroundId,
      }}
    >
      {children}
    </CustomizationContext.Provider>
  );
};
