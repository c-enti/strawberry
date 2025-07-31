import { render, screen } from "@testing-library/react";
import React from "react";
import YearlyCalendarGrid from "../src/app/components/YearlyCalendarGrid";

describe("YearlyCalendarGrid", () => {
  it("renders selected months and events", () => {
    render(
      <YearlyCalendarGrid
        year={2025}
        selectedMonths={["January", "February"]}
        events={[
          { date: "2025-01-01", title: "New Year" },
          { date: "2025-02-14", title: "Valentine's Day" },
        ]}
        backgroundUrl={undefined}
      />
    );

    // Verify months are rendered
    expect(screen.getByText("January 2025")).toBeInTheDocument();
    expect(screen.getByText("February 2025")).toBeInTheDocument();

    // Verify events are rendered
    expect(screen.getByText("New Year")).toBeInTheDocument();
    expect(screen.getByText("Valentine's Day")).toBeInTheDocument();
  });
});
