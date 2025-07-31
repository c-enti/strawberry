import React from "react";
import styles from "./CustomizationSelectors.module.css";

// Template option type for theme, font, background
export type CustomizationTemplate = {
  id: string;
  name: string;
  preview: string; // URL or color code
  type: "theme" | "font" | "background";
};

export interface ThemeSelectorProps {
  templates: CustomizationTemplate[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  templates,
  selectedId,
  onSelect,
}) => {
  const [isLoading, setIsLoading] = React.useState(false);

  const handleKeyDown = (e: React.KeyboardEvent, templateId: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(templateId);
    }
  };

  return (
    <div
      className={styles["theme-selector"]}
      role="region"
      aria-label="Theme selection"
    >
      <h3 id="theme-heading">Theme Options</h3>
      <div
        className={`${styles["theme-options"]} ${
          isLoading ? styles.loading : ""
        }`}
        role="listbox"
        aria-labelledby="theme-heading"
      >
        {templates
          .filter((t) => t.type === "theme")
          .map((template) => (
            <button
              key={template.id}
              className={`${styles.customButton} ${
                selectedId === template.id ? styles.selected : ""
              }`}
              style={{ background: template.preview }}
              onClick={() => {
                setIsLoading(true);
                onSelect(template.id);
                setTimeout(() => setIsLoading(false), 300); // Simulate loading
              }}
              onKeyDown={(e) => handleKeyDown(e, template.id)}
              role="option"
              aria-selected={selectedId === template.id}
              tabIndex={0}
            >
              {template.name}
            </button>
          ))}
      </div>
    </div>
  );
};

export interface FontSelectorProps {
  templates: CustomizationTemplate[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export const FontSelector: React.FC<FontSelectorProps> = ({
  templates,
  selectedId,
  onSelect,
}) => {
  const [isLoading, setIsLoading] = React.useState(false);

  const handleKeyDown = (e: React.KeyboardEvent, templateId: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(templateId);
    }
  };

  return (
    <div
      className={styles["font-selector"]}
      role="region"
      aria-label="Font selection"
    >
      <h3 id="font-heading">Font Options</h3>
      <div
        className={`${styles["font-options"]} ${
          isLoading ? styles.loading : ""
        }`}
        role="listbox"
        aria-labelledby="font-heading"
      >
        {templates
          .filter((t) => t.type === "font")
          .map((template) => (
            <button
              key={template.id}
              className={`${styles.customButton} ${
                selectedId === template.id ? styles.selected : ""
              }`}
              style={{ fontFamily: template.preview }}
              onClick={() => {
                setIsLoading(true);
                onSelect(template.id);
                setTimeout(() => setIsLoading(false), 300); // Simulate loading
              }}
              onKeyDown={(e) => handleKeyDown(e, template.id)}
              role="option"
              aria-selected={selectedId === template.id}
              tabIndex={0}
            >
              {template.name}
            </button>
          ))}
      </div>
    </div>
  );
};

export interface BackgroundSelectorProps {
  templates: CustomizationTemplate[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export const BackgroundSelector: React.FC<BackgroundSelectorProps> = ({
  templates,
  selectedId,
  onSelect,
}) => {
  const [isLoading, setIsLoading] = React.useState(false);

  const handleKeyDown = (e: React.KeyboardEvent, templateId: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(templateId);
    }
  };

  return (
    <div
      className={styles["background-selector"]}
      role="region"
      aria-label="Background selection"
    >
      <h3 id="background-heading">Background Options</h3>
      <div
        className={`${styles["background-options"]} ${
          isLoading ? styles.loading : ""
        }`}
        role="listbox"
        aria-labelledby="background-heading"
      >
        {templates
          .filter((t) => t.type === "background")
          .map((template) => (
            <button
              key={template.id}
              className={`${styles.customButton} ${
                selectedId === template.id ? styles.selected : ""
              }`}
              style={{ backgroundImage: `url(${template.preview})` }}
              onClick={() => {
                setIsLoading(true);
                onSelect(template.id);
                setTimeout(() => setIsLoading(false), 300); // Simulate loading
              }}
              onKeyDown={(e) => handleKeyDown(e, template.id)}
              role="option"
              aria-selected={selectedId === template.id}
              tabIndex={0}
            >
              {template.name}
            </button>
          ))}
      </div>
    </div>
  );
};
