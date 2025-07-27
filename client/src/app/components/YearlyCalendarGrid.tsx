"use client";

import React from "react";

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

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

export default function YearlyCalendarGrid({
  year,
  selectedMonths,
  events,
  backgroundUrl,
}: {
  year: number;
  selectedMonths: string[];
  events: { date: string; title: string }[];
  backgroundUrl?: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 24,
        background: backgroundUrl
          ? `url(${backgroundUrl}) center/cover no-repeat`
          : undefined,
        padding: 24,
        borderRadius: 12,
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        minHeight: 600,
      }}
    >
      {months
        .filter((m) => selectedMonths.includes(m))
        .map((month) => {
          const monthIdx = months.indexOf(month);
          const days = getDaysInMonth(year, monthIdx);
          return (
            <div
              key={month}
              style={{
                background: "rgba(255,255,255,0.85)",
                borderRadius: 8,
                padding: 12,
              }}
            >
              <h4 style={{ margin: "0 0 8px 0", textAlign: "center" }}>
                {month} {year}
              </h4>
              <table
                style={{
                  width: "100%",
                  fontSize: 12,
                  borderCollapse: "collapse",
                }}
              >
                <thead>
                  <tr>
                    {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                      <th key={d} style={{ padding: 2, fontWeight: 600 }}>
                        {d}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const firstDay = new Date(year, monthIdx, 1).getDay();
                    const rows = [];
                    let cells = [];
                    let day = 1;
                    for (let i = 0; i < 6; i++) {
                      cells = [];
                      for (let j = 0; j < 7; j++) {
                        if ((i === 0 && j < firstDay) || day > days) {
                          cells.push(<td key={j}></td>);
                        } else {
                          const dateStr = `${year}-${String(
                            monthIdx + 1
                          ).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                          const dayEvents = events.filter(
                            (e) => e.date === dateStr
                          );
                          cells.push(
                            <td
                              key={j}
                              style={{
                                padding: 2,
                                textAlign: "center",
                                background: dayEvents.length
                                  ? "#ffeeba"
                                  : undefined,
                                borderRadius: 4,
                              }}
                            >
                              {day}
                              {dayEvents.length > 0 && (
                                <div style={{ fontSize: 10, color: "#b36b00" }}>
                                  {dayEvents.map((e, i) => (
                                    <div key={i}>{e.title}</div>
                                  ))}
                                </div>
                              )}
                            </td>
                          );
                          day++;
                        }
                      }
                      rows.push(<tr key={i}>{cells}</tr>);
                    }
                    return rows;
                  })()}
                </tbody>
              </table>
            </div>
          );
        })}
    </div>
  );
}
