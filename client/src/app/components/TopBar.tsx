"use client";

import React from "react";
import { useCalendarView, CalendarView } from "./CalendarViewContext";

const views: CalendarView[] = ["year", "month", "week", "day"];

const TopBar: React.FC = () => {
  const { view, setView } = useCalendarView();
  return (
    <header className="calendar-plus-topbar">
      <div style={{ flex: 1 }}>App Name</div>
      <nav style={{ display: "flex", gap: "1rem" }}>
        {views.map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              fontWeight: view === v ? "bold" : undefined,
              background: view === v ? "#9a8c98" : "#22223b",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              padding: "0.5rem 1rem",
              cursor: "pointer",
            }}
            aria-pressed={view === v}
          >
            {v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </nav>
      <div style={{ marginLeft: "auto" }}>
        {/* Export | Share buttons placeholder */}
      </div>
    </header>
  );
};

export default TopBar;
