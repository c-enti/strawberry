"use client";

import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import styles from './ThemeSwitcher.module.css';

export const ThemeSwitcher: React.FC = () => {
  const { themeId, setTheme, availableThemes } = useTheme();

  return (
    <div className={styles.themeSwitcher}>
      <label className={styles.label}>Theme:</label>
      <div className={styles.themeButtons}>
        {Object.entries(availableThemes).map(([id, theme]) => (
          <button
            key={id}
            onClick={() => setTheme(id)}
            className={`${styles.themeButton} ${themeId === id ? styles.active : ''}`}
            title={theme.name}
            style={{
              '--theme-primary': theme.primary,
              '--theme-accent': theme.accent,
              '--theme-background': theme.background,
            } as React.CSSProperties}
          >
            <span className={styles.colorPreview}>
              <span className={styles.primary} />
              <span className={styles.accent} />
            </span>
            <span className={styles.themeName}>{theme.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
