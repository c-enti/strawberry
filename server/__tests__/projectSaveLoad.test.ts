import request from "supertest";
import app from "../app";
import { prisma } from "../lib/prisma";
import { cleanupDatabase } from "./helpers/db";

describe("Project Save/Load API", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const sampleProject = {
    name: "Summer 2025 Calendar",
    description: "Family vacation planning",
    year: 2025,
    selectedMonths: ["June", "July", "August"],
    settings: {
      theme: {
        colors: ["#FF5733", "#33FF57"],
        layout: "grid",
      },
    },
  };

  describe("POST /projects", () => {
    it("should create a new project", async () => {
      const response = await request(app)
        .post("/projects")
        .send(sampleProject)
        .expect(201);

      expect(response.body).toMatchObject({
        ...sampleProject,
        id: expect.any(String),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it("should fail if required fields are missing", async () => {
      await request(app).post("/projects").send({}).expect(400);
    });
  });

  describe("GET /projects", () => {
    it("should list all projects", async () => {
      // Create two projects first
      await request(app).post("/projects").send(sampleProject);
      await request(app)
        .post("/projects")
        .send({
          ...sampleProject,
          name: "Winter 2025 Calendar",
        });

      const response = await request(app).get("/projects").expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toMatchObject({
        name: expect.any(String),
        year: expect.any(Number),
      });
    });
  });

  describe("GET /projects/:id", () => {
    it("should get a project by ID", async () => {
      const createResponse = await request(app)
        .post("/projects")
        .send(sampleProject);

      const response = await request(app)
        .get(`/projects/${createResponse.body.id}`)
        .expect(200);

      expect(response.body).toMatchObject(sampleProject);
    });

    it("should return 404 for non-existent project", async () => {
      await request(app).get("/projects/non-existent-id").expect(404);
    });
  });

  describe("PUT /projects/:id", () => {
    it("should update a project", async () => {
      const createResponse = await request(app)
        .post("/projects")
        .send(sampleProject);

      const updates = {
        name: "Updated Summer Calendar",
        settings: {
          theme: {
            colors: ["#000000"],
          },
        },
      };

      const response = await request(app)
        .put(`/projects/${createResponse.body.id}`)
        .send(updates)
        .expect(200);

      expect(response.body).toMatchObject({
        ...sampleProject,
        ...updates,
      });
    });
  });

  describe("DELETE /projects/:id", () => {
    it("should delete a project", async () => {
      const createResponse = await request(app)
        .post("/projects")
        .send(sampleProject);

      await request(app)
        .delete(`/projects/${createResponse.body.id}`)
        .expect(204);

      // Verify project is gone
      await request(app).get(`/projects/${createResponse.body.id}`).expect(404);
    });
  });
});
