import { Prisma } from "@prisma/client";
import { CalendarError } from "../lib/errors";
import { prisma } from "../lib/prisma";

// Custom error classes
class NotFoundError extends CalendarError {
  constructor(message: string) {
    super(message, 404);
    this.name = "NotFoundError";
  }
}

class BadRequestError extends CalendarError {
  constructor(message: string) {
    super(message, 400);
    this.name = "BadRequestError";
  }
}

interface CalendarEvent {
  date: string;
  title: string;
}

interface CalendarSettings {
  [key: string]: any;
  theme?: {
    colors?: string[];
    fonts?: string[];
    layout?: string;
  };
  design?: {
    backgroundStyle?: string;
    headerStyle?: string;
  };
  preferences?: {
    weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
    showHolidays?: boolean;
  };
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  year: number;
  selectedMonths: string[];
  settings?: CalendarSettings;
  backgroundUrl?: string;
  events?: CalendarEvent[];
}

export interface UpdateProjectInput extends Partial<CreateProjectInput> {
  id: string;
}

export class ProjectManagementService {
  /**
   * Get a calendar project by ID
   */
  async getProject(id: string) {
    const project = await prisma.calendar.findUnique({
      where: { id },
      include: {
        events: true,
      },
    });

    if (!project) {
      throw new NotFoundError(`Calendar project ${id} not found`);
    }

    return project;
  }

  /**
   * List all calendar projects
   */
  async listProjects() {
    return prisma.calendar.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        events: true,
      },
    });
  }

  /**
   * Create a new calendar project
   */
  async createProject(data: CreateProjectInput) {
    const { events, ...createData } = data;

    try {
      return await prisma.$transaction(
        async (tx) => {
          const calendar = await tx.calendar.create({
            data: {
              ...createData,
              settings: (createData.settings as Prisma.InputJsonValue) || {},
              events: events
                ? {
                    create: events.map((event) => ({
                      date: event.date,
                      title: event.title,
                    })),
                  }
                : undefined,
            },
            include: {
              events: true,
            },
          });

          // Verify creation
          const verifyProject = await tx.calendar.findUnique({
            where: { id: calendar.id },
            include: { events: true },
          });

          if (!verifyProject) {
            throw new BadRequestError("Failed to create project");
          }

          return verifyProject;
        },
        {
          maxWait: 5000, // 5 seconds max wait per retry
          timeout: 10000, // 10 second transaction timeout
          isolationLevel: "Serializable", // Ensure strong consistency
        }
      );
    } catch (err: any) {
      if (err.code === "P2002") {
        throw new CalendarError("Calendar with this name already exists", 400);
      }
      if (err.code === "P2003") {
        throw new CalendarError("Invalid data provided", 400);
      }
      if (err.message?.includes("deadlock detected")) {
        throw new CalendarError("Database conflict, please try again", 409);
      }
      throw err;
    }
  }

  /**
   * Delete a calendar project
   */
  async deleteProject(id: string) {
    try {
      // First verify project exists
      const project = await this.getProject(id);
      if (!project) {
        throw new NotFoundError(`Calendar project ${id} not found`);
      }

      // Then delete with a transaction
      return await prisma.$transaction(
        async (tx) => {
          // Delete events first to avoid foreign key issues
          await tx.event.deleteMany({
            where: { calendarId: id },
          });

          // Then delete calendar
          await tx.calendar.delete({
            where: { id },
          });

          // Verify deletion
          const verifyDelete = await tx.calendar.findUnique({
            where: { id },
            include: { events: true },
          });

          if (verifyDelete) {
            throw new Error("Failed to delete calendar");
          }
        },
        {
          maxWait: 5000,
          timeout: 10000,
          isolationLevel: "Serializable",
        }
      );
    } catch (err: any) {
      if (err.code === "P2025") {
        // Record to delete does not exist - that's fine
        return;
      }
      if (err.message?.includes("deadlock detected")) {
        throw new CalendarError("Database conflict, please try again", 409);
      }
      throw err;
    }
  }

  /**
   * Update a calendar project
   */
  async updateProject(data: UpdateProjectInput) {
    const { id, events, ...updateData } = data;

    try {
      // First verify project exists
      const existingProject = await this.getProject(id);

      // Then update in a transaction
      return await prisma.$transaction(
        async (tx) => {
          // Build update data
          const updateFields: any = {};
          if (updateData.name !== undefined)
            updateFields.name = updateData.name;
          if (updateData.description !== undefined)
            updateFields.description = updateData.description;
          if (updateData.year !== undefined)
            updateFields.year = updateData.year;
          if (updateData.selectedMonths !== undefined)
            updateFields.selectedMonths = updateData.selectedMonths;
          if (updateData.backgroundUrl !== undefined)
            updateFields.backgroundUrl = updateData.backgroundUrl;
          if (updateData.settings !== undefined) {
            updateFields.settings =
              updateData.settings as Prisma.InputJsonValue;
          }

          // Handle events update if provided
          if (events !== undefined) {
            await tx.event.deleteMany({
              where: { calendarId: id },
            });

            if (events && events.length > 0) {
              updateFields.events = {
                create: events.map((event) => ({
                  date: event.date,
                  title: event.title,
                })),
              };
            }
          }

          const updated = await tx.calendar.update({
            where: { id },
            data: updateFields,
            include: {
              events: true,
            },
          });

          // Verify update
          const verifyUpdate = await tx.calendar.findUnique({
            where: { id },
            include: { events: true },
          });

          if (!verifyUpdate) {
            throw new Error("Failed to update calendar");
          }

          return verifyUpdate;
        },
        {
          maxWait: 5000,
          timeout: 10000,
          isolationLevel: "Serializable",
        }
      );
    } catch (err: any) {
      if (err.code === "P2025") {
        throw new NotFoundError(`Calendar project ${id} not found`);
      }
      if (err.code === "P2002") {
        throw new CalendarError("Calendar with this name already exists", 400);
      }
      if (err.message?.includes("deadlock detected")) {
        throw new CalendarError("Database conflict, please try again", 409);
      }
      throw err;
    }
  }
}

export const projectManagementService = new ProjectManagementService();
