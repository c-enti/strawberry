"use client";

import React from "react";
import { CustomizationTemplate } from "./CustomizationSelectors";
import { useCustomization } from "./CustomizationContext";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import BottomBar from "./BottomBar";
import CalendarArea from "./CalendarArea";
import styles from "./CalendarCreatorPlus.module.css";
import { CalendarViewProvider } from "./CalendarViewContext";

const CalendarCreatorPlus: React.FC = () => {
  // Example template options (replace with real data)
  const templates: CustomizationTemplate[] = [
    { id: "light", name: "Light Theme", preview: "#fff", type: "theme" },
    { id: "dark", name: "Dark Theme", preview: "#222", type: "theme" },
    {
      id: "sans",
      name: "Sans Font",
      preview: "Geist, Arial, sans-serif",
      type: "font",
    },
    {
      id: "mono",
      name: "Mono Font",
      preview: "Geist Mono, monospace",
      type: "font",
    },
    {
      id: "bg1",
      name: "Blue Sky",
      preview: "/public/next.svg",
      type: "background",
    },
    {
      id: "bg2",
      name: "Vercel",
      preview: "/public/vercel.svg",
      type: "background",
    },
  ];

  const {
    themeId,
    fontId,
    backgroundId,
    setThemeId,
    setFontId,
    setBackgroundId,
  } = useCustomization();

  return (
    <CalendarViewProvider>
      <div className={styles["calendar-plus-root"]}>
        <TopBar />
        <div className={styles["calendar-plus-main"]}>
          <Sidebar
            templates={templates}
            themeId={themeId}
            fontId={fontId}
            backgroundId={backgroundId}
            onThemeSelect={setThemeId}
            onFontSelect={setFontId}
            onBackgroundSelect={setBackgroundId}
          />
          <CalendarArea />
        </div>
        <BottomBar />
      </div>
    </CalendarViewProvider>
  );
};

export default CalendarCreatorPlus;
