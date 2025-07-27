"use client";

import React, { useState } from "react";
import Image from "next/image";
import YearlyCalendarGrid from "./YearlyCalendarGrid";
import { exportCalendarToPDF } from "shared";
import { createCalendar, updateCalendar, deleteCalendar } from "../utils/api";

const currentYear = new Date().getFullYear();
const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function CalendarCreator() {
  const [year, setYear] = useState(currentYear);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([months[0]]);
  const [events, setEvents] = useState<{ date: string; title: string }[]>([]);
  const [eventInput, setEventInput] = useState({ date: "", title: "" });
  const [backgroundUrl, setBackgroundUrl] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedCalendarId, setSavedCalendarId] = useState<string | null>(null);

  const handleMonthToggle = (month: string) => {
    setSelectedMonths((prev) =>
      prev.includes(month) ? prev.filter((m) => m !== month) : [...prev, month]
    );
  };

  const handleEventInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEventInput({ ...eventInput, [e.target.name]: e.target.value });
  };

  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (eventInput.date && eventInput.title) {
      setEvents([...events, eventInput]);
      setEventInput({ date: "", title: "" });
    }
  };

  const handleRemoveEvent = (idx: number) => {
    setEvents(events.filter((_, i) => i !== idx));
  };
  const handleReset = () => {
    setYear(currentYear);
    setSelectedMonths([months[0]]);
    setEvents([]);
    setEventInput({ date: "", title: "" });
    setBackgroundUrl(undefined);
  };

  const handleExportPDF = async () => {
    const pdfBytes = await exportCalendarToPDF({
      year,
      selectedMonths,
      events,
      backgroundUrl,
    });
    const safeBytes = new Uint8Array(pdfBytes);
    const blob = new Blob([safeBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${year}-calendar.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveCalendar = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const calendarData = {
        year,
        selectedMonths,
        events,
        backgroundUrl,
      };

      if (savedCalendarId) {
        const updated = await updateCalendar(savedCalendarId, calendarData);
        setSavedCalendarId(updated.id);
      } else {
        const created = await createCalendar(calendarData);
        setSavedCalendarId(created.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save calendar");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCalendar = async () => {
    if (!savedCalendarId) return;

    setIsLoading(true);
    setError(null);
    try {
      await deleteCalendar(savedCalendarId);
      setSavedCalendarId(null);
      // Reset form to initial state
      setYear(currentYear);
      setSelectedMonths([months[0]]);
      setEvents([]);
      setEventInput({ date: "", title: "" });
      setBackgroundUrl(undefined);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete calendar"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {error && (
        <div
          className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative"
          role="alert"
        >
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Create Your Calendar</h1>
        <div className="space-x-4">
          <button
            onClick={handleSaveCalendar}
            disabled={isLoading}
            className={`px-4 py-2 rounded ${
              isLoading
                ? "bg-gray-300 cursor-not-allowed"
                : "bg-blue-500 hover:bg-blue-600 text-white"
            }`}
          >
            {isLoading
              ? "Saving..."
              : savedCalendarId
              ? "Update Calendar"
              : "Save Calendar"}
          </button>
          {savedCalendarId && (
            <button
              onClick={handleDeleteCalendar}
              disabled={isLoading}
              className="px-4 py-2 rounded bg-red-500 hover:bg-red-600 text-white"
            >
              Delete Calendar
            </button>
          )}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label htmlFor="calendar-year">
          <strong>Year:</strong>
        </label>
        <input
          id="calendar-year"
          type="number"
          value={year}
          min={currentYear - 5}
          max={currentYear + 5}
          onChange={(e) => setYear(Number(e.target.value))}
          style={{ marginLeft: 8, width: 100 }}
        />
        <span style={{ marginLeft: 12, color: "#888", fontSize: 12 }}>
          (Choose a year between {currentYear - 5} and {currentYear + 5})
        </span>
      </div>
      <div style={{ marginBottom: 16 }}>
        <strong>Select Months:</strong>
        <div
          style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}
        >
          {months.map((month) => (
            <label key={month} style={{ minWidth: 90 }}>
              <input
                type="checkbox"
                checked={selectedMonths.includes(month)}
                onChange={() => handleMonthToggle(month)}
                aria-checked={selectedMonths.includes(month)}
                aria-label={month}
              />
              {month}
            </label>
          ))}
        </div>
        {selectedMonths.length === 0 && (
          <div style={{ color: "#b00", fontSize: 13, marginTop: 4 }}>
            Please select at least one month.
          </div>
        )}
      </div>
      <hr style={{ margin: "16px 0" }} />
      <div style={{ marginBottom: 16 }}>
        <strong>Add Event:</strong>
        <form
          onSubmit={handleAddEvent}
          style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}
          aria-label="Add calendar event"
        >
          <label htmlFor="event-date" style={{ display: "none" }}>
            Date
          </label>
          <input
            id="event-date"
            type="date"
            name="date"
            value={eventInput.date}
            onChange={handleEventInputChange}
            required
            style={{ minWidth: 140 }}
          />
          <label htmlFor="event-title" style={{ display: "none" }}>
            Title
          </label>
          <input
            id="event-title"
            type="text"
            name="title"
            value={eventInput.title}
            onChange={handleEventInputChange}
            placeholder="Event Title"
            required
            style={{ minWidth: 180 }}
          />
          <button type="submit">Add</button>
          <button type="button" onClick={handleReset} style={{ marginLeft: 8 }}>
            Reset
          </button>
        </form>
        <div style={{ color: "#888", fontSize: 12, marginTop: 4 }}>
          (Events will appear on the calendar grid and in the list below)
        </div>
      </div>
      <div>
        <strong>Events:</strong>
        {events.length === 0 ? (
          <div style={{ color: "#888", fontSize: 13, marginTop: 4 }}>
            No events added yet.
          </div>
        ) : (
          <ul style={{ marginTop: 8, paddingLeft: 18 }}>
            {events.map((event, idx) => (
              <li key={idx} style={{ marginBottom: 4 }}>
                <span style={{ fontWeight: 500 }}>{event.date}</span>:{" "}
                {event.title}
                <button
                  onClick={() => handleRemoveEvent(idx)}
                  style={{
                    marginLeft: 10,
                    color: "#b00",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                  aria-label={`Remove event ${event.title}`}
                  title="Remove event"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div style={{ marginTop: 24 }}>
        <strong>Selected Months:</strong>{" "}
        {selectedMonths.length > 0 ? (
          selectedMonths.join(", ")
        ) : (
          <span style={{ color: "#888" }}>None</span>
        )}
      </div>
      <div style={{ marginTop: 16 }}>
        <strong>Background Image/Art:</strong>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = (ev) =>
                setBackgroundUrl(ev.target?.result as string);
              reader.readAsDataURL(file);
            }
          }}
        />
        {backgroundUrl && (
          <div style={{ marginTop: 8 }}>
            <Image
              src={backgroundUrl}
              alt="Background preview"
              width={200}
              height={120}
              style={{
                maxWidth: 200,
                borderRadius: 8,
                height: "auto",
                display: "block",
                marginTop: 8,
              }}
            />
          </div>
        )}
      </div>
      <div style={{ marginTop: 32 }}>
        <button onClick={handleExportPDF} style={{ marginBottom: 16 }}>
          Export as PDF
        </button>
        <YearlyCalendarGrid
          year={year}
          selectedMonths={selectedMonths}
          events={events}
          backgroundUrl={backgroundUrl}
        />
      </div>
    </div>
  );
}
