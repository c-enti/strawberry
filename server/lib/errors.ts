import {
  PrismaClientKnownRequestError,
  PrismaClientValidationError,
} from "@prisma/client/runtime/library";
import { Response } from "express";

export class CalendarError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export function handleDatabaseError(error: unknown, res: Response): void {
  console.error("Database error:", error);

  if (error instanceof PrismaClientKnownRequestError) {
    // Handle known Prisma errors
    switch (error.code) {
      case "P2002": // Unique constraint violation
        res.status(409).json({
          message: "A calendar with these properties already exists",
          code: error.code,
        });
        break;
      case "P2025": // Record not found
        res.status(404).json({
          message: "Calendar not found",
          code: error.code,
        });
        break;
      default:
        res.status(500).json({
          message: "Database operation failed",
          code: error.code,
        });
    }
  } else if (error instanceof PrismaClientValidationError) {
    // Handle validation errors
    res.status(400).json({
      message: "Invalid data provided",
      details: error.message,
    });
  } else if (error instanceof CalendarError) {
    // Handle custom calendar errors
    res.status(error.statusCode).json({
      message: error.message,
      details: error.details,
    });
  } else {
    // Handle unknown errors
    res.status(500).json({
      message: "An unexpected error occurred",
    });
  }
}
