import { CalendarError } from "../lib/errors";
import { validateCalendarInput } from "../routes/calendar";

describe("Calendar Input Validation", () => {
  describe("Year Validation", () => {
    test("should accept valid year number", () => {
      expect(() =>
        validateCalendarInput({ year: 2025, selectedMonths: ["January"] })
      ).not.toThrow();
    });

    test("should reject string year", () => {
      expect(() =>
        validateCalendarInput({ year: "2025", selectedMonths: ["January"] })
      ).toThrow(
        new CalendarError("Year is required and must be a number", 400)
      );
    });

    test("should reject missing year", () => {
      expect(() =>
        validateCalendarInput({ selectedMonths: ["January"] })
      ).toThrow(
        new CalendarError("Year is required and must be a number", 400)
      );
    });
  });
});
