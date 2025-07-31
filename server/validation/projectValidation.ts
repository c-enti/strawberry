import { body } from "express-validator";

export const validateProjectInput = [
  body("name").isString().trim().notEmpty().withMessage("Name is required"),
  body("year")
    .isInt({ min: 1900, max: 2100 })
    .withMessage("Year must be a valid integer between 1900 and 2100"),
  body("selectedMonths")
    .isArray({ min: 1 })
    .withMessage("At least one month must be selected"),
  // Add more field validations as needed
];

export const validateProjectUpdateInput = [
  body("name")
    .optional()
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Name, if provided, must be a non-empty string"),
  body("year")
    .optional()
    .isInt({ min: 1900, max: 2100 })
    .withMessage(
      "Year, if provided, must be a valid integer between 1900 and 2100"
    ),
  body("selectedMonths")
    .optional()
    .isArray({ min: 1 })
    .withMessage("If provided, at least one month must be selected"),
  // Add more field validations as needed
];
