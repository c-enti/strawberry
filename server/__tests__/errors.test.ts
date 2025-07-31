import { Response } from "express";
import {
  PrismaClientKnownRequestError,
  PrismaClientValidationError,
} from "@prisma/client/runtime/library";
import { CalendarError, handleDatabaseError } from "../lib/errors";

// Mock Response object
const mockResponse = () => {
  const res: Partial<Response> = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as Response;
};

describe("Error Handling", () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe("CalendarError", () => {
    it("should create error with default status code", () => {
      const error = new CalendarError("Test error");
      expect(error.message).toBe("Test error");
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe("CalendarError");
    });

    it("should create error with custom status code", () => {
      const error = new CalendarError("Not found", 404);
      expect(error.message).toBe("Not found");
      expect(error.statusCode).toBe(404);
    });

    it("should create error with details", () => {
      const details = { field: "test" };
      const error = new CalendarError("Validation error", 400, details);
      expect(error.details).toEqual(details);
    });

    it("should preserve error name after inheritance", () => {
      class CustomError extends CalendarError {
        constructor() {
          super("Custom error", 418);
        }
      }
      const error = new CustomError();
      expect(error.name).toBe("CustomError");
    });
  });

  describe("handleDatabaseError", () => {
    it("should handle unique constraint violation (P2002)", () => {
      const error = new PrismaClientKnownRequestError(
        "Unique constraint violation",
        {
          code: "P2002",
          clientVersion: "1.0",
        }
      );
      const res = mockResponse();

      handleDatabaseError(error, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        message: "A calendar with these properties already exists",
        code: "P2002",
      });
    });

    it("should handle record not found (P2025)", () => {
      const error = new PrismaClientKnownRequestError("Record not found", {
        code: "P2025",
        clientVersion: "1.0",
      });
      const res = mockResponse();

      handleDatabaseError(error, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "Calendar not found",
        code: "P2025",
      });
    });

    it("should handle other Prisma known errors", () => {
      const error = new PrismaClientKnownRequestError("Unknown error", {
        code: "P2001",
        clientVersion: "1.0",
      });
      const res = mockResponse();

      handleDatabaseError(error, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Database operation failed",
        code: "P2001",
      });
    });

    it("should handle validation errors", () => {
      const error = new PrismaClientValidationError("Invalid data", {
        clientVersion: "1.0",
      });
      const res = mockResponse();

      handleDatabaseError(error, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invalid data provided",
        details: error.message,
      });
    });

    it("should handle custom calendar errors", () => {
      const error = new CalendarError("Custom error", 418, { extra: "info" });
      const res = mockResponse();

      handleDatabaseError(error, res);

      expect(res.status).toHaveBeenCalledWith(418);
      expect(res.json).toHaveBeenCalledWith({
        message: "Custom error",
        details: { extra: "info" },
      });
    });

    it("should handle unknown errors", () => {
      const error = new Error("Unknown error");
      const res = mockResponse();

      handleDatabaseError(error, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "An unexpected error occurred",
      });
      expect(consoleSpy).toHaveBeenCalledWith("Database error:", error);
    });

    it("should handle null or undefined errors", () => {
      const res = mockResponse();

      handleDatabaseError(null, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "An unexpected error occurred",
      });

      handleDatabaseError(undefined, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "An unexpected error occurred",
      });
    });

    it("should handle errors without a code property", () => {
      const error = { message: "Custom error object" };
      const res = mockResponse();

      handleDatabaseError(error, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "An unexpected error occurred",
      });
    });
  });
});
