import request from "supertest";
import app from "../app";
import { cleanupDatabase } from "./helpers/db";
import { prisma } from "../lib/prisma";

describe("Project Management API", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  afterAll(async () => {
    await cleanupDatabase();
    await prisma.$disconnect();
  });

  describe("POST /projects", () => {
    it("should create a new project with valid data", async () => {
      const newProject = {
        name: "Test Calendar",
        year: 2025,
        selectedMonths: ["January", "February"],
        settings: {
          theme: "modern",
          paperSize: "A4",
        },
      };

      const response = await request(app)
        .post("/projects")
        .send(newProject)
        .expect(201);

      expect(response.body).toMatchObject(newProject);
      expect(response.body).toHaveProperty("id");
      expect(response.body).toHaveProperty("createdAt");
      expect(response.body).toHaveProperty("updatedAt");

      // Verify project was saved in database
      const saved = await prisma.calendar.findUnique({
        where: { id: response.body.id },
      });
      expect(saved).toBeTruthy();
      expect(saved?.name).toBe(newProject.name);
    });

    it("should return 400 when required fields are missing", async () => {
      // Test each required field individually
      const testCases = [
        {
          data: { year: 2025, selectedMonths: ["January"] },
          missing: "name",
        },
        {
          data: { name: "Test Calendar", selectedMonths: ["January"] },
          missing: "year",
        },
        {
          data: { name: "Test Calendar", year: 2025 },
          missing: "selectedMonths",
        },
        {
          data: {},
          missing: "all required fields",
        },
      ];

      for (const testCase of testCases) {
        const response = await request(app)
          .post("/projects")
          .send(testCase.data)
          .expect(400);

        expect(response.body).toHaveProperty(
          "error",
          "Missing required fields"
        );

        // Verify no project was created
        const count = await prisma.calendar.count();
        expect(count).toBe(0);
      }
    });
  });

  describe("GET /projects/:id", () => {
    it("should get a project by ID", async () => {
      // Create a project first
      const newProject = {
        name: "Test Calendar",
        year: 2025,
        selectedMonths: ["January", "February"],
        settings: {
          theme: "modern",
          paperSize: "A4",
        },
      };

      const createResponse = await request(app)
        .post("/projects")
        .send(newProject);

      // Get the project by ID
      const response = await request(app)
        .get(`/projects/${createResponse.body.id}`)
        .expect(200);

      expect(response.body).toMatchObject(newProject);
      expect(response.body.id).toBe(createResponse.body.id);
    });

    it("should return 404 when project doesn't exist", async () => {
      const nonExistentId = "non-existent-id";
      const response = await request(app)
        .get(`/projects/${nonExistentId}`)
        .expect(404);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("not found");
    });
  });

  describe("GET /projects", () => {
    it("should list all projects", async () => {
      // Create two projects first
      const projects = [
        {
          name: "Calendar 1",
          year: 2025,
          selectedMonths: ["January", "February"],
          settings: { theme: "modern" },
        },
        {
          name: "Calendar 2",
          year: 2026,
          selectedMonths: ["March", "April"],
          settings: { theme: "classic" },
        },
      ];

      for (const project of projects) {
        await request(app).post("/projects").send(project);
      }

      // Get all projects
      const response = await request(app).get("/projects").expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toMatchObject(projects[1]); // Most recent first
      expect(response.body[1]).toMatchObject(projects[0]);
    });

    it("should return empty array when no projects exist", async () => {
      const response = await request(app).get("/projects").expect(200);

      expect(response.body).toEqual([]);
    });
  });

  describe("PUT /projects/:id", () => {
    it("should update an existing project", async () => {
      // Create a project first
      const initialProject = {
        name: "Test Calendar",
        year: 2025,
        selectedMonths: ["January", "February"],
        settings: {
          theme: "modern",
          paperSize: "A4",
        },
      };

      const createResponse = await request(app)
        .post("/projects")
        .send(initialProject);

      // Update the project
      const updates = {
        name: "Updated Calendar",
        selectedMonths: ["March", "April", "May"],
        settings: {
          theme: "classic",
          paperSize: "Letter",
        },
      };

      const response = await request(app)
        .put(`/projects/${createResponse.body.id}`)
        .send(updates)
        .expect(200);

      // Check that response has updated values
      expect(response.body).toMatchObject({
        ...initialProject,
        ...updates,
        id: createResponse.body.id,
      });

      // Verify updates were saved to database
      const updated = await prisma.calendar.findUnique({
        where: { id: createResponse.body.id },
      });
      expect(updated).toBeTruthy();
      expect(updated?.name).toBe(updates.name);
      expect(updated?.selectedMonths).toEqual(updates.selectedMonths);
      expect(updated?.settings).toMatchObject(updates.settings);
    });

    it("should handle partial updates", async () => {
      // Create a project first
      const initialProject = {
        name: "Test Calendar",
        year: 2025,
        selectedMonths: ["January", "February"],
        settings: {
          theme: "modern",
          paperSize: "A4",
        },
      };

      const createResponse = await request(app)
        .post("/projects")
        .send(initialProject);

      // Update only the name
      const response = await request(app)
        .put(`/projects/${createResponse.body.id}`)
        .send({ name: "Updated Name Only" })
        .expect(200);

      // Check that only name was updated
      expect(response.body).toMatchObject({
        ...initialProject,
        name: "Updated Name Only",
        id: createResponse.body.id,
      });
    });

    it("should return 404 when updating non-existent project", async () => {
      const response = await request(app)
        .put("/projects/non-existent-id")
        .send({ name: "Updated Name" })
        .expect(404);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("not found");
    });
  });

  describe("DELETE /projects/:id", () => {
    it("should delete an existing project", async () => {
      // Create a project first
      const project = {
        name: "Test Calendar",
        year: 2025,
        selectedMonths: ["January", "February"],
        settings: {
          theme: "modern",
          paperSize: "A4",
        },
      };

      const createResponse = await request(app).post("/projects").send(project);

      // Delete the project
      await request(app)
        .delete(`/projects/${createResponse.body.id}`)
        .expect(204);

      // Verify project was deleted
      const deleted = await prisma.calendar.findUnique({
        where: { id: createResponse.body.id },
      });
      expect(deleted).toBeNull();
    });

    it("should return 404 when deleting non-existent project", async () => {
      const response = await request(app)
        .delete("/projects/non-existent-id")
        .expect(404);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("not found");
    });

    it("should delete project and its related events", async () => {
      // Create a project with events
      const project = {
        name: "Test Calendar",
        year: 2025,
        selectedMonths: ["January", "February"],
        settings: { theme: "modern" },
      };

      const createResponse = await request(app).post("/projects").send(project);

      // Add some events
      await prisma.event.createMany({
        data: [
          {
            title: "Event 1",
            date: "2025-01-01",
            calendarId: createResponse.body.id,
          },
          {
            title: "Event 2",
            date: "2025-02-01",
            calendarId: createResponse.body.id,
          },
        ],
      });

      // Delete the project
      await request(app)
        .delete(`/projects/${createResponse.body.id}`)
        .expect(204);

      // Verify project and events were deleted
      const [project_, events] = await Promise.all([
        prisma.calendar.findUnique({
          where: { id: createResponse.body.id },
        }),
        prisma.event.findMany({
          where: { calendarId: createResponse.body.id },
        }),
      ]);

      expect(project_).toBeNull();
      expect(events).toHaveLength(0);
    });
  });
});
