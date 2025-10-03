# AetherPress Extension: Dynamic Journal Generation

## Overview

This document outlines how AetherPress can evolve to dynamically generate themed, fillable PDF journals—leveraging its existing architecture while expanding into interactive, seasonal content creation.

## 🧭 Strategic Extension: From eBooks to Journals

AetherPress already supports:

- Prompt-based generation
- AI-driven content and layout
- HTML-to-PDF export via Puppeteer

To support **fillable journals**, we'll extend the pipeline to include:

- **Form field injection** into HTML templates
- **Theme-aware prompt parsing**
- **Modular journal components** (e.g., trackers, prompts, calendars)

## 🏗️ Architectural Blueprint

### 1. **Prompt → Journal Intent Parser**

- Extend the **Prompt Engine** to detect journal-specific intents:
  - `"Create a cozy October journal with mood tracker and daily prompts"`
- Parse for:
  - Theme (`October`, `Autumn`, `Whimsical`)
  - Modules (`Mood Tracker`, `Daily Reflections`, `Mini Challenges`)
  - Style (`Whimsical`, `Minimalist`, etc.)

### 2. **AI Orchestrator → Journal Composer**

- Adapt the **AI Orchestrator** to:
  - Generate themed prompts and titles
  - Select decorative backgrounds
  - Define form field types (text, checkbox, dropdown)
- Use Gemini to generate:
  - Page-level content
  - Seasonal illustrations
  - Field labels and instructions

### 3. **Layout Engine → Form-Aware HTML Templates**

- Introduce reusable journal components:
  ```html
  <JournalPage type="tracker" /> <JournalPage type="prompt" />
  ```
- Inject `<input>`, `<textarea>`, and `<select>` fields with `name` attributes
- Style with seasonal CSS classes (e.g., `.autumn-border`, `.pumpkin-accent`)

### 4. **Preview → Interactive Journal Viewer**

- Render fillable fields in the preview pane
- Allow basic override of:
  - Prompt text
  - Field labels
  - Background art

### 5. **Export → Fillable PDF via Puppeteer**

- Use Puppeteer's form field support:
  - Preserve `<input>` and `<textarea>` as fillable fields
  - Embed metadata for accessibility and tab order
- Output: A4 or Letter-sized themed journal with interactive fields

## 🧪 Example Workflow

**Prompt**:

> "Create a whimsical October journal with daily reflections, mood tracker, and cozy challenges."

**Generated Pages**:

1. Cover: "Whispers of October" with illustrated forest
2. Daily Prompt Page:
   - "What did the wind whisper today?"
   - `<textarea name="daily_reflection_01" />`
3. Mood Tracker:
   - Leaf icons with checkboxes
   - `<input type="checkbox" name="mood_happy" />`
4. Cozy Challenge:
   - "Find something orange and describe it"
   - `<textarea name="challenge_01" />`

**Export**:  
→ Fillable PDF with embedded fields, styled backgrounds, and whimsical typography

## 🔮 Future Enhancements (V1.0+)

- **User-defined modules** via drag-and-drop dashboard
- **Agentic journaling assistant** that adapts prompts based on user entries
- **Seasonal journal packs** auto-generated monthly
- **Cloud sync** for journal progress and entries

## Technical Implementation Details

### Sample Journal Module Schema (PostgreSQL JSONB)

```sql
CREATE TABLE journal_modules (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL,  -- 'tracker', 'prompt', 'challenge'
    metadata JSONB NOT NULL,    -- Configurable module properties
    template JSONB NOT NULL,    -- HTML template with field definitions
    themes TEXT[],             -- Compatible themes/seasons
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Example module data
INSERT INTO journal_modules (type, metadata, template, themes) VALUES (
    'mood_tracker',
    '{
        "title": "Monthly Mood Tracker",
        "description": "Track your daily mood with seasonal icons",
        "fieldCount": 31,
        "iconSet": "autumn_leaves"
    }',
    '{
        "html": "<div class=\"mood-tracker autumn-theme\">...</div>",
        "fields": [{
            "type": "checkbox",
            "name": "mood_day_${n}",
            "label": "Day ${n}",
            "icon": "${leaf_icon}"
        }]
    }',
    ARRAY['autumn', 'october', 'harvest']
);
```

### Sample Journal Page Template

```html
<!-- components/journal/MoodTrackerPage.svelte -->
<script>
  export let theme = "autumn";
  export let days = 31;
  export let icons = [];
</script>

<div class="journal-page {theme}-theme">
  <header class="journal-header">
    <h2>October Mood Tracker</h2>
    <div class="seasonal-decoration"></div>
  </header>

  <div class="tracker-grid">
    {#each Array(days) as _, i}
    <div class="day-cell">
      <label for="mood_{i+1}">
        <img src="{icons[i" % icons.length]} alt="mood icon" />
      </label>
      <input
        type="checkbox"
        id="mood_{i+1}"
        name="mood_day_{i+1}"
        data-day="{i+1}"
      />
    </div>
    {/each}
  </div>

  <footer class="journal-footer">
    <div class="legend">
      <!-- Mood icons legend -->
    </div>
  </footer>
</div>

<style>
  .autumn-theme {
    --primary-color: #d64e27;
    --accent-color: #f0a04b;
    --background: #fdf6ec;
  }

  .tracker-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 1rem;
    padding: 2rem;
  }

  .day-cell {
    aspect-ratio: 1;
    display: grid;
    place-items: center;
  }
</style>
```

This extension builds naturally on AetherPress's existing capabilities while opening up new possibilities for interactive content generation. The modular architecture makes it easy to add new journal components and themes over time.

Would you like me to provide more detailed examples of:

1. Theme-aware prompt parsing implementation
2. Puppeteer form field injection code
3. Dynamic template generation system
4. Database schema for other journal components
