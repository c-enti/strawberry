"use client";

import React, { lazy, Suspense } from "react";
const GenAIAssistant = lazy(() => import("./GenAIAssistant"));
import { CustomizationTemplate } from "./CustomizationSelectors";
import styles from "./Sidebar.module.css";
import {
  ThemeSelector,
  FontSelector,
  BackgroundSelector,
} from "./CustomizationSelectors";

interface SidebarProps {
  templates: CustomizationTemplate[];
  themeId: string;
  fontId: string;
  backgroundId: string;
  onThemeSelect: (id: string) => void;
  onFontSelect: (id: string) => void;
  onBackgroundSelect: (id: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  templates,
  themeId,
  fontId,
  backgroundId,
  onThemeSelect,
  onFontSelect,
  onBackgroundSelect,
}) => {
  return (
    <aside className={styles.sidebar}>
      <nav className={styles.nav}>
        <div className={styles.section}>
          <ThemeSelector
            templates={templates}
            selectedId={themeId}
            onSelect={onThemeSelect}
          />
        </div>
        <div className={styles.section}>
          <FontSelector
            templates={templates}
            selectedId={fontId}
            onSelect={onFontSelect}
          />
        </div>
        <div className={styles.section}>
          <BackgroundSelector
            templates={templates}
            selectedId={backgroundId}
            onSelect={onBackgroundSelect}
          />
        </div>
        {/* Placeholders for other sections */}
        <div className={styles.section}>
          <h3>Colors</h3>
          <div className={styles.comingSoon}>Coming soon</div>
        </div>
        <div className={styles.section}>
          <h3>Stickers</h3>
          <div className={styles.comingSoon}>Coming soon</div>
        </div>
        <div className={styles.section}>
          <h3>Notes/Photos</h3>
          <div className={styles.comingSoon}>Coming soon</div>
        </div>
        <div className={styles.section}>
          <h3>Settings</h3>
          <div className={styles.comingSoon}>Coming soon</div>
        </div>
        <div className={styles.section}>
          {/* GenAI Assistant Section */}
          <Suspense fallback={<div>Loading GenAI Assistant...</div>}>
            <GenAIAssistant />
          </Suspense>
        </div>
      </nav>
    </aside>
  );
};

export default Sidebar;
