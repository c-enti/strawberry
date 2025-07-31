import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import CalendarCreator from "../src/app/components/CalendarCreator";

describe("CalendarCreator", () => {
  it("renders the calendar creator UI", () => {
    render(<CalendarCreator />);
    expect(screen.getByText("Create Your Calendar")).toBeInTheDocument();
    expect(screen.getByText("Add Event:")).toBeInTheDocument();
    expect(screen.getByText("Select Months:")).toBeInTheDocument();
  });

  it("allows adding an event", () => {
    render(<CalendarCreator />);
    const dateInput = screen.getByRole("spinbutton", { name: /year/i });
    const titleInput = screen.getByPlaceholderText(/event title/i);
    const addButton = screen.getByRole("button", { name: /add/i });

    fireEvent.change(dateInput, { target: { value: 2025 } });
    fireEvent.change(titleInput, { target: { value: "Christmas" } });
    fireEvent.click(addButton);

    expect(screen.getByDisplayValue("Christmas")).toBeInTheDocument();
  });

  it("allows toggling months", () => {
    render(<CalendarCreator />);
    const febCheckbox = screen.getByLabelText("February");
    fireEvent.click(febCheckbox);
    expect(febCheckbox).toBeChecked();
  });
});
